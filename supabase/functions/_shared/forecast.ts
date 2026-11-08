/**
 * Lança Lance — condições para o planeador (lógica pura). Previsão do Open-Meteo para um local e um
 * dia, distinguindo previsão (futuro), estimativa de modelo (passado recente) e reanálise (passado).
 */
import { datasetPlan, roundCell, type Dataset } from './enrichment.ts'

export const FORECAST_HORIZON_DAYS = 15

export interface ForecastQuery {
  lat: number
  lng: number
  date: string // YYYY-MM-DD (dia local)
  timezone: string
}

export function validateQuery(q: Partial<ForecastQuery>): ForecastQuery | string {
  const lat = Number(q.lat), lng = Number(q.lng)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return 'Coordenadas inválidas'
  if (!q.date || !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return 'Data inválida'
  const tz = q.timezone && /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(q.timezone) ? q.timezone : 'Europe/Lisbon'
  return { lat, lng, date: q.date, timezone: tz }
}

/** Conjunto de dados para o dia pedido; null se estiver para lá do horizonte de previsão. */
export function forecastDataset(date: string, now: Date): { dataset: Dataset; kind: 'previsao' | 'estimado' | 'historico' } | null {
  const day = Date.parse(`${date}T12:00:00Z`)
  const diffDays = (day - now.getTime()) / 86400000
  if (diffDays > FORECAST_HORIZON_DAYS) return null
  if (diffDays >= -0.5) return { dataset: 'forecast', kind: 'previsao' }
  const ds = datasetPlan(new Date(day), now)[0]
  return { dataset: ds, kind: ds === 'archive' ? 'historico' : 'estimado' }
}

const HOURLY = ['temperature_2m', 'relative_humidity_2m', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'precipitation', 'precipitation_probability', 'cloud_cover', 'weather_code']
const DAILY = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'precipitation_probability_max', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'sunrise', 'sunset', 'weather_code']

export function buildForecastUrl(base: string, q: ForecastQuery, dataset: Dataset): string {
  const hourly = dataset === 'forecast' ? HOURLY : HOURLY.filter((h) => h !== 'precipitation_probability')
  const daily = dataset === 'forecast' ? DAILY : DAILY.filter((d) => d !== 'precipitation_probability_max')
  const p = new URLSearchParams({
    latitude: String(roundCell(q.lat)), longitude: String(roundCell(q.lng)), hourly: hourly.join(','), daily: daily.join(','),
    start_date: q.date, end_date: q.date, timezone: q.timezone, wind_speed_unit: 'kmh',
  })
  return `${base}?${p}`
}
