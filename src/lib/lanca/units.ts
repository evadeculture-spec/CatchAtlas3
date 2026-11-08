import type { Profile } from './types'

export type Units = Pick<Profile, 'unit_temperature' | 'unit_length' | 'unit_weight' | 'unit_wind'>
export const DEFAULT_UNITS: Units = { unit_temperature: 'c', unit_length: 'cm', unit_weight: 'kg', unit_wind: 'kmh' }

const nf = (v: number, d = 1) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(v)

/** Formatação com as unidades do perfil. Valores em falta mostram-se como "indisponível". */
export const fmt = {
  temp: (c: number | null | undefined, u: Units = DEFAULT_UNITS) => (c == null ? null : u.unit_temperature === 'f' ? `${nf((c * 9) / 5 + 32, 0)} °F` : `${nf(c, 1)} °C`),
  wind: (kmh: number | null | undefined, u: Units = DEFAULT_UNITS) =>
    kmh == null ? null : u.unit_wind === 'ms' ? `${nf(kmh / 3.6, 1)} m/s` : u.unit_wind === 'kn' ? `${nf(kmh / 1.852, 0)} nós` : `${nf(kmh, 0)} km/h`,
  length: (cm: number | null | undefined, u: Units = DEFAULT_UNITS) => (cm == null ? null : u.unit_length === 'in' ? `${nf(cm / 2.54, 1)} in` : `${nf(cm, 1)} cm`),
  weight: (g: number | null | undefined, u: Units = DEFAULT_UNITS) => (g == null ? null : u.unit_weight === 'lb' ? `${nf(g / 453.592, 2)} lb` : g < 1000 ? `${nf(g, 0)} g` : `${nf(g / 1000, 2)} kg`),
  pressure: (h: number | null | undefined) => (h == null ? null : `${nf(h, 0)} hPa`),
  pct: (v: number | null | undefined) => (v == null ? null : `${nf(v, 0)} %`),
  mm: (v: number | null | undefined) => (v == null ? null : `${nf(v, 1)} mm`),
  m: (v: number | null | undefined, d = 1) => (v == null ? null : `${nf(v, d)} m`),
  num: nf,
}

/** Converte a entrada do utilizador (nas suas unidades) para as unidades base (cm, g). */
export function toBaseLength(v: number, u: Units) {
  return u.unit_length === 'in' ? Math.round(v * 2.54 * 10) / 10 : v
}
export function toBaseWeight(v: number, u: Units) {
  // Entrada em kg ou lb.
  return Math.round(u.unit_weight === 'lb' ? v * 453.592 : v * 1000)
}
export function fromBaseLength(cm: number, u: Units) {
  return u.unit_length === 'in' ? Math.round((cm / 2.54) * 10) / 10 : cm
}
export function fromBaseWeight(g: number, u: Units) {
  return u.unit_weight === 'lb' ? Math.round((g / 453.592) * 100) / 100 : Math.round(g / 10) / 100
}

/** Rumo do vento em pontos cardeais (de onde sopra). */
export function compass(deg: number | null | undefined) {
  if (deg == null) return null
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
  return pts[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]
}

/** Códigos WMO do estado do tempo (Open-Meteo). */
export function weatherLabel(code: number | null | undefined) {
  if (code == null) return null
  if (code === 0) return 'Céu limpo'
  if (code <= 2) return 'Pouco nublado'
  if (code === 3) return 'Nublado'
  if (code === 45 || code === 48) return 'Nevoeiro'
  if (code >= 51 && code <= 57) return 'Chuvisco'
  if (code >= 61 && code <= 67) return 'Chuva'
  if (code >= 71 && code <= 77) return 'Neve'
  if (code >= 80 && code <= 82) return 'Aguaceiros'
  if (code === 85 || code === 86) return 'Aguaceiros de neve'
  if (code >= 95) return 'Trovoada'
  return `Código ${code}`
}
