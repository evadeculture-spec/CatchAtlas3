import { brand } from '../config/brand'

// Fotografias das capturas: comprimidas no navegador e guardadas em IndexedDB (não em localStorage).
const STORE = 'photos'
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_INPUT_BYTES = 15 * 1024 * 1024
const MAX_SIDE = 1400

export class PhotoError extends Error {}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new PhotoError('Este navegador não permite guardar fotografias.'))
    const req = indexedDB.open(brand.photoDbName, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new PhotoError('Não foi possível abrir o armazenamento local de fotografias.'))
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req.result)
    t.onerror = () => {
      const err = t.error
      reject(
        new PhotoError(
          err?.name === 'QuotaExceededError'
            ? 'Sem espaço no armazenamento deste navegador. Elimine fotografias antigas e tente novamente.'
            : 'Não foi possível guardar a fotografia.',
        ),
      )
    }
    t.onabort = t.onerror
  })
}

export const savePhoto = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id))
export const loadPhoto = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id)).catch(() => undefined)
export const clearPhotos = () => tx('readwrite', (s) => s.clear()).catch(() => undefined)

export function validatePhoto(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return 'Formato não suportado. Use JPEG, PNG ou WebP.'
  if (file.size > MAX_INPUT_BYTES) return 'A fotografia excede 15 MB. Escolha uma imagem mais pequena.'
  return null
}

/** Redimensiona para no máximo 1400 px e comprime em JPEG. */
export async function compressPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new PhotoError('Não foi possível ler esta imagem.'))
      img.src = URL.createObjectURL(file)
    })
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError('Não foi possível processar a imagem.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
  if (!blob) throw new PhotoError('Não foi possível comprimir a imagem.')
  return blob
}
