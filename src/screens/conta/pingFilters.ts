import type { PingFull, PingKind } from '../../lib/lanca/types'

export interface PingFilter {
  kinds: PingKind[]
  species: string
  modality: string
  period: 'tudo' | '30d' | '12m' | 'ano'
}
export const DEFAULT_FILTER: PingFilter = { kinds: [], species: '', modality: '', period: 'tudo' }

export function applyFilter(pings: PingFull[], f: PingFilter, now = Date.now()) {
  const since = f.period === '30d' ? now - 30 * 86400000 : f.period === '12m' ? now - 365 * 86400000 : f.period === 'ano' ? Date.UTC(new Date(now).getUTCFullYear(), 0, 1) : 0
  const sp = f.species.trim().toLowerCase()
  return pings.filter(
    (p) =>
      (!f.kinds.length || f.kinds.includes(p.kind)) &&
      (!f.modality || p.modality === f.modality) &&
      (!sp || p.catches.some((c) => c.species.toLowerCase().includes(sp))) &&
      Date.parse(p.occurred_at) >= since,
  )
}
