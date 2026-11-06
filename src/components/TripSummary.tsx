import { Check, Clock, Lightbulb, MapPin, CalendarDays, Fish } from 'lucide-react'
import { HourlyChart } from './charts'
import { ConditionsGrid } from './cards'
import { DamCover } from './photo/DamCover'
import { Card, cx, Tag } from './ui'
import { modalityName, speciesById } from '../data/catalog'
import { damById } from '../data/dams'
import type { ModalityId, SpeciesId } from '../data/types'
import { formatDateLong } from '../lib/format'
import { buildChecklist, suggestApproaches, suggestWindow } from '../lib/tripAdvisor'
import { simulateConditions } from '../lib/weather'

export function computeTrip(damId: string, date: string, speciesId: SpeciesId, modality: ModalityId) {
  const dam = damById[damId]
  const cond = simulateConditions(dam, date)
  const approaches = suggestApproaches(speciesId, modality, cond)
  const window = suggestWindow(speciesId, cond)
  const checklist = buildChecklist(speciesId, modality, cond, approaches, window)
  return { dam, cond, approaches, window, checklist }
}

export function TripSummary({
  damId,
  date,
  speciesId,
  modality,
  checked,
  onToggle,
}: { damId: string; date: string; speciesId: SpeciesId; modality: ModalityId; checked?: string[]; onToggle?: (id: string) => void }) {
  const { dam, cond, approaches, window, checklist } = computeTrip(damId, date, speciesId, modality)
  const h0 = parseInt(window.start)
  const h1 = parseInt(window.end) || 23
  const groups = ['Essencial', 'Segurança', 'Material', 'Conforto'] as const

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-ink text-white">
        <div className="absolute inset-0 opacity-70">
          <DamCover dam={dam} variant="thumb" sizes="(min-width: 768px) 720px, 100vw" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
        <div className="relative p-5">
          <Tag tone="glass">Sugestões ilustrativas para demonstrar a experiência</Tag>
          <h2 className="font-display mt-3 text-[30px] font-semibold leading-tight">{dam.name}</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-white/80">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-teal" aria-hidden />{formatDateLong(date)}</span>
            <span className="flex items-center gap-1.5"><Fish className="h-4 w-4 text-teal" aria-hidden />{speciesById[speciesId].name}</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-teal" aria-hidden />{modalityName(modality)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-extrabold text-ink">Condições simuladas</h3>
            <Tag tone="amber">Simulado</Tag>
          </div>
          <div className="mt-3.5">
            <ConditionsGrid c={cond} />
          </div>
          <div className="mt-5">
            <HourlyChart data={cond.hourly} highlight={[h0, h1]} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-800">
              <Clock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Faixa horária sugerida · {window.label}</p>
              <p className="tnum mt-0.5 text-[24px] font-extrabold text-ink">
                {window.start} – {window.end}
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{window.why}</p>
            </div>
          </div>
          <h3 className="mt-6 text-[15px] font-extrabold text-ink">Três abordagens a experimentar</h3>
          <ol className="mt-3 space-y-2.5">
            {approaches.map((a, i) => (
              <li key={a.id} className="rounded-2xl border border-line p-3.5">
                <div className="flex items-start gap-3">
                  <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-extrabold text-white">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-extrabold text-ink">{a.title}</p>
                    <p className="text-[13px] font-semibold text-teal-700">{a.setup}</p>
                    <p className="mt-1.5 flex gap-1.5 text-[13px] leading-relaxed text-muted">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-800" aria-hidden />
                      {a.why}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12px] text-muted">Abordagens a experimentar, sem garantia de resultado.</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-extrabold text-ink">Equipamento e checklist</h3>
          {checked && (
            <span className="tnum text-[13px] font-bold text-muted">
              {checklist.filter((c) => checked.includes(c.id)).length}/{checklist.length}
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {groups.map((g) => {
            const items = checklist.filter((c) => c.group === g)
            if (!items.length) return null
            return (
              <div key={g}>
                <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wider text-subtle">{g}</p>
                <ul className="space-y-1">
                  {items.map((it) => {
                    const on = checked?.includes(it.id)
                    return (
                      <li key={it.id}>
                        {onToggle ? (
                          <button onClick={() => onToggle(it.id)} aria-pressed={on} className="press flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-mist/60">
                            <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition', on ? 'border-teal bg-teal text-ink' : 'border-line')}>
                              {on && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                            </span>
                            <span className={cx('text-[14px] font-semibold', on ? 'text-subtle line-through' : 'text-ink')}>{it.label}</span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-3 px-1 py-1.5 text-[14px] font-semibold text-ink">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden />
                            {it.label}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
