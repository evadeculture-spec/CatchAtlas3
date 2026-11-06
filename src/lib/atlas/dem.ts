import * as maplibregl from 'maplibre-gl'
import type { DemEncoding } from './config'

/**
 * Relevo terrestre sem batimetria.
 *
 * Os Terrain Tiles incluem a profundidade do mar (valores negativos). Mostrá-la como relevo seria
 * confundir batimetria com terreno (e o mar "afundaria" com o terreno 3D). Este protocolo
 * descarrega o tile, põe a 0 m todas as cotas negativas e entrega a imagem ao MapLibre.
 * Pedidos cancelados pelo MapLibre (tiles que deixaram de ser precisos) abortam o fetch.
 */
export const DEM_PROTOCOL = 'atlasdem'
let registeredFor = ''
/** Recebe o resultado de cada tile (o mapa montado no momento; o protocolo é global). */
let listener: ((ok: boolean) => void) | undefined

/** Limiar no espaço de cores para cada codificação (valor que representa 0 m). */
export function clampNegativeElevation(px: Uint8ClampedArray, encoding: DemEncoding) {
  for (let i = 0; i < px.length; i += 4) {
    if (encoding === 'terrarium') {
      // h = R·256 + G + B/256 − 32768  →  negativo quando R < 128
      if (px[i] < 128) {
        px[i] = 128
        px[i + 1] = 0
        px[i + 2] = 0
      }
    } else {
      // Mapbox Terrain-RGB: h = −10000 + (R·65536 + G·256 + B)·0,1  →  0 m = 100000
      const v = px[i] * 65536 + px[i + 1] * 256 + px[i + 2]
      if (v < 100000) {
        px[i] = 1
        px[i + 1] = 134
        px[i + 2] = 160
      }
    }
    px[i + 3] = 255
  }
}

export function decodeElevation(r: number, g: number, b: number, encoding: DemEncoding) {
  return encoding === 'terrarium' ? r * 256 + g + b / 256 - 32768 : -10000 + (r * 65536 + g * 256 + b) * 0.1
}

export function registerDemProtocol(template: string, encoding: DemEncoding, onResult?: (ok: boolean) => void) {
  listener = onResult
  const key = `${template}|${encoding}`
  if (registeredFor === key) return
  registeredFor = key
  maplibregl.removeProtocol(DEM_PROTOCOL)
  maplibregl.addProtocol(DEM_PROTOCOL, async (params, abort) => {
    const m = params.url.match(/(\d+)\/(\d+)\/(\d+)$/)
    if (!m) throw new Error(`DEM: URL inválido ${params.url}`)
    const url = template.replace('{z}', m[1]).replace('{x}', m[2]).replace('{y}', m[3])
    let res: Response
    try {
      res = await fetch(url, { signal: abort.signal, mode: 'cors' })
    } catch (e) {
      if (!abort.signal.aborted) listener?.(false)
      throw e
    }
    if (!res.ok) {
      listener?.(false)
      throw new Error(`DEM ${res.status}`)
    }
    const bmp = await createImageBitmap(await res.blob())
    const canvas = new OffscreenCanvas(bmp.width, bmp.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return { data: bmp }
    ctx.drawImage(bmp, 0, 0)
    bmp.close()
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    clampNegativeElevation(img.data, encoding)
    listener?.(true)
    return { data: await createImageBitmap(img) }
  })
}
