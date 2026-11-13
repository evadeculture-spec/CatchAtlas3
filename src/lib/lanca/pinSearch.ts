/**
 * «Os meus pins» — pesquisa de pins (regras puras + chamada ao servidor).
 *
 * O servidor (`search_pins`) é a fonte de verdade: aplica permissões, precisão pública, filtros e contagens
 * sobre o conjunto completo autorizado. `matchesLocal` replica as MESMAS regras para os pins ainda guardados
 * só no dispositivo (por sincronizar), para que mapa e contagens não mudem quando a sincronização termina.
 *
 * Regras (iguais no servidor e aqui):
 *  - Cada critério é opcional, independente e combinável. Um critério que exige um dado (espécie, peso,
 *    data, hora, local) exclui os registos sem esse dado; sem esse critério, o dado em falta não exclui nada.
 *  - Peso: «mais de» (>), «menos de» (<) ou «exatamente» (=), comparado em gramas (aceita vírgula decimal).
 *  - Datas: início e fim inclusivos sobre a data LOCAL da captura (fuso do local onde ocorreu).
 *    «Repetir em todos os anos» compara só mês e dia; um intervalo de dezembro a janeiro dá a volta ao ano.
 *    29 de fevereiro só existe em anos bissextos (nunca se transforma em 28 de fevereiro ou 1 de março).
 *  - Horas: minutos do dia LOCAL; o fim inclui todo o minuto escolhido (12h00 inclui 12h00:59, exclui 12h01).
 *    Uma janela que atravessa a meia-noite (ex.: 22h–02h) atribui a madrugada ao dia em que a jornada começou:
 *    selecionar só o dia 13 inclui até às 02h00 do dia 14 e exclui a madrugada do próprio dia 13.
 */
import { sb } from './supabase'

export type WeightOp = 'gt' | 'lt' | 'eq'
export interface WaterChoice {
  ref: string
  name: string
  region?: string
}
export interface PinFilter {
  species: string[]
  water: WaterChoice | null
  weight: { op: WeightOp; grams: number } | null
  dateFrom: string | null // AAAA-MM-DD
  dateTo: string | null
  yearly: boolean
  timeFrom: string | null // HH:MM
  timeTo: string | null
}
export const EMPTY_FILTER: PinFilter = { species: [], water: null, weight: null, dateFrom: null, dateTo: null, yearly: false, timeFrom: null, timeTo: null }

export type Precision = 'exato' | 'zona'
export type Visibility = 'privado' | 'zona' | 'exato'
export interface PinRow {
  source: 'mine' | 'comm' | 'local'
  id: string
  kind: string
  lat: number
  lng: number
  precision: Precision
  visibility: Visibility
  species: string | null
  weight_g: number | null
  occurred_at: string | null
  occurred_tz: string | null
  zone_id: string | null
  water_body_ref: string | null
  water_body_name: string | null
  photo_path: string | null
  photo_bucket: string | null
  label: string | null
}
export interface SearchResult {
  rows: PinRow[]
  total: number
  inView: number
}

// ------------------------------------------------------------------ entradas
/** Peso em kg (aceita «2,1», «2.1», «2 kg») → gramas inteiras; null se inválido. */
export function parseKg(input: string): number | null {
  const t = input.trim().toLowerCase().replace(/\s*kg$/, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const g = Math.round(Number(t) * 1000)
  return g > 0 && g <= 300000 ? g : null
}
export const formatKg = (g: number) => `${(g / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 3 })} kg`

/** «HH:MM» → minutos do dia; null se inválido. */
export function minutesOf(hhmm: string | null): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1]), mi = Number(m[2])
  return h < 24 && mi < 60 ? h * 60 + mi : null
}

export const filterActive = (f: PinFilter) =>
  f.species.length > 0 || !!f.water || !!f.weight || !!f.dateFrom || !!f.dateTo || !!f.timeFrom || !!f.timeTo

// ------------------------------------------------------------------ regras (cliente, iguais às do servidor)
/** Data e minutos locais de um instante no fuso indicado (fuso inválido → UTC, como no servidor). */
export function localParts(iso: string, tz: string | null): { y: number; m: number; d: number; min: number } {
  const fmt = (zone: string) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(iso))
        .map((p) => [p.type, p.value]),
    )
  let p: Record<string, string>
  try {
    p = fmt(tz || 'Europe/Lisbon')
  } catch {
    p = fmt('UTC')
  }
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), min: Number(p.hour) * 60 + Number(p.minute) }
}
const ymd = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
function prevDay(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1, d) - 86400000)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}
const md = (iso: string) => Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10))

export interface Matchable {
  species: string | null
  weight_g: number | null
  occurred_at: string | null
  occurred_tz: string | null
  water_body_ref: string | null
}
export function matches(r: Matchable, f: PinFilter): boolean {
  if (f.species.length) {
    const want = f.species.map((s) => s.trim().toLowerCase())
    if (!r.species || !want.includes(r.species.trim().toLowerCase())) return false
  }
  if (f.water && r.water_body_ref !== f.water.ref) return false
  if (f.weight) {
    if (r.weight_g == null) return false
    const w = r.weight_g, x = f.weight.grams
    if (f.weight.op === 'gt' ? !(w > x) : f.weight.op === 'lt' ? !(w < x) : w !== x) return false
  }
  const tFrom = minutesOf(f.timeFrom), tTo = minutesOf(f.timeTo)
  const timeActive = tFrom != null || tTo != null
  const dateActive = !!f.dateFrom || !!f.dateTo
  if (!timeActive && !dateActive) return true
  if (!r.occurred_at) return false
  const lp = localParts(r.occurred_at, r.occurred_tz)
  const from = tFrom ?? 0, to = tTo ?? 1439
  const overnight = timeActive && from > to
  if (timeActive && !(overnight ? lp.min >= from || lp.min <= to : lp.min >= from && lp.min <= to)) return false
  if (!dateActive) return true
  // Dia da jornada de pesquisa: numa janela noturna, a madrugada pertence ao dia anterior.
  const s = overnight && lp.min <= to ? prevDay(lp.y, lp.m, lp.d) : { y: lp.y, m: lp.m, d: lp.d }
  const sday = ymd(s.y, s.m, s.d)
  if (f.yearly) {
    const a = f.dateFrom ? md(f.dateFrom) : 101
    const b = f.dateTo ? md(f.dateTo) : 1231
    const v = s.m * 100 + s.d
    return a <= b ? v >= a && v <= b : v >= a || v <= b
  }
  return (!f.dateFrom || sday >= f.dateFrom) && (!f.dateTo || sday <= f.dateTo)
}

// ------------------------------------------------------------------ ordenação e agrupamento
/** Da captura mais recente para a mais antiga; o ID desempata; datas desconhecidas no fim. */
export function sortReports<T extends { id: string; occurred_at: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.occurred_at && b.occurred_at) {
      const d = Date.parse(b.occurred_at) - Date.parse(a.occurred_at)
      if (d) return d
    } else if (a.occurred_at || b.occurred_at) return a.occurred_at ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * Junta os resultados do servidor e os pins só locais (por sincronizar), contando cada registo uma vez pelo
 * seu identificador persistente. `inView` usa o ponto de apresentação autorizado.
 */
export function mergeLocal(server: SearchResult, local: PinRow[], f: PinFilter, bounds: [number, number, number, number] | null): SearchResult {
  const ids = new Set(server.rows.map((r) => r.id))
  const extra = local.filter((p) => !ids.has(p.id) && matches(p, f))
  const inB = (r: PinRow) => !bounds || (r.lng >= bounds[0] && r.lng <= bounds[2] && r.lat >= bounds[1] && r.lat <= bounds[3])
  return { rows: [...server.rows, ...extra], total: server.total + extra.length, inView: server.inView + extra.filter(inB).length }
}

// ------------------------------------------------------------------ descrição (filtros ativos)
const fmtDay = (iso: string, yearly: boolean) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', ...(yearly ? {} : { year: 'numeric' }), timeZone: 'UTC' })
}
export type ChipKey = 'species' | 'water' | 'weight' | 'dates' | 'hours'
export function activeChips(f: PinFilter): { key: ChipKey; label: string }[] {
  const out: { key: ChipKey; label: string }[] = []
  if (f.species.length) out.push({ key: 'species', label: f.species.join(', ') })
  if (f.water) out.push({ key: 'water', label: f.water.name })
  if (f.weight) out.push({ key: 'weight', label: `${f.weight.op === 'gt' ? 'Mais de' : f.weight.op === 'lt' ? 'Menos de' : 'Exatamente'} ${formatKg(f.weight.grams)}` })
  if (f.dateFrom || f.dateTo)
    out.push({ key: 'dates', label: `${f.dateFrom ? fmtDay(f.dateFrom, f.yearly) : 'Início'} – ${f.dateTo ? fmtDay(f.dateTo, f.yearly) : 'hoje'}${f.yearly ? ' · todos os anos' : ''}` })
  if (f.timeFrom || f.timeTo) out.push({ key: 'hours', label: `${f.timeFrom ?? '00:00'}–${f.timeTo ?? '23:59'}` })
  return out
}
export function removeChip(f: PinFilter, key: ChipKey): PinFilter {
  if (key === 'species') return { ...f, species: [] }
  if (key === 'water') return { ...f, water: null }
  if (key === 'weight') return { ...f, weight: null }
  if (key === 'dates') return { ...f, dateFrom: null, dateTo: null, yearly: false }
  return { ...f, timeFrom: null, timeTo: null }
}

// ------------------------------------------------------------------ servidor
export function rpcParams(f: PinFilter, community: boolean, view: [number, number, number, number] | null) {
  return {
    p_community: community,
    p_west: view?.[0] ?? -180,
    p_south: view?.[1] ?? -90,
    p_east: view?.[2] ?? 180,
    p_north: view?.[3] ?? 90,
    p_species: f.species.length ? f.species : null,
    p_water: f.water?.ref ?? null,
    p_weight_op: f.weight?.op ?? null,
    p_weight_g: f.weight?.grams ?? null,
    p_date_from: f.dateFrom,
    p_date_to: f.dateTo,
    p_yearly: f.yearly,
    p_min_from: minutesOf(f.timeFrom),
    p_min_to: minutesOf(f.timeTo),
    p_limit: 2000,
  }
}

type RpcRow = Omit<PinRow, 'source'> & { source: 'mine' | 'comm'; total: number; in_view: number }

/** Uma pesquisa: linhas autorizadas + total da pesquisa + total na área visível. Cancelável. */
export async function searchPins(f: PinFilter, community: boolean, view: [number, number, number, number] | null, signal?: AbortSignal): Promise<SearchResult> {
  let q = sb().rpc('search_pins', rpcParams(f, community, view))
  if (signal) q = q.abortSignal(signal)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as RpcRow[]
  const out: PinRow[] = rows.map((r) => {
    const { total, in_view, ...rest } = r
    void total
    void in_view
    return rest
  })
  return { rows: out, total: rows[0]?.total ?? 0, inView: rows[0]?.in_view ?? 0 }
}
