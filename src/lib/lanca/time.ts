/** Utilitários de fuso horário: guarda-se sempre em UTC, com o fuso do acontecimento à parte. */

export const DEFAULT_TZ = 'Europe/Lisbon'
export const TIMEZONES = ['Europe/Lisbon', 'Europe/Madrid', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Canary', 'Africa/Ceuta']

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ
  } catch {
    return DEFAULT_TZ
  }
}

function partsIn(tz: string, t: number) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const p = Object.fromEntries(f.formatToParts(new Date(t)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]))
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** Diferença (minutos) entre a hora local do fuso e UTC, no instante t. */
export function tzOffsetMin(tz: string, t: number) {
  const p = partsIn(tz, t)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / 60000)
}

/** "2024-05-04T19:10" (hora local no fuso tz) → ISO UTC. Resolve mudanças de hora (DST). */
export function zonedLocalToUtc(local: string, tz: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
  let t = guess - tzOffsetMin(tz, guess) * 60000
  t = guess - tzOffsetMin(tz, t) * 60000
  return new Date(t).toISOString()
}

/** ISO UTC → "YYYY-MM-DDTHH:mm" na hora local do fuso (para <input type="datetime-local">). */
export function utcToZonedLocal(iso: string, tz: string): string {
  const p = partsIn(tz, new Date(iso).getTime())
  const z = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`
}

/** Hora local (0–23) do acontecimento no seu fuso. */
export const localHour = (iso: string, tz: string) => partsIn(tz, new Date(iso).getTime()).hour
export const localMonth = (iso: string, tz: string) => partsIn(tz, new Date(iso).getTime()).month

export function formatDateTime(iso: string, tz: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: tz, ...opts }).format(new Date(iso))
}
export function formatTime(iso: string | null | undefined, tz: string) {
  return iso ? new Intl.DateTimeFormat('pt-PT', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : null
}
export function formatDay(isoDate: string) {
  return new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T12:00:00Z`))
}
export function todayIn(tz: string) {
  return utcToZonedLocal(new Date().toISOString(), tz).slice(0, 10)
}

/** "+01:00" → 60 (minutos a leste de UTC). */
export function offsetMinutes(offset: string): number | null {
  const m = offset.trim().match(/^([+-])(\d{2}):(\d{2})$/)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : null
}

/**
 * Fuso do acontecimento coerente com o offset gravado pela câmara: mantém o preferido se coincidir;
 * senão, o primeiro fuso ibérico/atlântico com esse offset nesse instante (ex.: +02:00 no verão → Madrid).
 */
export function tzForOffset(offset: string, instantMs: number, preferred: string): string {
  const want = offsetMinutes(offset)
  if (want === null) return preferred
  if (tzOffsetMin(preferred, instantMs) === want) return preferred
  return TIMEZONES.find((z) => tzOffsetMin(z, instantMs) === want) ?? preferred
}
