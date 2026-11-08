import { utcToZonedLocal, zonedLocalToUtc } from './time'
import type { Reliability, TimeSource } from './types'
import { validLatLng } from './geo'

/** Metadados úteis de uma fotografia (lidos no dispositivo; nada é enviado antes de guardar). */
export interface PhotoMeta {
  /** "YYYY:MM:DD HH:MM:SS" tal como gravado pela câmara (hora local da câmara). */
  takenLocal: string | null
  /** "+01:00" quando a câmara grava o fuso (OffsetTimeOriginal). */
  offset: string | null
  gps: { lat: number; lng: number; accuracy: number | null } | null
  camera: string | null
}

export async function readPhotoMeta(file: Blob): Promise<PhotoMeta> {
  const empty: PhotoMeta = { takenLocal: null, offset: null, gps: null, camera: null }
  try {
    const exifr = (await import('exifr')).default
    const [raw, gps] = await Promise.all([
      exifr.parse(file, { reviveValues: false, pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal', 'OffsetTime', 'Make', 'Model', 'GPSHPositioningError'] }).catch(() => null),
      exifr.gps(file).catch(() => null),
    ])
    const taken = typeof raw?.DateTimeOriginal === 'string' ? raw.DateTimeOriginal : typeof raw?.CreateDate === 'string' ? raw.CreateDate : null
    const offset = typeof raw?.OffsetTimeOriginal === 'string' ? raw.OffsetTimeOriginal : typeof raw?.OffsetTime === 'string' ? raw.OffsetTime : null
    const err = typeof raw?.GPSHPositioningError === 'number' ? Math.round(raw.GPSHPositioningError) : null
    return {
      takenLocal: taken && /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}(:\d{2})?/.test(taken) ? taken.slice(0, 19) : null,
      offset: offset && /^[+-]\d{2}:\d{2}$/.test(offset.trim()) ? offset.trim() : null,
      gps: gps && validLatLng(gps.latitude, gps.longitude) ? { lat: gps.latitude, lng: gps.longitude, accuracy: err } : null,
      camera: [raw?.Make, raw?.Model].filter((x) => typeof x === 'string').join(' ').trim() || null,
    }
  } catch {
    return empty
  }
}

export interface ResolvedTime {
  occurredAt: string
  source: TimeSource
  reliability: Reliability
  /** Explicação apresentada ao utilizador. */
  note: string
}

const MIN_T = Date.UTC(1990, 0, 1)

/**
 * Hora do acontecimento a partir da fotografia.
 *  - EXIF com fuso: hora exata (fiabilidade alta).
 *  - EXIF sem fuso: interpretada no fuso escolhido (média: a câmara pode estar noutro fuso).
 *  - Sem EXIF: data do ficheiro (baixa: pode ser a data da cópia ou do download).
 *  - Fotografia tirada agora com a câmara: hora do dispositivo (alta).
 */
export function resolvePhotoTime(meta: PhotoMeta | null, tz: string, opts: { fileLastModified?: number; capturedNow?: boolean; now?: number } = {}): ResolvedTime {
  const now = opts.now ?? Date.now()
  const plausible = (t: number) => Number.isFinite(t) && t >= MIN_T && t <= now + 2 * 86400000
  if (meta?.takenLocal) {
    const [d, h] = meta.takenLocal.split(' ')
    const local = `${d.replace(/:/g, '-')}T${h.slice(0, 5)}`
    if (meta.offset) {
      const t = Date.parse(`${d.replace(/:/g, '-')}T${h}${meta.offset}`)
      if (plausible(t)) return { occurredAt: new Date(t).toISOString(), source: 'foto-exif', reliability: 'alta', note: 'Hora e fuso gravados pela câmara.' }
    } else {
      const iso = zonedLocalToUtc(local, tz)
      if (iso && plausible(Date.parse(iso)))
        return { occurredAt: iso, source: 'foto-exif', reliability: 'media', note: `Hora da câmara, sem fuso gravado: interpretada como hora de ${tz}. Confirme se a câmara estava certa.` }
    }
  }
  if (opts.capturedNow) return { occurredAt: new Date(now).toISOString(), source: 'dispositivo', reliability: 'alta', note: 'Fotografia tirada agora.' }
  if (opts.fileLastModified && plausible(opts.fileLastModified))
    return { occurredAt: new Date(opts.fileLastModified).toISOString(), source: 'dispositivo', reliability: 'baixa', note: 'A fotografia não tem data nos metadados: usada a data do ficheiro, que pode não ser a do momento. Confirme.' }
  return { occurredAt: new Date(now).toISOString(), source: 'dispositivo', reliability: 'media', note: 'Sem data na fotografia: usada a hora atual. Altere se o acontecimento foi noutro momento.' }
}

/** Valor para o campo de data/hora do formulário. */
export const toLocalInput = (iso: string, tz: string) => utcToZonedLocal(iso, tz)
