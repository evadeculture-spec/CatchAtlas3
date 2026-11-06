import { brand } from '../config/brand'
import type { Catch, Report } from '../data/types'
import { addDaysISO, diffDays, parseISODate, toISODate } from './dates'

export interface GiveawayPeriod {
  key: string
  start: string
  end: string
  label: string
}

/** Período atual do giveaway (mês ou semana de segunda a domingo), a partir da data de referência. */
export function currentPeriod(ref: string, frequency = brand.giveaway.frequency): GiveawayPeriod {
  const d = parseISODate(ref)
  if (frequency === 'semanal') {
    const dow = (d.getDay() + 6) % 7
    const start = addDaysISO(ref, -dow)
    const end = addDaysISO(start, 6)
    const jan1 = new Date(d.getFullYear(), 0, 1)
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + ((jan1.getDay() + 6) % 7) + 1) / 7)
    return { key: `${d.getFullYear()}-S${week}`, start, end, label: `semana de ${start.slice(8)}/${start.slice(5, 7)} a ${end.slice(8)}/${end.slice(5, 7)}` }
  }
  const start = toISODate(new Date(d.getFullYear(), d.getMonth(), 1, 12))
  const end = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))
  const month = new Intl.DateTimeFormat('pt-PT', { month: 'long' }).format(d)
  return { key: start.slice(0, 7), start, end, label: `${month} de ${d.getFullYear()}` }
}

export const daysLeft = (p: GiveawayPeriod, ref: string) => diffDays(p.end, ref)

/** Participações: 1 por captura pública e 1 por report no período, +2 para subscritores. */
export function countEntries(p: GiveawayPeriod, catches: Catch[], reports: Report[], subscribed: boolean) {
  const inP = (date: string) => date >= p.start && date <= p.end
  const c = catches.filter((x) => x.visibility === 'publica' && inP(x.date)).length
  const r = reports.filter((x) => inP(x.date)).length
  const bonus = subscribed ? 2 : 0
  return { catches: c, reports: r, bonus, total: Math.min(brand.giveaway.maxEntries, c + r + bonus) }
}
