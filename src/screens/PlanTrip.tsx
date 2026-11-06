import { Anchor, Check, Footprints, Sailboat, Save } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { SpeciesDot } from '../components/bits'
import { DamCover } from '../components/photo/DamCover'
import { TripSummary } from '../components/TripSummary'
import { Button, cx, inputCls, PageHeader, Tag } from '../components/ui'
import { damRegion, MODALITIES, SPECIES } from '../data/catalog'
import { DAMS, damById } from '../data/dams'
import type { ModalityId, SpeciesId } from '../data/types'
import { addDaysISO } from '../lib/dates'
import { capFirst, relativeDay, formatDate } from '../lib/format'
import { simulateConditions } from '../lib/weather'
import { SkyIcon } from '../components/cards'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'

const STEPS = ['Barragem', 'Data', 'Espécie', 'Modalidade', 'Resumo']
const MOD_ICON = { margem: Footprints, caiaque: Sailboat, embarcacao: Anchor }

export default function PlanTrip() {
  const { state, saveTrip } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const damId = params.get('barragem') && damById[params.get('barragem')!] ? params.get('barragem')! : ''
  const date = params.get('data') ?? ''
  const species = (params.get('especie') as SpeciesId | null) ?? null
  const modality = (params.get('modalidade') as ModalityId | null) ?? null
  const requested = Number(params.get('passo') ?? (damId ? 1 : 0))
  const completed = [!!damId, !!date, !!species, !!modality]
  const maxStep = completed.findIndex((c) => !c)
  const step = Math.min(requested, maxStep === -1 ? 4 : maxStep)

  const update = (k: string, v: string, advance = true) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    if (advance) next.set('passo', String(step + 1))
    setParams(next, { replace: !advance })
  }
  const goStep = (s: number) => {
    const next = new URLSearchParams(params)
    next.set('passo', String(s))
    setParams(next)
  }

  const dam = damId ? damById[damId] : null
  const days = Array.from({ length: 10 }, (_, i) => addDaysISO(state.anchor, i))
  const maxDate = addDaysISO(state.anchor, 30)

  const save = () => {
    if (!dam || !date || !species || !modality) return
    const t = saveTrip({ damId: dam.id, date, speciesId: species, modality })
    toast('Jornada guardada', { detail: 'Pode consultá-la no Perfil, em Jornadas guardadas.' })
    navigate(`/jornadas/${t.id}`, { replace: true })
  }

  return (
    <div>
      <PageHeader back={dam ? `/barragens/${dam.id}` : '/'} title="Preparar jornada" eyebrow={`Passo ${step + 1} de 5 · ${STEPS[step]}`} />
      <div className="mx-auto max-w-3xl px-4 pt-4 lg:px-8">
        <ol className="flex gap-1.5" aria-label="Progresso">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button
                onClick={() => i <= (maxStep === -1 ? 4 : maxStep) && goStep(i)}
                disabled={i > (maxStep === -1 ? 4 : maxStep)}
                aria-current={i === step ? 'step' : undefined}
                className="group w-full text-left disabled:cursor-default"
              >
                <span className={cx('block h-1.5 rounded-full transition-colors', i < step ? 'bg-teal' : i === step ? 'bg-ink' : 'bg-line')} />
                <span className={cx('mt-1.5 hidden text-[11.5px] font-bold sm:block', i === step ? 'text-ink' : 'text-subtle')}>{s}</span>
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="page-in mt-6">
            <h2 className="font-display text-[28px] font-semibold text-ink">Onde vais pescar?</h2>
            {(['PT', 'ES'] as const).map((country) => (
            <div key={country}>
            <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{country === 'PT' ? 'Portugal' : 'Espanha'}</p>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {DAMS.filter((d) => d.country === country).map((d) => (
                <button key={d.id} onClick={() => update('barragem', d.id)} aria-pressed={damId === d.id} className={cx('press flex items-center gap-3 rounded-2xl border-2 bg-white p-2 text-left', damId === d.id ? 'border-ink' : 'border-transparent shadow-card')}>
                  <span className="h-14 w-16 shrink-0 overflow-hidden rounded-xl">
                    <DamCover dam={d} variant="thumb" sizes="64px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold text-ink">{d.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">{damRegion(d)} · {d.river}</span>
                  </span>
                  {state.favorites.includes(d.id) && <Tag tone="amber">Favorita</Tag>}
                </button>
              ))}
            </div>
            </div>
            ))}
          </section>
        )}

        {step === 1 && dam && (
          <section className="page-in mt-6">
            <h2 className="font-display text-[28px] font-semibold text-ink">Quando?</h2>
            <p className="mt-1 text-muted">Condições simuladas para {dam.name}.</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {days.map((d) => {
                const c = simulateConditions(dam, d)
                return (
                  <button key={d} onClick={() => update('data', d)} aria-pressed={date === d} className={cx('press rounded-2xl border-2 bg-white p-3 text-left', date === d ? 'border-ink' : 'border-transparent shadow-card')}>
                    <span className="block text-[12px] font-bold text-muted">{relativeDay(d, state.anchor)}</span>
                    <span className="block text-[14px] font-extrabold text-ink">{capFirst(formatDate(d, { weekday: 'short', day: 'numeric' }))}</span>
                    <span className="tnum mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <SkyIcon sky={c.sky} className="h-4 w-4 text-teal-700" /> {c.airMax}° · {c.wind} km/h
                    </span>
                  </button>
                )
              })}
            </div>
            <label htmlFor="trip-date" className="mt-5 block text-[13px] font-bold text-ink">
              Outra data (até 30 dias)
            </label>
            <input id="trip-date" type="date" min={state.anchor} max={maxDate} value={date} onChange={(e) => e.target.value && update('data', e.target.value)} className={cx(inputCls, 'mt-1.5 sm:w-64')} />
          </section>
        )}

        {step === 2 && dam && (
          <section className="page-in mt-6">
            <h2 className="font-display text-[28px] font-semibold text-ink">Que espécie?</h2>
            <p className="mt-1 text-muted">Destacamos as espécies de exemplo desta barragem (não verificadas).</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[...SPECIES].sort((a, b) => Number(dam.species.includes(b.id)) - Number(dam.species.includes(a.id))).map((s) => (
                <button key={s.id} onClick={() => update('especie', s.id)} aria-pressed={species === s.id} className={cx('press flex flex-col items-start rounded-2xl border-2 bg-white p-3.5 text-left', species === s.id ? 'border-ink' : 'border-transparent shadow-card')}>
                  <span className="flex items-center gap-2 font-extrabold text-ink">
                    <SpeciesDot id={s.id} className="h-2.5 w-2.5" /> {s.name}
                  </span>
                  <span className="mt-1 text-[12px] font-semibold text-muted">{dam.species.includes(s.id) ? 'Exemplo nesta barragem' : 'Fora dos exemplos'}</span>
                  {state.profile.species.includes(s.id) && <span className="mt-2"><Tag tone="teal">Favorita</Tag></span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && dam && (
          <section className="page-in mt-6">
            <h2 className="font-display text-[28px] font-semibold text-ink">Como vais pescar?</h2>
            <div className="mt-4 space-y-2.5">
              {MODALITIES.map((m) => {
                const I = MOD_ICON[m.id]
                const suggested = dam.modalities.includes(m.id)
                return (
                  <button key={m.id} onClick={() => update('modalidade', m.id)} aria-pressed={modality === m.id} className={cx('press flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left', modality === m.id ? 'border-ink' : 'border-transparent shadow-card')}>
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-mist text-ink">
                      <I className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block font-extrabold text-ink">{m.name}</span>
                      <span className="block text-[13px] text-muted">{suggested ? m.hint : 'Não indicada nos exemplos desta barragem — confirme acessos'}</span>
                    </span>
                    {modality === m.id && <Check className="h-5 w-5 text-teal-700" aria-hidden />}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {step === 4 && dam && date && species && modality && (
          <section className="page-in mt-6">
            <TripSummary damId={dam.id} date={date} speciesId={species} modality={modality} />
            <div className="sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-20 -mx-4 mt-4 flex gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-xl lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => goStep(0)}>
                Alterar
              </Button>
              <Button size="lg" icon={Save} className="flex-[2]" onClick={save}>
                Guardar jornada
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
