import { diffDays, parseISODate } from './dates'

const kgFmt = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const kgShort = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const formatKg = (g: number) => `${kgFmt.format(g / 1000)} kg`
export const formatKgShort = (g: number) => `${kgShort.format(g / 1000)} kg`
export const formatCm = (cm: number) => `${cm} cm`
export const formatTemp = (c: number) => `${Math.round(c)} °C`
export const formatWind = (kmh: number) => `${Math.round(kmh)} km/h`

/** Converte "1,25" ou "1.25" (kg) em gramas. Devolve null se inválido. */
export function parseKgToGrams(input: string): number | null {
  const clean = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(clean)) return null
  const g = Math.round(parseFloat(clean) * 1000)
  return g > 0 ? g : null
}

export const gramsToKgInput = (g: number) => (g / 1000).toString().replace('.', ',')

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const monthShort = (iso: string) => MONTHS[parseISODate(iso).getMonth()]

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  if (!opts) {
    const d = parseISODate(iso)
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  }
  return new Intl.DateTimeFormat('pt-PT', opts).format(parseISODate(iso)).replace('.', '')
}

export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const formatDateLong = (iso: string) => capFirst(formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long' }))

export function relativeDay(iso: string, ref: string): string {
  const d = diffDays(iso, ref)
  if (d === 0) return 'Hoje'
  if (d === 1) return 'Amanhã'
  if (d === -1) return 'Ontem'
  if (d < 0 && d > -7) return `Há ${-d} dias`
  if (d > 0 && d < 7) return `Daqui a ${d} dias`
  return formatDate(iso)
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 6) return 'Boa noite'
  if (h < 13) return 'Bom dia'
  if (h < 20) return 'Boa tarde'
  return 'Boa noite'
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
