import { CalendarRange, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ButtonLink, Chip, EmptyState, Tag } from '../../components/ui'
import { ErrorBox, ListSkeleton, useLoad } from '../../components/lanca/primitives'
import { listJourneys } from '../../lib/lanca/api'
import { JOURNEY_STATUS, modalityLabel } from '../../lib/lanca/labels'
import { formatDay, todayIn } from '../../lib/lanca/time'
import type { JourneyStatus } from '../../lib/lanca/types'

export default function Journeys() {
  const { data, error, loading, reload } = useLoad(listJourneys, [])
  const [tab, setTab] = useState<'proximas' | 'passadas' | 'arquivadas'>('proximas')
  const list = useMemo(() => {
    const today = todayIn('Europe/Lisbon')
    const all = data ?? []
    if (tab === 'arquivadas') return all.filter((j) => j.status === 'arquivada')
    if (tab === 'proximas') return all.filter((j) => j.status !== 'arquivada' && (j.journey_date >= today || j.status === 'em-curso')).sort((a, b) => a.journey_date.localeCompare(b.journey_date))
    return all.filter((j) => j.status !== 'arquivada' && j.journey_date < today && j.status !== 'em-curso')
  }, [data, tab])
  const tone = (s: JourneyStatus) => (s === 'em-curso' ? 'teal' : s === 'concluida' ? 'ink' : 'neutral')
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold text-ink">Jornadas</h1>
          <p className="text-[13.5px] text-muted">Planeie com previsões e com o seu histórico real em cada local.</p>
        </div>
        <ButtonLink to="/conta/jornadas/nova" icon={Plus}>
          Planear
        </ButtonLink>
      </div>
      <div className="mb-4 flex gap-2">
        {(['proximas', 'passadas', 'arquivadas'] as const).map((t) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
            {t === 'proximas' ? 'Próximas' : t === 'passadas' ? 'Passadas' : 'Arquivadas'}
          </Chip>
        ))}
      </div>
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState icon={CalendarRange} title={tab === 'proximas' ? 'Sem jornadas planeadas' : 'Nada aqui'} text="Escolha os Pins, a data e veja a previsão ao lado do que já aconteceu nesses locais." action={tab === 'proximas' && <ButtonLink to="/conta/jornadas/nova" icon={Plus}>Planear jornada</ButtonLink>} />
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {list.map((j) => (
            <li key={j.id}>
              <Link to={`/conta/jornadas/${j.id}`} className="press block rounded-[var(--radius-card)] bg-white p-4 shadow-card hover:shadow-lift">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-extrabold text-ink">{j.title}</p>
                  <Tag tone={tone(j.status)}>{JOURNEY_STATUS[j.status]}</Tag>
                </div>
                <p className="mt-1 text-[13px] first-letter:uppercase text-muted">
                  {formatDay(j.journey_date)}
                  {j.start_time ? ` · ${j.start_time.slice(0, 5)}` : ''}
                  {j.end_time ? `–${j.end_time.slice(0, 5)}` : ''}
                </p>
                <p className="mt-1 truncate text-[12.5px] text-subtle">
                  {j.journey_pins.map((jp) => jp.pin?.name).filter(Boolean).join(' → ') || 'Sem Pins'}
                  {j.modality ? ` · ${modalityLabel(j.modality)}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
