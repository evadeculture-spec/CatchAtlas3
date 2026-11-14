import { AlertTriangle, CalendarRange, Check, CloudSun, History as HistoryIcon, Info, Pencil, Plus, Radio, ShieldAlert, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmSheet } from '../../components/Dialog'
import { Button, ButtonLink, Chip, cx, inputCls, PageHeader, Tag } from '../../components/ui'
import { PingRow } from '../../components/lanca/cards'
import { PrivateMap } from '../../components/lanca/PrivateMap'
import { ErrorBox, KindBadge, KV, ListSkeleton, Notice, Panel, Spinner, selectCls, useLoad } from '../../components/lanca/primitives'
import { conditions, deleteJourney, friendly, getJourney, listEquipment, listPings, updateJourney, type ConditionsResponse } from '../../lib/lanca/api'
import { isSession, isSuccess, MIN_SAMPLE, mostSimilar, speciesSummary, type ConditionVector } from '../../lib/lanca/intelligence'
import { BOAT_MODALITIES, JOURNEY_STATUS, modalityLabel, plural } from '../../lib/lanca/labels'
import { moonPhaseName } from '../../lib/lanca/moon'
import { daySummary, FORECAST_DISCLAIMER, hourRows, pressureTrend, safetyNotices, windowRows } from '../../lib/lanca/planner'
import { formatDateTime, formatDay } from '../../lib/lanca/time'
import { distanceM } from '../../lib/lanca/geo'
import type { ChecklistItem, JourneyStatus, Pin, PingFull, PingKind } from '../../lib/lanca/types'
import { compass, fmt, weatherLabel, type Units } from '../../lib/lanca/units'
import { useAuth } from '../../state/Auth'
import { useToast } from '../../state/Toasts'

const NEXT: Partial<Record<JourneyStatus, { to: JourneyStatus; label: string }>> = {
  planeada: { to: 'em-curso', label: 'Começar jornada' },
  'em-curso': { to: 'concluida', label: 'Concluir jornada' },
}

export default function JourneyDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { units } = useAuth()
  const { data, error, loading, reload, setData } = useLoad(async () => {
    const [journey, pings, equipment] = await Promise.all([getJourney(id!), listPings({ limit: 3000 }), listEquipment()])
    return { journey, pings, equipment }
  }, [id])
  const [newItem, setNewItem] = useState('')
  const [eqPick, setEqPick] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading || !data) return <ListSkeleton />
  const { journey: j, pings, equipment } = data
  const pins = j.journey_pins.map((jp) => jp.pin).filter((p): p is Pin => !!p)
  // Pontos da jornada: Pins (locais) e capturas/observações guardadas como referência.
  const targets: Target[] = [
    ...pins.map((p) => ({ key: `pin:${p.id}`, kind: 'pin' as const, id: p.id, name: p.name, lat: p.lat, lng: p.lng, environment: p.environment, waterRef: p.water_body_ref })),
    ...j.journey_pings
      .filter((t) => t.ping && t.ping.lat != null && t.ping.lng != null)
      .map((t) => ({
        key: `ping:${t.ping_id}`,
        kind: 'ping' as const,
        id: t.ping_id,
        name: `${t.ping!.catches?.[0]?.species ?? (t.ping!.kind === 'captura' ? 'Captura' : 'Observação')} · ${formatDateTime(t.ping!.occurred_at, t.ping!.occurred_tz, { dateStyle: 'short' })}`,
        lat: t.ping!.lat!,
        lng: t.ping!.lng!,
        environment: null,
        waterRef: t.ping!.water_body_ref,
      })),
  ]
  const journeyPings = pings.filter((p) => p.journey_id === j.id)

  const saveChecklist = async (checklist: ChecklistItem[]) => {
    setData({ ...data, journey: { ...j, checklist } })
    try {
      await updateJourney(j.id, { checklist })
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
      void reload()
    }
  }
  const setStatus = async (status: JourneyStatus) => {
    try {
      const u = await updateJourney(j.id, { status })
      setData({ ...data, journey: { ...j, ...u } })
      toast(JOURNEY_STATUS[status])
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    }
  }
  const done = j.checklist.filter((c) => c.done).length

  return (
    <div className="-mx-4 -mt-5 lg:-mx-8">
      <PageHeader title={j.title} eyebrow={JOURNEY_STATUS[j.status]} back="/conta/jornadas" actions={<ButtonLink to={`/conta/jornadas/${j.id}/editar`} size="sm" variant="outline" icon={Pencil}>Editar</ButtonLink>} />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-5 lg:px-8">
        <div className="rounded-[var(--radius-card)] bg-ink p-5 text-white shadow-lift">
          <p className="flex items-center gap-2 text-[13px] font-bold first-letter:uppercase text-white/70">
            <CalendarRange className="h-4 w-4" aria-hidden /> {formatDay(j.journey_date)}
            {j.start_time ? ` · ${j.start_time.slice(0, 5)}` : ''}
            {j.end_time ? `–${j.end_time.slice(0, 5)}` : ''}
          </p>
          <p className="mt-2 text-[20px] font-extrabold">{targets.map((p) => p.name).join(' → ') || 'Sem locais'}</p>
          <p className="mt-1 text-[13px] text-white/70">
            {j.modality ? modalityLabel(j.modality) : 'Modalidade por definir'}
            {j.target_species.length ? ` · ${j.target_species.join(', ')}` : ''} · {j.timezone}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {NEXT[j.status] && (
              <Button size="sm" onClick={() => setStatus(NEXT[j.status]!.to)}>
                {NEXT[j.status]!.label}
              </Button>
            )}
            <ButtonLink to={`/conta/pings/novo?journey=${j.id}${pins[0] ? `&pin=${pins[0].id}` : ''}`} size="sm" variant="soft" icon={Radio}>
              Registar Ping
            </ButtonLink>
            {j.status !== 'arquivada' ? (
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setStatus('arquivada')}>
                Arquivar
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setStatus('planeada')}>
                Reativar
              </Button>
            )}
          </div>
        </div>

        <Notice>{FORECAST_DISCLAIMER} O índice de semelhança compara condições; não é uma probabilidade de captura.</Notice>

        {targets.length === 0 ? (
          <Panel>
            <p className="text-[14px] text-muted">Adicione Pins à jornada para ver as previsões e o histórico de cada local.</p>
            <ButtonLink to={`/conta/jornadas/${j.id}/editar`} size="sm" className="mt-3" icon={Plus}>
              Adicionar Pins
            </ButtonLink>
          </Panel>
        ) : (
          <>
          <Panel title="Mapa da jornada" actions={<Tag>{targets.length}</Tag>}>
            {/* Mesmo motor cartográfico 3D do Atlas, com os locais e capturas desta jornada. */}
            <PrivateMap
              pins={pins}
              pings={j.journey_pings.filter((t) => t.ping && t.ping.lat != null && t.ping.lng != null).map((t) => ({ id: t.ping_id, lat: t.ping!.lat!, lng: t.ping!.lng!, kind: t.ping!.kind as PingKind, occurred_at: t.ping!.occurred_at }))}
              onSelect={(s) => s && nav(s.type === 'pin' ? `/conta/pins/${s.id}` : `/conta/pings/${s.id}`)}
              className="h-72 rounded-2xl lg:h-80"
              label="Mapa da jornada"
            />
          </Panel>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {targets.map((p, i) => (
              <PinPlan key={p.key} index={i + 1} pin={p} journey={j} pings={pings} units={units} />
            ))}
          </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Lista de verificação" actions={<Tag tone={done === j.checklist.length && done > 0 ? 'teal' : 'neutral'}>{done}/{j.checklist.length}</Tag>}>
            <ul className="space-y-1">
              {j.checklist.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={c.done}
                    onClick={() => saveChecklist(j.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))}
                    className="press flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-mist"
                  >
                    <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2', c.done ? 'border-teal bg-teal text-ink' : 'border-line')}>{c.done && <Check className="h-3.5 w-3.5" aria-hidden />}</span>
                    <span className={cx('text-[13.5px]', c.done ? 'text-subtle line-through' : 'text-ink')}>
                      {c.label}
                      {c.kind === 'licenca' && <Tag className="ml-1.5 align-middle">Documentos</Tag>}
                      {c.kind === 'seguranca' && <Tag tone="amber" className="ml-1.5 align-middle">Segurança</Tag>}
                    </span>
                  </button>
                  <button type="button" onClick={() => saveChecklist(j.checklist.filter((x) => x.id !== c.id))} className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-subtle hover:text-danger" aria-label={`Retirar ${c.label}`}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newItem.trim()) return
                void saveChecklist([...j.checklist, { id: crypto.randomUUID(), label: newItem.trim().slice(0, 140), done: false, kind: 'outro' }])
                setNewItem('')
              }}
            >
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Iscos, acessórios, notas…" className={inputCls} aria-label="Novo item" />
              <Button type="submit" variant="dark" icon={Plus} aria-label="Adicionar item" />
            </form>
            {equipment.length > 0 && (
              <div className="mt-2 flex gap-2">
                <select value={eqPick} onChange={(e) => setEqPick(e.target.value)} className={selectCls} aria-label="Adicionar equipamento">
                  <option value="">Adicionar do meu equipamento…</option>
                  {equipment.filter((e) => !j.checklist.some((c) => c.id === `eq-${e.id}`)).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={!eqPick}
                  onClick={() => {
                    const e = equipment.find((x) => x.id === eqPick)
                    if (e) void saveChecklist([...j.checklist, { id: `eq-${e.id}`, label: e.name, done: false, kind: 'equipamento' }])
                    setEqPick('')
                  }}
                >
                  Adicionar
                </Button>
              </div>
            )}
          </Panel>
          <Panel title="Pings desta jornada" actions={<Tag>{journeyPings.length}</Tag>}>
            {journeyPings.length === 0 ? (
              <p className="text-[13.5px] text-muted">Durante a jornada, registe cada experiência (com ou sem captura). Os dias sem captura também contam para as estatísticas.</p>
            ) : (
              <ul className="space-y-2">
                {journeyPings.map((p) => (
                  <li key={p.id}>
                    <PingRow ping={p} units={units} />
                  </li>
                ))}
              </ul>
            )}
            {j.notes && <p className="mt-3 whitespace-pre-line rounded-2xl bg-mist p-3 text-[13px] text-text">{j.notes}</p>}
          </Panel>
        </div>
        <Button variant="ghost" icon={Trash2} className="text-danger" onClick={() => setConfirmDel(true)}>
          Apagar jornada
        </Button>
      </div>
      <ConfirmSheet
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        danger
        title="Apagar esta jornada?"
        confirmLabel="Apagar"
        text={`A jornada é apagada. Os Pins mantêm-se e os ${journeyPings.length} pings registados nela ficam no histórico, sem jornada associada.`}
        onConfirm={async () => {
          try {
            await deleteJourney(j.id)
            toast('Jornada apagada')
            nav('/conta/jornadas', { replace: true })
          } catch (e) {
            toast(friendly(e), { tone: 'warning' })
          }
        }}
      />
    </div>
  )
}

interface Target {
  key: string
  kind: 'pin' | 'ping'
  id: string
  name: string
  lat: number
  lng: number
  environment: Pin['environment']
  waterRef: string | null
}

function PinPlan({ index, pin, journey, pings, units }: { index: number; pin: Target; journey: Awaited<ReturnType<typeof getJourney>>; pings: PingFull[]; units: Units }) {
  const c = useLoad<ConditionsResponse>(() => conditions({ lat: pin.lat, lng: pin.lng, date: journey.journey_date, timezone: journey.timezone }), [pin.id, journey.journey_date, journey.timezone])
  const [scope, setScope] = useState<'local' | 'todos'>('local')
  // Histórico do local: mesmo Pin, mesma massa de água ou a menos de 500 m (dados reais do utilizador).
  const here = pings.filter((p) => (pin.kind === 'pin' && p.pin_id === pin.id) || (!!pin.waterRef && p.water_body_ref === pin.waterRef) || (p.lat != null && p.lng != null && distanceM({ lat: p.lat, lng: p.lng }, pin) < 500))
  const sessions = here.filter(isSession)
  const day = c.data ? daySummary(c.data) : null
  const rows = c.data ? windowRows(hourRows(c.data), journey.start_time, journey.end_time) : []
  const trend = pressureTrend(rows.slice(0, 4))
  const first = rows[0]
  const target: ConditionVector = {
    month: Number(journey.journey_date.slice(5, 7)),
    hour: journey.start_time ? Number(journey.start_time.slice(0, 2)) : null,
    airTempC: first?.temp ?? null,
    pressureTrend: trend,
    windKmh: first?.wind ?? null,
    moonPhase: c.data?.astronomy?.moon_phase ?? null,
  }
  const pool = scope === 'local' ? here : pings
  const similar = useMemo(() => (c.data ? mostSimilar(target, pool, 5) : []), [c.data, pool]) // eslint-disable-line react-hooks/exhaustive-deps
  const similarHits = similar.filter((s) => isSuccess(s.ping)).length
  const similarTemp = target.airTempC != null ? sessions.filter((p) => p.ping_environment?.air_temp_c != null && Math.abs(p.ping_environment.air_temp_c - target.airTempC!) <= 3) : []
  const notices = safetyNotices(rows, day, { boat: !!journey.modality && BOAT_MODALITIES.includes(journey.modality), coastal: pin.environment === 'costa' || pin.environment === 'mar' })

  return (
    <Panel kicker={`Local ${index}`} title={pin.name} actions={<Link to={`/?pin=${pin.id}`} className="text-[12.5px] font-bold text-teal-700">Ver no mapa</Link>}>
      {/* Condições */}
      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CloudSun className="h-4 w-4 text-muted" aria-hidden />
          <h3 className="text-[13.5px] font-extrabold text-ink">Condições para o dia</h3>
          {c.data?.available && c.data.kind && <KindBadge kind={c.data.kind} />}
          {c.data?.stale && <Tag tone="amber">Cópia anterior (fornecedor indisponível)</Tag>}
        </div>
        {c.loading ? (
          <Spinner label="A consultar a previsão…" />
        ) : c.error ? (
          <ErrorBox message={c.error} onRetry={c.reload} />
        ) : !c.data?.available ? (
          <Notice>{c.data?.reason ?? 'Sem previsão disponível.'}{c.data?.astronomy ? ` Lua: ${moonPhaseName(c.data.astronomy.moon_phase)}.` : ''}</Notice>
        ) : (
          <>
            <dl>
              <KV label="Estado do tempo" value={weatherLabel(day?.weatherCode)} />
              <KV label="Temperatura" value={day?.tMin != null && day.tMax != null ? `${fmt.temp(day.tMin, units)} a ${fmt.temp(day.tMax, units)}` : null} />
              <KV label="Vento máximo" value={day?.windMax != null ? `${fmt.wind(day.windMax, units)}${day.windDir != null ? ` de ${compass(day.windDir)}` : ''}` : null} />
              <KV label="Rajadas" value={fmt.wind(day?.gustMax, units)} />
              <KV label="Precipitação" value={day?.precipSum != null ? `${fmt.mm(day.precipSum)}${day.precipProbMax != null ? ` · prob. máx. ${Math.round(day.precipProbMax)} % (fornecedor)` : ''}` : null} />
              <KV label="Pressão na janela" value={first?.pressure != null ? `${fmt.pressure(first.pressure)}${trend != null ? ` · ${trend > 0 ? '+' : ''}${fmt.num(trend)} hPa em 3 h` : ''}` : null} />
              <KV label="Nascer / pôr do sol" value={day?.sunrise && day.sunset ? `${day.sunrise.slice(11, 16)} / ${day.sunset.slice(11, 16)}` : null} />
              <KV label="Lua" value={c.data.astronomy ? `${moonPhaseName(c.data.astronomy.moon_phase)} · ${Math.round(c.data.astronomy.moon_illumination * 100)} %` : null} />
              <KV label="Marés" value={pin.environment === 'costa' || pin.environment === 'mar' ? null : 'não aplicável'} hint="Marés oficiais não integradas." />
              <KV label="Nível / caudal" value={null} hint="Sem fonte hidrológica integrada." />
            </dl>
            {rows.length > 0 && (
              <div className="no-scrollbar -mx-1 mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-[12px]">
                  <caption className="sr-only">Previsão horária na janela da jornada</caption>
                  <thead>
                    <tr className="text-left text-subtle">
                      <th className="px-1 py-1 font-bold">Hora</th>
                      <th className="px-1 py-1 font-bold">Temp.</th>
                      <th className="px-1 py-1 font-bold">Vento</th>
                      <th className="px-1 py-1 font-bold">Rajada</th>
                      <th className="px-1 py-1 font-bold">Precip.</th>
                      <th className="px-1 py-1 font-bold">Pressão</th>
                    </tr>
                  </thead>
                  <tbody className="tnum">
                    {rows.map((r) => (
                      <tr key={r.time} className="border-t border-line/70">
                        <td className="px-1 py-1 font-bold text-ink">{String(r.hour).padStart(2, '0')}h</td>
                        <td className="px-1 py-1">{fmt.temp(r.temp, units) ?? '—'}</td>
                        <td className="px-1 py-1">{fmt.wind(r.wind, units) ?? '—'} {compass(r.windDir) ?? ''}</td>
                        <td className="px-1 py-1">{fmt.wind(r.gust, units) ?? '—'}</td>
                        <td className="px-1 py-1">{r.precip != null ? `${fmt.num(r.precip)} mm` : '—'}{r.precipProb != null ? ` · ${r.precipProb} %` : ''}</td>
                        <td className="px-1 py-1">{r.pressure != null ? Math.round(r.pressure) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-subtle">
              Fonte: Open-Meteo ({c.data.dataset}){c.data.fetchedAt ? ` · obtido ${formatDateTime(c.data.fetchedAt, journey.timezone, { dateStyle: 'short', timeStyle: 'short' })}` : ''} · célula ~1 km · Weather data by Open-Meteo.com (CC BY 4.0)
            </p>
          </>
        )}
      </div>

      {notices.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {notices.map((n, i) => (
            <li key={i} className={cx('flex items-start gap-2 rounded-2xl px-3 py-2 text-[12.5px] leading-snug', n.level === 'perigo' ? 'bg-[#fdf0ee] text-[#7b2318]' : n.level === 'aviso' ? 'bg-amber-50 text-amber-800' : 'bg-mist text-muted')}>
              {n.level === 'perigo' ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : n.level === 'aviso' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              {n.text}
            </li>
          ))}
        </ul>
      )}

      {/* Histórico pessoal */}
      <div className="border-t border-line pt-3">
        <div className="mb-2 flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-muted" aria-hidden />
          <h3 className="text-[13.5px] font-extrabold text-ink">O seu histórico</h3>
        </div>
        {here.length === 0 ? (
          <p className="text-[13px] text-muted">Ainda não há reports neste local.</p>
        ) : (
          <div className="space-y-1.5 text-[13px] text-text">
            <p>
              {here.length === 1 ? 'Neste local existe ' : 'Neste local existem '}<strong>{plural(here.length, 'report', 'reports')}</strong> ({plural(sessions.length, 'sessão de pesca', 'sessões de pesca')}, {sessions.filter(isSuccess).length} com captura).
              {speciesSummary(here).length > 0 && ` Espécies: ${speciesSummary(here).map((s) => `${s.species} (${s.count})`).join(', ')}.`}
            </p>
            {target.airTempC != null && similarTemp.length > 0 && (
              <p>
                {similarTemp.filter(isSuccess).length} de {plural(similarTemp.length, 'sessão', 'sessões')} aqui com temperatura do ar a ±3 °C da prevista ({fmt.temp(target.airTempC, units)}) tiveram captura
                {similarTemp.length < MIN_SAMPLE ? ' — amostra pequena, não permite conclusões' : ''}.
              </p>
            )}
            <p className="text-[12px] text-subtle">Última visita: {formatDateTime(here[0].occurred_at, here[0].occurred_tz, { dateStyle: 'medium' })}</p>
          </div>
        )}
        {c.data?.available && (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-extrabold text-ink">Sessões passadas com condições mais semelhantes</p>
              <div className="flex gap-1">
                <Chip active={scope === 'local'} onClick={() => setScope('local')} className="h-8 px-3 text-[12px]">
                  Este local
                </Chip>
                <Chip active={scope === 'todos'} onClick={() => setScope('todos')} className="h-8 px-3 text-[12px]">
                  Todos
                </Chip>
              </div>
            </div>
            {similar.length === 0 ? (
              <p className="text-[12.5px] text-muted">Sem sessões com condições registadas suficientes para comparar (são precisos pelo menos 3 fatores).</p>
            ) : (
              <>
                <p className="mb-2 text-[12.5px] text-muted">
                  {similarHits} de {plural(similar.length, 'sessão mais semelhante', 'sessões mais semelhantes')} com captura{similar.length < MIN_SAMPLE ? ' (amostra pequena)' : ''}.
                </p>
                <ul className="space-y-1.5">
                  {similar.map((s) => (
                    <li key={s.ping.id}>
                      <details className="rounded-2xl bg-mist px-3 py-2">
                        <summary className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                          <span className="tnum grid h-8 w-11 shrink-0 place-items-center rounded-lg bg-white text-[13px] font-extrabold text-ink" title="Índice de semelhança (0–100), não é probabilidade">{s.sim.score}</span>
                          <span className="min-w-0 flex-1 truncate font-bold text-ink">
                            {formatDateTime(s.ping.occurred_at, s.ping.occurred_tz, { dateStyle: 'medium' })} · {isSuccess(s.ping) ? 'com captura' : 'sem captura'}
                            {scope === 'todos' && s.ping.pin ? ` · ${s.ping.pin.name}` : ''}
                          </span>
                        </summary>
                        <ul className="mt-2 space-y-0.5 text-[12px] text-muted">
                          {s.sim.factors.map((f) => (
                            <li key={f.key}>
                              {f.label}: {Math.round(f.similarity * 100)} — {f.detail}
                            </li>
                          ))}
                          {s.sim.missing.length > 0 && <li className="text-subtle">Sem dados: {s.sim.missing.join(', ')}</li>}
                          <li>
                            <Link to={`/conta/pings/${s.ping.id}`} className="font-bold text-teal-700">
                              Abrir Ping
                            </Link>
                          </li>
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}
