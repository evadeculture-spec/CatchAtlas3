/**
 * Lança Lance — versão comunitária de um report (lógica pura, partilhada pelo servidor e pela
 * pré-visualização na app). A coordenada exata nunca sai do perfil privado: a versão partilhada usa
 * o centro de uma célula fixa de 0,05° (~5,6 km N-S), estável para o mesmo local. Em albufeiras
 * pequenas, a célula é maior do que a própria água, por isso só se fica a saber a albufeira.
 */
export const APPROX_CELL_DEG = 0.05

const r4 = (v: number) => Math.round(v * 1e4) / 1e4

export function approximate(lat: number, lng: number, waterName?: string | null) {
  const c = APPROX_CELL_DEG
  const aLat = r4((Math.floor(lat / c) + 0.5) * c)
  const aLng = r4((Math.floor(lng / c) + 0.5) * c)
  const precisionKm = Math.round(c * 111.32 * 10) / 10
  const zone = `zona aproximada (~${Math.round(precisionKm)} km)`
  return { lat: aLat, lng: aLng, precisionKm, label: waterName ? `${waterName} · ${zone}` : zone.charAt(0).toUpperCase() + zone.slice(1) }
}

export type DayPeriod = 'madrugada' | 'manha' | 'tarde' | 'noite'
export function dayPeriod(hour: number): DayPeriod {
  return hour < 6 ? 'madrugada' : hour < 12 ? 'manha' : hour < 18 ? 'tarde' : 'noite'
}

/** Data (AAAA-MM-DD) e hora local do acontecimento no seu fuso. */
export function localDateHour(iso: string, tz: string): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}
