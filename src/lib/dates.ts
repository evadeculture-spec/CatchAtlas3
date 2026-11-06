// Datas locais em formato AAAA-MM-DD, sem dependências de fuso via Date ISO.
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDaysISO(base: string, n: number): string {
  const d = parseISODate(base)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000)
}

export const todayISO = () => toISODate(new Date())
