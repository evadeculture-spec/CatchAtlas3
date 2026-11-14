/**
 * Memória da câmara partilhada por TODOS os mapas (mesmo motor, mesma sessão do browser): ao mudar de módulo e
 * voltar, o mapa reabre na mesma região, zoom, inclinação, orientação e modo 2D/3D. Fica em sessionStorage
 * (por separador; não sai do dispositivo). Falhas de armazenamento nunca impedem o mapa de abrir.
 */
import type { CameraState } from '../../components/atlas/AtlasMap'

export interface SharedCamera {
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
  mode: '2d' | '3d'
}
const KEY = 'lanca-mapa-camera'

export function readCamera(): SharedCamera | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as SharedCamera | null
    if (!v || !Array.isArray(v.center) || !Number.isFinite(v.zoom)) return null
    return v
  } catch {
    return null
  }
}

let t: number | undefined
/** Guarda a câmara (com atraso curto: o mapa emite muitas vistas durante um gesto). */
export function writeCamera(c: Pick<CameraState, 'center' | 'zoom' | 'pitch' | 'bearing'>, mode: '2d' | '3d') {
  window.clearTimeout(t)
  t = window.setTimeout(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ center: c.center, zoom: c.zoom, pitch: mode === '2d' ? 0 : c.pitch, bearing: c.bearing, mode }))
    } catch {
      /* armazenamento indisponível: o mapa continua a funcionar */
    }
  }, 250)
}

/** Câmara inicial para o motor a partir da memória (ou nada: o motor enquadra a Península). */
export const memoryCamera = (): CameraState | undefined => {
  const c = readCamera()
  return c ? ({ center: c.center, zoom: c.zoom, pitch: c.mode === '2d' ? 0 : c.pitch, bearing: c.bearing } as CameraState) : undefined
}
export const memoryMode = (fallback: '2d' | '3d' = '3d'): '2d' | '3d' => readCamera()?.mode ?? fallback
