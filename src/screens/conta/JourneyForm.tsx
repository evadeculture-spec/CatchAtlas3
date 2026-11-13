import { ArrowDown, ArrowUp, Plus, Save, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, Chip, cx, Field, inputCls, PageHeader } from '../../components/ui'
import { ErrorBox, ListSkeleton, selectCls, textareaCls, useLoad } from '../../components/lanca/primitives'
import { TagInput } from '../../components/lanca/TagInput'
import { createJourney, createPin, friendly, getJourney, listPings, listPins, setJourneyPings, setJourneyPins, updateJourney, type JourneyFull } from '../../lib/lanca/api'
import { distanceM } from '../../lib/lanca/geo'
import { formatDateTime } from '../../lib/lanca/time'
import type { Pin, PingFull } from '../../lib/lanca/types'
import { MODALITIES, SPECIES_SUGGESTIONS } from '../../lib/lanca/labels'
import { defaultChecklist } from '../../lib/lanca/planner'
import { deviceTimeZone, TIMEZONES, todayIn } from '../../lib/lanca/time'
import { useAuth } from '../../state/Auth'
import { useToast } from '../../state/Toasts'

export default function JourneyForm() {
  const { id } = useParams()
  const { data, error, loading, reload } = useLoad(async () => {
    const [pins, journey, pings] = await Promise.all([listPins(), id ? getJourney(id) : Promise.resolve(null), listPings({ limit: 3000 })])
    return { pins, journey, pings }
  }, [id])
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading || !data) return <ListSkeleton />
  return <JourneyFormBody key={id ?? 'nova'} id={id} allPins={data.pins} j={data.journey} allPings={data.pings} />
}

function JourneyFormBody({ id, allPins, j, allPings }: { id?: string; allPins: Pin[]; j: JourneyFull | null; allPings: PingFull[] }) {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const { profile } = useAuth()
  const [title, setTitle] = useState(j?.title ?? '')
  // Planeamento a partir de um setor do Atlas da Carpa (?setor=&data=&nome=): a data escolhida na ficha passa para a jornada.
  const qs = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const qsDate = /^\d{4}-\d{2}-\d{2}$/.test(qs.get('data') ?? '') ? qs.get('data')! : null
  const [date, setDate] = useState(() => j?.journey_date ?? qsDate ?? todayIn(deviceTimeZone()))
  const [start, setStart] = useState(j ? (j.start_time?.slice(0, 5) ?? '') : '06:30')
  const [end, setEnd] = useState(j ? (j.end_time?.slice(0, 5) ?? '') : '12:00')
  const [tz, setTz] = useState(() => j?.timezone ?? deviceTimeZone())
  const [modality, setModality] = useState(j ? (j.modality ?? '') : (profile?.modalities?.[0] ?? 'margem'))
  const [species, setSpecies] = useState<string[]>(j?.target_species ?? (qs.get('setor') ? ['carpa'] : profile?.favorite_species?.slice(0, 2) ?? []))
  // Planeamento a partir de uma massa de água do Atlas (?agua=&nome=&lat=&lng=) ou de um pin (?pin= / ?ping=).
  const agua = params.get('agua')
  const aguaNome = params.get('nome')
  const centre = params.get('lat') && params.get('lng') ? { lat: Number(params.get('lat')), lng: Number(params.get('lng')) } : null
  const waterPins = agua ? allPins.filter((p) => p.water_body_ref === agua && p.status === 'ativo') : []
  const waterPings = agua
    ? allPings.filter((p) => p.lat != null && (p.water_body_ref === agua || (centre && !p.water_body_ref && distanceM({ lat: p.lat, lng: p.lng! }, centre) < 3000))).slice(0, 40)
    : []
  const [selected, setSelected] = useState<string[]>(() => (j ? j.journey_pins.map((jp) => jp.pin_id) : params.get('pin') ? [params.get('pin')!] : waterPins.map((p) => p.id)))
  const [selectedPings, setSelectedPings] = useState<string[]>(() => (j ? j.journey_pings.map((t) => t.ping_id) : params.get('ping') ? [params.get('ping')!] : []))
  const [centrePin, setCentrePin] = useState(() => !j && !!agua && !!centre && !params.get('pin') && !params.get('ping') && waterPins.length === 0)
  const [notes, setNotes] = useState(j?.notes ?? (qs.get('setor') ? `Setor do Atlas da Carpa: ${qs.get('nome') ?? ''} [${qs.get('setor')}]` : ''))
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const pins = allPins.filter((p) => p.status === 'ativo' || selected.includes(p.id))
  const pinById = new Map(pins.map((p) => [p.id, p]))
  const move = (i: number, d: -1 | 1) => setSelected((s) => {
    const n = [...s]
    const j = i + d
    if (j < 0 || j >= n.length) return s
    ;[n[i], n[j]] = [n[j], n[i]]
    return n
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!date) return setErr('Escolha a data.')
    setBusy(true)
    setErr(null)
    const autoTitle = title.trim() || `${aguaNome ?? selected.map((s) => pinById.get(s)?.name).filter(Boolean)[0] ?? 'Jornada'} · ${date.split('-').reverse().slice(0, 2).join('/')}`
    const night = !!start && (Number(start.slice(0, 2)) < 6 || Number(start.slice(0, 2)) >= 19)
    try {
      const payload = { title: autoTitle.slice(0, 120), journey_date: date, start_time: start || null, end_time: end || null, timezone: tz, modality: modality || null, target_species: species, notes: notes.trim() || null }
      let jid = id
      if (id) await updateJourney(id, payload)
      else {
        const j = await createJourney({ ...payload, checklist: defaultChecklist(modality || null, selected.map((s) => pinById.get(s)!).filter(Boolean), night) })
        jid = j.id
      }
      let pinIds = selected
      if (centrePin && centre && agua) {
        // Ponto de referência explícito (escolhido pelo utilizador) no centro da água, para a previsão.
        const ref = await createPin({ name: `${aguaNome ?? 'Massa de água'} (centro)`, category: 'interesse', lat: centre.lat, lng: centre.lng, coord_source: 'mapa', water_body_ref: agua, water_body_name: aguaNome })
        pinIds = [ref.id, ...selected]
      }
      await setJourneyPins(jid!, pinIds)
      await setJourneyPings(jid!, selectedPings)
      toast(id ? 'Jornada atualizada' : 'Jornada criada')
      nav(`/conta/jornadas/${jid}`, { replace: true })
    } catch (x) {
      setErr(friendly(x))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="-mx-4 -mt-5 lg:-mx-8">
      <PageHeader title={id ? 'Editar jornada' : 'Planear jornada'} back={id ? `/conta/jornadas/${id}` : '/conta/jornadas'} />
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5 px-4 py-5 lg:px-8">
        <Field label="Nome" htmlFor="t" optional hint="Se ficar vazio, usa o primeiro Pin e a data.">
          <input id="t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Data" htmlFor="d">
            <input id="d" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Início" htmlFor="s">
            <input id="s" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Fim" htmlFor="e">
            <input id="e" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Fuso" htmlFor="tz">
            <select id="tz" value={tz} onChange={(e) => setTz(e.target.value)} className={selectCls}>
              {[...new Set([tz, ...TIMEZONES])].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">Modalidade</p>
          <div className="flex flex-wrap gap-2">
            {MODALITIES.map((m) => (
              <Chip key={m.id} active={modality === m.id} onClick={() => setModality(m.id)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Espécies-alvo" optional>
          <TagInput value={species} onChange={setSpecies} suggestions={SPECIES_SUGGESTIONS} placeholder="Adicionar espécie" />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">Locais (por ordem)</p>
          {selected.length > 0 && (
            <ol className="mb-2 space-y-1.5">
              {selected.map((sid, i) => (
                <li key={sid} className="flex items-center gap-2 rounded-2xl bg-white p-2 pl-3 shadow-card">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-extrabold text-white">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{pinById.get(sid)?.name ?? 'Pin'}</span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-9 w-9 place-items-center rounded-full text-muted disabled:opacity-30" aria-label="Subir">
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} className="grid h-9 w-9 place-items-center rounded-full text-muted disabled:opacity-30" aria-label="Descer">
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => setSelected((s) => s.filter((x) => x !== sid))} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-danger" aria-label="Retirar">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-2">
            <select value={adding} onChange={(e) => setAdding(e.target.value)} className={selectCls} aria-label="Adicionar Pin">
              <option value="">{pins.length ? 'Escolher um Pin…' : 'Ainda não tem Pins'}</option>
              {pins.filter((p) => !selected.includes(p.id)).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button variant="dark" icon={Plus} disabled={!adding} onClick={() => (setSelected((s) => [...s, adding]), setAdding(''))}>
              Adicionar
            </Button>
          </div>
        </div>
        {(waterPings.length > 0 || (agua && centre)) && (
          <div>
            <p className="mb-1 text-[13px] font-bold text-ink">{aguaNome ? `As suas capturas e observações em ${aguaNome}` : 'As suas capturas e observações'}</p>
            <p className="mb-2 text-[12.5px] text-muted">Escolha os pontos onde quer voltar. Ficam na jornada como referência (não é criada outra captura).</p>
            {waterPings.length === 0 && <p className="mb-2 text-[13px] text-muted">Ainda não tem registos nesta água.</p>}
            <ul className="space-y-1.5">
              {waterPings.map((p) => {
                const on = selectedPings.includes(p.id)
                return (
                  <li key={p.id}>
                    <label className={cx('flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-2.5', on ? 'border-teal bg-teal-50' : 'border-line bg-white')}>
                      <input type="checkbox" className="h-5 w-5 accent-[#20bfa9]" checked={on} onChange={() => setSelectedPings((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-ink">{p.catches[0]?.species ?? (p.kind === 'captura' ? 'Captura' : 'Observação')}</span>
                        <span className="block truncate text-[12px] text-muted">{formatDateTime(p.occurred_at, p.occurred_tz)}{p.ping_environment?.air_temp_c != null ? ` · ${Math.round(p.ping_environment.air_temp_c)} °C` : ''}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            {agua && centre && (
              <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl bg-mist p-3 text-[13px] text-muted">
                <input type="checkbox" className="h-5 w-5 accent-[#20bfa9]" checked={centrePin} onChange={(e) => setCentrePin(e.target.checked)} />
                Criar um ponto de referência no centro de {aguaNome ?? 'esta água'} (para a previsão)
              </label>
            )}
          </div>
        )}
        <Field label="Notas" htmlFor="n" optional>
          <textarea id="n" value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} />
        </Field>
        {err && <ErrorBox message={err} />}
        <Button type="submit" size="lg" icon={Save} className="w-full" disabled={busy}>
          {busy ? 'A guardar…' : id ? 'Guardar' : 'Criar jornada'}
        </Button>
      </form>
    </div>
  )
}
