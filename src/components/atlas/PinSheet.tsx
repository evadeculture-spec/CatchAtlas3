import { BookOpen, CalendarPlus, Loader2, MapPin, Move, Pencil, Share2, Trash2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import { getPing, listJourneys, type JourneyFull } from '../../lib/lanca/api'
import { addToJourney, PHOTO_LABEL, publishShare, revokeShare, SYNC_LABEL, TYPE_LABEL, type FieldPin, type FieldPinType, type FieldStore, type ShareMode } from '../../lib/lanca/fieldPins'
import { formatCoords } from '../../lib/lanca/geo'
import { tzLabel } from '../../lib/lanca/region'
import { formatDateTime, todayIn } from '../../lib/lanca/time'
import type { PingFull } from '../../lib/lanca/types'
import { fmt, weatherLabel, type Units } from '../../lib/lanca/units'
import { approximate } from '../../../supabase/functions/_shared/approx.ts'
import { SignedImage } from '../lanca/SignedImage'
import { cx } from '../ui'
import { pinIconSvg } from './pinLayers'
import { perfMeasure } from './PinComposer'

/** Pin selecionado no mapa: registo local (pode ainda não estar no servidor) e/ou linha do servidor. */
export interface SelectedPin {
  id: string
  type: FieldPinType
  lat: number
  lng: number
  title: string | null
  occurredAt: string | null
  tz: string | null
  waterName: string | null
  waterRef: string | null
  thumbPath: string | null
  local: FieldPin | null
}

const chip = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold'
const action = 'press inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 px-3 text-[13px] font-bold hover:bg-white/5'

export function PinSheet({ sel, store, units, shared, shareMode = null, onClose, onEdit, onMove, onDeleted, onSharedChange, toast }: {
  sel: SelectedPin
  store: FieldStore
  units: Units
  shared: boolean
  /** Modo da partilha atual, quando conhecido («zona» por omissão nas partilhas antigas). */
  shareMode?: ShareMode | null
  onClose: () => void
  onEdit: () => void
  onMove: () => void
  onDeleted: () => void
  onSharedChange: () => void
  toast: (m: string, o?: { tone?: 'success' | 'info' | 'warning'; detail?: string }) => void
}) {
  const local = sel.local
  const synced = local ? local.existsOnServer : true
  const isPing = sel.type !== 'local'
  const [full, setFull] = useState<{ id: string; ping: PingFull | null } | null>(null)
  const [localThumb, setLocalThumb] = useState<string | null>(null)
  const [panel, setPanel] = useState<null | 'jornada' | 'partilhar' | 'eliminar'>(null)
  const [journeys, setJourneys] = useState<JourneyFull[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const currentMode: ShareMode = shareMode ?? 'zona'
  const [mode, setMode] = useState<ShareMode>(currentMode)

  // Dados completos do servidor (fotografia assinada, captura, condições) quando já sincronizado.
  const syncedNow = local?.sync === 'synced' || !local
  useEffect(() => {
    if (!isPing || !synced) return
    let alive = true
    getPing(sel.id)
      .then((p) => alive && setFull({ id: sel.id, ping: p }))
      .catch(() => alive && setFull({ id: sel.id, ping: null }))
    return () => {
      alive = false
    }
  }, [sel.id, isPing, synced, syncedNow])
  // Fotografia ainda só no dispositivo.
  const firstLocal = local?.photos.find((f) => f.state !== 'synced')
  useEffect(() => {
    if (!local || !firstLocal) return
    let alive = true
    let url: string | null = null
    store.photoUrl(local.id, firstLocal.id, 'thumb').then((u) => {
      url = u
      if (alive) setLocalThumb(u)
    })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [local, firstLocal, store])

  // Feedback da seleção (toque no pin → ficha visível), medido em produção.
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      try {
        performance.mark('pin:sheet')
        perfMeasure('pin-select:feedback', 'pin:select', 'pin:sheet')
      } catch {
        /* sem marca inicial */
      }
    })
  }, [sel.id])
  const ping = full?.id === sel.id ? full.ping : null
  const env = ping?.ping_environment ?? null
  const media = ping?.ping_media[0] ?? null
  const c = ping?.catches[0]
  const tz = local?.tz ?? sel.tz ?? ping?.occurred_tz ?? 'Europe/Lisbon'
  const occurredAt = local?.occurredAt ?? sel.occurredAt ?? ping?.occurred_at ?? null
  const title = (sel.type === 'local' ? local?.name ?? sel.title : local?.species ?? c?.species ?? sel.title) || TYPE_LABEL[sel.type]
  const state = local?.sync ?? 'synced'
  const photoStates = local?.photos.map((f) => f.state) ?? []
  const photoState = photoStates.includes('error') ? 'error' : photoStates.includes('uploading') ? 'uploading' : photoStates.includes('local') ? 'local' : photoStates.length ? 'synced' : null

  const openJourneys = async () => {
    setPanel('jornada')
    setErr(null)
    try {
      const today = todayIn(tz)
      setJourneys((await listJourneys()).filter((j) => j.status !== 'arquivada' && j.status !== 'concluida' && j.journey_date >= today).sort((a, b) => a.journey_date.localeCompare(b.journey_date)))
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const ap = approximate(sel.lat, sel.lng, sel.waterName)

  return (
    <div className="space-y-3" data-pin-sheet={sel.id} data-pin-state={state} data-pin-type={sel.type} data-lat={sel.lat} data-lng={sel.lng}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/8" dangerouslySetInnerHTML={{ __html: pinIconSvg(sel.type) }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#83e5ef]">{TYPE_LABEL[sel.type]} · privado</p>
          <h2 className="truncate text-[18px] font-extrabold">{title}</h2>
        </div>
        <button type="button" onClick={onClose} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar ficha do pin">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-live="polite">
        <span className={cx(chip, state === 'synced' ? 'bg-[#38c9d5]/15 text-[#83e5ef]' : state === 'local' || state === 'syncing' ? 'bg-white/10 text-[#f4f7f8]' : 'bg-amber-50 text-amber-900')} data-sync={state}>
          {state === 'syncing' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {SYNC_LABEL[state]}
        </span>
        {photoState && <span className={cx(chip, photoState === 'synced' ? 'bg-white/8 text-[#b5c5cc]' : photoState === 'error' ? 'bg-amber-50 text-amber-900' : 'bg-white/10 text-[#f4f7f8]')} data-photo={photoState}>{PHOTO_LABEL[photoState]}</span>}
        {shared && <span className={cx(chip, 'bg-[#3b82f6]/20 text-[#bcd6ff]')} data-share-mode={currentMode}>{currentMode === 'exato' ? 'Partilhado (ponto exato)' : 'Partilhado (aproximado)'}</span>}
        {!shared && synced && isPing && <span className={cx(chip, 'bg-[#8b5cf6]/20 text-[#d9ccff]')} data-share-mode="privado">Privado</span>}
      </div>
      {local?.error && state !== 'synced' && (
        <div className="rounded-2xl bg-amber-50 p-3 text-[12.5px] text-amber-900" role="alert">
          <p className="font-semibold">{local.error}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {state === 'auth' && (
              <Link to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} className="press min-h-9 rounded-full bg-amber-900 px-3 py-2 font-bold text-white">
                Iniciar sessão
              </Link>
            )}
            {state === 'conflict' ? (
              <>
                <button type="button" className="press min-h-9 rounded-full bg-amber-900 px-3 font-bold text-white" onClick={() => void store.resolveConflict(sel.id, 'local')}>
                  Manter a minha versão
                </button>
                <button type="button" className="press min-h-9 rounded-full px-3 font-bold" onClick={() => void store.resolveConflict(sel.id, 'server')}>
                  Usar a do servidor
                </button>
              </>
            ) : (
              <button type="button" className="press min-h-9 rounded-full bg-amber-900 px-3 font-bold text-white" onClick={() => void store.retryAll()}>
                Tentar de novo
              </button>
            )}
            {state === 'quota' && firstLocal && (
              <button type="button" className="press min-h-9 rounded-full px-3 font-bold" onClick={() => void store.dropPhoto(sel.id, firstLocal.id)}>
                Guardar sem esta fotografia
              </button>
            )}
          </div>
        </div>
      )}

      {(localThumb || media) && (
        <div className="overflow-hidden rounded-2xl">
          {localThumb ? <img src={localThumb} alt={`Fotografia: ${title}`} className="aspect-[4/3] w-full object-cover" /> : <SignedImage path={media!.display_path} fallbackPath={media!.thumb_path} alt={`Fotografia: ${title}`} className="aspect-[4/3] w-full" />}
        </div>
      )}

      <dl className="space-y-1 text-[13px]">
        {occurredAt && sel.type !== 'local' && (
          <div className="flex justify-between gap-3">
            <dt className="text-[#b5c5cc]">Quando</dt>
            <dd className="text-right font-bold">
              {formatDateTime(occurredAt, tz)} <span className="font-semibold text-[#b5c5cc]">· {tzLabel(tz)}</span>
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-[#b5c5cc]">Ponto</dt>
          <dd className="tnum text-right font-bold">
            {formatCoords(sel.lat, sel.lng, 5)}
            {local?.accuracy != null ? ` · ±${local.accuracy} m` : ''}
            <span className="block text-[11.5px] font-semibold text-[#b5c5cc]">{local ? (local.source === 'gps' ? 'GPS do telemóvel' : 'Escolhido no mapa') : ''}{sel.waterName ? `${local ? ' · ' : ''}${sel.waterName}` : ''}</span>
          </dd>
        </div>
        {(c || local?.species) && (
          <div className="flex justify-between gap-3">
            <dt className="text-[#b5c5cc]">Captura</dt>
            <dd className="text-right font-bold">{[local?.species ?? c?.species, fmt.length(local?.lengthCm ?? c?.length_cm, units), fmt.weight(local?.weightG ?? c?.weight_g, units)].filter(Boolean).join(' · ')}</dd>
          </div>
        )}
        {isPing && synced && (
          <div className="flex justify-between gap-3">
            <dt className="text-[#b5c5cc]">Condições</dt>
            <dd className="text-right font-bold">
              {env?.air_temp_c != null ? `${fmt.temp(env.air_temp_c, units)} ar · ${weatherLabel(env.weather_code) ?? ''} · vento ${fmt.wind(env.wind_kmh, units) ?? '—'}` : ping?.enrichment_status === 'falhou' ? 'Indisponível' : ping ? 'A obter…' : '…'}
              {env && <span className="block text-[11px] font-semibold text-[#b5c5cc]">{env.data_kind === 'historico' ? 'Histórico (reanálise)' : 'Estimativa de modelo'} · água: indisponível</span>}
            </dd>
          </div>
        )}
      </dl>

      {panel === null && (
        <div className="grid grid-cols-2 gap-2">
          {synced ? (
            <Link to={isPing ? `/conta/pings/${sel.id}` : `/conta/pins/${sel.id}`} className={action}>
              <BookOpen className="h-4 w-4" aria-hidden /> Abrir no diário
            </Link>
          ) : (
            <span className={cx(action, 'opacity-50')} title="Disponível depois de sincronizar">
              <BookOpen className="h-4 w-4" aria-hidden /> Diário
            </span>
          )}
          <button type="button" className={action} onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden /> Editar
          </button>
          <button type="button" className={action} onClick={onMove}>
            <Move className="h-4 w-4" aria-hidden /> Mover
          </button>
          <button type="button" className={action} onClick={openJourneys} disabled={!synced}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Adicionar à jornada
          </button>
          {isPing && (
            <button type="button" className={action} onClick={() => setPanel('partilhar')} disabled={!synced}>
              <Share2 className="h-4 w-4" aria-hidden /> {shared ? 'Partilha' : 'Partilhar'}
            </button>
          )}
          <button type="button" className={cx(action, 'text-[#ffb4a8]')} onClick={() => setPanel('eliminar')}>
            <Trash2 className="h-4 w-4" aria-hidden /> Eliminar
          </button>
        </div>
      )}

      {panel === 'jornada' && (
        <div className="space-y-2 rounded-2xl border border-white/10 p-3">
          <p className="text-[13.5px] font-extrabold">Adicionar à jornada</p>
          <p className="text-[12px] text-[#b5c5cc]">O ponto fica na jornada como referência; não é criada outra captura.</p>
          {!journeys ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-label="A carregar" />
          ) : (
            <ul className="space-y-1.5">
              {journeys.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className="press flex min-h-11 w-full items-center justify-between rounded-xl bg-white/5 px-3 text-left text-[13px] font-bold hover:bg-white/10"
                    onClick={() =>
                      run(async () => {
                        await addToJourney(j.id, sel.id, sel.type)
                        toast('Adicionado à jornada', { detail: j.title })
                        setPanel(null)
                      })
                    }
                  >
                    <span className="truncate">{j.title}</span>
                    <span className="shrink-0 text-[12px] text-[#b5c5cc]">{j.journey_date.split('-').reverse().join('/')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to={`/conta/jornadas/nova?${new URLSearchParams({ ...(sel.type === 'local' ? { pin: sel.id } : { ping: sel.id }), ...(sel.waterRef ? { agua: sel.waterRef } : {}), ...(sel.waterName ? { nome: sel.waterName } : {}) })}`} className={cx(action, 'w-full bg-[#38c9d5] text-[#071923]')}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Nova jornada com este ponto
          </Link>
          <button type="button" className="press min-h-11 w-full text-[13px] font-bold text-[#b5c5cc]" onClick={() => setPanel(null)}>
            Cancelar
          </button>
        </div>
      )}

      {panel === 'partilhar' && (
        <div className="space-y-2 rounded-2xl border border-[#3b82f6]/40 p-3" data-share-panel>
          <p className="text-[13.5px] font-extrabold">{shared ? 'Partilhado na comunidade' : 'Partilhar na comunidade'}</p>
          <p className="text-[12px] leading-relaxed text-[#b5c5cc]">O seu pin continua no seu diário com o ponto exato. A comunidade vê uma cópia separada:</p>
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Como partilhar a localização</legend>
            {(['zona', 'exato'] as const).map((m) => (
              <label key={m} className={cx('flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2', mode === m ? 'border-[#3b82f6] bg-[#3b82f6]/10' : 'border-white/12')}>
                <input type="radio" name="share-mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-1 h-4 w-4 accent-[#3b82f6]" />
                <span className="text-[12.5px]">
                  <span className="block font-extrabold">{m === 'zona' ? 'Partilhar zona' : 'Partilhar ponto exato'}{m === 'zona' ? ' (recomendado)' : ''}</span>
                  <span className="text-[#b5c5cc]">{m === 'zona' ? 'Mostra só uma zona da massa de água (~6 km), nunca o ponto exato.' : 'Qualquer pessoa da comunidade vê exatamente onde pescou.'}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#83e5ef]">Pré-visualização da vista pública</p>
          <ul className="list-disc space-y-0.5 pl-5 text-[12.5px]" data-share-preview={mode}>
            <li>{mode === 'zona' ? `Local: ${ap.label} (nunca o ponto exato)` : `Local: ponto exato (${sel.lat.toFixed(5)}, ${sel.lng.toFixed(5)})`}</li>
            <li>Data e hora da captura{occurredAt ? `: ${formatDateTime(occurredAt, tz)}` : ''}</li>
            <li>{TYPE_LABEL[sel.type]}{(local?.species ?? c?.species) ? ` · ${local?.species ?? c?.species}` : ''}{c?.weight_g ? ` · ${(c.weight_g / 1000).toLocaleString('pt-PT')} kg` : ''}{ping?.technique ? ` · ${ping.technique}` : ''}</li>
            <li>{media?.display_path ? 'Fotografia reduzida, sem metadados nem GPS' : 'Sem fotografia'} · sem notas nem nome</li>
          </ul>
          {(!shared || mode !== currentMode) && (
            <button
              type="button"
              disabled={busy}
              className={cx(action, 'w-full bg-[#3b82f6] text-white')}
              onClick={() =>
                run(async () => {
                  await publishShare(sel.id, mode)
                  toast(shared ? 'Partilha atualizada' : 'Partilhado na comunidade', { detail: mode === 'zona' ? 'Versão aproximada, sem o ponto exato.' : 'Com o ponto exato, por sua escolha.' })
                  onSharedChange()
                  setPanel(null)
                })
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
              {shared ? (mode === 'zona' ? 'Mudar para zona aproximada' : 'Mudar para ponto exato') : mode === 'zona' ? 'Publicar versão aproximada' : 'Publicar ponto exato'}
            </button>
          )}
          {shared && (
            <button
              type="button"
              disabled={busy}
              className={cx(action, 'w-full')}
              onClick={() =>
                run(async () => {
                  await revokeShare(sel.id)
                  toast('Partilha retirada', { detail: 'O pin continua no seu diário privado.' })
                  onSharedChange()
                  setPanel(null)
                })
              }
            >
              Retirar da comunidade (tornar privado)
            </button>
          )}
          <button type="button" className="press min-h-11 w-full text-[13px] font-bold text-[#b5c5cc]" onClick={() => setPanel(null)}>
            Cancelar
          </button>
        </div>
      )}

      {panel === 'eliminar' && (
        <div className="space-y-2 rounded-2xl border border-[#ffb4a8]/40 p-3" role="alertdialog" aria-label="Confirmar eliminação">
          <p className="text-[13.5px] font-extrabold">Eliminar este pin?</p>
          <p className="text-[12.5px] text-[#b5c5cc]">Apaga o pin{isPing ? ', as fotografias e as condições guardadas' : ''} no dispositivo e no servidor{shared ? ', e retira a partilha' : ''}. Não é possível desfazer.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={action} onClick={() => setPanel(null)}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              className={cx(action, 'border-transparent bg-[#c0392b] text-white')}
              onClick={() =>
                run(async () => {
                  await store.remove(sel.id)
                  toast('Pin eliminado')
                  onDeleted()
                })
              }
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Eliminar pin
            </button>
          </div>
        </div>
      )}
      {err && <p className="text-[12.5px] font-semibold text-amber-200" role="alert">{err}</p>}
      <p className="flex items-center gap-1.5 text-[11.5px] text-[#b5c5cc]">
        <MapPin className="h-3 w-3" aria-hidden /> Coordenada exata e fotografia original só na sua conta.
      </p>
    </div>
  )
}
