import { Camera, Check, ChevronDown, Clock, Crosshair, ImagePlus, Loader2, MapPin, Pencil, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { resolvePhotoTime, readPhotoMeta } from '../../lib/lanca/exif'
import { FieldStore, TYPE_LABEL, type Draft, type FieldPhoto, type FieldPin, type FieldPinType } from '../../lib/lanca/fieldPins'
import { distanceM, formatCoords, formatDistance, getDevicePosition } from '../../lib/lanca/geo'
import { prepareImage, type PreparedImage } from '../../lib/lanca/image'
import { SPECIES_SUGGESTIONS } from '../../lib/lanca/labels'
import { tzForPoint, tzLabel } from '../../lib/lanca/region'
import { formatDateTime, TIMEZONES, utcToZonedLocal, zonedLocalToUtc } from '../../lib/lanca/time'
import { fromBaseLength, fromBaseWeight, toBaseLength, toBaseWeight } from '../../lib/lanca/units'
import { useAuth } from '../../state/Auth'
import { cx } from '../ui'
import { pinIconSvg } from './pinLayers'

export interface LngLat {
  lng: number
  lat: number
}
/** Ligações ao mapa do Atlas (uma única instância do motor; o compositor nunca o recria). */
export interface MapBridge {
  /** Coordenada no centro da mira (com relevo: ponto no terreno). */
  crosshair: () => LngLat | null
  /** Posição da mira no ecrã (centro da área útil do mapa, acima do painel). */
  crossPoint: () => { x: number; y: number } | null
  easeTo: (p: LngLat, zoom?: number) => void
  setPreview: (p: LngLat | null) => void
  showDevice: (p: (LngLat & { accuracy: number }) | null) => void
  detectWater: (p: LngLat) => { ref: string; name: string } | null
  onMove: (cb: () => void) => () => void
}

export type ComposerMode = 'new' | 'edit' | 'move'
interface PhotoItem {
  photo: FieldPhoto
  img: PreparedImage | null
  url: string | null
}

const mark = (name: string) => {
  try {
    performance.mark(name)
  } catch {
    /* sem suporte */
  }
}
export function perfMeasure(name: string, start: string, end: string) {
  try {
    const m = performance.measure(name, start, end)
    const w = window as unknown as { __lancaPerf?: { name: string; ms: number }[] }
    ;(w.__lancaPerf ??= []).push({ name, ms: Math.round(m.duration * 10) / 10 })
  } catch {
    /* sem marca inicial */
  }
}

const btn = 'press inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-bold'
const field = 'h-12 w-full rounded-2xl border border-white/12 bg-[#071923]/70 px-4 text-[15px] text-[#f4f7f8] placeholder:text-[#b5c5cc]/70 outline-none focus:border-[#83e5ef]/70 focus:ring-4 focus:ring-[#83e5ef]/15'
const lbl = 'mb-1.5 block text-[12.5px] font-bold text-[#b5c5cc]'

function newPin(uid: string, id: string): FieldPin {
  const nowIso = new Date().toISOString()
  return {
    id, uid, type: 'captura', lat: 0, lng: 0, accuracy: null, source: 'mapa', measuredAt: null, occurredAt: nowIso, tz: 'Europe/Lisbon', timeSource: 'dispositivo', timeReliability: 'alta',
    name: null, notes: null, species: null, count: null, weightG: null, lengthCm: null, technique: null, bait: null, depthM: null, catchId: null, waterRef: null, waterName: null,
    photos: [], sync: 'local', error: null, existsOnServer: false, serverUpdatedAt: null, dirty: true, reenrich: true, deleted: false, attempts: 0, nextAttemptAt: 0, createdAt: nowIso, updatedAt: nowIso,
  }
}

/**
 * Compositor do pin, sobre o próprio Atlas: colocar (GPS ou mira) → confirmar → tipo e dados mínimos
 * → "Guardar pin privado". O ponto escolhido fica sempre visível (o painel é compacto e o mapa
 * reserva a sua altura). Os dados mantêm-se ao alternar entre câmara, mapa e ficha, e o rascunho
 * fica guardado no dispositivo.
 */
export function PinComposer({
  store,
  mode,
  pin: initialPin,
  draft,
  start,
  water,
  bridge,
  desktop,
  onDone,
  onCancel,
  onLayout,
}: {
  store: FieldStore
  mode: ComposerMode
  pin?: FieldPin | null
  draft?: Draft | null
  start?: LngLat | null
  water?: { ref: string; name: string } | null
  bridge: MapBridge
  desktop: boolean
  onDone: (p: FieldPin) => void
  onCancel: () => void
  onLayout: (step: 'place' | 'details', height: number) => void
}) {
  const { units, profile } = useAuth()
  const [pin, setPin] = useState<FieldPin>(() => {
    if (draft) return { ...newPin(store.uid, draft.pin.id), ...draft.pin } as FieldPin
    if (initialPin) return initialPin
    const p = newPin(store.uid, crypto.randomUUID())
    return water ? { ...p, waterRef: water.ref, waterName: water.name } : p
  })
  const [step, setStep] = useState<'place' | 'details'>(() => (draft ? draft.step : mode === 'edit' ? 'details' : 'place'))
  const [placeMode, setPlaceMode] = useState<'mira' | 'gps'>('mira')
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number; at: number } | null>(null)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [gpsErr, setGpsErr] = useState<string | null>(null)
  const [cross, setCross] = useState<LngLat | null>(null)
  const [photos, setPhotos] = useState<PhotoItem[]>(() => (draft ? draft.photos.map((photo) => ({ photo, img: null, url: null })) : []))
  const [timeTouched, setTimeTouched] = useState(mode !== 'new')
  const [editTime, setEditTime] = useState(false)
  const [more, setMore] = useState(mode === 'edit')
  const [photoSuggest, setPhotoSuggest] = useState<{ time?: ReturnType<typeof resolvePhotoTime>; gps?: { lat: number; lng: number; d: number } } | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [nums, setNums] = useState(() => ({
    weight: pin.weightG != null ? String(fromBaseWeight(pin.weightG, units)) : '',
    length: pin.lengthCm != null ? String(fromBaseLength(pin.lengthCm, units)) : '',
    count: pin.count != null ? String(pin.count) : '',
    depth: pin.depthM != null ? String(pin.depthM) : '',
  }))
  const [ageNow, setAgeNow] = useState(() => Date.now())
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const set = <K extends keyof FieldPin>(k: K, v: FieldPin[K]) => setPin((p) => ({ ...p, [k]: v }))

  // Feedback imediato a "Marcar pin" (medido: clique → painel visível).
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      mark('marcar:visible')
      perfMeasure('marcar-pin:feedback', 'marcar:click', 'marcar:visible')
    })
  }, [])

  // Altura do painel → o mapa reserva-a (a mira e o ponto ficam acima do painel).
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const ro = new ResizeObserver(() => onLayout(step, el.getBoundingClientRect().height))
    ro.observe(el)
    onLayout(step, el.getBoundingClientRect().height)
    return () => ro.disconnect()
  }, [step, onLayout])

  // Início: centra na posição de partida (toque prolongado, mover, "Marcar aqui" mantém a vista).
  useEffect(() => {
    const p = mode === 'move' || mode === 'edit' ? { lat: pin.lat, lng: pin.lng } : start ?? (draft?.pin.lat ? { lat: draft.pin.lat, lng: draft.pin.lng! } : null)
    if (p && p.lat) bridge.easeTo(p, Math.max(14, 0))
    if (step === 'details') bridge.setPreview({ lat: pin.lat, lng: pin.lng })
    return () => {
      bridge.setPreview(null)
      bridge.showDevice(null)
    }
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Leitura contínua da coordenada sob a mira.
  useEffect(() => {
    if (step !== 'place' || placeMode !== 'mira') return
    let raf = 0
    const read = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setCross(bridge.crosshair()))
    }
    read()
    const off = bridge.onMove(read)
    return () => {
      cancelAnimationFrame(raf)
      off()
    }
  }, [step, placeMode, bridge])

  // Idade da leitura GPS (atualiza enquanto o painel está aberto).
  useEffect(() => {
    if (!gps) return
    const t = window.setInterval(() => setAgeNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [gps])

  // Pré-visualizações das fotografias do rascunho (guardadas no dispositivo).
  useEffect(() => {
    let alive = true
    const created: string[] = []
    void Promise.all(
      photos.filter((p) => !p.url).map(async (p) => {
        const url = await store.photoUrl(pin.id, p.photo.id, 'thumb')
        if (url) created.push(url)
        return { id: p.photo.id, url }
      }),
    ).then((rs) => alive && rs.length && setPhotos((ps) => ps.map((p) => ({ ...p, url: p.url ?? rs.find((r) => r.id === p.photo.id)?.url ?? null }))))
    return () => {
      alive = false
    }
    // Só para as fotografias restauradas do rascunho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rascunho: guardado no dispositivo a cada alteração (retomar depois de fechar a app).
  useEffect(() => {
    if (mode !== 'new') return
    const t = window.setTimeout(() => {
      void store.saveDraft({ pin, photos: photos.map((p) => p.photo), step, savedAt: new Date().toISOString() }).catch(() => undefined)
    }, 500)
    return () => window.clearTimeout(t)
  }, [pin, photos, step, mode, store])

  const useGps = async () => {
    setGpsBusy(true)
    setGpsErr(null)
    try {
      const p = await getDevicePosition()
      const g = { lat: p.lat, lng: p.lng, accuracy: p.accuracy, at: Date.parse(p.at) || Date.now() }
      setGps(g)
      setAgeNow(Date.now())
      setPlaceMode('gps')
      bridge.showDevice({ lat: g.lat, lng: g.lng, accuracy: g.accuracy })
      bridge.setPreview({ lat: g.lat, lng: g.lng })
      bridge.easeTo({ lat: g.lat, lng: g.lng }, 15)
    } catch (e) {
      setGpsErr(`${(e as Error).message} Pode escolher o ponto com a mira.`)
      setPlaceMode('mira')
    } finally {
      setGpsBusy(false)
    }
  }
  const useMira = () => {
    setPlaceMode('mira')
    bridge.setPreview(null)
    if (gps) bridge.easeTo({ lat: gps.lat, lng: gps.lng })
  }

  const confirmPlace = async () => {
    const at = placeMode === 'gps' && gps ? { lat: gps.lat, lng: gps.lng } : bridge.crosshair()
    if (!at) return setErr('Não foi possível ler a posição no mapa. Mova o mapa e tente de novo.')
    const w = water ?? bridge.detectWater(at)
    const tz = tzForPoint(at.lat, at.lng, pin.tz)
    const next: FieldPin = {
      ...pin,
      lat: at.lat,
      lng: at.lng,
      accuracy: placeMode === 'gps' && gps ? gps.accuracy : null,
      source: placeMode === 'gps' ? 'gps' : 'mapa',
      measuredAt: placeMode === 'gps' && gps ? new Date(gps.at).toISOString() : null,
      waterRef: w?.ref ?? pin.waterRef,
      waterName: w?.name ?? pin.waterName,
      tz: timeTouched ? pin.tz : tz,
      reenrich: true,
    }
    setErr(null)
    if (mode === 'move') {
      setSaving(true)
      try {
        onDone(await store.save(next))
      } catch (e) {
        setErr((e as Error).message)
        setSaving(false)
      }
      return
    }
    setPin(next)
    bridge.setPreview(at)
    bridge.showDevice(null)
    setStep('details')
  }

  const addFiles = async (files: FileList | null, capturedNow: boolean) => {
    if (!files?.length) return
    const room = 6 - photos.length
    for (const file of [...files].slice(0, room)) {
      try {
        const [img, meta] = await Promise.all([prepareImage(file), readPhotoMeta(file)])
        const photo: FieldPhoto = {
          id: crypto.randomUUID(), mime: img.originalMime, width: img.width, height: img.height, bytes: img.original.size, hasDisplay: !!img.display, hasThumb: !!img.thumb,
          displayMime: img.display?.type ?? null, thumbMime: img.thumb?.type ?? null, exif: meta, state: 'local', error: null,
        }
        // As fotografias ficam já no dispositivo (o rascunho sobrevive a fechar a app).
        if (mode === 'new') await store.saveDraft({ pin, photos: [...photos.map((p) => p.photo), photo], step, savedAt: new Date().toISOString() }, [{ photo, img }])
        setPhotos((ps) => [...ps, { photo, img, url: img.previewUrl || null }])
        // Fotografia antiga: confirmar data e local antes de pedir dados históricos.
        if (photos.length === 0) {
          const t = meta.takenLocal ? resolvePhotoTime(meta, pin.tz, { fileLastModified: file.lastModified, capturedNow }) : null
          const sug: typeof photoSuggest = {}
          if (t && !timeTouched && Math.abs(Date.parse(t.occurredAt) - Date.parse(pin.occurredAt)) > 15 * 60000) sug.time = t
          if (meta.gps && pin.lat) {
            const d = distanceM(meta.gps, pin)
            if (d > 500) sug.gps = { lat: meta.gps.lat, lng: meta.gps.lng, d }
          }
          if (sug.time || sug.gps) setPhotoSuggest(sug)
        }
      } catch (e) {
        setErr((e as Error).message)
      }
    }
  }

  const num = (s: string) => {
    const v = Number(s.replace(',', '.'))
    return s.trim() && Number.isFinite(v) && v >= 0 ? v : null
  }
  const save = async () => {
    setSaving(true)
    setErr(null)
    mark('pin:save:start')
    const w = num(nums.weight)
    const l = num(nums.length)
    const final: FieldPin = {
      ...pin,
      name: pin.type === 'local' ? pin.name?.trim() || null : null,
      species: pin.type === 'captura' ? pin.species?.trim() || null : null,
      weightG: pin.type === 'captura' && w != null ? toBaseWeight(w, units) : null,
      lengthCm: pin.type === 'captura' && l != null ? toBaseLength(l, units) : null,
      count: pin.type === 'captura' ? (num(nums.count) != null ? Math.round(num(nums.count)!) : null) : null,
      depthM: num(nums.depth),
      photos: pin.type === 'local' ? [] : [...pin.photos.filter((f) => !photos.some((p) => p.photo.id === f.id)), ...photos.map((p) => p.photo)],
    }
    try {
      const saved = await store.save(final, pin.type === 'local' ? [] : photos.filter((p) => p.img).map((p) => ({ photo: p.photo, img: p.img! })))
      mark('pin:save:local')
      perfMeasure('pin:local-durable', 'pin:save:start', 'pin:save:local')
      if (mode === 'new') await store.clearDraft().catch(() => undefined)
      onDone(saved)
    } catch (e) {
      // Nunca dizer "guardado" se a escrita falhou (ex.: sem espaço no dispositivo).
      setErr((e as Error).message)
      setSaving(false)
    }
  }

  const discard = async () => {
    if (mode === 'new') await store.clearDraft({ pinId: pin.id, photoIds: photos.map((p) => p.photo.id) }).catch(() => undefined)
    onCancel()
  }

  const gpsAge = gps ? Math.max(0, Math.round((ageNow - gps.at) / 1000)) : 0
  const weak = !!gps && gps.accuracy > 50
  const typeChoices: FieldPinType[] = mode === 'edit' ? (pin.type === 'local' ? ['local'] : ['captura', 'observacao']) : ['captura', 'observacao', 'local']

  const cp = step === 'place' && placeMode === 'mira' ? bridge.crossPoint() : null
  return (
    <>
    {cp && (
      <div className="pointer-events-none absolute z-30" style={{ left: cp.x, top: cp.y, transform: 'translate(-50%, -50%)' }} data-crosshair aria-hidden>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="17" fill="none" stroke="#071923" strokeWidth="6" />
          <circle cx="36" cy="36" r="17" fill="none" stroke="#f4f7f8" strokeWidth="2.5" />
          {[[36, 4, 36, 16], [36, 56, 36, 68], [4, 36, 16, 36], [56, 36, 68, 36]].map(([a, b, c, d], i) => (
            <g key={i}>
              <line x1={a} y1={b} x2={c} y2={d} stroke="#071923" strokeWidth="6" strokeLinecap="round" />
              <line x1={a} y1={b} x2={c} y2={d} stroke="#f4f7f8" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          ))}
          <circle cx="36" cy="36" r="3.5" fill="#38c9d5" stroke="#071923" strokeWidth="1.5" />
        </svg>
      </div>
    )}
    <div
      ref={panel}
      className={cx(
        'pointer-events-auto z-40 flex max-h-[min(70dvh,640px)] flex-col overflow-hidden border border-white/10 bg-[#0a2230]/96 text-[#f4f7f8] shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.8)] backdrop-blur-xl',
        desktop ? 'absolute bottom-4 left-4 w-[400px] rounded-3xl' : 'absolute inset-x-0 bottom-0 rounded-t-[26px] pb-[env(safe-area-inset-bottom)]',
      )}
      role="dialog"
      aria-label={mode === 'move' ? 'Mover pin' : mode === 'edit' ? 'Editar pin' : 'Marcar pin'}
      data-no-swipe
      data-composer-step={step}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-3">
        <h2 className="text-[16px] font-extrabold">{step === 'place' ? (mode === 'move' ? 'Novo ponto do pin' : 'Onde?') : mode === 'edit' ? 'Editar pin' : 'Marcar pin'}</h2>
        <button type="button" onClick={mode === 'new' ? discard : onCancel} className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label={mode === 'new' ? 'Descartar' : 'Cancelar'}>
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {step === 'place' ? (
        <div className="space-y-3 overflow-y-auto overscroll-contain px-4 pb-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Como escolher o ponto">
            <button type="button" role="radio" aria-checked={placeMode === 'gps'} onClick={useGps} disabled={gpsBusy} className={cx(btn, 'rounded-2xl border', placeMode === 'gps' ? 'border-[#83e5ef] bg-[#83e5ef]/15' : 'border-white/12 hover:bg-white/5')}>
              {gpsBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Crosshair className="h-4 w-4" aria-hidden />}
              {gpsBusy ? 'A localizar…' : 'Usar a minha posição'}
            </button>
            <button type="button" role="radio" aria-checked={placeMode === 'mira'} onClick={useMira} className={cx(btn, 'rounded-2xl border', placeMode === 'mira' ? 'border-[#83e5ef] bg-[#83e5ef]/15' : 'border-white/12 hover:bg-white/5')}>
              <MapPin className="h-4 w-4" aria-hidden /> Escolher no mapa
            </button>
          </div>
          {placeMode === 'gps' && gps ? (
            <div className={cx('rounded-2xl px-3.5 py-2.5 text-[13px]', weak ? 'bg-amber-50 text-amber-900' : 'bg-white/5 text-[#d6e2e6]')} aria-live="polite">
              <p className="font-bold">
                GPS: ±{gps.accuracy} m · leitura há {gpsAge < 60 ? `${gpsAge} s` : `${Math.round(gpsAge / 60)} min`}
              </p>
              <p className="mt-0.5 text-[12.5px]">{weak ? 'Sinal fraco: confirme ou corrija com a mira.' : 'O ponto azul é o telemóvel; o pin fica onde indicar.'}</p>
              <button type="button" onClick={useMira} className="mt-1.5 text-[12.5px] font-extrabold underline underline-offset-2">
                Corrigir com a mira
              </button>
            </div>
          ) : (
            <p className="rounded-2xl bg-white/5 px-3.5 py-2.5 text-[13px] text-[#d6e2e6]" aria-live="polite">
              Mova o mapa até a mira estar no local{cross ? <span className="tnum"> · {formatCoords(cross.lat, cross.lng, 5)}</span> : null}. Também pode tocar num ponto para o centrar.
            </p>
          )}
          {gpsErr && <p className="text-[12.5px] font-semibold text-amber-200" role="alert">{gpsErr}</p>}
          {err && <p className="text-[12.5px] font-semibold text-amber-200" role="alert">{err}</p>}
          <button type="button" onClick={confirmPlace} disabled={saving} className={cx(btn, 'h-12 w-full bg-[#38c9d5] text-[15px] font-extrabold text-[#071923] hover:bg-[#5fd6e0]')}>
            <Check className="h-5 w-5" aria-hidden /> {mode === 'move' ? (saving ? 'A guardar…' : 'Guardar novo ponto') : 'Confirmar local'}
          </button>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de pin">
              {typeChoices.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={pin.type === t} onClick={() => set('type', t)} className={cx('press inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-bold', pin.type === t ? 'border-[#f4f7f8] bg-[#f4f7f8] text-[#071923]' : 'border-white/15 hover:bg-white/5')}>
                  <span dangerouslySetInnerHTML={{ __html: pinIconSvg(t) }} className="grid h-6 w-6 place-items-center" />
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            <div className="flex items-start justify-between gap-2 rounded-2xl bg-white/5 px-3.5 py-2.5">
              <div className="min-w-0 text-[13px]">
                <p className="flex items-center gap-1.5 font-bold">
                  <MapPin className="h-4 w-4 text-[#83e5ef]" aria-hidden /> <span className="tnum">{formatCoords(pin.lat, pin.lng, 5)}</span>
                </p>
                <p className="mt-0.5 text-[12px] text-[#b5c5cc]">
                  {pin.source === 'gps' ? `GPS${pin.accuracy != null ? ` ±${pin.accuracy} m` : ''}` : 'Escolhido no mapa'}
                  {pin.waterName ? ` · ${pin.waterName}` : ''}
                </p>
              </div>
              {mode === 'new' && (
                <button type="button" onClick={() => (setStep('place'), bridge.setPreview(null))} className="press shrink-0 rounded-full px-3 py-2 text-[12.5px] font-bold text-[#83e5ef] hover:bg-white/5">
                  Mudar local
                </button>
              )}
            </div>

            {pin.type !== 'local' && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[13.5px] font-bold">
                    <Clock className="h-4 w-4 text-[#83e5ef]" aria-hidden />
                    {formatDateTime(pin.occurredAt, pin.tz, { dateStyle: 'medium', timeStyle: 'short' })}
                    <span className="font-semibold text-[#b5c5cc]">· {tzLabel(pin.tz)}</span>
                  </p>
                  <button type="button" onClick={() => setEditTime((v) => !v)} aria-expanded={editTime} className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Alterar data e hora">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {editTime && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      type="datetime-local"
                      aria-label="Data e hora do acontecimento"
                      value={utcToZonedLocal(pin.occurredAt, pin.tz)}
                      onChange={(e) => {
                        const iso = zonedLocalToUtc(e.target.value, pin.tz)
                        if (iso) setPin((p) => ({ ...p, occurredAt: iso, timeSource: 'manual', timeReliability: 'media', reenrich: true }))
                        setTimeTouched(true)
                      }}
                      className={field}
                    />
                    <select aria-label="Fuso" value={pin.tz} onChange={(e) => setPin((p) => ({ ...p, tz: e.target.value }))} className={field}>
                      {[...new Set([pin.tz, ...TIMEZONES])].map((z) => (
                        <option key={z} value={z}>
                          {tzLabel(z)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {pin.type !== 'local' && (
              <div>
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (void addFiles(e.target.files, true), (e.target.value = ''))} />
                <input ref={galRef} type="file" accept="image/*,.heic,.heif" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (void addFiles(e.target.files, false), (e.target.value = ''))} />
                <div className={cx('grid gap-2', pin.type === 'captura' ? 'grid-cols-2' : 'grid-cols-2')}>
                  <button type="button" onClick={() => camRef.current?.click()} className={cx(btn, 'h-12 rounded-2xl', pin.type === 'captura' ? 'bg-[#f4f7f8] text-[#071923]' : 'border border-white/15 hover:bg-white/5')}>
                    <Camera className="h-5 w-5" aria-hidden /> Tirar fotografia
                  </button>
                  <button type="button" onClick={() => galRef.current?.click()} className={cx(btn, 'h-12 rounded-2xl border border-white/15 hover:bg-white/5')}>
                    <ImagePlus className="h-5 w-5" aria-hidden /> Escolher fotografia
                  </button>
                </div>
                {photos.length > 0 && (
                  <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {photos.map((p) => (
                      <li key={p.photo.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/10">
                        {p.url ? <img src={p.url} alt="Fotografia do pin" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[11px] text-[#b5c5cc]">Sem pré-visualização</div>}
                        <button type="button" onClick={() => setPhotos((ps) => ps.filter((x) => x.photo.id !== p.photo.id))} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/60" aria-label="Retirar fotografia">
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {photoSuggest && (
                  <div className="mt-2 space-y-2 rounded-2xl bg-amber-50 p-3 text-[12.5px] text-amber-900" role="alert">
                    {photoSuggest.time && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          A fotografia é de <strong>{formatDateTime(photoSuggest.time.occurredAt, pin.tz)}</strong> (metadados).
                        </span>
                        <button type="button" className="press min-h-9 rounded-full bg-amber-900 px-3 font-bold text-white" onClick={() => (setPin((p) => ({ ...p, occurredAt: photoSuggest.time!.occurredAt, timeSource: photoSuggest.time!.source, timeReliability: photoSuggest.time!.reliability, reenrich: true })), setTimeTouched(true), setPhotoSuggest((s) => (s?.gps ? { gps: s.gps } : null)))}>
                          Usar esta data
                        </button>
                      </div>
                    )}
                    {photoSuggest.gps && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>A fotografia foi tirada a {formatDistance(photoSuggest.gps.d)} deste ponto.</span>
                        <span className="flex gap-1.5">
                          <button type="button" className="press min-h-9 rounded-full bg-amber-900 px-3 font-bold text-white" onClick={() => {
                            const g = photoSuggest.gps!
                            setPin((p) => ({ ...p, lat: g.lat, lng: g.lng, accuracy: null, source: 'mapa', reenrich: true, ...(() => { const w = bridge.detectWater(g); return w ? { waterRef: w.ref, waterName: w.name } : {} })() }))
                            bridge.setPreview(g)
                            bridge.easeTo(g)
                            setPhotoSuggest((s) => (s?.time ? { time: s.time } : null))
                          }}>
                            Usar o local da foto
                          </button>
                          <button type="button" className="press min-h-9 rounded-full px-3 font-bold" onClick={() => setPhotoSuggest((s) => (s?.time ? { time: s.time } : null))}>
                            Manter
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {pin.type === 'captura' && (
              <div>
                <label className={lbl} htmlFor="pc-species">
                  Espécie <span className="font-semibold text-[#b5c5cc]/70">· opcional</span>
                </label>
                <input id="pc-species" list="pc-species-list" value={pin.species ?? ''} onChange={(e) => set('species', e.target.value)} className={field} placeholder="Ex.: Achigã" />
                <datalist id="pc-species-list">
                  {[...new Set([...(profile?.favorite_species ?? []), ...SPECIES_SUGGESTIONS])].map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            )}
            {pin.type === 'local' && (
              <div>
                <label className={lbl} htmlFor="pc-name">
                  Nome <span className="font-semibold text-[#b5c5cc]/70">· opcional</span>
                </label>
                <input id="pc-name" value={pin.name ?? ''} onChange={(e) => set('name', e.target.value)} maxLength={80} className={field} placeholder="Ex.: Ponta das árvores" />
              </div>
            )}

            <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="press flex min-h-11 w-full items-center justify-between rounded-2xl px-1 text-[13.5px] font-bold text-[#b5c5cc] hover:text-[#f4f7f8]">
              Mais detalhes {pin.type === 'captura' ? '· quantidade, peso, técnica…' : '· notas'}
              <ChevronDown className={cx('h-4 w-4 transition', more && 'rotate-180')} aria-hidden />
            </button>
            {more && (
              <div className="space-y-3">
                {pin.type === 'captura' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={lbl} htmlFor="pc-count">Quantidade</label>
                      <input id="pc-count" inputMode="numeric" value={nums.count} onChange={(e) => setNums((n) => ({ ...n, count: e.target.value }))} className={field} placeholder="1" />
                    </div>
                    <div>
                      <label className={lbl} htmlFor="pc-w">Peso ({units.unit_weight})</label>
                      <input id="pc-w" inputMode="decimal" value={nums.weight} onChange={(e) => setNums((n) => ({ ...n, weight: e.target.value }))} className={field} />
                    </div>
                    <div>
                      <label className={lbl} htmlFor="pc-l">Comp. ({units.unit_length})</label>
                      <input id="pc-l" inputMode="decimal" value={nums.length} onChange={(e) => setNums((n) => ({ ...n, length: e.target.value }))} className={field} />
                    </div>
                  </div>
                )}
                {pin.type !== 'local' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl} htmlFor="pc-tech">Técnica</label>
                      <input id="pc-tech" value={pin.technique ?? ''} onChange={(e) => set('technique', e.target.value)} className={field} />
                    </div>
                    <div>
                      <label className={lbl} htmlFor="pc-bait">Amostra / isco</label>
                      <input id="pc-bait" value={pin.bait ?? ''} onChange={(e) => set('bait', e.target.value)} className={field} />
                    </div>
                    <div>
                      <label className={lbl} htmlFor="pc-depth">Profundidade (m)</label>
                      <input id="pc-depth" inputMode="decimal" value={nums.depth} onChange={(e) => setNums((n) => ({ ...n, depth: e.target.value }))} className={field} />
                    </div>
                  </div>
                )}
                <div>
                  <label className={lbl} htmlFor="pc-notes">Notas</label>
                  <textarea id="pc-notes" value={pin.notes ?? ''} onChange={(e) => set('notes', e.target.value)} maxLength={2000} className={cx(field, 'h-24 py-3')} />
                </div>
              </div>
            )}
            {err && <p className="rounded-2xl bg-[#fdf0ee] px-3.5 py-2.5 text-[13px] font-semibold text-[#7b2318]" role="alert">{err}</p>}
          </div>
          <div className="shrink-0 border-t border-white/10 p-3">
            <button type="button" onClick={save} disabled={saving} className={cx(btn, 'h-12 w-full bg-[#38c9d5] text-[15px] font-extrabold text-[#071923] hover:bg-[#5fd6e0] disabled:opacity-60')} data-action="guardar-pin">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Check className="h-5 w-5" aria-hidden />}
              {saving ? 'A guardar…' : mode === 'edit' ? 'Guardar alterações' : 'Guardar pin privado'}
            </button>
          </div>
        </>
      )}
    </div>
    </>
  )
}
