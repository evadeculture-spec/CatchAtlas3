import { Bookmark, Trophy } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { EventCard } from '../components/cards'
import { Chip, cx, DemoTag, EmptyState, SectionHeader } from '../components/ui'
import { MODALITIES } from '../data/catalog'
import { DAMS, damById } from '../data/dams'
import { EVENTS } from '../data/events'
import type { ModalityId } from '../data/types'
import { useApp } from '../state/AppState'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23566a73' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundSize: '16px',
  backgroundPosition: 'right 14px center',
  backgroundRepeat: 'no-repeat',
}

export default function Events() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const modality = params.get('modalidade') as ModalityId | null
  const damId = params.get('barragem') && damById[params.get('barragem')!] ? params.get('barragem')! : ''
  const savedOnly = params.get('guardadas') === '1'
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const match = (e: (typeof EVENTS)[number]) => (!modality || e.modality === modality) && (!damId || e.damId === damId) && (!savedOnly || state.savedEvents.includes(e.id))
  const upcoming = EVENTS.filter((e) => e.dayOffset >= 0 && match(e)).sort((a, b) => a.dayOffset - b.dayOffset)
  const past = EVENTS.filter((e) => e.dayOffset < 0 && match(e)).sort((a, b) => b.dayOffset - a.dayOffset)

  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-8">
      <header className="pt-safe pt-5 lg:pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Provas</p>
          <DemoTag />
        </div>
        <h1 className="font-display mt-1 text-[30px] font-semibold leading-tight text-ink sm:text-[36px]">Calendário e resultados</h1>
        <p className="mt-1 text-[13px] text-muted">Todas as provas, organizadores e resultados são fictícios.</p>
      </header>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:-mx-8 lg:px-8">
        <Chip active={savedOnly} icon={Bookmark} onClick={() => set('guardadas', savedOnly ? null : '1')}>
          Guardadas
        </Chip>
        <span className="my-2 w-px shrink-0 bg-line" aria-hidden />
        {MODALITIES.map((m) => (
          <Chip key={m.id} active={modality === m.id} onClick={() => set('modalidade', modality === m.id ? null : m.id)}>
            {m.name}
          </Chip>
        ))}
        <select aria-label="Filtrar por barragem" value={damId} onChange={(e) => set('barragem', e.target.value)} className={cx('h-10 shrink-0 appearance-none rounded-full border bg-white pl-4 pr-10 text-[13px] font-bold text-ink outline-none focus:border-teal', damId ? 'border-ink' : 'border-line')} style={selectStyle}>
          <option value="">Todas as barragens</option>
          {DAMS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <section className="mt-6">
        <SectionHeader title="Próximas provas" />
        {upcoming.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {upcoming.map((e) => (
              <EventCard key={e.id} ev={e} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Trophy} title="Sem provas para estes filtros" text={savedOnly ? 'Ainda não guardou nenhuma prova futura.' : 'Experimente outra modalidade ou barragem.'} />
        )}
      </section>

      <section className="mt-8">
        <SectionHeader title="Resultados anteriores" />
        {past.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {past.map((e) => (
              <EventCard key={e.id} ev={e} />
            ))}
          </div>
        ) : (
          <p className="text-[13.5px] text-muted">Sem resultados para estes filtros.</p>
        )}
      </section>
    </div>
  )
}
