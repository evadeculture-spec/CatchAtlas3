import { Clock, Fish, ImagePlus, Loader2, MapPin, MapPinPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmSheet, Sheet } from '../../components/Dialog'
import { Button, ButtonLink, Chip, Field, inputCls, PageHeader, Tag, Toggle } from '../../components/ui'
import { ConditionsPanel } from '../../components/lanca/ConditionsPanel'
import { PrivateMap } from '../../components/lanca/PrivateMap'
import { ErrorBox, KV, ListSkeleton, Panel, selectCls, textareaCls, useLoad } from '../../components/lanca/primitives'
import { SignedImage } from '../../components/lanca/SignedImage'
import { addCatch, deleteCatch, deletePhoto, deletePing, enrichPing, friendly, getPing, getPingStatus, listPins, updatePing, uploadPingPhoto } from '../../lib/lanca/api'
import { readPhotoMeta } from '../../lib/lanca/exif'
import { formatCoords } from '../../lib/lanca/geo'
import { prepareImage } from '../../lib/lanca/image'
import { LOCATION_SOURCE, modalityLabel, OUTCOMES, PING_KINDS, pingKind, RELIABILITY, SPECIES_SUGGESTIONS, TIME_SOURCE } from '../../lib/lanca/labels'
import { formatDateTime, utcToZonedLocal, zonedLocalToUtc } from '../../lib/lanca/time'
import type { Catch, PingFull, PingKind } from '../../lib/lanca/types'
import { fmt, toBaseLength, toBaseWeight } from '../../lib/lanca/units'
import { useAuth } from '../../state/Auth'
import { useToast } from '../../state/Toasts'

const FINAL = ['concluido', 'parcial', 'falhou', 'sem-localizacao']

export default function PingDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { units } = useAuth()
  const { data: ping, error, loading, reload, setData } = useLoad(() => getPing(id!), [id])
  const [retrying, setRetrying] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [catchOpen, setCatchOpen] = useState(false)
  const [viewer, setViewer] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const triggered = useRef(false)
  const galRef = useRef<HTMLInputElement>(null)

  // Atualização visual do enriquecimento sem recarregar a página.
  const status = ping?.enrichment_status
  useEffect(() => {
    if (!ping || FINAL.includes(ping.enrichment_status)) return
    if (ping.enrichment_status === 'pendente' && !triggered.current) {
      triggered.current = true
      void enrichPing(ping.id).catch(() => undefined)
    }
    let n = 0
    const t = window.setInterval(async () => {
      n++
      try {
        const s = await getPingStatus(ping.id)
        if (FINAL.includes(s.enrichment_status) || n > 30) {
          window.clearInterval(t)
          void reload()
        }
      } catch {
        if (n > 30) window.clearInterval(t)
      }
    }, 2500)
    return () => window.clearInterval(t)
  }, [ping?.id, status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading || !ping) return <ListSkeleton />
  const k = pingKind(ping.kind)
  const tz = ping.occurred_tz

  const retry = async () => {
    setRetrying(true)
    try {
      await enrichPing(ping.id)
      await reload()
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    } finally {
      setRetrying(false)
    }
  }
  const remove = async () => {
    try {
      await deletePing(ping.id)
      toast('Ping apagado')
      nav('/conta/pings', { replace: true })
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    }
  }
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      let pos = ping.ping_media.length
      for (const f of [...files].slice(0, Math.max(0, 6 - pos))) {
        const [img, meta] = await Promise.all([prepareImage(f), readPhotoMeta(f)])
        await uploadPingPhoto(ping.id, img, meta, pos++, crypto.randomUUID())
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
      }
      await reload()
      toast('Fotografia adicionada')
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="-mx-4 -mt-5 lg:-mx-8">
      <PageHeader
        title={ping.catches[0]?.species ?? k.label}
        eyebrow={`Ping · ${k.label}`}
        back="/conta/pings"
        actions={
          <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditOpen(true)}>
            Editar
          </Button>
        }
      />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-5 lg:grid-cols-[1.15fr_1fr] lg:px-8">
        <div className="space-y-4">
          {ping.ping_media.length > 0 ? (
            <div className="space-y-2">
              <button type="button" className="block w-full overflow-hidden rounded-[var(--radius-card)] shadow-card" onClick={() => setViewer(ping.ping_media[0].display_path ?? ping.ping_media[0].storage_path)} aria-label="Ver fotografia em grande">
                <SignedImage path={ping.ping_media[0].display_path} fallbackPath={ping.ping_media[0].thumb_path} alt={`Fotografia do Ping (${k.label})`} className="aspect-[4/3] w-full" />
              </button>
              {ping.ping_media.length > 1 && (
                <ul className="grid grid-cols-5 gap-1.5">
                  {ping.ping_media.slice(1).map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => setViewer(m.display_path ?? m.storage_path)} className="block w-full overflow-hidden rounded-xl" aria-label="Ver fotografia">
                        <SignedImage path={m.thumb_path} fallbackPath={m.display_path} alt="" className="aspect-square w-full" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <input ref={galRef} type="file" accept="image/*,.heic,.heif" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (void addPhotos(e.target.files), (e.target.value = ''))} />
            {ping.ping_media.length < 6 && (
              <Button size="sm" variant="outline" icon={uploading ? Loader2 : ImagePlus} className={uploading ? '[&_svg]:animate-spin' : ''} disabled={uploading} onClick={() => galRef.current?.click()}>
                {uploading ? 'A enviar…' : 'Adicionar fotografia'}
              </Button>
            )}
          </div>

          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="text-white" tone="ink">
                <span className="h-2 w-2 rounded-full" style={{ background: k.color }} aria-hidden /> {k.label}
              </Tag>
              {ping.outcome && <Tag>{OUTCOMES.find((o) => o.id === ping.outcome)?.label}</Tag>}
              {ping.modality && <Tag>{modalityLabel(ping.modality)}</Tag>}
            </div>
            <p className="mt-3 flex items-center gap-2 text-[15px] font-extrabold text-ink">
              <Clock className="h-4 w-4 text-teal-700" aria-hidden />
              {formatDateTime(ping.occurred_at, tz, { dateStyle: 'full', timeStyle: 'short' })}
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {tz} · {TIME_SOURCE[ping.time_source]} · fiabilidade {RELIABILITY[ping.time_reliability]}
            </p>
            <p className="mt-1 text-[11.5px] text-subtle">
              Registado em {formatDateTime(ping.server_received_at, tz)}
              {ping.ping_media[0]?.exif_taken_at ? ` · fotografia com data nos metadados` : ''}
            </p>
            {ping.notes && <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-text">{ping.notes}</p>}
          </Panel>

          <Panel
            title="Capturas"
            actions={
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => setCatchOpen(true)}>
                Adicionar
              </Button>
            }
          >
            {ping.catches.length === 0 ? (
              <p className="text-[13.5px] text-muted">{ping.kind === 'captura' ? 'Ainda sem detalhes da captura.' : 'Sem capturas neste Ping.'}</p>
            ) : (
              <ul className="space-y-2">
                {ping.catches.map((c) => (
                  <CatchItem key={c.id} c={c} units={units} onDelete={async () => {
                    try {
                      await deleteCatch(c.id)
                      setData({ ...ping, catches: ping.catches.filter((x) => x.id !== c.id) })
                    } catch (e) {
                      toast(friendly(e), { tone: 'warning' })
                    }
                  }} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Detalhes">
            <dl>
              <KV label="Técnica" value={ping.technique} />
              <KV label="Isco" value={ping.bait} />
              <KV label="Equipamento" value={ping.equipment} />
              <KV label="Profundidade" value={ping.depth_m != null ? `${fmt.num(ping.depth_m)} m` : null} />
              <KV label="Fundo" value={ping.bottom_type} />
              <KV label="Tempo de pesca" value={ping.fishing_minutes != null ? `${ping.fishing_minutes} min` : null} />
              <KV label="N.º de capturas" value={ping.catch_count} />
            </dl>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Local">
            {ping.lat != null && ping.lng != null ? (
              <>
                <div className="relative mb-3 h-52 overflow-hidden rounded-2xl">
                  <PrivateMap pings={[{ id: ping.id, lat: ping.lat, lng: ping.lng, kind: ping.kind, occurred_at: ping.occurred_at }]} className="absolute inset-0" label="Mapa do local do Ping" />
                </div>
                <p className="flex items-center gap-2 text-[14px] font-bold text-ink">
                  <MapPin className="h-4 w-4 text-teal-700" aria-hidden />
                  <span className="tnum">{formatCoords(ping.lat, ping.lng)}</span>
                </p>
                <p className="text-[12.5px] text-muted">
                  {LOCATION_SOURCE[ping.location_source]}
                  {ping.accuracy_m != null ? ` · ±${ping.accuracy_m} m` : ''}
                </p>
                <ButtonLink to={`/?pin=${ping.id}`} size="sm" variant="dark" icon={MapPin} className="mt-2">
                  Ver no mapa
                </ButtonLink>
              </>
            ) : (
              <p className="text-[13.5px] text-muted">Sem localização.</p>
            )}
            <div className="mt-3 border-t border-line pt-3">
              {ping.pin ? (
                <Link to={`/conta/pins/${ping.pin.id}`} className="text-[14px] font-extrabold text-teal-700 underline-offset-2 hover:underline">
                  Pin: {ping.pin.name}
                </Link>
              ) : ping.lat != null ? (
                <ButtonLink to={`/conta/pins/novo?lat=${ping.lat}&lng=${ping.lng}${ping.accuracy_m ? `&acc=${ping.accuracy_m}` : ''}&fromPing=${ping.id}`} size="sm" variant="outline" icon={MapPinPlus}>
                  Guardar este local como Pin
                </ButtonLink>
              ) : (
                <p className="text-[13px] text-muted">Sem Pin associado.</p>
              )}
            </div>
          </Panel>
          <ConditionsPanel env={ping.ping_environment} status={ping.enrichment_status} error={ping.enrichment_error} tz={tz} units={units} onRetry={retry} retrying={retrying} />
          <Button variant="ghost" icon={Trash2} className="text-danger" onClick={() => setConfirmDel(true)}>
            Apagar Ping
          </Button>
        </div>
      </div>

      <ConfirmSheet open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={remove} danger title="Apagar este Ping?" confirmLabel="Apagar" text={`O Ping, as suas ${ping.ping_media.length} fotografias, as capturas e as condições guardadas são apagados definitivamente. O Pin e as jornadas mantêm-se.`} />
      <EditPingSheet open={editOpen} onClose={() => setEditOpen(false)} ping={ping} onSaved={() => void reload()} />
      <CatchSheet open={catchOpen} onClose={() => setCatchOpen(false)} pingId={ping.id} onSaved={(c) => setData({ ...ping, catches: [...ping.catches, c] })} />
      {viewer && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-3" role="dialog" aria-modal="true" aria-label="Fotografia" onClick={() => setViewer(null)}>
          <SignedImage path={viewer} alt="Fotografia do Ping" className="max-h-full max-w-full !object-contain" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/15 px-4 py-2 text-[13px] font-bold text-white" onClick={() => setViewer(null)}>
            Fechar
          </button>
          <div className="absolute bottom-5 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="danger" icon={Trash2} onClick={async () => {
              const m = ping.ping_media.find((x) => x.display_path === viewer || x.storage_path === viewer)
              if (!m) return
              try {
                await deletePhoto(m)
                setViewer(null)
                setData({ ...ping, ping_media: ping.ping_media.filter((x) => x.id !== m.id) })
              } catch (e) {
                toast(friendly(e), { tone: 'warning' })
              }
            }}>
              Apagar fotografia
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function CatchItem({ c, units, onDelete }: { c: Catch; units: ReturnType<typeof useAuth>['units']; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-mist p-3">
      <Fish className="h-5 w-5 shrink-0 text-teal-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold text-ink">{c.species}</p>
        <p className="text-[12.5px] text-muted">
          {[fmt.length(c.length_cm, units), fmt.weight(c.weight_g, units), c.released === true ? 'devolvido' : c.released === false ? 'não devolvido' : null].filter(Boolean).join(' · ') || 'Sem medidas'}
        </p>
      </div>
      <button type="button" onClick={onDelete} className="press grid h-9 w-9 place-items-center rounded-full text-subtle hover:bg-white hover:text-danger" aria-label={`Apagar captura ${c.species}`}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  )
}

function CatchSheet({ open, onClose, pingId, onSaved }: { open: boolean; onClose: () => void; pingId: string; onSaved: (c: Catch) => void }) {
  const { units } = useAuth()
  const toast = useToast()
  const [species, setSpecies] = useState('')
  const [length, setLength] = useState('')
  const [weight, setWeight] = useState('')
  const [released, setReleased] = useState(true)
  const [busy, setBusy] = useState(false)
  const n = (s: string) => (s.trim() && Number.isFinite(Number(s.replace(',', '.'))) ? Number(s.replace(',', '.')) : null)
  const save = async () => {
    if (!species.trim()) return
    setBusy(true)
    try {
      const l = n(length)
      const w = n(weight)
      onSaved(await addCatch({ ping_id: pingId, species: species.trim(), length_cm: l != null ? toBaseLength(l, units) : null, weight_g: w != null ? toBaseWeight(w, units) : null, released }))
      setSpecies('')
      setLength('')
      setWeight('')
      onClose()
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Adicionar captura" footer={<Button className="w-full" disabled={!species.trim() || busy} onClick={save}>Guardar captura</Button>}>
      <div className="space-y-3">
        <Field label="Espécie" htmlFor="c-sp">
          <input id="c-sp" list="c-sp-list" value={species} onChange={(e) => setSpecies(e.target.value)} className={inputCls} />
          <datalist id="c-sp-list">{SPECIES_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Comprimento (${units.unit_length})`} htmlFor="c-l">
            <input id="c-l" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} className={inputCls} />
          </Field>
          <Field label={`Peso (${units.unit_weight})`} htmlFor="c-w">
            <input id="c-w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Toggle label="Devolvido à água" checked={released} onChange={setReleased} />
      </div>
    </Sheet>
  )
}

function EditPingSheet(props: { open: boolean; onClose: () => void; ping: PingFull; onSaved: () => void }) {
  // O formulário nasce de novo a cada abertura, com os valores atuais do Ping.
  return props.open ? <EditPingForm key={props.ping.updated_at} {...props} /> : null
}

function EditPingForm({ open, onClose, ping, onSaved }: { open: boolean; onClose: () => void; ping: PingFull; onSaved: () => void }) {
  const toast = useToast()
  const pinsQ = useLoad(listPins, [])
  const [kind, setKind] = useState<PingKind>(ping.kind)
  const [when, setWhen] = useState(utcToZonedLocal(ping.occurred_at, ping.occurred_tz))
  const [pinId, setPinId] = useState(ping.pin_id ?? '')
  const [notes, setNotes] = useState(ping.notes ?? '')
  const [technique, setTechnique] = useState(ping.technique ?? '')
  const [bait, setBait] = useState(ping.bait ?? '')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      const iso = zonedLocalToUtc(when, ping.occurred_tz)
      const timeChanged = iso && iso !== new Date(ping.occurred_at).toISOString()
      await updatePing(ping.id, {
        kind,
        pin_id: pinId || null,
        notes: notes.trim() || null,
        technique: technique.trim() || null,
        bait: bait.trim() || null,
        ...(timeChanged ? { occurred_at: iso!, time_source: 'manual' as const, time_reliability: 'media' as const } : {}),
      })
      toast('Ping atualizado', { detail: timeChanged ? 'A hora mudou: as condições vão ser obtidas de novo para o novo momento.' : undefined })
      onSaved()
      onClose()
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Editar Ping" footer={<Button className="w-full" disabled={busy} onClick={save}>Guardar</Button>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PING_KINDS.map((x) => (
            <Chip key={x.id} active={kind === x.id} onClick={() => setKind(x.id)}>
              {x.label}
            </Chip>
          ))}
        </div>
        <Field label={`Data e hora (${ping.occurred_tz})`} htmlFor="e-when">
          <input id="e-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Pin" htmlFor="e-pin">
          <select id="e-pin" value={pinId} onChange={(e) => setPinId(e.target.value)} className={selectCls}>
            <option value="">Sem Pin</option>
            {(pinsQ.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Técnica" htmlFor="e-tech">
            <input id="e-tech" value={technique} onChange={(e) => setTechnique(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Isco" htmlFor="e-bait">
            <input id="e-bait" value={bait} onChange={(e) => setBait(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Notas" htmlFor="e-notes">
          <textarea id="e-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} />
        </Field>
      </div>
    </Sheet>
  )
}
