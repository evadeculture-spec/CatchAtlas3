import { BookOpen, CalendarRange, Fish, MapPin, Radio } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Segmented } from '../../components/ui'
import { ErrorBox, ListSkeleton, Panel, useLoad } from '../../components/lanca/primitives'
import { listPings, listPins, timeline } from '../../lib/lanca/api'
import { isSession, isSuccess, MIN_SAMPLE, speciesSummary } from '../../lib/lanca/intelligence'
import { pingKind } from '../../lib/lanca/labels'
import { deviceTimeZone, formatDateTime, localMonth } from '../../lib/lanca/time'
import type { PingKind, TimelineRow } from '../../lib/lanca/types'
import { fmt } from '../../lib/lanca/units'
import { useAuth } from '../../state/Auth'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const monthKey = (iso: string) => new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(new Date(iso))

function rowLink(r: TimelineRow) {
  if (r.kind === 'ping') return `/conta/pings/${r.id}`
  if (r.kind === 'catch') return r.ping_id ? `/conta/pings/${r.ping_id}` : '/conta/pings'
  if (r.kind === 'pin') return `/conta/pins/${r.id}`
  return `/conta/jornadas/${r.id}`
}
const ICON = { ping: Radio, catch: Fish, pin: MapPin, journey: CalendarRange }
function rowText(r: TimelineRow) {
  if (r.kind === 'ping') return `Ping · ${pingKind((r.subtype ?? 'observacao') as PingKind).label}${r.title ? ` · ${r.title}` : ''}`
  if (r.kind === 'catch') return `Captura · ${r.title ?? r.subtype ?? ''}`
  if (r.kind === 'pin') return `Novo Pin · ${r.title ?? ''}`
  return `Jornada · ${r.title ?? ''}`
}

export default function History() {
  const { units } = useAuth()
  const [tab, setTab] = useState<'cronologia' | 'local' | 'especie'>('cronologia')
  const { data, error, loading, reload } = useLoad(async () => {
    const [tl, pings, pins] = await Promise.all([timeline(400), listPings({ limit: 3000 }), listPins()])
    return { tl, pings, pins }
  }, [])

  const groups = useMemo(() => {
    const m = new Map<string, TimelineRow[]>()
    for (const r of data?.tl ?? []) {
      const k = monthKey(r.at)
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()]
  }, [data])

  const byPin = useMemo(() => {
    if (!data) return []
    return data.pins
      .map((pin) => {
        const ps = data.pings.filter((p) => p.pin_id === pin.id)
        const sessions = ps.filter(isSession)
        const months = [...new Set(ps.map((p) => localMonth(p.occurred_at, p.occurred_tz)))].sort((a, b) => a - b)
        return { pin, pings: ps.length, sessions: sessions.length, successes: sessions.filter(isSuccess).length, catches: ps.reduce((s, p) => s + p.catches.length, 0), species: speciesSummary(ps).map((s) => s.species), months, last: ps[0]?.occurred_at ?? null }
      })
      .filter((x) => x.pings > 0)
      .sort((a, b) => b.pings - a.pings)
  }, [data])

  const bySpecies = useMemo(() => {
    if (!data) return []
    return speciesSummary(data.pings).map((s) => {
      const ps = data.pings.filter((p) => p.catches.some((c) => c.species.trim().toLowerCase() === s.species.toLowerCase()))
      const months = Array(12).fill(0) as number[]
      ps.forEach((p) => months[localMonth(p.occurred_at, p.occurred_tz) - 1]++)
      const temps = ps.map((p) => p.ping_environment?.air_temp_c).filter((t): t is number => t != null).sort((a, b) => a - b)
      const tech = [...new Set(ps.map((p) => p.technique).filter(Boolean))] as string[]
      const pins = [...new Map(ps.filter((p) => p.pin).map((p) => [p.pin!.id, p.pin!])).values()]
      return { ...s, months, temps, tech, pins }
    })
  }, [data])

  return (
    <div>
      <h1 className="text-[24px] font-extrabold text-ink">Histórico</h1>
      <p className="mb-4 text-[13.5px] text-muted">Tudo o que registou, por ordem, por local e por espécie. Só dados reais da sua conta.</p>
      <Segmented
        label="Vista do histórico"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'cronologia', label: 'Cronologia' },
          { id: 'local', label: 'Por local' },
          { id: 'especie', label: 'Por espécie' },
        ]}
        className="mb-4 w-full sm:w-auto"
      />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <ListSkeleton rows={6} />
      ) : tab === 'cronologia' ? (
        groups.length === 0 ? (
          <EmptyState icon={BookOpen} title="Histórico vazio" text="Os Pings, Pins, capturas e jornadas que criar aparecem aqui." />
        ) : (
          <div className="space-y-5">
            {groups.map(([month, rows]) => (
              <section key={month}>
                <h2 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.12em] text-muted">{month}</h2>
                <ol className="relative space-y-1 border-l-2 border-line pl-4">
                  {rows.map((r) => {
                    const I = ICON[r.kind]
                    return (
                      <li key={`${r.kind}-${r.id}`} className="relative">
                        <span className="absolute -left-[25px] top-3 grid h-4 w-4 place-items-center rounded-full bg-white ring-2 ring-line" aria-hidden>
                          <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                        </span>
                        <Link to={rowLink(r)} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white">
                          <I className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{rowText(r)}</span>
                          <span className="shrink-0 text-[12px] text-muted">{formatDateTime(r.at, deviceTimeZone(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        )
      ) : tab === 'local' ? (
        byPin.length === 0 ? (
          <EmptyState icon={MapPin} title="Sem Pings associados a Pins" text="Associe os Pings a Pins para ver o histórico de cada local." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {byPin.map((x) => (
              <li key={x.pin.id}>
                <Link to={`/conta/pins/${x.pin.id}`} className="press block rounded-[var(--radius-card)] bg-white p-4 shadow-card hover:shadow-lift">
                  <p className="text-[15px] font-extrabold text-ink">{x.pin.name}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    {x.pings} pings · {x.sessions} sessões ({x.successes} com sucesso) · {x.catches} capturas
                  </p>
                  {x.species.length > 0 && <p className="mt-1 text-[12.5px] text-muted">Espécies: {x.species.join(', ')}</p>}
                  <p className="mt-1 text-[12.5px] text-subtle">Meses com registos: {x.months.map((m) => MONTHS[m - 1]).join(', ')}</p>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : bySpecies.length === 0 ? (
        <EmptyState icon={Fish} title="Sem capturas registadas" text="Ao registar a espécie de uma captura, ela aparece aqui com épocas, técnicas e condições." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {bySpecies.map((s) => (
            <Panel key={s.species} title={s.species} kicker={`${s.count} ${s.count === 1 ? 'captura' : 'capturas'}`}>
              <div className="mb-3 flex items-end gap-1" aria-label={`Capturas por mês de ${s.species}`} role="img">
                {s.months.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-teal" style={{ height: `${Math.max(v ? 8 : 2, (v / Math.max(...s.months)) * 44)}px`, opacity: v ? 1 : 0.15 }} />
                    <span className="text-[9.5px] font-bold text-subtle">{MONTHS[i][0].toUpperCase()}</span>
                  </div>
                ))}
              </div>
              <ul className="space-y-1 text-[13px] text-muted">
                <li>Maior: {[fmt.length(s.maxLengthCm, units), fmt.weight(s.maxWeightG, units)].filter(Boolean).join(' · ') || 'sem medidas'} · {s.released} devolvidos</li>
                {s.temps.length > 0 && (
                  <li>
                    Temperatura do ar: {fmt.temp(s.temps[0], units)} a {fmt.temp(s.temps[s.temps.length - 1], units)} (n = {s.temps.length}
                    {s.temps.length < MIN_SAMPLE ? ', amostra pequena' : ''})
                  </li>
                )}
                {s.tech.length > 0 && <li>Técnicas: {s.tech.join(', ')}</li>}
                {s.pins.length > 0 && <li>Locais (privados): {s.pins.map((p) => p.name).join(', ')}</li>}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
