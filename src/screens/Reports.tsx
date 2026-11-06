import { List, Map as MapIcon, MapPin, Plus, Radio, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Avatar, useAnglerName } from '../components/bits'
import { SchematicMap, type MapView } from '../components/SchematicMap'
import { ButtonLink, Card, Chip, cx, DemoTag, EmptyState, PageHeader, Segmented, Tag } from '../components/ui'
import { DEMO_USER_ID } from '../data/anglers'
import { ACTIVITY, periodName, SPECIES, speciesById } from '../data/catalog'
import { DAMS, damById } from '../data/dams'
import type { Activity, Report, SpeciesId } from '../data/types'
import { diffDays } from '../lib/dates'
import { relativeDay } from '../lib/format'
import { reportToPing } from '../lib/pings'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'

const WINDOWS = [
  { id: '3', label: '3 dias' },
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
] as const

export default function Reports() {
  const { state, allReports } = useApp()
  const [params, setParams] = useSearchParams()
  const species = (params.get('especie') as SpeciesId | null) ?? null
  const activity = (params.get('atividade') as Activity | null) ?? null
  const windowDays = Number(WINDOWS.find((w) => w.id === params.get('janela'))?.id ?? '7')
  const view = params.get('vista') === 'lista' ? 'lista' : 'mapa'
  const mapView = (params.get('mapa') as MapView | null) ?? 'iberia'
  const selected = params.get('sel')
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true, preventScrollReset: true })
  }

  const filtered = useMemo(
    () =>
      allReports
        .filter((r) => {
          const age = diffDays(state.anchor, r.date)
          return age >= 0 && age <= windowDays && (!species || r.speciesId === species) && (!activity || r.activity === activity)
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [allReports, state.anchor, windowDays, species, activity],
  )
  const pings = filtered.map((r) => reportToPing(r, state.anchor))
  const sel = filtered.find((r) => r.id === selected)
  const counts = (['forte', 'moderada', 'fraca', 'nula'] as Activity[]).map((a) => ({ a, n: filtered.filter((r) => r.activity === a).length }))

  return (
    <div>
      <PageHeader back="/comunidade" title="Reports e pings" eyebrow="Comunidade" actions={<ButtonLink to="/reports/novo" size="sm" icon={Plus}>Report</ButtonLink>} />
      <div className="mx-auto max-w-6xl px-4 pt-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-[13.5px] text-muted">
            Atividade reportada pelos pescadores nos últimos dias. Cada ping mostra uma posição aproximada na barragem, nunca o local exato.
          </p>
          <DemoTag />
        </div>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          {WINDOWS.map((w) => (
            <Chip key={w.id} active={windowDays === Number(w.id)} onClick={() => set('janela', w.id === '7' ? null : w.id)}>
              {w.label}
            </Chip>
          ))}
          <span className="my-2 w-px shrink-0 bg-line" aria-hidden />
          {SPECIES.map((s) => (
            <Chip key={s.id} active={species === s.id} onClick={() => set('especie', species === s.id ? null : s.id)}>
              {s.name}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {counts.map(({ a, n }) => (
            <button
              key={a}
              type="button"
              onClick={() => set('atividade', activity === a ? null : a)}
              aria-pressed={activity === a}
              className={cx('press inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12.5px] font-bold', activity === a ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink')}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACTIVITY[a].color }} aria-hidden />
              {ACTIVITY[a].name.replace('Atividade ', '')}
              <span className={cx('tnum', activity === a ? 'text-white/70' : 'text-subtle')}>{n}</span>
            </button>
          ))}
          <Segmented
            label="Vista"
            value={view}
            onChange={(v) => set('vista', v === 'lista' ? 'lista' : null)}
            options={[
              { id: 'mapa', label: 'Mapa', icon: MapIcon },
              { id: 'lista', label: 'Lista', icon: List },
            ]}
            className="ml-auto lg:hidden"
          />
        </div>

        <div className="mt-4 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
          <div className={cx(view === 'lista' && 'hidden lg:block')}>
            <SchematicMap
              dams={DAMS}
              view={mapView}
              selected={sel?.damId}
              pings={pings}
              selectedPing={sel?.id}
              onSelectPing={(id) => set('sel', id)}
              onSelect={(damId) => {
                const first = filtered.find((r) => r.damId === damId)
                set('sel', first ? first.id : null)
              }}
              className={mapView === 'pt' ? 'h-[min(60dvh,520px)]' : 'aspect-[330/262] w-full'}
              overlay={
                <div className="absolute bottom-3 right-3">
                  <Segmented
                    label="Zona do mapa"
                    value={mapView}
                    onChange={(v) => set('mapa', v === 'iberia' ? null : v)}
                    options={[
                      { id: 'pt', label: 'Portugal' },
                      { id: 'iberia', label: 'Península' },
                    ]}
                    className="shadow-card"
                  />
                </div>
              }
            />
            {sel ? (
              <div className="mt-3">
                <ReportCard r={sel} />
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] text-muted">
                Toque num ping para ver o report. Pings maiores e a pulsar são mais recentes. {filtered.length} reports neste período.
              </p>
            )}
          </div>
          <div className={cx('mt-0 space-y-2.5 lg:mt-0', view === 'mapa' && 'hidden lg:block')}>
            {filtered.length === 0 ? (
              <EmptyState icon={Radio} title="Sem reports" text="Não há reports para estes filtros. Alargue o período ou registe o seu." action={<ButtonLink to="/reports/novo" icon={Plus}>Criar report</ButtonLink>} />
            ) : (
              filtered.map((r) => <ReportCard key={r.id} r={r} compact onSelect={() => set('sel', r.id)} active={r.id === sel?.id} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReportCard({ r, compact, onSelect, active }: { r: Report; compact?: boolean; onSelect?: () => void; active?: boolean }) {
  const { state, deleteReport } = useApp()
  const toast = useToast()
  const anglerName = useAnglerName()
  const dam = damById[r.damId]
  const act = ACTIVITY[r.activity]
  const body = (
    <>
      <div className="flex items-start gap-3">
        <Avatar anglerId={r.anglerId} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-ink">
            {anglerName(r.anglerId)}
            {r.anglerId === DEMO_USER_ID && <span className="ml-1.5 text-[12px] font-semibold text-teal-700">(tu)</span>}
          </p>
          <p className="flex items-center gap-1 truncate text-[12.5px] text-muted">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {dam.name} · {relativeDay(r.date, state.anchor)}, {periodName(r.period).toLowerCase()}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={{ background: `${act.color}1f`, color: '#172C36' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: act.color }} aria-hidden />
          {act.name.replace('Atividade ', '')}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Tag tone="teal">{speciesById[r.speciesId].name}</Tag>
        {r.technique && <Tag>{r.technique}</Tag>}
        {r.lure && <Tag>{r.lure}</Tag>}
        <Tag tone="amber">{r.catches} {r.catches === 1 ? 'captura' : 'capturas'}</Tag>
      </div>
      {r.note && !compact && <p className="mt-2.5 text-[13.5px] leading-relaxed text-text">{r.note}</p>}
      {r.note && compact && <p className="mt-2 line-clamp-2 text-[13px] text-muted">{r.note}</p>}
    </>
  )
  return (
    <Card className={cx('p-4 transition', active && 'ring-2 ring-teal')}>
      {onSelect ? (
        <button type="button" onClick={onSelect} className="block w-full text-left">
          {body}
        </button>
      ) : (
        body
      )}
      {!compact && (
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <Link to={`/barragens/${dam.id}`} className="text-[13px] font-bold text-teal-700 hover:underline">
            Ver barragem
          </Link>
          {r.anglerId === DEMO_USER_ID ? (
            <button
              type="button"
              onClick={() => {
                deleteReport(r.id)
                toast('Report eliminado', { tone: 'info' })
              }}
              className="press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Eliminar
            </button>
          ) : (
            <span className="text-[12px] text-subtle">Perfil fictício</span>
          )}
        </div>
      )}
    </Card>
  )
}
