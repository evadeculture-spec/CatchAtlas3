/**
 * Fishing Intelligence — estatística DESCRITIVA sobre os registos do próprio pescador.
 *
 * Princípios (não negociáveis):
 *  - Só dados reais do utilizador. Cada número vem com o tamanho da amostra (n).
 *  - Abaixo de MIN_SAMPLE, o grupo é mostrado como "amostra insuficiente" e não entra em destaques.
 *  - Correlação não é causalidade: os textos descrevem o que aconteceu, nunca prometem resultados.
 *  - Sem probabilidades de captura. O índice de semelhança compara condições (0–100), com os
 *    fatores usados e os que faltaram, e não é uma probabilidade.
 *  - Sem modelos de aprendizagem automática nesta fase.
 */
import type { PingFull } from './types'
import { localHour, localMonth } from './time'

export const MIN_SAMPLE = 5

/** Sessões de pesca (excluem observações, condições e eventos). */
export const isSession = (p: Pick<PingFull, 'kind'>) => p.kind === 'captura' || p.kind === 'tentativa' || p.kind === 'sem-captura'
export const isSuccess = (p: Pick<PingFull, 'kind' | 'outcome' | 'catches' | 'catch_count'>) =>
  p.kind === 'captura' || p.outcome === 'sucesso' || (p.catch_count ?? 0) > 0 || (p.catches?.length ?? 0) > 0

export interface Bucket {
  key: string
  label: string
  n: number
  successes: number
  /** Proporção observada (sucessos / sessões), null se n = 0. */
  rate: number | null
  sufficient: boolean
}

function bucketize<T extends PingFull>(pings: T[], keyOf: (p: T) => { key: string; label: string } | null, order?: string[]): Bucket[] {
  const map = new Map<string, Bucket>()
  for (const p of pings) {
    const k = keyOf(p)
    if (!k) continue
    const b = map.get(k.key) ?? { key: k.key, label: k.label, n: 0, successes: 0, rate: null, sufficient: false }
    b.n++
    if (isSuccess(p)) b.successes++
    map.set(k.key, b)
  }
  const out = [...map.values()].map((b) => ({ ...b, rate: b.n ? b.successes / b.n : null, sufficient: b.n >= MIN_SAMPLE }))
  if (order) out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  else out.sort((a, b) => b.n - a.n)
  return out
}

export const DAY_PERIODS = [
  { key: 'madrugada', label: 'Madrugada (0–6 h)', from: 0, to: 6 },
  { key: 'manha', label: 'Manhã (6–12 h)', from: 6, to: 12 },
  { key: 'tarde', label: 'Tarde (12–18 h)', from: 12, to: 18 },
  { key: 'noite', label: 'Noite (18–24 h)', from: 18, to: 24 },
]
export const SEASONS = [
  { key: 'inverno', label: 'Inverno (dez–fev)', months: [12, 1, 2] },
  { key: 'primavera', label: 'Primavera (mar–mai)', months: [3, 4, 5] },
  { key: 'verao', label: 'Verão (jun–ago)', months: [6, 7, 8] },
  { key: 'outono', label: 'Outono (set–nov)', months: [9, 10, 11] },
]

export type PressureClass = 'subir' | 'estavel' | 'descer'
export function pressureClass(trend3h: number | null | undefined): PressureClass | null {
  if (trend3h == null) return null
  if (trend3h >= 1) return 'subir'
  if (trend3h <= -1) return 'descer'
  return 'estavel'
}
export const PRESSURE_LABEL: Record<PressureClass, string> = { subir: 'A subir (≥ +1 hPa/3 h)', estavel: 'Estável', descer: 'A descer (≤ −1 hPa/3 h)' }

export function moonGroup(phase: number | null | undefined): { key: string; label: string } | null {
  if (phase == null) return null
  const p = ((phase % 1) + 1) % 1
  if (p < 0.125 || p >= 0.875) return { key: 'nova', label: 'Lua nova (±3 dias)' }
  if (p < 0.375) return { key: 'crescente', label: 'Crescente' }
  if (p < 0.625) return { key: 'cheia', label: 'Lua cheia (±3 dias)' }
  return { key: 'minguante', label: 'Minguante' }
}

const band = (v: number | null | undefined, edges: number[], labels: string[]) => {
  if (v == null) return null
  let i = 0
  while (i < edges.length && v >= edges[i]) i++
  return { key: String(i), label: labels[i] }
}

export interface IntelligenceReport {
  sessions: number
  successes: number
  withConditions: number
  firstAt: string | null
  lastAt: string | null
  byPeriod: Bucket[]
  bySeason: Bucket[]
  byPressure: Bucket[]
  byMoon: Bucket[]
  byTemp: Bucket[]
  byWind: Bucket[]
  byPin: Bucket[]
  byTechnique: Bucket[]
  byBait: Bucket[]
  bySpecies: { species: string; count: number; maxLengthCm: number | null; maxWeightG: number | null; released: number }[]
  highlights: string[]
}

export function analyse(all: PingFull[]): IntelligenceReport {
  const s = all.filter(isSession)
  const env = (p: PingFull) => p.ping_environment
  const sorted = [...s].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const report: IntelligenceReport = {
    sessions: s.length,
    successes: s.filter(isSuccess).length,
    withConditions: s.filter((p) => env(p)?.air_temp_c != null).length,
    firstAt: sorted[0]?.occurred_at ?? null,
    lastAt: sorted.at(-1)?.occurred_at ?? null,
    byPeriod: bucketize(s, (p) => {
      const h = localHour(p.occurred_at, p.occurred_tz)
      const d = DAY_PERIODS.find((x) => h >= x.from && h < x.to)!
      return { key: d.key, label: d.label }
    }, DAY_PERIODS.map((d) => d.key)),
    bySeason: bucketize(s, (p) => {
      const m = localMonth(p.occurred_at, p.occurred_tz)
      const d = SEASONS.find((x) => x.months.includes(m))!
      return { key: d.key, label: d.label }
    }, SEASONS.map((d) => d.key)),
    byPressure: bucketize(s, (p) => {
      const c = pressureClass(env(p)?.pressure_trend_3h_hpa)
      return c ? { key: c, label: PRESSURE_LABEL[c] } : null
    }, ['descer', 'estavel', 'subir']),
    byMoon: bucketize(s, (p) => moonGroup(env(p)?.moon_phase), ['nova', 'crescente', 'cheia', 'minguante']),
    byTemp: bucketize(s, (p) => band(env(p)?.air_temp_c, [10, 15, 20, 25], ['< 10 °C', '10–15 °C', '15–20 °C', '20–25 °C', '≥ 25 °C']), ['0', '1', '2', '3', '4']),
    byWind: bucketize(s, (p) => band(env(p)?.wind_kmh, [10, 25], ['Fraco (< 10 km/h)', 'Moderado (10–25 km/h)', 'Forte (≥ 25 km/h)']), ['0', '1', '2']),
    byPin: bucketize(s, (p) => (p.pin ? { key: p.pin.id, label: p.pin.name } : null)),
    byTechnique: bucketize(s, (p) => (p.technique ? { key: p.technique.toLowerCase(), label: p.technique } : null)),
    byBait: bucketize(s, (p) => (p.bait ? { key: p.bait.toLowerCase(), label: p.bait } : null)),
    bySpecies: speciesSummary(all),
    highlights: [],
  }
  report.highlights = highlights(report)
  return report
}

export function speciesSummary(pings: PingFull[]) {
  const m = new Map<string, { species: string; count: number; maxLengthCm: number | null; maxWeightG: number | null; released: number }>()
  for (const p of pings)
    for (const c of p.catches ?? []) {
      const k = c.species.trim().toLowerCase()
      const e = m.get(k) ?? { species: c.species.trim(), count: 0, maxLengthCm: null, maxWeightG: null, released: 0 }
      e.count++
      if (c.length_cm != null) e.maxLengthCm = Math.max(e.maxLengthCm ?? 0, c.length_cm)
      if (c.weight_g != null) e.maxWeightG = Math.max(e.maxWeightG ?? 0, c.weight_g)
      if (c.released) e.released++
      m.set(k, e)
    }
  return [...m.values()].sort((a, b) => b.count - a.count)
}

const pct = (r: number) => `${Math.round(r * 100)} %`

/** Frases descritivas só com grupos de amostra suficiente e diferença clara face ao global. */
export function highlights(r: IntelligenceReport): string[] {
  if (r.sessions < MIN_SAMPLE) return []
  const overall = r.successes / r.sessions
  const out: string[] = []
  const groups: [string, Bucket[]][] = [
    ['período do dia', r.byPeriod],
    ['estação', r.bySeason],
    ['tendência da pressão', r.byPressure],
    ['fase da lua', r.byMoon],
    ['temperatura do ar', r.byTemp],
    ['local', r.byPin],
    ['técnica', r.byTechnique],
  ]
  for (const [name, bs] of groups) {
    const ok = bs.filter((b) => b.sufficient && b.rate !== null)
    if (ok.length < 2) continue
    const best = ok.reduce((a, b) => ((b.rate ?? 0) > (a.rate ?? 0) ? b : a))
    if ((best.rate ?? 0) - overall >= 0.15)
      out.push(`Por ${name}: "${best.label}" teve sucesso em ${best.successes} de ${best.n} sessões (${pct(best.rate!)}), acima da sua média de ${pct(overall)}.`)
  }
  return out.slice(0, 4)
}

// ------------------------------------------------------------------ índice de semelhança
export interface ConditionVector {
  month?: number | null
  hour?: number | null
  airTempC?: number | null
  pressureTrend?: number | null
  windKmh?: number | null
  moonPhase?: number | null
}

export interface SimilarityFactor {
  key: keyof ConditionVector
  label: string
  similarity: number
  detail: string
}

export interface Similarity {
  score: number
  factors: SimilarityFactor[]
  missing: string[]
}

const FACTOR_LABEL: Record<keyof ConditionVector, string> = { month: 'Época do ano', hour: 'Hora do dia', airTempC: 'Temperatura do ar', pressureTrend: 'Tendência da pressão', windKmh: 'Vento', moonPhase: 'Fase da lua' }
/** Pesos iguais: sem evidência para dar mais peso a um fator do que a outro. */
export const FACTOR_WEIGHT: Record<keyof ConditionVector, number> = { month: 1, hour: 1, airTempC: 1, pressureTrend: 1, windKmh: 1, moonPhase: 1 }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const circ = (a: number, b: number, period: number) => {
  const d = Math.abs(a - b) % period
  return Math.min(d, period - d)
}

/**
 * Semelhança (0–100) entre as condições previstas e as de um registo passado. Usa só os fatores
 * disponíveis nos dois lados e devolve-os explicados. NÃO é uma probabilidade de captura.
 */
export function similarity(target: ConditionVector, past: ConditionVector): Similarity {
  const factors: SimilarityFactor[] = []
  const missing: string[] = []
  const add = (key: keyof ConditionVector, sim: number, detail: string) => factors.push({ key, label: FACTOR_LABEL[key], similarity: clamp01(sim), detail })
  const both = (k: keyof ConditionVector) => target[k] != null && past[k] != null
  for (const k of Object.keys(FACTOR_LABEL) as (keyof ConditionVector)[]) {
    if (!both(k)) {
      missing.push(FACTOR_LABEL[k])
      continue
    }
    const t = target[k] as number
    const p = past[k] as number
    switch (k) {
      case 'month': {
        const d = circ(t, p, 12)
        add(k, 1 - d / 6, d === 0 ? 'mesmo mês' : `${d} ${d === 1 ? 'mês' : 'meses'} de diferença`)
        break
      }
      case 'hour': {
        const d = circ(t, p, 24)
        add(k, 1 - d / 12, d === 0 ? 'mesma hora' : `${d} h de diferença`)
        break
      }
      case 'airTempC': {
        const d = Math.abs(t - p)
        add(k, 1 - d / 10, `${d.toFixed(1)} °C de diferença`)
        break
      }
      case 'pressureTrend': {
        const ct = pressureClass(t)!
        const cp = pressureClass(p)!
        const order = ['descer', 'estavel', 'subir']
        const d = Math.abs(order.indexOf(ct) - order.indexOf(cp))
        add(k, 1 - d / 2, ct === cp ? `ambas ${PRESSURE_LABEL[ct].toLowerCase()}` : `${PRESSURE_LABEL[ct].toLowerCase()} vs ${PRESSURE_LABEL[cp].toLowerCase()}`)
        break
      }
      case 'windKmh': {
        const d = Math.abs(t - p)
        add(k, 1 - d / 20, `${Math.round(d)} km/h de diferença`)
        break
      }
      case 'moonPhase': {
        const d = circ(t, p, 1)
        add(k, 1 - d / 0.5, `${Math.round(d * 29.53)} dias de ciclo lunar de diferença`)
        break
      }
    }
  }
  const wsum = factors.reduce((s, f) => s + FACTOR_WEIGHT[f.key], 0)
  const score = wsum ? Math.round((factors.reduce((s, f) => s + f.similarity * FACTOR_WEIGHT[f.key], 0) / wsum) * 100) : 0
  return { score, factors, missing }
}

export function vectorOf(p: PingFull): ConditionVector {
  const e = p.ping_environment
  return {
    month: localMonth(p.occurred_at, p.occurred_tz),
    hour: localHour(p.occurred_at, p.occurred_tz),
    airTempC: e?.air_temp_c ?? null,
    pressureTrend: e?.pressure_trend_3h_hpa ?? null,
    windKmh: e?.wind_kmh ?? null,
    moonPhase: e?.moon_phase ?? null,
  }
}

export interface SimilarSession {
  ping: PingFull
  sim: Similarity
}

/** Sessões passadas mais semelhantes (exige pelo menos 3 fatores comparáveis). */
export function mostSimilar(target: ConditionVector, pings: PingFull[], limit = 5): SimilarSession[] {
  return pings
    .filter(isSession)
    .map((p) => ({ ping: p, sim: similarity(target, vectorOf(p)) }))
    .filter((x) => x.sim.factors.length >= 3)
    .sort((a, b) => b.sim.score - a.sim.score)
    .slice(0, limit)
}
