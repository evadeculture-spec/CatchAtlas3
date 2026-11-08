import { Camera, Check, Clock, Crosshair, ImagePlus, Loader2, MapPin, MapPinOff, Pencil, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Sheet } from '../../components/Dialog'
import { Button, Chip, cx, Field, inputCls, PageHeader, Toggle } from '../../components/ui'
import { LocationPicker, type PickedLocation } from '../../components/lanca/LocationPicker'
import { ErrorBox, Notice, selectCls, textareaCls, useLoad } from '../../components/lanca/primitives'
import { addCatch, createPin, createPing, enrichPing, friendly, listPins, nearbyPins, uploadPingPhoto } from '../../lib/lanca/api'
import { readPhotoMeta, resolvePhotoTime, type PhotoMeta, type ResolvedTime } from '../../lib/lanca/exif'
import { distanceM, formatCoords, formatDistance, getDevicePosition, locationDivergence } from '../../lib/lanca/geo'
import { prepareImage, type PreparedImage } from '../../lib/lanca/image'
import { BAIT_SUGGESTIONS, LOCATION_SOURCE, MODALITIES, OUTCOMES, PING_KINDS, RELIABILITY, SPECIES_SUGGESTIONS, TECHNIQUE_SUGGESTIONS, TIME_SOURCE } from '../../lib/lanca/labels'
import { deviceTimeZone, formatDateTime, TIMEZONES, tzForOffset, utcToZonedLocal, zonedLocalToUtc } from '../../lib/lanca/time'
import type { LocationSource, Outcome, Pin, PingKind } from '../../lib/lanca/types'
import { toBaseLength, toBaseWeight } from '../../lib/lanca/units'
import { useAuth } from '../../state/Auth'
import { useToast } from '../../state/Toasts'

interface Photo {
  key: string
  mediaId: string
  file: File
  prepared: PreparedImage | null
  meta: PhotoMeta | null
  capturedNow: boolean
  error: string | null
  uploaded: boolean
}

interface Loc {
  lat: number
  lng: number
  accuracy: number | null
  source: LocationSource
  measuredAt: string | null
}

const MAX_PHOTOS = 6
const uuid = () => crypto.randomUUID()

export default function PingNew() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const { units, profile } = useAuth()
  const pinsQ = useLoad(listPins, [])
  const pins = useMemo(() => (pinsQ.data ?? []).filter((p) => p.status === 'ativo'), [pinsQ.data])

  const [pingId] = useState(uuid)
  const [nowRef] = useState(() => Date.now())
  const [photos, setPhotos] = useState<Photo[]>([])
  const [kind, setKind] = useState<PingKind | null>(null)
  const [tz, setTz] = useState(deviceTimeZone)
  const [time, setTime] = useState<ResolvedTime>(() => ({ occurredAt: new Date().toISOString(), source: 'dispositivo', reliability: 'alta', note: 'Hora atual do dispositivo.' }))
  const [timeTouched, setTimeTouched] = useState(false)
  const [editTime, setEditTime] = useState(false)
  // Local indicado no URL (a partir do mapa) é o valor inicial.
  const [urlLoc] = useState<Loc | null>(() => {
    const lat = Number(params.get('lat'))
    const lng = Number(params.get('lng'))
    return params.get('lat') && Number.isFinite(lat) && Number.isFinite(lng) && !params.get('pin') ? { lat, lng, accuracy: null, source: 'mapa', measuredAt: null } : null
  })
  const [locState, setLoc] = useState<Loc | null>(urlLoc)
  const [locTouched, setLocTouched] = useState(!!urlLoc)
  const [noLocation, setNoLocation] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [gpsErr, setGpsErr] = useState<string | null>(null)
  const [divergence, setDivergence] = useState<{ photo: Loc; device: Loc; distance: number } | null>(null)
  const [pinId, setPinId] = useState<string | null>(params.get('pin'))
  const [suggestState, setSuggest] = useState<{ key: string; value: { id: string; name: string; distance_m: number } | null }>({ key: '', value: null })
  const [dismissed, setDismissed] = useState<string[]>([])
  const [savePin, setSavePin] = useState(false)
  const [pinName, setPinName] = useState('')
  // Detalhes opcionais
  const [species, setSpecies] = useState('')
  const [length, setLength] = useState('')
  const [weight, setWeight] = useState('')
  const [released, setReleased] = useState(true)
  const [count, setCount] = useState('')
  const [modality, setModality] = useState(profile?.modalities?.[0] ?? '')
  const [technique, setTechnique] = useState('')
  const [bait, setBait] = useState('')
  const [equipment, setEquipment] = useState('')
  const [depth, setDepth] = useState('')
  const [bottom, setBottom] = useState('')
  const [minutes, setMinutes] = useState('')
  const [outcome, setOutcome] = useState<Outcome | ''>('')
  const [notes, setNotes] = useState('')
  // Gravação
  const [phase, setPhase] = useState<'idle' | 'saving' | 'error'>('idle')
  const [progress, setProgress] = useState('')
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const done = useRef({ pin: null as string | null, ping: false, catch: false })
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const journeyId = params.get('journey')

  const pin = pins.find((p) => p.id === pinId) ?? null

  // Sem outro local escolhido, um Pin indicado usa a sua posição.
  const loc: Loc | null = locState ?? (pin && !locTouched ? { lat: pin.lat, lng: pin.lng, accuracy: pin.accuracy_m, source: 'pin', measuredAt: null } : null)

  // Sugestão de Pin próximo (nunca associa sozinho).
  const wantSuggest = !!loc && !pinId && loc.source !== 'pin'
  const suggestKey = loc ? `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}|${dismissed.join(',')}` : ''
  const suggest = wantSuggest && suggestState.key === suggestKey ? suggestState.value : null
  useEffect(() => {
    if (!wantSuggest || !loc) return
    let alive = true
    const t = setTimeout(() => {
      nearbyPins(loc.lat, loc.lng, 150)
        .then((r) => alive && setSuggest({ key: suggestKey, value: r.find((p) => p.status === 'ativo' && !dismissed.includes(p.id)) ?? null }))
        .catch(() => undefined)
    }, 350)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [wantSuggest, suggestKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => photos.forEach((p) => p.prepared?.previewUrl && URL.revokeObjectURL(p.prepared.previewUrl)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = async (files: FileList | null, capturedNow: boolean) => {
    if (!files?.length) return
    const room = MAX_PHOTOS - photos.length
    const list = [...files].slice(0, room)
    if (files.length > room) toast(`Máximo de ${MAX_PHOTOS} fotografias por Ping`, { tone: 'warning' })
    const first = photos.length === 0
    const fresh: Photo[] = list.map((file) => ({ key: uuid(), mediaId: uuid(), file, prepared: null, meta: null, capturedNow, error: null, uploaded: false }))
    setPhotos((ps) => [...ps, ...fresh])
    for (const [i, ph] of fresh.entries()) {
      const [prepared, meta] = await Promise.all([prepareImage(ph.file).catch((e: Error) => e), readPhotoMeta(ph.file)])
      setPhotos((ps) => ps.map((p) => (p.key === ph.key ? { ...p, prepared: prepared instanceof Error ? null : prepared, error: prepared instanceof Error ? prepared.message : null, meta } : p)))
      // A primeira fotografia sugere a hora e o local do acontecimento (se o utilizador não os definiu).
      if (first && i === 0) {
        if (!timeTouched) {
          const r = resolvePhotoTime(meta, tz, { fileLastModified: ph.file.lastModified, capturedNow })
          // Com o offset da câmara, o fuso do acontecimento passa a ser um fuso com esse offset.
          if (meta.offset && r.source === 'foto-exif') setTz(tzForOffset(meta.offset, Date.parse(r.occurredAt), tz))
          setTime(r)
        }
        if (meta.gps && !locTouched && !pinId) {
          setLoc({ lat: meta.gps.lat, lng: meta.gps.lng, accuracy: meta.gps.accuracy, source: 'foto-exif', measuredAt: null })
          setNoLocation(false)
        }
      }
    }
  }

  const removePhoto = (key: string) =>
    setPhotos((ps) => {
      const p = ps.find((x) => x.key === key)
      if (p?.prepared?.previewUrl) URL.revokeObjectURL(p.prepared.previewUrl)
      return ps.filter((x) => x.key !== key)
    })

  const photoGps = photos.find((p) => p.meta?.gps)?.meta?.gps ?? null

  const useGps = async () => {
    setGpsBusy(true)
    setGpsErr(null)
    try {
      const p = await getDevicePosition()
      const device: Loc = { lat: p.lat, lng: p.lng, accuracy: p.accuracy, source: 'gps', measuredAt: p.at }
      const d = locationDivergence(photoGps, device)
      if (photoGps && d) setDivergence({ photo: { ...photoGps, source: 'foto-exif', measuredAt: null }, device, distance: d })
      else {
        setLoc(device)
        setLocTouched(true)
        setNoLocation(false)
      }
    } catch (e) {
      setGpsErr((e as Error).message)
    } finally {
      setGpsBusy(false)
    }
  }

  const pickFromMap = (v: PickedLocation) => {
    setLoc({ lat: v.lat, lng: v.lng, accuracy: v.accuracy, source: v.source === 'gps' ? 'gps' : 'mapa', measuredAt: v.measuredAt })
    setLocTouched(true)
    setNoLocation(false)
  }

  const choosePin = (p: Pin | null) => {
    setPinId(p?.id ?? null)
    if (p && (!loc || !locTouched || distanceM(loc, p) > 500)) setLoc({ lat: p.lat, lng: p.lng, accuracy: p.accuracy_m, source: 'pin', measuredAt: null })
    if (p) setNoLocation(false)
  }

  const isCatch = kind === 'captura'
  const ready = !!kind && photos.every((p) => p.prepared || p.error) && phase !== 'saving'

  const save = async () => {
    if (!kind) return
    if (!navigator.onLine) {
      setSaveErr('Sem ligação à internet: o Ping não pode ser guardado agora. Mantenha esta página aberta e tente quando tiver rede.')
      setPhase('error')
      return
    }
    setPhase('saving')
    setSaveErr(null)
    try {
      let useLoc = noLocation ? null : loc
      let pid = pinId
      if (savePin && !pid && useLoc && !done.current.pin) {
        setProgress('A criar o Pin…')
        const p = await createPin({ name: (pinName || 'Novo local').slice(0, 80), category: isCatch ? 'captura' : 'spot', lat: useLoc.lat, lng: useLoc.lng, accuracy_m: useLoc.accuracy, coord_source: useLoc.source === 'gps' ? 'gps' : useLoc.source === 'foto-exif' ? 'foto' : 'mapa' })
        done.current.pin = p.id
      }
      pid = pid ?? done.current.pin
      if (!useLoc && pid && pin) useLoc = { lat: pin.lat, lng: pin.lng, accuracy: pin.accuracy_m, source: 'pin', measuredAt: null }
      const num = (s: string) => {
        const v = Number(s.replace(',', '.'))
        return s.trim() && Number.isFinite(v) && v >= 0 ? v : null
      }
      if (!done.current.ping) {
        setProgress('A guardar o Ping…')
        await createPing({
          id: pingId,
          kind,
          pin_id: pid,
          journey_id: journeyId,
          occurred_at: time.occurredAt,
          occurred_tz: tz,
          time_source: time.source,
          time_reliability: time.reliability,
          client_created_at: new Date().toISOString(),
          lat: useLoc?.lat ?? null,
          lng: useLoc?.lng ?? null,
          accuracy_m: useLoc?.accuracy ?? null,
          location_source: useLoc?.source ?? 'nenhuma',
          location_measured_at: useLoc?.measuredAt ?? null,
          modality: modality || null,
          technique: technique.trim() || null,
          bait: bait.trim() || null,
          equipment: equipment.trim() || null,
          depth_m: num(depth),
          bottom_type: bottom.trim() || null,
          fishing_minutes: num(minutes) != null ? Math.round(num(minutes)!) : null,
          catch_count: num(count) != null ? Math.round(num(count)!) : isCatch ? 1 : null,
          outcome: outcome || (isCatch ? 'sucesso' : kind === 'sem-captura' ? 'sem-sucesso' : null),
          notes: notes.trim() || null,
        })
        done.current.ping = true
      }
      const list = photos.filter((p) => p.prepared && !p.uploaded)
      for (const [i, ph] of list.entries()) {
        setProgress(`A enviar fotografia ${i + 1} de ${list.length}…`)
        await uploadPingPhoto(pingId, ph.prepared!, ph.meta, photos.indexOf(ph), ph.mediaId)
        setPhotos((ps) => ps.map((p) => (p.key === ph.key ? { ...p, uploaded: true } : p)))
        ph.uploaded = true
      }
      if (isCatch && species.trim() && !done.current.catch) {
        setProgress('A registar a captura…')
        const l = num(length)
        const w = num(weight)
        await addCatch({ ping_id: pingId, species: species.trim().slice(0, 80), length_cm: l != null ? toBaseLength(l, units) : null, weight_g: w != null ? toBaseWeight(w, units) : null, released })
        done.current.catch = true
      }
      // Enriquecimento assíncrono: o Ping já está guardado; as condições chegam depois.
      if (useLoc) void enrichPing(pingId).catch(() => undefined)
      toast('Ping guardado', { detail: useLoc ? 'A obter as condições do momento…' : undefined })
      nav(`/conta/pings/${pingId}`, { replace: true })
    } catch (e) {
      setSaveErr(`${friendly(e)}${done.current.ping ? ' O Ping já está guardado; ao tentar de novo só é enviado o que falta.' : ''}`)
      setPhase('error')
    }
  }

  const localValue = utcToZonedLocal(time.occurredAt, tz)
  const maxLocal = utcToZonedLocal(new Date(nowRef + 86400000).toISOString(), tz)

  return (
    <div className="-mx-4 -mt-5 lg:-mx-8">
      <PageHeader title="Novo Ping" back="/conta" eyebrow={journeyId ? 'Na jornada' : pin ? pin.name : 'Report de experiência'} />
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-32 pt-5 lg:px-8">
        {/* 1. Fotografia */}
        <section aria-labelledby="h-foto">
          <h2 id="h-foto" className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
            Fotografia <span className="font-semibold normal-case tracking-normal text-subtle">· opcional</span>
          </h2>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => (void addFiles(e.target.files, true), (e.target.value = ''))} aria-hidden />
          <input ref={galRef} type="file" accept="image/*,.heic,.heif" multiple className="sr-only" tabIndex={-1} onChange={(e) => (void addFiles(e.target.files, false), (e.target.value = ''))} aria-hidden />
          {photos.length === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => camRef.current?.click()} className="press flex h-32 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] bg-ink text-white shadow-lift">
                <Camera className="h-7 w-7" aria-hidden />
                <span className="text-[14px] font-extrabold">Tirar fotografia</span>
              </button>
              <button type="button" onClick={() => galRef.current?.click()} className="press flex h-32 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-line bg-white text-ink shadow-card">
                <ImagePlus className="h-7 w-7" aria-hidden />
                <span className="text-[14px] font-extrabold">Da galeria</span>
              </button>
            </div>
          ) : (
            <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
              {photos.map((p) => (
                <li key={p.key} className="relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl bg-mist">
                  {p.prepared?.previewUrl ? <img src={p.prepared.previewUrl} alt="Pré-visualização" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[11.5px] font-semibold text-muted">{p.error ? 'Erro' : p.prepared ? 'Sem pré-visualização' : <Loader2 className="h-5 w-5 animate-spin" aria-label="A preparar" />}</div>}
                  {p.uploaded && <span className="absolute bottom-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-full bg-teal text-ink"><Check className="h-4 w-4" aria-label="Enviada" /></span>}
                  {p.error && <p className="absolute inset-x-1 bottom-1 rounded-lg bg-danger/90 p-1 text-[10.5px] font-bold text-white">{p.error}</p>}
                  {phase !== 'saving' && !p.uploaded && (
                    <button type="button" onClick={() => removePhoto(p.key)} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white" aria-label="Remover fotografia">
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
              {photos.length < MAX_PHOTOS && (
                <li className="flex shrink-0 flex-col gap-2">
                  <button type="button" onClick={() => camRef.current?.click()} className="press grid h-[68px] w-24 place-items-center rounded-2xl bg-ink text-white" aria-label="Tirar outra fotografia">
                    <Camera className="h-5 w-5" aria-hidden />
                  </button>
                  <button type="button" onClick={() => galRef.current?.click()} className="press grid h-[68px] w-24 place-items-center rounded-2xl border border-line bg-white text-ink" aria-label="Adicionar da galeria">
                    <ImagePlus className="h-5 w-5" aria-hidden />
                  </button>
                </li>
              )}
            </ul>
          )}
          {photos.some((p) => p.prepared?.warning) && <Notice className="mt-2">{photos.find((p) => p.prepared?.warning)!.prepared!.warning}</Notice>}
        </section>

        {/* 2. Tipo */}
        <section aria-labelledby="h-tipo">
          <h2 id="h-tipo" className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
            O que aconteceu?
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de Ping">
            {PING_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                onClick={() => setKind(k.id)}
                className={cx('press rounded-2xl border p-3 text-left transition', kind === k.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/30')}
              >
                <span className="flex items-center gap-2 text-[14px] font-extrabold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} aria-hidden />
                  {k.label}
                </span>
                <span className={cx('mt-0.5 block text-[12px]', kind === k.id ? 'text-white/70' : 'text-muted')}>{k.hint}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 3. Local */}
        <section aria-labelledby="h-local" className="rounded-[var(--radius-card)] bg-white p-4 shadow-card">
          <h2 id="h-local" className="mb-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
            Local
          </h2>
          {noLocation ? (
            <p className="flex items-center gap-2 text-[14px] font-bold text-ink">
              <MapPinOff className="h-4 w-4 text-subtle" aria-hidden /> Sem localização <span className="font-normal text-muted">(sem condições meteorológicas)</span>
            </p>
          ) : loc ? (
            <div>
              <p className="flex items-center gap-2 text-[14.5px] font-bold text-ink">
                <MapPin className="h-4 w-4 text-teal-700" aria-hidden />
                {pin && loc.source === 'pin' ? pin.name : <span className="tnum">{formatCoords(loc.lat, loc.lng)}</span>}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {LOCATION_SOURCE[loc.source]}
                {loc.accuracy != null ? ` · ±${loc.accuracy} m` : ''}
              </p>
            </div>
          ) : (
            <p className="text-[13.5px] text-muted">Ainda sem localização. {photos.length ? 'A fotografia não tem coordenadas.' : ''}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon={gpsBusy ? Loader2 : Crosshair} className={gpsBusy ? '[&_svg]:animate-spin' : ''} onClick={useGps} disabled={gpsBusy}>
              {gpsBusy ? 'A localizar…' : 'Posição atual'}
            </Button>
            <Button size="sm" variant="outline" icon={MapPin} onClick={() => setMapOpen(true)}>
              Escolher no mapa
            </Button>
            {!noLocation && (
              <Button size="sm" variant="ghost" onClick={() => (setNoLocation(true), setPinId(null))}>
                Sem localização
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-subtle">A posição só é pedida quando carrega em “Posição atual” e fica privada na sua conta. Para obter o tempo, o serviço meteorológico recebe-a arredondada a ~1 km.</p>
          {gpsErr && <p className="mt-2 text-[12.5px] font-semibold text-danger" role="alert">{gpsErr}</p>}

          {divergence && (
            <div className="mt-3 rounded-2xl border border-amber/50 bg-amber-50 p-3" role="alert">
              <p className="text-[13px] font-bold text-amber-800">A fotografia foi tirada a {formatDistance(divergence.distance)} da sua posição atual. Onde aconteceu?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="dark" onClick={() => (setLoc(divergence.photo), setLocTouched(true), setDivergence(null))}>
                  Local da fotografia
                </Button>
                <Button size="sm" variant="outline" onClick={() => (setLoc(divergence.device), setLocTouched(true), setDivergence(null))}>
                  Posição atual
                </Button>
              </div>
            </div>
          )}

          {/* Associação a Pin */}
          <div className="mt-4 border-t border-line pt-3">
            <label htmlFor="pin" className="mb-1.5 block text-[13px] font-bold text-ink">
              Pin
            </label>
            <select id="pin" value={pinId ?? ''} onChange={(e) => choosePin(pins.find((p) => p.id === e.target.value) ?? null)} className={selectCls}>
              <option value="">Sem Pin associado</option>
              {pins.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {loc && loc.source !== 'pin' ? ` · ${formatDistance(distanceM(loc, p))}` : ''}
                </option>
              ))}
            </select>
            {suggest && !pinId && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-teal-50 p-3 text-[13px] text-teal-700">
                <span className="min-w-0 flex-1 font-semibold">
                  Este local fica a {formatDistance(suggest.distance_m)} do Pin <strong>{suggest.name}</strong>. Associar?
                </span>
                <Button size="sm" variant="dark" onClick={() => choosePin(pins.find((p) => p.id === suggest.id) ?? null)}>
                  Associar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDismissed((d) => [...d, suggest.id])}>
                  É outro local
                </Button>
              </div>
            )}
            {!pinId && loc && !noLocation && (
              <div className="mt-3">
                <Toggle label="Guardar também como novo Pin" description="Cria um local permanente com estas coordenadas." checked={savePin} onChange={setSavePin} />
                {savePin && <input value={pinName} onChange={(e) => setPinName(e.target.value)} placeholder="Nome do Pin" maxLength={80} className={`${inputCls} mt-2`} aria-label="Nome do novo Pin" />}
              </div>
            )}
          </div>
        </section>

        {/* 4. Hora */}
        <section aria-labelledby="h-hora" className="rounded-[var(--radius-card)] bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="h-hora" className="mb-1 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
                Quando
              </h2>
              <p className="flex items-center gap-2 text-[14.5px] font-bold text-ink">
                <Clock className="h-4 w-4 text-teal-700" aria-hidden />
                {formatDateTime(time.occurredAt, tz, { dateStyle: 'full', timeStyle: 'short' })}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {TIME_SOURCE[time.source]} · fiabilidade {RELIABILITY[time.reliability]} · {tz}
              </p>
            </div>
            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditTime((v) => !v)} aria-expanded={editTime}>
              Alterar
            </Button>
          </div>
          {time.note && time.source !== 'dispositivo' && <p className="mt-2 text-[12px] leading-snug text-subtle">{time.note}</p>}
          {time.reliability === 'baixa' && <Notice tone="warn" className="mt-2">{time.note}</Notice>}
          {editTime && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <Field label="Data e hora do acontecimento" htmlFor="when">
                <input
                  id="when"
                  type="datetime-local"
                  value={localValue}
                  max={maxLocal}
                  onChange={(e) => {
                    const iso = zonedLocalToUtc(e.target.value, tz)
                    if (iso) {
                      setTime({ occurredAt: iso, source: 'manual', reliability: 'media', note: 'Hora indicada manualmente.' })
                      setTimeTouched(true)
                    }
                  }}
                  className={inputCls}
                />
              </Field>
              <Field label="Fuso" htmlFor="tz">
                <select
                  id="tz"
                  value={tz}
                  onChange={(e) => {
                    // Mantém a hora de parede e muda o fuso (ex.: fotografia tirada em Espanha).
                    const wall = utcToZonedLocal(time.occurredAt, tz)
                    const next = e.target.value
                    setTz(next)
                    const iso = zonedLocalToUtc(wall, next)
                    if (iso) setTime((t) => ({ ...t, occurredAt: iso }))
                  }}
                  className={selectCls}
                >
                  {[...new Set([tz, ...TIMEZONES])].map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </section>

        {/* 5. Detalhes opcionais (progressivos) */}
        {isCatch && (
          <section aria-labelledby="h-captura" className="rounded-[var(--radius-card)] bg-white p-4 shadow-card">
            <h2 id="h-captura" className="mb-3 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
              Captura <span className="font-semibold normal-case tracking-normal text-subtle">· opcional</span>
            </h2>
            <div className="space-y-3">
              <Field label="Espécie" htmlFor="species">
                <input id="species" list="species-list" value={species} onChange={(e) => setSpecies(e.target.value)} className={inputCls} placeholder="Ex.: Achigã" />
                <datalist id="species-list">
                  {[...new Set([...(profile?.favorite_species ?? []), ...SPECIES_SUGGESTIONS])].map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label={`Comprimento (${units.unit_length})`} htmlFor="len">
                  <input id="len" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} className={inputCls} />
                </Field>
                <Field label={`Peso (${units.unit_weight})`} htmlFor="wt">
                  <input id="wt" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} />
                </Field>
                <Field label="N.º" htmlFor="cnt">
                  <input id="cnt" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className={inputCls} placeholder="1" />
                </Field>
              </div>
              <Toggle label="Devolvido à água" checked={released} onChange={setReleased} />
            </div>
          </section>
        )}

        <details className="rounded-[var(--radius-card)] bg-white p-4 shadow-card">
          <summary className="cursor-pointer text-[14px] font-extrabold text-ink">Mais detalhes <span className="font-semibold text-subtle">· técnica, isco, notas…</span></summary>
          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-1.5 text-[13px] font-bold text-ink">Modalidade</p>
              <div className="flex flex-wrap gap-2">
                {MODALITIES.map((m) => (
                  <Chip key={m.id} active={modality === m.id} onClick={() => setModality(modality === m.id ? '' : m.id)}>
                    {m.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Técnica" htmlFor="tech" optional>
                <input id="tech" list="tech-list" value={technique} onChange={(e) => setTechnique(e.target.value)} className={inputCls} />
                <datalist id="tech-list">{[...new Set([...(profile?.techniques ?? []), ...TECHNIQUE_SUGGESTIONS])].map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="Isco" htmlFor="bait" optional>
                <input id="bait" list="bait-list" value={bait} onChange={(e) => setBait(e.target.value)} className={inputCls} />
                <datalist id="bait-list">{BAIT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="Equipamento" htmlFor="eq" optional>
                <input id="eq" value={equipment} onChange={(e) => setEquipment(e.target.value)} className={inputCls} placeholder="Cana, carreto, linha" />
              </Field>
              <Field label="Tempo de pesca (min)" htmlFor="min" optional>
                <input id="min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Profundidade (m)" htmlFor="dep" optional>
                <input id="dep" inputMode="decimal" value={depth} onChange={(e) => setDepth(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Tipo de fundo" htmlFor="bot" optional>
                <input id="bot" value={bottom} onChange={(e) => setBottom(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-bold text-ink">Resultado</p>
              <div className="flex flex-wrap gap-2">
                {OUTCOMES.map((o) => (
                  <Chip key={o.id} active={outcome === o.id} onClick={() => setOutcome(outcome === o.id ? '' : o.id)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </details>

        <Field label="Notas" htmlFor="notes" optional>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} maxLength={4000} placeholder="O que viu, o que funcionou, o que mudou…" />
        </Field>
        {phase === 'error' && saveErr && <ErrorBox message={saveErr} />}
        {pinsQ.error && <ErrorBox message={`Não foi possível carregar os Pins: ${pinsQ.error}`} onRetry={pinsQ.reload} />}
      </div>

      {/* Barra de gravação fixa */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-xl lg:left-[264px]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-muted" aria-live="polite">
            {phase === 'saving' ? progress : !kind ? 'Escolha o tipo de Ping' : photos.some((p) => !p.prepared && !p.error) ? 'A preparar fotografias…' : `${photos.length} foto${photos.length === 1 ? '' : 's'} · ${noLocation || !loc ? 'sem local' : 'com local'}`}
          </p>
          {photos.some((p) => p.error) && phase !== 'saving' && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setPhotos((ps) => ps.filter((p) => !p.error))}>
              Retirar com erro
            </Button>
          )}
          <Button size="lg" icon={phase === 'saving' ? Loader2 : Save} className={phase === 'saving' ? '[&_svg]:animate-spin' : ''} disabled={!ready} onClick={save}>
            {phase === 'error' ? 'Tentar de novo' : phase === 'saving' ? 'A guardar…' : 'Guardar Ping'}
          </Button>
        </div>
      </div>

      <Sheet open={mapOpen} onClose={() => setMapOpen(false)} title="Local do acontecimento" footer={<Button className="w-full" onClick={() => setMapOpen(false)} disabled={!loc}>Usar este local</Button>}>
        <LocationPicker value={loc ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, source: loc.source === 'gps' ? 'gps' : 'mapa', measuredAt: loc.measuredAt } : null} onChange={pickFromMap} pins={pins} mapClassName="h-[52dvh]" />
      </Sheet>
    </div>
  )
}
