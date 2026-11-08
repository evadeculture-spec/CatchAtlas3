/** Planeador de jornadas 2.0 — lista de verificação, avisos de segurança e leitura das condições. */
import type { ConditionsResponse } from './api'
import { BOAT_MODALITIES } from './labels'
import type { ChecklistItem, Pin } from './types'

const item = (id: string, label: string, kind: ChecklistItem['kind']): ChecklistItem => ({ id, label, done: false, kind })

/** Lista de verificação inicial conforme a modalidade e os locais (o utilizador pode editar). */
export function defaultChecklist(modality: string | null, pins: Pick<Pin, 'environment'>[], night: boolean): ChecklistItem[] {
  const list: ChecklistItem[] = [
    item('licenca', 'Licença de pesca válida para a zona (PT: ICNF · ES: licença da comunidade autónoma)', 'licenca'),
    item('regras', 'Regras locais confirmadas: defesos, tamanhos mínimos, zonas reservadas ou concessionadas', 'licenca'),
    item('documento', 'Documento de identificação', 'licenca'),
    item('plano', 'Alguém sabe onde vou e a que horas volto', 'seguranca'),
    item('telemovel', 'Telemóvel carregado (e bateria externa)', 'seguranca'),
    item('agua', 'Água, proteção solar e kit de primeiros socorros', 'seguranca'),
  ]
  if (modality && BOAT_MODALITIES.includes(modality)) {
    list.push(item('colete', 'Colete salva-vidas (vestido na água)', 'seguranca'))
    list.push(item('embarcacao', 'Registo/licença da embarcação e regras de navegação da albufeira', 'licenca'))
  }
  if (pins.some((p) => p.environment === 'costa' || p.environment === 'mar')) {
    list.push(item('mares', 'Tabela de marés oficial consultada (Instituto Hidrográfico / Puertos del Estado)', 'seguranca'))
    list.push(item('licenca-mar', 'Licença de pesca lúdica marítima (DGRM em Portugal)', 'licenca'))
  }
  if (night) list.push(item('luz', 'Lanterna frontal e luz de presença', 'seguranca'))
  return list
}

export interface DaySummary {
  tMax: number | null
  tMin: number | null
  precipSum: number | null
  precipProbMax: number | null
  windMax: number | null
  gustMax: number | null
  windDir: number | null
  weatherCode: number | null
  sunrise: string | null
  sunset: string | null
}

export interface HourRow {
  time: string
  hour: number
  temp: number | null
  wind: number | null
  gust: number | null
  windDir: number | null
  precip: number | null
  precipProb: number | null
  pressure: number | null
  cloud: number | null
  code: number | null
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const s = (v: unknown) => (typeof v === 'string' ? v : null)

export function daySummary(c: ConditionsResponse): DaySummary | null {
  const d = c.data?.daily
  if (!d?.time?.length) return null
  return {
    tMax: n(d.temperature_2m_max?.[0]),
    tMin: n(d.temperature_2m_min?.[0]),
    precipSum: n(d.precipitation_sum?.[0]),
    precipProbMax: n(d.precipitation_probability_max?.[0]),
    windMax: n(d.wind_speed_10m_max?.[0]),
    gustMax: n(d.wind_gusts_10m_max?.[0]),
    windDir: n(d.wind_direction_10m_dominant?.[0]),
    weatherCode: n(d.weather_code?.[0]),
    sunrise: s(d.sunrise?.[0]),
    sunset: s(d.sunset?.[0]),
  }
}

/** Linhas horárias (hora local do fuso pedido). */
export function hourRows(c: ConditionsResponse): HourRow[] {
  const h = c.data?.hourly
  if (!h?.time) return []
  return h.time.map((t, i) => ({
    time: String(t),
    hour: Number(String(t).slice(11, 13)),
    temp: n(h.temperature_2m?.[i]),
    wind: n(h.wind_speed_10m?.[i]),
    gust: n(h.wind_gusts_10m?.[i]),
    windDir: n(h.wind_direction_10m?.[i]),
    precip: n(h.precipitation?.[i]),
    precipProb: n(h.precipitation_probability?.[i]),
    pressure: n(h.pressure_msl?.[i]),
    cloud: n(h.cloud_cover?.[i]),
    code: n(h.weather_code?.[i]),
  }))
}

/** Janela da jornada (horas inteiras entre início e fim, por omissão 6–12 h). */
export function windowRows(rows: HourRow[], start: string | null, end: string | null) {
  const a = start ? Number(start.slice(0, 2)) : 6
  const b = end ? Number(end.slice(0, 2)) : Math.min(23, a + 6)
  return rows.filter((r) => (b >= a ? r.hour >= a && r.hour <= b : r.hour >= a || r.hour <= b))
}

/** Tendência da pressão (hPa) entre o início e o fim da janela. */
export function pressureTrend(rows: HourRow[]) {
  const p = rows.map((r) => r.pressure).filter((v): v is number => v !== null)
  if (p.length < 2) return null
  return Math.round((p[p.length - 1] - p[0]) * 10) / 10
}

export interface SafetyNotice {
  level: 'info' | 'aviso' | 'perigo'
  text: string
}

/** Avisos derivados das condições (limiares conservadores e explicados). */
export function safetyNotices(rows: HourRow[], day: DaySummary | null, opts: { boat: boolean; coastal: boolean; kind?: string }): SafetyNotice[] {
  const out: SafetyNotice[] = []
  const max = (k: keyof HourRow) => Math.max(-Infinity, ...rows.map((r) => (typeof r[k] === 'number' ? (r[k] as number) : -Infinity)))
  const min = (k: keyof HourRow) => Math.min(Infinity, ...rows.map((r) => (typeof r[k] === 'number' ? (r[k] as number) : Infinity)))
  const codes = rows.map((r) => r.code).filter((c): c is number => c !== null)
  if (codes.some((c) => c >= 95) || (day?.weatherCode ?? 0) >= 95)
    out.push({ level: 'perigo', text: 'Trovoada prevista. Canas de carbono são condutoras: não pesque com trovoada e abrigue-se longe da água.' })
  const gust = Math.max(max('gust'), day?.gustMax ?? -Infinity)
  if (gust >= 50) out.push({ level: 'perigo', text: `Rajadas até ${Math.round(gust)} km/h.${opts.boat ? ' Não recomendável sair de embarcação ligeira.' : ' Cuidado com ramos e margens expostas.'}` })
  else if (gust >= 35 && opts.boat) out.push({ level: 'aviso', text: `Rajadas até ${Math.round(gust)} km/h: atenção à ondulação em embarcação ligeira ou caiaque.` })
  const hot = Math.max(max('temp'), day?.tMax ?? -Infinity)
  if (hot >= 32) out.push({ level: 'aviso', text: `Calor (${Math.round(hot)} °C): hidratação, sombra e proteção solar.` })
  const cold = Math.min(min('temp'), day?.tMin ?? Infinity)
  if (cold <= 3) out.push({ level: 'aviso', text: `Frio (${Math.round(cold)} °C): roupa em camadas; risco de geada nas margens.` })
  const prob = Math.max(max('precipProb'), day?.precipProbMax ?? -Infinity)
  if (prob >= 70) out.push({ level: 'info', text: `Probabilidade de precipitação até ${Math.round(prob)} % (valor do fornecedor de previsão).` })
  if (codes.some((c) => c === 45 || c === 48)) out.push({ level: 'aviso', text: 'Nevoeiro previsto: visibilidade reduzida na água e na estrada.' })
  if (opts.coastal) out.push({ level: 'info', text: 'Local costeiro: confirme a tabela de marés oficial e o estado do mar antes de sair (as marés não estão integradas).' })
  return out
}

export const FORECAST_DISCLAIMER = 'Previsões são estimativas de modelo para uma célula de ~1–11 km e mudam até ao dia. Confirme as condições e os avisos oficiais (IPMA / AEMET) antes de sair.'
