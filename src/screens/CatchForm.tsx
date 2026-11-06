import { Camera, ImagePlus, Info, Lock, Globe, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, Chip, cx, Field, inputCls, PageHeader, Segmented, Toggle } from '../components/ui'
import { SPECIES, speciesById, TECHNIQUES } from '../data/catalog'
import { DAMS, damById } from '../data/dams'
import type { SpeciesId } from '../data/types'
import { addDaysISO } from '../lib/dates'
import { gramsToKgInput, parseKgToGrams } from '../lib/format'
import { compressPhoto, deletePhoto, PhotoError, savePhoto, validatePhoto } from '../lib/photos'
import { usePhotoUrl } from '../lib/usePhotoUrl'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'
import NotFound from './NotFound'
import { currentPeriod } from './ReportForm'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23566a73' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundSize: '16px',
  backgroundPosition: 'right 16px center',
  backgroundRepeat: 'no-repeat',
}

type Errors = Partial<Record<'species' | 'dam' | 'weight' | 'length' | 'date' | 'photo', string>>

export default function CatchForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { state, addCatch, updateCatch, bumpPhotos, addReport } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const existing = id ? state.myCatches.find((c) => c.id === id) : undefined
  const existingPhoto = usePhotoUrl(existing?.id ?? '', !!existing?.hasPhoto)

  const prefSpecies = params.get('especie') as SpeciesId | null
  const [species, setSpecies] = useState<SpeciesId | ''>(existing?.speciesId ?? (prefSpecies && speciesById[prefSpecies] ? prefSpecies : (state.profile.species[0] ?? '')))
  const [damId, setDamId] = useState(existing?.damId ?? (params.get('barragem') && damById[params.get('barragem')!] ? params.get('barragem')! : (state.favorites[0] ?? '')))
  const [weight, setWeight] = useState(existing ? gramsToKgInput(existing.weightG) : '')
  const [length, setLength] = useState(existing?.lengthCm ? String(existing.lengthCm) : '')
  const [date, setDate] = useState(existing?.date ?? params.get('data') ?? state.anchor)
  const [technique, setTechnique] = useState(existing?.technique ?? '')
  const [lure, setLure] = useState(existing?.lure ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [released, setReleased] = useState(existing?.released ?? true)
  const [visibility, setVisibility] = useState<'publica' | 'privada'>(existing?.visibility ?? 'publica')
  const [ranking, setRanking] = useState(existing?.ranking ?? true)
  const [makeReport, setMakeReport] = useState(false)
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo])

  if (id && !existing) return <NotFound />

  const previewUrl = photo?.url ?? (!removePhoto ? existingPhoto.url : null)
  const minDate = addDaysISO(state.anchor, -730)

  const onFile = (f: File | undefined) => {
    if (!f) return
    const err = validatePhoto(f)
    if (err) {
      setErrors((e) => ({ ...e, photo: err }))
      return
    }
    setErrors((e) => ({ ...e, photo: undefined }))
    setPhoto({ file: f, url: URL.createObjectURL(f) })
    setRemovePhoto(false)
  }

  const validate = () => {
    const e: Errors = {}
    if (!species) e.species = 'Escolha a espécie.'
    if (!damId) e.dam = 'Escolha a barragem.'
    const g = parseKgToGrams(weight)
    if (g === null) e.weight = 'Indique o peso em kg, por exemplo 1,25.'
    else if (g > 120_000) e.weight = 'O peso parece demasiado elevado. Confirme o valor em kg.'
    if (length) {
      const l = Number(length)
      if (!Number.isInteger(l) || l < 1 || l > 250) e.length = 'Indique o comprimento em cm (número inteiro até 250).'
    }
    if (!date || date > state.anchor) e.date = 'A data não pode ser futura.'
    else if (date < minDate) e.date = 'Use uma data dos últimos dois anos.'
    setErrors(e)
    return Object.keys(e).length === 0 ? g : null
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const weightG = validate()
    if (weightG === null || !species) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
      return
    }
    setSaving(true)
    let blob: Blob | null = null
    if (photo) {
      try {
        blob = await compressPhoto(photo.file)
      } catch (err) {
        setSaving(false)
        setErrors((e) => ({ ...e, photo: err instanceof PhotoError ? err.message : 'Não foi possível processar a fotografia.' }))
        return
      }
    }
    const data = {
      speciesId: species,
      damId,
      weightG,
      lengthCm: length ? Number(length) : undefined,
      date,
      technique,
      lure: lure.trim(),
      notes: notes.trim(),
      released,
      visibility,
      ranking: visibility === 'publica' && ranking,
      hasPhoto: blob ? true : removePhoto ? false : (existing?.hasPhoto ?? false),
    }
    const targetId = existing ? existing.id : addCatch(data).id
    if (existing) updateCatch(existing.id, data)
    let photoWarning: string | undefined
    if (blob) {
      try {
        await savePhoto(targetId, blob)
      } catch (err) {
        updateCatch(targetId, { hasPhoto: false })
        photoWarning = err instanceof PhotoError ? err.message : 'A fotografia não foi guardada.'
      }
    } else if (removePhoto && existing) await deletePhoto(existing.id)
    if (makeReport && !existing && visibility === 'publica') {
      addReport({ damId, speciesId: species, activity: 'moderada', period: currentPeriod(), date, catches: 1, technique, lure: lure.trim(), note: notes.trim() })
    }
    bumpPhotos()
    setSaving(false)
    if (photoWarning) toast('Captura guardada sem fotografia', { tone: 'warning', detail: photoWarning })
    else
      toast(existing ? 'Captura atualizada' : 'Captura registada', {
        detail: data.ranking ? `Conta para o ranking de demonstração de ${speciesById[species].name}.` : 'Guardada no diário deste navegador.',
      })
    navigate(`/capturas/${targetId}`, { replace: true })
  }

  return (
    <div>
      <PageHeader back={existing ? `/capturas/${existing.id}` : '/capturas'} title={existing ? 'Editar captura' : 'Registar captura'} />
      <form onSubmit={submit} noValidate className="mx-auto max-w-3xl px-4 pt-4 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="catch-photo" onChange={(e) => onFile(e.target.files?.[0])} />
            {previewUrl ? (
              <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-ink shadow-card">
                <img src={previewUrl} alt="Pré-visualização da fotografia" className="aspect-[4/3] w-full object-cover lg:aspect-[3/4]" />
                <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10">
                  <Button type="button" size="sm" variant="soft" icon={Camera} onClick={() => fileRef.current?.click()}>
                    Trocar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    className="bg-black/30 text-white hover:bg-black/45"
                    onClick={() => {
                      setPhoto(null)
                      setRemovePhoto(true)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="catch-photo"
                className="press flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed border-[#c9d6d9] bg-white text-center hover:border-teal hover:bg-teal-50/40 lg:aspect-[3/4]"
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
                tabIndex={0}
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                  <ImagePlus className="h-6 w-6" aria-hidden />
                </span>
                <span className="mt-3 font-extrabold text-ink">Adicionar fotografia</span>
                <span className="mt-1 px-6 text-[12.5px] text-muted">Opcional · JPEG, PNG ou WebP até 15 MB. É comprimida antes de guardar.</span>
              </label>
            )}
            {errors.photo && (
              <p className="mt-2 text-[12.5px] font-semibold text-danger" role="alert">
                {errors.photo}
              </p>
            )}
          </div>

          <div className="space-y-5">
            <Field label="Espécie" error={errors.species}>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Espécie">
                {SPECIES.map((s) => (
                  <Chip key={s.id} active={species === s.id} onClick={() => setSpecies(s.id)}>
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.name}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Barragem" htmlFor="f-dam" error={errors.dam}>
              <select id="f-dam" value={damId} onChange={(e) => setDamId(e.target.value)} className={cx(inputCls, 'appearance-none pr-10 font-semibold')} style={selectStyle}>
                <option value="">Escolher barragem</option>
                {DAMS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Peso (kg)" htmlFor="f-weight" error={errors.weight}>
                <input id="f-weight" inputMode="decimal" autoComplete="off" placeholder="1,25" value={weight} onChange={(e) => setWeight(e.target.value)} className={cx(inputCls, 'tnum font-bold')} aria-invalid={!!errors.weight} />
              </Field>
              <Field label="Comprimento (cm)" htmlFor="f-length" error={errors.length} optional>
                <input id="f-length" inputMode="numeric" autoComplete="off" placeholder="42" value={length} onChange={(e) => setLength(e.target.value.replace(/[^\d]/g, ''))} className={cx(inputCls, 'tnum font-bold')} aria-invalid={!!errors.length} />
              </Field>
            </div>

            <Field label="Data" htmlFor="f-date" error={errors.date}>
              <input id="f-date" type="date" value={date} min={minDate} max={state.anchor} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Técnica" htmlFor="f-tech" optional>
                <select id="f-tech" value={technique} onChange={(e) => setTechnique(e.target.value)} className={cx(inputCls, 'appearance-none pr-10')} style={selectStyle}>
                  <option value="">Sem indicação</option>
                  {TECHNIQUES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Amostra / isco" htmlFor="f-lure" optional>
                <input id="f-lure" value={lure} maxLength={60} onChange={(e) => setLure(e.target.value)} placeholder="Ex.: vinil 4'' verde" className={inputCls} />
              </Field>
            </div>

            <Field label="Notas" htmlFor="f-notes" optional>
              <textarea id="f-notes" rows={3} maxLength={400} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Zona, profundidade, condições…" className={cx(inputCls, 'h-auto py-3 leading-relaxed')} />
            </Field>

            <div className="space-y-4 rounded-[var(--radius-card)] bg-white p-4 shadow-card">
              <Toggle checked={released} onChange={setReleased} label="Captura libertada" description="Captura e solta." />
              <div className="border-t border-line pt-4">
                <p className="mb-2 text-[14px] font-bold text-ink">Visibilidade</p>
                <Segmented
                  label="Visibilidade"
                  value={visibility}
                  onChange={setVisibility}
                  options={[
                    { id: 'publica', label: 'Pública', icon: Globe },
                    { id: 'privada', label: 'Privada', icon: Lock },
                  ]}
                  className="w-full"
                />
                <p className="mt-2 text-[12.5px] text-muted">Na demonstração, “pública” significa visível nas listas e rankings deste navegador.</p>
              </div>
              <div className="border-t border-line pt-4">
                <Toggle
                  checked={visibility === 'publica' && ranking}
                  onChange={setRanking}
                  disabled={visibility === 'privada'}
                  label="Participar no ranking de demonstração"
                  description={visibility === 'privada' ? 'Disponível apenas para capturas públicas.' : 'Entra na classificação comunitária da espécie.'}
                />
              </div>
              {!existing && (
                <div className="border-t border-line pt-4">
                  <Toggle
                    checked={visibility === 'publica' && makeReport}
                    onChange={setMakeReport}
                    disabled={visibility === 'privada'}
                    label="Criar report no mapa de pings"
                    description="Publica um ping com localização aproximada e conta para o giveaway."
                  />
                </div>
              )}
            </div>

            <p className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              As capturas e fotografias ficam guardadas apenas neste navegador e não são partilhadas com outros utilizadores.
            </p>
          </div>
        </div>
        <div className="sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-xl lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
          <Button type="submit" size="lg" className="w-full lg:w-auto lg:min-w-[260px]" disabled={saving}>
            {saving ? 'A guardar…' : existing ? 'Guardar alterações' : 'Guardar captura'}
          </Button>
        </div>
      </form>
    </div>
  )
}
