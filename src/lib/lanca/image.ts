/**
 * Preparação das fotografias no dispositivo, antes do envio:
 *  - original: o ficheiro tal como está (fica no bucket privado; inclui os metadados originais);
 *  - display (≤ 2048 px) e thumb (≤ 480 px): reencodados no canvas, o que REMOVE os metadados EXIF
 *    (incluindo GPS) das versões usadas para mostrar a fotografia.
 * HEIC/HEIF que o browser não consiga descodificar: guarda-se só o original (sem pré-visualização).
 */
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024
export const DISPLAY_PX = 2048
export const THUMB_PX = 480
export const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export interface PreparedImage {
  original: Blob
  originalMime: string
  display: Blob | null
  thumb: Blob | null
  width: number | null
  height: number | null
  /** Pré-visualização local (object URL) — revogar quando já não for precisa. */
  previewUrl: string
  warning: string | null
}

export function fitWithin(w: number, h: number, max: number): [number, number] {
  if (w <= max && h <= max) return [w, h]
  const s = max / Math.max(w, h)
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))]
}

async function encode(bmp: ImageBitmap, max: number, quality: number): Promise<Blob | null> {
  const [w, h] = fitWithin(bmp.width, bmp.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality))
  if (blob && blob.type === 'image/webp') return blob
  return new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
}

export function guessMime(file: File): string {
  if (file.type) return file.type
  const n = file.name.toLowerCase()
  if (n.endsWith('.heic')) return 'image/heic'
  if (n.endsWith('.heif')) return 'image/heif'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const mime = guessMime(file)
  if (!ACCEPTED.includes(mime)) throw new Error('Formato não suportado. Use JPEG, PNG, WebP ou HEIC.')
  const bmp: ImageBitmap | null = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)
  if (!bmp) {
    if (file.size > MAX_ORIGINAL_BYTES) throw new Error('Fotografia demasiado grande (máximo 15 MB).')
    return { original: file, originalMime: mime, display: null, thumb: null, width: null, height: null, previewUrl: '', warning: 'Este navegador não consegue mostrar este formato: a fotografia é guardada sem pré-visualização.' }
  }
  const display = await encode(bmp, DISPLAY_PX, 0.85)
  const thumb = await encode(bmp, THUMB_PX, 0.78)
  const width = bmp.width
  const height = bmp.height
  bmp.close()
  let original: Blob = file
  let originalMime = mime
  let warning: string | null = null
  if (file.size > MAX_ORIGINAL_BYTES) {
    if (!display) throw new Error('Fotografia demasiado grande (máximo 15 MB).')
    // Original acima do limite: guarda-se a versão de 2048 px como original (fica registado).
    original = display
    originalMime = display.type
    warning = 'A fotografia original excede 15 MB: foi guardada a versão reduzida (2048 px).'
  }
  return { original, originalMime, display, thumb, width, height, previewUrl: URL.createObjectURL(display ?? file), warning }
}

export const extFor = (mime: string) => (mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : mime === 'image/heic' ? 'heic' : mime === 'image/heif' ? 'heif' : 'jpg')
