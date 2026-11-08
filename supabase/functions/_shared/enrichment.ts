/**
 * Lança Lance — enriquecimento ambiental dos Pings (lógica pura, partilhada pela Edge Function e
 * pelos testes). Sem APIs de Deno nem de browser.
 *
 * Regras de integridade:
 *  - A meteorologia é sempre a da HORA DO ACONTECIMENTO (nunca a atual para uma fotografia antiga).
 *  - O conjunto de dados depende da idade do acontecimento e fica registado (dataset + data_kind).
 *  - Valores do Open-Meteo são de MODELO para a célula da grelha: "estimado" (modelo/arquivo de
 *    previsões) ou "historico" (reanálise ERA5). Nunca "observado".
 *  - As coordenadas enviadas ao fornecedor são arredondadas a 0,01° (~1 km): o spot exato do
 *    pescador não sai do servidor, e a cache é partilhável por célula.
 */

export type Dataset = 'forecast' | 'historical-forecast' | 'archive'
export type DataKind = 'estimado' | 'historico' | 'previsao'

export const DATASET_URL: Record<Dataset, string> = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  'historical-forecast': 'https://historical-forecast-api.open-meteo.com/v1/forecast',
  archive: 'https://archive-api.open-meteo.com/v1/archive',
}
export const SOURCE_KEY: Record<Dataset, string> = {
  forecast: 'open-meteo-forecast',
  'historical-forecast': 'open-meteo-historical-forecast',
  archive: 'open-meteo-archive',
}
export const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine'

const HOURLY_BASE = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'precipitation', 'cloud_cover', 'weather_code', 'is_day']
/** Variáveis que o arquivo de reanálise não tem. */
const HOURLY_FORECAST_ONLY = ['visibility', 'uv_index']
const HOURLY_MARINE = ['wave_height', 'wave_direction', 'wave_period', 'sea_surface_temperature']

const DAY = 86400000
/** Primeiro dia com arquivo de previsões de alta resolução no Open-Meteo. */
export const HISTORICAL_FORECAST_FROM = Date.UTC(2022, 0, 1)

/** Ordem de tentativa dos conjuntos de dados para um acontecimento (com fallback). */
export function datasetPlan(occurredAt: Date, now: Date): Dataset[] {
  const age = now.getTime() - occurredAt.getTime()
  if (age < 3 * DAY) return ['forecast', 'historical-forecast', 'archive']
  if (occurredAt.getTime() >= HISTORICAL_FORECAST_FROM) return age < 85 * DAY ? ['historical-forecast', 'forecast', 'archive'] : ['historical-forecast', 'archive']
  return ['archive']
}

/** Natureza do dado: previsão só para horas futuras; reanálise = histórico; modelo = estimado. */
export function dataKindFor(dataset: Dataset, occurredAt: Date, now: Date): DataKind {
  if (occurredAt.getTime() > now.getTime() + 30 * 60000) return 'previsao'
  return dataset === 'archive' ? 'historico' : 'estimado'
}

export const roundCell = (v: number) => Math.round(v * 100) / 100
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10)

/** Janela pedida: do dia anterior ao dia do acontecimento (para precipitação de 24 h e tendência de 3 h). */
export function requestWindow(occurredAt: Date) {
  const t = occurredAt.getTime()
  return { start: ymd(t - DAY), end: ymd(t) }
}

export function buildWeatherUrl(dataset: Dataset, lat: number, lng: number, occurredAt: Date): string {
  const { start, end } = requestWindow(occurredAt)
  const hourly = dataset === 'archive' ? HOURLY_BASE : [...HOURLY_BASE, ...HOURLY_FORECAST_ONLY]
  const p = new URLSearchParams({
    latitude: String(roundCell(lat)),
    longitude: String(roundCell(lng)),
    hourly: hourly.join(','),
    start_date: start,
    end_date: end,
    timezone: 'GMT',
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
  })
  return `${DATASET_URL[dataset]}?${p}`
}

export function buildMarineUrl(lat: number, lng: number, occurredAt: Date): string {
  const { start, end } = requestWindow(occurredAt)
  const p = new URLSearchParams({ latitude: String(roundCell(lat)), longitude: String(roundCell(lng)), hourly: HOURLY_MARINE.join(','), start_date: start, end_date: end, timezone: 'GMT', timeformat: 'unixtime' })
  return `${MARINE_URL}?${p}`
}

/** Chave de cache: fornecedor + célula + janela (os dados de arquivo são imutáveis). */
export const cacheKey = (kind: string, lat: number, lng: number, occurredAt: Date) => {
  const { start, end } = requestWindow(occurredAt)
  return `om:${kind}:${roundCell(lat).toFixed(2)}:${roundCell(lng).toFixed(2)}:${start}:${end}`
}
/** Validade da cache: previsões recentes mudam (1 h); arquivo e reanálise não expiram. */
export function cacheTtlMs(dataset: Dataset | 'marine', occurredAt: Date, now: Date): number | null {
  const age = now.getTime() - occurredAt.getTime()
  if (dataset === 'archive' || dataset === 'historical-forecast') return age > 7 * DAY ? null : 6 * 3600000
  return age > 7 * DAY ? null : 3600000
}

export interface OpenMeteoHourly {
  latitude?: number
  longitude?: number
  elevation?: number
  hourly?: Record<string, (number | null)[]> & { time?: number[] }
}

/** Índice da hora mais próxima do acontecimento (e a distância em minutos). */
export function nearestHour(times: number[], occurredAt: Date): { index: number; offsetMin: number } | null {
  if (!times?.length) return null
  const t = occurredAt.getTime() / 1000
  let best = 0
  for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - t) < Math.abs(times[best] - t)) best = i
  const offsetMin = Math.round((times[best] - t) / 60)
  // Mais de 90 min de distância: a hora pedida não está na resposta (fora do intervalo do conjunto).
  if (Math.abs(offsetMin) > 90) return null
  return { index: best, offsetMin }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10)

export interface WeatherSnapshot {
  reference_time: string
  time_offset_min: number
  grid_lat: number | null
  grid_lng: number | null
  grid_elevation_m: number | null
  air_temp_c: number | null
  apparent_temp_c: number | null
  humidity_pct: number | null
  pressure_hpa: number | null
  pressure_trend_3h_hpa: number | null
  wind_kmh: number | null
  wind_dir_deg: number | null
  gust_kmh: number | null
  precip_mm: number | null
  precip_24h_mm: number | null
  cloud_cover_pct: number | null
  visibility_m: number | null
  uv_index: number | null
  weather_code: number | null
  is_day: boolean | null
}

/** Extrai o instantâneo da hora do acontecimento; null se a resposta não cobre essa hora. */
export function extractWeather(json: OpenMeteoHourly, occurredAt: Date): WeatherSnapshot | null {
  const h = json.hourly
  const times = h?.time
  if (!h || !times) return null
  const hit = nearestHour(times, occurredAt)
  if (!hit) return null
  const i = hit.index
  const at = (k: string) => num(h[k]?.[i])
  const temp = at('temperature_2m')
  // Sem temperatura na hora pedida, o conjunto não cobre o acontecimento (tenta-se o seguinte).
  if (temp === null) return null
  const p = at('pressure_msl')
  const p3 = i >= 3 ? num(h.pressure_msl?.[i - 3]) : null
  let precip24: number | null = null
  if (i >= 23) {
    const slice = (h.precipitation ?? []).slice(i - 23, i + 1).map(num)
    precip24 = slice.every((v) => v !== null) ? round1((slice as number[]).reduce((s, v) => s + v, 0)) : null
  }
  const isDay = at('is_day')
  return {
    reference_time: new Date(times[i] * 1000).toISOString(),
    time_offset_min: hit.offsetMin,
    grid_lat: num(json.latitude),
    grid_lng: num(json.longitude),
    grid_elevation_m: num(json.elevation),
    air_temp_c: round1(temp),
    apparent_temp_c: round1(at('apparent_temperature')),
    humidity_pct: round1(at('relative_humidity_2m')),
    pressure_hpa: round1(p),
    pressure_trend_3h_hpa: p !== null && p3 !== null ? round1(p - p3) : null,
    wind_kmh: round1(at('wind_speed_10m')),
    wind_dir_deg: at('wind_direction_10m'),
    gust_kmh: round1(at('wind_gusts_10m')),
    precip_mm: round1(at('precipitation')),
    precip_24h_mm: precip24,
    cloud_cover_pct: at('cloud_cover'),
    visibility_m: at('visibility'),
    uv_index: round1(at('uv_index')),
    weather_code: at('weather_code'),
    is_day: isDay === null ? null : isDay === 1,
  }
}

export interface MarineSnapshot {
  wave_height_m: number | null
  wave_period_s: number | null
  wave_dir_deg: number | null
  sea_temp_c: number | null
}
export function extractMarine(json: OpenMeteoHourly, occurredAt: Date): MarineSnapshot | null {
  const h = json.hourly
  if (!h?.time) return null
  const hit = nearestHour(h.time, occurredAt)
  if (!hit) return null
  const at = (k: string) => num(h[k]?.[hit.index])
  const out = { wave_height_m: round1(at('wave_height')), wave_period_s: round1(at('wave_period')), wave_dir_deg: at('wave_direction'), sea_temp_c: round1(at('sea_surface_temperature')) }
  return Object.values(out).every((v) => v === null) ? null : out
}

// ---------------------------------------------------------------- astronomia
/** Subconjunto da API do SunCalc 1.9 (injetado: npm:suncalc no servidor, pacote npm nos testes). */
export interface SunCalcLike {
  getTimes(date: Date, lat: number, lng: number): { sunrise: Date; sunset: Date }
  getPosition(date: Date, lat: number, lng: number): { altitude: number; azimuth: number }
  getMoonIllumination(date: Date): { fraction: number; phase: number }
  getMoonTimes(date: Date, lat: number, lng: number, inUTC?: boolean): { rise?: Date; set?: Date; alwaysUp?: boolean; alwaysDown?: boolean }
}

const validIso = (d: Date | undefined) => (d && !Number.isNaN(d.getTime()) ? d.toISOString() : null)

export function astronomy(SunCalc: SunCalcLike, occurredAt: Date, lat: number, lng: number) {
  const times = SunCalc.getTimes(occurredAt, lat, lng)
  const pos = SunCalc.getPosition(occurredAt, lat, lng)
  const moon = SunCalc.getMoonIllumination(occurredAt)
  const mt = SunCalc.getMoonTimes(occurredAt, lat, lng, true)
  const rise = validIso(times.sunrise)
  const set = validIso(times.sunset)
  return {
    sunrise: rise,
    sunset: set,
    day_length_min: rise && set ? Math.round((times.sunset.getTime() - times.sunrise.getTime()) / 60000) : null,
    sun_altitude_deg: Math.round(((pos.altitude * 180) / Math.PI) * 10) / 10,
    // SunCalc mede o azimute a partir de sul; converte para rumo a partir de norte.
    sun_azimuth_deg: Math.round((((pos.azimuth * 180) / Math.PI + 180) % 360) * 10) / 10,
    moon_phase: Math.round(moon.phase * 1000) / 1000,
    moon_illumination: Math.round(moon.fraction * 1000) / 1000,
    moonrise: validIso(mt.rise),
    moonset: validIso(mt.set),
  }
}

/** Nome da fase lunar (0 = nova, 0,5 = cheia). */
export function moonPhaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1
  if (p < 0.03 || p > 0.97) return 'Lua nova'
  if (p < 0.22) return 'Crescente'
  if (p < 0.28) return 'Quarto crescente'
  if (p < 0.47) return 'Crescente gibosa'
  if (p < 0.53) return 'Lua cheia'
  if (p < 0.72) return 'Minguante gibosa'
  if (p < 0.78) return 'Quarto minguante'
  return 'Minguante'
}

/** Local costeiro/marítimo (para pedir ondulação e temperatura do mar). */
export const isCoastal = (environment: string | null | undefined) => environment === 'costa' || environment === 'mar'
