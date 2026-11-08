import { Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, Chip, Field, inputCls, PageHeader, Toggle } from '../../components/ui'
import { LocationPicker, type PickedLocation } from '../../components/lanca/LocationPicker'
import { ErrorBox, ListSkeleton, Notice, selectCls, textareaCls, useLoad } from '../../components/lanca/primitives'
import { TagInput } from '../../components/lanca/TagInput'
import { createPin, friendly, getPin, listPins, nearbyPins, updatePin, updatePing } from '../../lib/lanca/api'
import { formatDistance } from '../../lib/lanca/geo'
import { BAIT_SUGGESTIONS, ENVIRONMENTS, MODALITIES, PIN_CATEGORIES, SPECIES_SUGGESTIONS, TECHNIQUE_SUGGESTIONS } from '../../lib/lanca/labels'
import type { CoordSource, Pin, PinCategory, PinInput, WaterEnvironment } from '../../lib/lanca/types'
import { useToast } from '../../state/Toasts'

const SOURCE: Record<PickedLocation['source'], CoordSource> = { gps: 'gps', mapa: 'mapa', manual: 'manual', foto: 'foto', pin: 'ping' }

export default function PinForm() {
  const { id } = useParams()
  const { data, error, loading, reload } = useLoad(async () => ({ pin: id ? await getPin(id) : null, all: await listPins() }), [id])
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading || !data) return <ListSkeleton />
  return <PinFormBody key={id ?? 'novo'} id={id} initial={data.pin} all={data.all} />
}

const EMPTY_PIN: Partial<PinInput> = { category: 'spot', status: 'ativo', is_favorite: false, tags: [], target_species: [], modalities: [], techniques: [], baits: [] }

function PinFormBody({ id, initial, all }: { id?: string; initial: Pin | null; all: Pin[] }) {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const editing = !!id
  const fromPing = params.get('fromPing')
  const [form, setForm] = useState<Partial<PinInput>>(() => initial ?? { ...EMPTY_PIN, name: params.get('name') ?? undefined })
  const [loc, setLoc] = useState<PickedLocation | null>(() => {
    if (initial) return { lat: initial.lat, lng: initial.lng, accuracy: initial.accuracy_m, source: initial.coord_source === 'ping' ? 'pin' : (initial.coord_source as PickedLocation['source']), measuredAt: null }
    const lat = Number(params.get('lat'))
    const lng = Number(params.get('lng'))
    return params.get('lat') && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, accuracy: params.get('acc') ? Number(params.get('acc')) : null, source: fromPing ? 'pin' : 'mapa', measuredAt: null } : null
  })
  const [depth, setDepth] = useState(() => (initial?.depth_m != null ? String(initial.depth_m) : ''))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [nearState, setNearState] = useState<{ key: string; list: { id: string; name: string; distance_m: number }[] }>({ key: '', list: [] })
  const locKey = loc ? `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}` : ''
  const near = loc && nearState.key === locKey ? nearState.list : []

  // Evita duplicar Pins: avisa se já existe um Pin a menos de 150 m (o utilizador decide).
  useEffect(() => {
    if (!loc) return
    let alive = true
    const t = setTimeout(() => {
      nearbyPins(loc.lat, loc.lng, 150)
        .then((r) => alive && setNearState({ key: locKey, list: r.filter((p) => p.id !== id) }))
        .catch(() => undefined)
    }, 400)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [loc, locKey, id])

  const set = <K extends keyof PinInput>(k: K, v: PinInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim()) return setErr('Dê um nome ao Pin.')
    if (!loc) return setErr('Marque a localização no mapa.')
    setBusy(true)
    setErr(null)
    const d = depth.trim() ? Number(depth.replace(',', '.')) : null
    const payload: Partial<PinInput> & Pick<PinInput, 'name' | 'lat' | 'lng'> = {
      name: form.name.trim().slice(0, 80),
      category: form.category as PinCategory,
      description: form.description?.trim() || null,
      tags: form.tags ?? [],
      is_favorite: !!form.is_favorite,
      lat: loc.lat,
      lng: loc.lng,
      accuracy_m: loc.accuracy,
      coord_source: SOURCE[loc.source],
      water_body_name: form.water_body_name?.trim() || null,
      environment: (form.environment as WaterEnvironment) || null,
      access_notes: form.access_notes?.trim() || null,
      target_species: form.target_species ?? [],
      modalities: form.modalities ?? [],
      techniques: form.techniques ?? [],
      baits: form.baits ?? [],
      depth_m: d != null && Number.isFinite(d) && d >= 0 && d < 12000 ? d : null,
      bottom_type: form.bottom_type?.trim() || null,
      private_notes: form.private_notes?.trim() || null,
    }
    try {
      let pin: Pin
      if (editing) pin = await updatePin(id!, payload)
      else {
        pin = await createPin(payload)
        if (fromPing) await updatePing(fromPing, { pin_id: pin.id })
      }
      toast(editing ? 'Pin atualizado' : 'Pin criado')
      nav(fromPing ? `/conta/pings/${fromPing}` : `/conta/pins/${pin.id}`, { replace: true })
    } catch (x) {
      setErr(friendly(x))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="-mx-4 -mt-5 lg:-mx-8">
      <PageHeader title={editing ? 'Editar Pin' : 'Novo Pin'} back={editing ? `/conta/pins/${id}` : '/conta/pins'} />
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5 px-4 py-5 lg:px-8">
        <Field label="Nome" htmlFor="name">
          <input id="name" required maxLength={80} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="Ex.: Margem norte da ponte" />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">Categoria</p>
          <div className="flex flex-wrap gap-2">
            {PIN_CATEGORIES.map((c) => (
              <Chip key={c.id} active={form.category === c.id} onClick={() => set('category', c.id)}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">Localização</p>
          <LocationPicker value={loc} onChange={setLoc} pins={all.filter((p) => p.id !== id)} />
          {near.length > 0 && (
            <Notice tone="warn" className="mt-2">
              Já tem {near.length === 1 ? 'um Pin' : `${near.length} Pins`} perto deste local: {near.map((n) => `${n.name} (${formatDistance(n.distance_m)})`).join(', ')}. Confirme que não é o mesmo local antes de guardar.
            </Notice>
          )}
        </div>
        <Toggle label="Favorito" description="Aparece em destaque no painel e no mapa." checked={!!form.is_favorite} onChange={(v) => set('is_favorite', v)} />

        <details className="rounded-[var(--radius-card)] bg-white p-4 shadow-card" open={editing}>
          <summary className="cursor-pointer text-[14px] font-extrabold text-ink">Água e acesso</summary>
          <div className="mt-4 space-y-4">
            <Field label="Corpo de água" htmlFor="water" optional>
              <input id="water" value={form.water_body_name ?? ''} onChange={(e) => set('water_body_name', e.target.value)} className={inputCls} placeholder="Ex.: Albufeira de Castelo do Bode" />
            </Field>
            <Field label="Tipo de ambiente" htmlFor="env" optional>
              <select id="env" value={form.environment ?? ''} onChange={(e) => set('environment', (e.target.value || null) as WaterEnvironment | null)} className={selectCls}>
                <option value="">—</option>
                {ENVIRONMENTS.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Acesso ao local" htmlFor="access" optional>
              <textarea id="access" value={form.access_notes ?? ''} onChange={(e) => set('access_notes', e.target.value)} className={textareaCls} placeholder="Caminho, portões, estado da estrada…" />
            </Field>
            <Field label="Descrição" htmlFor="desc" optional>
              <textarea id="desc" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} className={textareaCls} />
            </Field>
          </div>
        </details>

        <details className="rounded-[var(--radius-card)] bg-white p-4 shadow-card" open={editing}>
          <summary className="cursor-pointer text-[14px] font-extrabold text-ink">Informação de pesca</summary>
          <div className="mt-4 space-y-4">
            <Field label="Espécies-alvo" optional>
              <TagInput value={form.target_species ?? []} onChange={(v) => set('target_species', v)} suggestions={SPECIES_SUGGESTIONS} placeholder="Adicionar espécie" />
            </Field>
            <div>
              <p className="mb-1.5 text-[13px] font-bold text-ink">Modalidades</p>
              <div className="flex flex-wrap gap-2">
                {MODALITIES.map((m) => {
                  const on = form.modalities?.includes(m.id)
                  return (
                    <Chip key={m.id} active={on} onClick={() => set('modalities', on ? form.modalities!.filter((x) => x !== m.id) : [...(form.modalities ?? []), m.id])}>
                      {m.label}
                    </Chip>
                  )
                })}
              </div>
            </div>
            <Field label="Técnicas" optional>
              <TagInput value={form.techniques ?? []} onChange={(v) => set('techniques', v)} suggestions={TECHNIQUE_SUGGESTIONS} placeholder="Adicionar técnica" />
            </Field>
            <Field label="Iscos" optional>
              <TagInput value={form.baits ?? []} onChange={(v) => set('baits', v)} suggestions={BAIT_SUGGESTIONS} placeholder="Adicionar isco" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Profundidade (m)" htmlFor="depth" optional>
                <input id="depth" inputMode="decimal" value={depth} onChange={(e) => setDepth(e.target.value)} className={inputCls} placeholder="3" />
              </Field>
              <Field label="Tipo de fundo" htmlFor="bottom" optional>
                <input id="bottom" value={form.bottom_type ?? ''} onChange={(e) => set('bottom_type', e.target.value)} className={inputCls} placeholder="Pedra, lodo, areia…" />
              </Field>
            </div>
            <Field label="Etiquetas" optional>
              <TagInput value={form.tags ?? []} onChange={(v) => set('tags', v)} placeholder="Ex.: madrugada, vento norte" />
            </Field>
          </div>
        </details>

        <Field label="Notas privadas" htmlFor="notes" optional hint="Só visíveis para si.">
          <textarea id="notes" value={form.private_notes ?? ''} onChange={(e) => set('private_notes', e.target.value)} className={textareaCls} />
        </Field>
        {err && <ErrorBox message={err} />}
        <Button type="submit" size="lg" icon={Save} className="w-full" disabled={busy}>
          {busy ? 'A guardar…' : editing ? 'Guardar alterações' : 'Criar Pin'}
        </Button>
      </form>
    </div>
  )
}
