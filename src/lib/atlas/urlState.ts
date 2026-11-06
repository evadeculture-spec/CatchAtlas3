import type { CountryId } from '../../data/types'
import type { AtlasType } from './model'

/**
 * Estado do atlas no endereço (partilhável, sobrevive ao "voltar" depois de abrir uma ficha,
 * preparar jornada ou registar captura):
 *   sel=<id do registo>  troco=<id do troço>  pais=PT|ES  tipo=albufeira,rio  fav=1
 *   modo=2d  v=lng,lat,zoom,inclinação,rotação  painel=lista
 * Entradas a partir de outras páginas: ficha=<id da ficha>, agua=<id da albufeira>.
 */
export interface AtlasUrlState {
  sel: string | null
  section: string | null
  countries: CountryId[]
  types: AtlasType[]
  favOnly: boolean
  mode: '2d' | '3d'
  camera: { center: [number, number]; zoom: number; pitch: number; bearing: number } | null
  list: boolean
}

const TYPES: AtlasType[] = ['albufeira', 'rio', 'barragem']

export function parseAtlasUrl(p: URLSearchParams): AtlasUrlState {
  const pais = p.get('pais')
  const v = p.get('v')?.split(',').map(Number)
  const camera =
    v && v.length === 5 && v.every(Number.isFinite) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 85
      ? { center: [v[0], v[1]] as [number, number], zoom: v[2], pitch: v[3], bearing: v[4] }
      : null
  return {
    sel: p.get('sel'),
    section: p.get('troco'),
    countries: pais === 'PT' || pais === 'ES' ? [pais] : [],
    types: (p.get('tipo')?.split(',') ?? []).filter((t): t is AtlasType => TYPES.includes(t as AtlasType)),
    favOnly: p.get('fav') === '1',
    mode: p.get('modo') === '2d' ? '2d' : '3d',
    camera,
    list: p.get('painel') === 'lista',
  }
}

export function cameraParam(c: { center: [number, number]; zoom: number; pitch: number; bearing: number }) {
  return [c.center[0].toFixed(4), c.center[1].toFixed(4), c.zoom.toFixed(2), c.pitch.toFixed(0), c.bearing.toFixed(0)].join(',')
}

/** Aplica alterações ao URL atual (null remove o parâmetro). */
export function patchParams(p: URLSearchParams, patch: Record<string, string | null | undefined>) {
  const next = new URLSearchParams(p)
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if (v === null || v === '') next.delete(k)
    else next.set(k, v)
  }
  return next
}

/** URLs dos fluxos existentes com o local pré-selecionado (mesmo ID da ficha). */
export const flowUrls = (catalogId: string) => ({
  ficha: `/barragens/${encodeURIComponent(catalogId)}`,
  jornada: `/jornada/nova?barragem=${encodeURIComponent(catalogId)}`,
  captura: `/capturas/nova?barragem=${encodeURIComponent(catalogId)}`,
})
