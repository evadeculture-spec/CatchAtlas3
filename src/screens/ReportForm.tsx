import { Info, Minus, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, Chip, cx, Field, inputCls, PageHeader } from '../components/ui'
import { ACTIVITY, PERIODS_OF_DAY, SPECIES, TECHNIQUES } from '../data/catalog'
import { DAMS, damById } from '../data/dams'
import type { Activity, DayPeriod, SpeciesId } from '../data/types'
import { addDaysISO } from '../lib/dates'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23566a73' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundSize: '16px',
  backgroundPosition: 'right 16px center',
  backgroundRepeat: 'no-repeat',
}

export function currentPeriod(): DayPeriod {
  const h = new Date().getHours()
  return h < 6 ? 'madrugada' : h < 13 ? 'manha' : h < 20 ? 'tarde' : 'noite'
}

export default function ReportForm() {
  const { state, addReport } = useApp()
  const [params] = useSearchParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [damId, setDamId] = useState(params.get('barragem') && damById[params.get('barragem')!] ? params.get('barragem')! : (state.favorites[0] ?? ''))
  const [species, setSpecies] = useState<SpeciesId>((state.profile.species[0] as SpeciesId) ?? 'achiga')
  const [activity, setActivity] = useState<Activity | ''>('')
  const [period, setPeriod] = useState<DayPeriod>(currentPeriod())
  const [date, setDate] = useState(state.anchor)
  const [catches, setCatches] = useState(1)
  const [technique, setTechnique] = useState('')
  const [lure, setLure] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{ dam?: string; activity?: string; date?: string }>({})
  const minDate = addDaysISO(state.anchor, -7)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: typeof errors = {}
    if (!damId) err.dam = 'Escolha a barragem.'
    if (!activity) err.activity = 'Indique a atividade que encontrou.'
    if (!date || date > state.anchor || date < minDate) err.date = 'Use uma data dos últimos 7 dias.'
    setErrors(err)
    if (Object.keys(err).length || !activity) return
    const r = addReport({ damId, speciesId: species, activity, period, date, catches: activity === 'nula' ? 0 : catches, technique, lure: lure.trim(), note: note.trim() })
    toast('Report publicado', { detail: 'O ping já aparece no mapa de reports.' })
    navigate(`/reports?sel=${r.id}${damById[damId].country === 'PT' ? '&mapa=pt' : ''}`, { replace: true })
  }

  return (
    <div>
      <PageHeader back="/reports" title="Novo report" eyebrow="Mapa de pings" />
      <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-5 px-4 pt-4 lg:px-8">
        <Field label="Barragem" htmlFor="r-dam" error={errors.dam}>
          <select id="r-dam" value={damId} onChange={(e) => setDamId(e.target.value)} className={cx(inputCls, 'appearance-none pr-10 font-semibold')} style={selectStyle}>
            <option value="">Escolher barragem</option>
            <optgroup label="Portugal">
              {DAMS.filter((d) => d.country === 'PT').map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </optgroup>
            <optgroup label="Espanha">
              {DAMS.filter((d) => d.country === 'ES').map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </optgroup>
          </select>
        </Field>

        <Field label="Atividade encontrada" error={errors.activity}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setActivity(a)}
                aria-pressed={activity === a}
                className={cx('press flex h-14 items-center gap-2.5 rounded-2xl border-2 bg-white px-3 text-left text-[13.5px] font-extrabold text-ink', activity === a ? 'border-ink' : 'border-transparent shadow-card')}
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: ACTIVITY[a].color }} aria-hidden />
                {ACTIVITY[a].name.replace('Atividade ', '')}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Espécie">
          <div className="flex flex-wrap gap-2">
            {SPECIES.map((s) => (
              <Chip key={s.id} active={species === s.id} onClick={() => setSpecies(s.id)}>{s.name}</Chip>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data" htmlFor="r-date" error={errors.date}>
            <input id="r-date" type="date" value={date} min={minDate} max={state.anchor} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Período do dia">
            <div className="flex flex-wrap gap-2">
              {PERIODS_OF_DAY.map((p) => (
                <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>{p.name}</Chip>
              ))}
            </div>
          </Field>
        </div>

        {activity !== 'nula' && (
          <Field label="Capturas na jornada">
            <div className="inline-flex items-center gap-3 rounded-full bg-white p-1 shadow-card">
              <button type="button" onClick={() => setCatches(Math.max(0, catches - 1))} className="press grid h-10 w-10 place-items-center rounded-full bg-mist" aria-label="Menos uma captura"><Minus className="h-4 w-4" /></button>
              <span className="tnum w-8 text-center text-[17px] font-extrabold text-ink" aria-live="polite">{catches}</span>
              <button type="button" onClick={() => setCatches(Math.min(50, catches + 1))} className="press grid h-10 w-10 place-items-center rounded-full bg-mist" aria-label="Mais uma captura"><Plus className="h-4 w-4" /></button>
            </div>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Técnica" htmlFor="r-tech" optional>
            <select id="r-tech" value={technique} onChange={(e) => setTechnique(e.target.value)} className={cx(inputCls, 'appearance-none pr-10')} style={selectStyle}>
              <option value="">Sem indicação</option>
              {TECHNIQUES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Amostra / isco" htmlFor="r-lure" optional>
            <input id="r-lure" value={lure} maxLength={60} onChange={(e) => setLure(e.target.value)} placeholder="Ex.: crank médio" className={inputCls} />
          </Field>
        </div>
        <Field label="Nota" htmlFor="r-note" optional>
          <textarea id="r-note" rows={3} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Profundidade, cor da água, vento…" className={cx(inputCls, 'h-auto py-3 leading-relaxed')} />
        </Field>

        <p className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          O ping fica numa posição aproximada dentro da barragem. Na demonstração, o report é guardado apenas neste navegador.
        </p>
        <div className="sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-xl lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
          <Button type="submit" size="lg" className="w-full lg:w-auto lg:min-w-[240px]">Publicar report</Button>
        </div>
      </form>
    </div>
  )
}
