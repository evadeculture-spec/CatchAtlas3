import type { Catch, SpeciesId } from '../data/types'
import { diffDays } from './dates'

export type RankMode = 'maior' | 'acumulado'
export type RankPeriod = '30' | '90' | '365' | 'sempre'

export const PERIODS: { id: RankPeriod; label: string }[] = [
  { id: '30', label: '30 dias' },
  { id: '90', label: '90 dias' },
  { id: '365', label: '12 meses' },
  { id: 'sempre', label: 'Sempre' },
]

export interface RankRow {
  anglerId: string
  valueG: number
  count: number
  best: Catch
}

export const isRankingEligible = (c: Catch) => c.visibility === 'publica' && c.ranking

/** Classificação comunitária: nunca mistura espécies. */
export function computeRanking(
  catches: Catch[],
  opts: { species: SpeciesId; damId: string | 'todas'; period: RankPeriod; mode: RankMode; ref: string },
): RankRow[] {
  const pool = catches.filter(
    (c) =>
      isRankingEligible(c) &&
      c.speciesId === opts.species &&
      (opts.damId === 'todas' || c.damId === opts.damId) &&
      (opts.period === 'sempre' || (diffDays(opts.ref, c.date) <= Number(opts.period) && diffDays(opts.ref, c.date) >= 0)),
  )
  const by = new Map<string, RankRow>()
  for (const c of pool) {
    const row = by.get(c.anglerId)
    if (!row) by.set(c.anglerId, { anglerId: c.anglerId, valueG: c.weightG, count: 1, best: c })
    else {
      row.count++
      if (c.weightG > row.best.weightG) row.best = c
      row.valueG = opts.mode === 'maior' ? row.best.weightG : row.valueG + c.weightG
    }
  }
  return [...by.values()].sort((a, b) => b.valueG - a.valueG || a.best.date.localeCompare(b.best.date))
}
