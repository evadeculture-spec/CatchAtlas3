/**
 * «Os meus pins» (dentro de «Gera a tua história»): o «Mapa de pins» do pescador.
 *  - Abre sempre na vista pessoal (privados e públicos do próprio). «Incluir pins da comunidade» fica desligado
 *    e em destaque no topo; ligar acrescenta reports públicos de terceiros na precisão escolhida por cada autor.
 *  - Uma única pesquisa (servidor) alimenta o mapa e as contagens: «N resultados» (toda a pesquisa autorizada)
 *    e «N nesta área» (pontos de apresentação na área visível). Mover o mapa muda só o segundo valor.
 *  - Pins ainda só no dispositivo entram com as mesmas regras (pinSearch.matches) e contam uma vez pelo ID.
 *  - Respostas antigas são descartadas (pedido cancelado + número de sequência) quando os filtros ou a camada
 *    da comunidade mudam; desligar a comunidade retira de imediato fichas, fotos, realces e resultados dela.
 */
import { ChevronLeft, ChevronRight, Filter, Globe2, Loader2, Lock, MapPinPlus, Search, WifiOff, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { GeoJSONSource } from 'maplibre-gl'
import { AtlasMap, type AtlasMapHandle, type AtlasStatus, type ViewInfo } from '../../components/atlas/AtlasMap'
import { useMediaQuery } from '../../components/atlas/BottomSheet'
import { PinSheet, type SelectedPin } from '../../components/atlas/PinSheet'
import { Sheet } from '../../components/Dialog'
import { SignedImage } from '../../components/lanca/SignedImage'
import { ensureLayers, MARK_LABEL, markOf, MP_LAYERS, MP_SRC, setRows, setSelected, setZone } from '../../components/meuspins/layers'
import { cx } from '../../components/ui'
import { SPECIES } from '../../data/catalog'
import { ATLAS_CONFIG } from '../../lib/atlas/config'
import { useRegistry } from '../../lib/atlas/registry'
import { searchAtlas } from '../../lib/atlas/search'
import { cameraParam } from '../../lib/atlas/urlState'
import { displayType, fieldStoreFor, type FieldPin } from '../../lib/lanca/fieldPins'
import {
  activeChips, EMPTY_FILTER, filterActive, formatKg, matches, mergeLocal, parseKg, removeChip, searchPins, sortReports,
  type PinFilter, type PinRow, type SearchResult, type WeightOp,
} from '../../lib/lanca/pinSearch'
import { formatDateTime } from '../../lib/lanca/time'
import { useAuth } from '../../state/Auth'
import { useToast } from '../../state/Toasts'

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] }
const NO_FILTERS = { countries: [], types: [], favOnly: false }
const QUICK_SPECIES = ['Achigã', 'Carpa', 'Lúcio']
const noopSubscribe = () => () => {}

const localRow = (p: FieldPin): PinRow => ({
  source: 'local', id: p.id, kind: p.type === 'local' ? 'local' : p.type, lat: p.lat, lng: p.lng, precision: 'exato', visibility: 'privado',
  species: p.type === 'local' ? null : p.species, weight_g: p.type === 'local' ? null : p.weightG, occurred_at: p.type === 'local' ? null : p.occurredAt,
  occurred_tz: p.tz, zone_id: null, water_body_ref: p.waterRef, water_body_name: p.waterName, photo_path: null, photo_bucket: null,
  label: p.type === 'local' ? p.name ?? 'Local para voltar' : p.species,
})
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-PT')} ${n === 1 ? one : many}`
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

export default function MeusPins() {
  const { user, units } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const desktop = useMediaQuery('(min-width: 900px)')
  const mapHandle = useRef<AtlasMapHandle>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [status, setStatus] = useState<AtlasStatus>({ map: 'loading', dem: ATLAS_CONFIG.dem.enabled ? 'loading' : 'off', basemap: 'ok', water: 'ok', detailLoading: false })
  const [view, setView] = useState<ViewInfo | null>(null)
  // Ao entrar no separador começa SEMPRE pela vista pessoal (estado não persistido entre visitas).
  const [community, setCommunity] = useState(false)
  const [filter, setFilter] = useState<PinFilter>(EMPTY_FILTER)
  const [panelOpen, setPanelOpen] = useState(false)
  const [res, setRes] = useState<{ key: string; community: boolean; r: SearchResult } | null>(null)
  const [net, setNet] = useState<'loading' | 'ok' | 'offline' | 'error'>('loading')
  const [nonce, setNonce] = useState(0)
  const [pager, setPager] = useState<{ ids: string[]; cur: string } | null>(null)
  const [sheetId, setSheetId] = useState<string | null>(null)

  // ---------- pins só no dispositivo (por sincronizar) ----------
  const store = user ? fieldStoreFor(user.id) : null
  const version = useSyncExternalStore(
    store ? (cb) => store.subscribe(cb) : noopSubscribe,
    () => (store ? store.list().map((p) => `${p.id}:${p.sync}:${p.updatedAt}`).join('|') + store.deletedIds().size : ''),
  )
  const local = useMemo(() => (store ? store.list() : []), [store, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const deleted = useMemo(() => (store ? store.deletedIds() : new Set<string>()), [store, version]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!store) return
    void store.ready().then(() => store.sync())
  }, [store])
  const syncedCount = local.filter((p) => p.sync === 'synced').length + deleted.size
  const lastSynced = useRef(syncedCount)
  useEffect(() => {
    if (syncedCount === lastSynced.current) return
    lastSynced.current = syncedCount
    // A sincronização terminou: o servidor passa a ter os registos (recarrega a mesma pesquisa).
    setNonce((n) => n + 1)
  }, [syncedCount])

  // ---------- pesquisa (uma só para mapa e contagens) ----------
  const filterKey = JSON.stringify(filter)
  const key = `${filterKey}|${community}`
  const b = view?.bounds
  const boundsKey = b ? b.map((v) => v.toFixed(4)).join(',') : ''
  const seq = useRef(0)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!user || !b) return
    const my = ++seq.current
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    const t = window.setTimeout(() => {
      searchPins(filter, community, b, ctl.signal)
        .then((r) => {
          // Resposta atrasada de uma pesquisa já substituída (outros filtros, comunidade desligada): descarta.
          if (ctl.signal.aborted || my !== seq.current) return
          setRes({ key, community, r })
          setNet('ok')
        })
        .catch(() => {
          if (ctl.signal.aborted || my !== seq.current) return
          setNet(navigator.onLine ? 'error' : 'offline')
        })
    }, 200)
    return () => {
      window.clearTimeout(t)
      ctl.abort()
    }
    // `key`, `boundsKey` e `nonce` resumem filtros, comunidade, área e recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key, boundsKey, nonce])
  useEffect(() => {
    const on = () => setNonce((n) => n + 1)
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [])

  // Linhas apresentadas: a resposta da pesquisa atual; enquanto a nova não chega, a anterior refiltrada com as
  // MESMAS regras (e nunca com reports da comunidade se ela estiver desligada).
  const current = res && res.key === key
  const serverRows = useMemo(() => {
    if (!res) return []
    const rows = res.r.rows.filter((r) => !deleted.has(r.id) && (community || r.source !== 'comm'))
    return current ? rows : rows.filter((r) => matches(r, filter))
  }, [res, current, community, filter, deleted])
  const localRows = useMemo(() => local.filter((p) => p.sync !== 'synced' && !deleted.has(p.id)).map(localRow), [local, deleted])
  const merged = useMemo(() => mergeLocal({ rows: serverRows, total: current ? res!.r.total : 0, inView: current ? res!.r.inView : 0 }, localRows, filter, b ?? null), [serverRows, current, res, localRows, filter, b])
  const rows = merged.rows
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])
  const countsReady = current && net !== 'loading'

  // ---------- mapa ----------
  const ready = status.map === 'ready'
  useEffect(() => {
    const map = mapHandle.current?.getMap()
    if (!map || !ready) return
    ensureLayers(map)
    setRows(map, rows)
  }, [ready, rows])

  // ---------- fichas (pager) ----------
  // Conserva a seleção por ID durante as atualizações; se sair dos resultados, fecha e mantém o enquadramento.
  const pagerItems = useMemo(() => (pager ? sortReports(pager.ids.map((id) => byId.get(id)).filter((r): r is PinRow => !!r)) : []), [pager, byId])
  const curRow = pager ? byId.get(pager.cur) ?? null : null
  useEffect(() => {
    if (pager && !curRow) {
      setPager(null) // eslint-disable-line react-hooks/set-state-in-effect
      setSheetId(null)
    }
  }, [pager, curRow])
  useEffect(() => {
    const map = mapHandle.current?.getMap()
    if (!map || !ready) return
    setSelected(map, curRow ? { lng: curRow.lng, lat: curRow.lat } : null)
    // Realce só da zona pública da ficha selecionada (reports aproximados de terceiros).
    setZone(map, curRow && curRow.source === 'comm' && curRow.precision === 'zona' ? curRow.zone_id : null)
  }, [ready, curRow])
  const closePager = () => {
    setPager(null)
    setSheetId(null)
    headingRef.current?.focus()
  }
  const openPager = useCallback((ids: string[]) => {
    const items = sortReports(ids.map((id) => byId.get(id)).filter((r): r is PinRow => !!r))
    if (!items.length) return
    setSheetId(null)
    setPager({ ids: items.map((r) => r.id), cur: items[0].id })
  }, [byId])
  const step = (d: number) => {
    if (!pager || !pagerItems.length) return
    const i = pagerItems.findIndex((r) => r.id === pager.cur)
    const n = pagerItems[(i + d + pagerItems.length) % pagerItems.length]
    setPager({ ...pager, cur: n.id })
  }

  const onMapClick = useCallback(
    ({ point }: { point: { x: number; y: number } }) => {
      const map = mapHandle.current?.getMap()
      if (!map) return false
      const layers = MP_LAYERS.filter((l) => map.getLayer(l))
      if (!layers.length) return false
      const f = map.queryRenderedFeatures([[point.x - 16, point.y - 34], [point.x + 16, point.y + 10]], { layers })[0]
      if (!f) return false
      const cid = f.properties?.cluster_id
      if (cid == null) {
        openPager([String(f.properties?.id)])
        return true
      }
      const src = map.getSource(MP_SRC) as GeoJSONSource
      void src.getClusterLeaves(cid, 10000, 0).then((leaves) => {
        const pts = leaves.map((l) => (l.geometry.type === 'Point' ? l.geometry.coordinates : [0, 0]))
        const coincident = pts.every((p) => Math.abs(p[0] - pts[0][0]) < 1e-7 && Math.abs(p[1] - pts[0][1]) < 1e-7)
        if (coincident || map.getZoom() >= 15) openPager(leaves.map((l) => String(l.properties?.id)))
        else void src.getClusterExpansionZoom(cid).then((z) => map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z }))
      })
      return true
    },
    [openPager],
  )

  // ---------- comunidade ----------
  const toggleCommunity = () => {
    const next = !community
    setCommunity(next)
    if (!next && pager) {
      // Desligar retira de imediato fichas, foto, realce e resultados de terceiros.
      const keep = pager.ids.filter((id) => byId.get(id)?.source !== 'comm')
      if (!keep.includes(pager.cur)) closePager()
      else setPager({ ids: keep, cur: pager.cur })
    }
  }

  // ---------- pesquisa por local (massa de água, com região para distinguir homónimos) ----------
  const [placeQ, setPlaceQ] = useState('')
  const [placeFocus, setPlaceFocus] = useState(false)
  const { reg } = useRegistry(placeFocus || placeQ.length > 0 || panelOpen)
  const placeHits = useMemo(() => (reg && placeQ.trim().length >= 2 ? searchAtlas(reg.items, placeQ, { types: ['albufeira', 'lagoa', 'rio'] }, 8) : []), [reg, placeQ])
  const choosePlace = (id: string) => {
    const it = reg?.byId.get(id)
    if (!it) return
    setFilter((f) => ({ ...f, water: { ref: it.id, name: it.name, region: it.region ? `${it.region.province}, ${it.region.region}` : undefined } }))
    setPlaceQ('')
    setPlaceFocus(false)
    mapHandle.current?.frame({ bbox: it.bbox, kind: it.type === 'rio' ? 'river' : 'water', tier: it.tier })
  }

  const chips = activeChips(filter)
  const empty = countsReady && merged.total === 0
  const firstUse = empty && !filterActive(filter) && !community
  const capturas = rows.filter((r) => r.kind === 'captura').length

  const marcar = () => navigate(`/?marcar=1${view ? `&v=${cameraParam(view)}` : ''}`)

  // ---------- ficha completa de um pin próprio ----------
  const sheetRow = sheetId ? byId.get(sheetId) ?? null : null
  const sheetSel: SelectedPin | null = sheetRow
    ? {
        id: sheetRow.id, type: displayType(sheetRow.kind), lat: sheetRow.lat, lng: sheetRow.lng, title: sheetRow.label, occurredAt: sheetRow.occurred_at,
        tz: sheetRow.occurred_tz ?? 'Europe/Lisbon', waterName: sheetRow.water_body_name, waterRef: sheetRow.water_body_ref,
        thumbPath: sheetRow.photo_path, local: local.find((p) => p.id === sheetRow.id) ?? null,
      }
    : null

  const panel = (
    <div className="flex min-h-0 flex-col gap-3">
      <form onSubmit={(e: FormEvent) => e.preventDefault()} className="relative" role="search">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#83e5ef]" aria-hidden />
        <input
          value={placeQ}
          onChange={(e) => setPlaceQ(e.target.value)}
          onFocus={() => setPlaceFocus(true)}
          placeholder="Pesquisar local (albufeira, lagoa, rio)"
          aria-label="Pesquisar por local"
          className="h-11 w-full rounded-full border border-white/12 bg-[#0a2230] pl-10 pr-3 text-[14px] text-[#f4f7f8] placeholder:text-[#7f97a1]"
        />
        {placeHits.length > 0 && (
          <ul className="absolute inset-x-0 top-12 z-30 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-[#0a2230] shadow-2xl" role="listbox" aria-label="Locais">
            {placeHits.map((h) => (
              <li key={h.item.id}>
                <button type="button" role="option" aria-selected="false" className="flex min-h-11 w-full flex-col items-start px-4 py-2 text-left hover:bg-white/5" onClick={() => choosePlace(h.item.id)}>
                  <span className="text-[14px] font-bold">{h.item.name}</span>
                  <span className="text-[12px] text-[#b5c5cc]">{h.item.region ? `${h.item.region.province} · ${h.item.region.region}` : h.item.countries.join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtros rápidos">
        {QUICK_SPECIES.map((s) => {
          const on = filter.species.length === 1 && filter.species[0] === s
          return (
            <button key={s} type="button" aria-pressed={on} onClick={() => setFilter((f) => ({ ...f, species: on ? [] : [s] }))} className={cx('press min-h-11 rounded-full border px-3.5 text-[13px] font-bold', on ? 'border-[#38c9d5] bg-[#38c9d5] text-[#071923]' : 'border-white/15')}>
              {s}
            </button>
          )
        })}
        <button type="button" aria-pressed={filter.dateFrom === daysAgo(30) && !filter.dateTo} onClick={() => setFilter((f) => ({ ...f, dateFrom: daysAgo(30), dateTo: null, yearly: false }))} className="press min-h-11 rounded-full border border-white/15 px-3.5 text-[13px] font-bold">
          Últimos 30 dias
        </button>
        <button type="button" onClick={() => setPanelOpen(true)} className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-[13px] font-bold" data-action="abrir-filtros">
          <Filter className="h-4 w-4" aria-hidden /> Filtros{chips.length ? ` (${chips.length})` : ''}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos" data-active-filters>
          {chips.map((c) => (
            <span key={c.key} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-[#38c9d5]/15 pl-3 pr-1 text-[12.5px] font-bold text-[#83e5ef]">
              {c.label}
              <button type="button" onClick={() => setFilter((f) => removeChip(f, c.key))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label={`Retirar filtro: ${c.label}`}>
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => setFilter(EMPTY_FILTER)} className="press min-h-9 rounded-full px-3 text-[12.5px] font-bold text-[#b5c5cc] underline">
            Limpar todos
          </button>
        </div>
      )}

      <p className="text-[13.5px]" aria-live="polite">
        {countsReady ? (
          <>
            <strong className="text-[15px]">{plural(merged.total, 'resultado', 'resultados')}</strong>
            <span className="text-[#b5c5cc]"> · {plural(capturas, 'captura', 'capturas')} entre os carregados</span>
          </>
        ) : net === 'error' || net === 'offline' ? null : (
          <span className="inline-flex items-center gap-1.5 text-[#b5c5cc]"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> A pesquisar…</span>
        )}
      </p>
      {net === 'offline' && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900" role="status">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Sem rede. Mostro os pins guardados neste dispositivo; o resto volta quando houver ligação.
        </p>
      )}
      {net === 'error' && (
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900" role="alert">
          Não foi possível pesquisar.{' '}
          <button type="button" className="underline" onClick={() => setNonce((n) => n + 1)}>Tentar de novo</button>
        </p>
      )}
      {empty && !firstUse && <p className="rounded-2xl bg-white/5 px-3 py-2 text-[13px] text-[#b5c5cc]" data-zero>Nenhum resultado com estes filtros. Retire um filtro ou alargue as datas.</p>}
      {firstUse && (
        <p className="rounded-2xl bg-white/5 px-3 py-2 text-[13px] text-[#b5c5cc]" data-first-use>
          Ainda não tem pins. Toque em <strong className="text-[#f4f7f8]">Marcar pin</strong> para registar o primeiro.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-1 text-[12px] text-[#b5c5cc]" aria-label="Legenda">
        {(['privado', 'publico', 'aprox'] as const).map((m) => (
          <div key={m} className="flex items-center gap-2">
            <span className={cx('grid h-5 w-5 place-items-center rounded-full text-white', m === 'privado' ? 'bg-[#7c4dff]' : 'bg-[#2f7cf6]')} aria-hidden>
              {m === 'privado' ? <Lock className="h-3 w-3" /> : m === 'publico' ? <Globe2 className="h-3 w-3" /> : <span className="text-[13px] font-bold leading-none">≈</span>}
            </span>
            <dt className="sr-only">Símbolo</dt>
            <dd>{MARK_LABEL[m]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )

  const cardIndex = curRow ? pagerItems.findIndex((r) => r.id === curRow.id) : -1
  const swipe = useRef<number | null>(null)
  const card = curRow && !sheetSel && (
    <article
      className="rounded-3xl border border-white/10 bg-[#0a2230] p-3 shadow-2xl"
      aria-label={`Ficha ${cardIndex + 1} de ${pagerItems.length}`}
      data-card={curRow.id}
      data-card-pos={`${cardIndex + 1}/${pagerItems.length}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1)
        if (e.key === 'ArrowLeft') step(-1)
        if (e.key === 'Escape') closePager()
      }}
      onPointerDown={(e) => (swipe.current = e.clientX)}
      onPointerUp={(e) => {
        if (swipe.current == null) return
        const dx = e.clientX - swipe.current
        swipe.current = null
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
      }}
    >
      <div className="flex items-center gap-2">
        <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold text-white', markOf(curRow) === 'privado' ? 'bg-[#7c4dff]' : 'bg-[#2f7cf6]')} data-mark={markOf(curRow)}>
          {markOf(curRow) === 'privado' ? <Lock className="h-3 w-3" aria-hidden /> : markOf(curRow) === 'publico' ? <Globe2 className="h-3 w-3" aria-hidden /> : <span aria-hidden>≈</span>}
          {MARK_LABEL[markOf(curRow)]}
        </span>
        <span className="ml-auto text-[12px] text-[#b5c5cc]">{curRow.source === 'comm' ? 'Outro pescador' : curRow.source === 'local' ? 'No dispositivo' : 'Seu'}</span>
        <button type="button" onClick={closePager} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar ficha">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mt-2 flex gap-3">
        {curRow.photo_path ? (
          <SignedImage path={curRow.photo_path} bucket={curRow.photo_bucket ?? undefined} alt={`Fotografia: ${curRow.label ?? 'report'}`} className="h-24 w-24 shrink-0 rounded-2xl" />
        ) : (
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white/5 text-center text-[11px] text-[#7f97a1]" role="img" aria-label="Sem fotografia">Sem fotografia</div>
        )}
        <dl className="min-w-0 flex-1 space-y-0.5 text-[12.5px]">
          <dt className="sr-only">Espécie ou tipo</dt>
          <dd className="truncate text-[15px] font-extrabold">{curRow.species ?? (curRow.kind === 'local' ? curRow.label ?? 'Pesqueiro' : curRow.label ?? 'Report')}</dd>
          <dt className="sr-only">Peso</dt>
          <dd>{curRow.weight_g != null ? formatKg(curRow.weight_g) : curRow.kind === 'local' ? 'Pesqueiro (sem captura)' : 'Peso desconhecido'}</dd>
          <dt className="sr-only">Data e hora locais</dt>
          <dd className="text-[#b5c5cc]">{curRow.occurred_at ? formatDateTime(curRow.occurred_at, curRow.occurred_tz ?? 'Europe/Lisbon') : curRow.kind === 'local' ? '' : 'Data desconhecida'}</dd>
          <dt className="sr-only">Local e precisão</dt>
          <dd className="text-[#b5c5cc]">
            {curRow.water_body_name ?? 'Massa de água desconhecida'}
            {curRow.source === 'comm' && curRow.precision === 'zona' ? ' · Localização aproximada (zona de ~6 km)' : curRow.source === 'comm' ? ' · Ponto exato partilhado pelo autor' : ''}
          </dd>
        </dl>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => step(-1)} disabled={pagerItems.length < 2} className="grid h-11 w-11 place-items-center rounded-full border border-white/12 disabled:opacity-40" aria-label="Ficha anterior">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="min-w-16 text-center text-[13px] font-bold" aria-live="polite" data-pos>{`${cardIndex + 1} de ${pagerItems.length}`}</span>
        <button type="button" onClick={() => step(1)} disabled={pagerItems.length < 2} className="grid h-11 w-11 place-items-center rounded-full border border-white/12 disabled:opacity-40" aria-label="Ficha seguinte">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
        {curRow.source !== 'comm' && store && (
          <button type="button" onClick={() => setSheetId(curRow.id)} className="press ml-auto min-h-11 rounded-full bg-[#38c9d5] px-4 text-[13px] font-extrabold text-[#071923]">
            Abrir ficha
          </button>
        )}
      </div>
    </article>
  )

  const sheetView = sheetSel && store && (
    <div className="max-h-[70dvh] overflow-auto rounded-3xl border border-white/10 bg-[#0a2230] p-3 shadow-2xl">
      <PinSheet
        sel={sheetSel}
        store={store}
        units={units}
        shared={sheetRow!.visibility !== 'privado'}
        shareMode={sheetRow!.visibility === 'privado' ? null : sheetRow!.visibility}
        onClose={() => setSheetId(null)}
        onEdit={() => navigate(`/?pin=${sheetSel.id}`)}
        onMove={() => navigate(`/?pin=${sheetSel.id}`)}
        onDeleted={() => {
          closePager()
          setNonce((n) => n + 1)
        }}
        onSharedChange={() => setNonce((n) => n + 1)}
        toast={toast}
      />
    </div>
  )

  return (
    <div className="relative h-[calc(100dvh-var(--nav-h)-env(safe-area-inset-bottom)-53px)] overflow-hidden bg-[#071923] text-[#f4f7f8] lg:h-[calc(100dvh-53px)]" data-meus-pins data-community={community ? '1' : '0'} data-atlas-status={status.map} data-total={countsReady ? merged.total : ''}>
      <AtlasMap
        handle={mapHandle}
        mode="2d"
        selection={null}
        favoriteIds={[]}
        filters={NO_FILTERS}
        catalog={EMPTY_FC}
        zones={EMPTY_FC}
        padding={desktop ? { top: 72, right: 16, bottom: 16, left: 392 } : { top: 120, right: 12, bottom: curRow || sheetSel ? 260 : 96, left: 12 }}
        attribution={desktop ? 'bottom-right' : 'bottom-left'}
        onPick={() => undefined}
        onView={setView}
        onStatus={setStatus}
        onMapClick={onMapClick}
        className="absolute inset-0"
      />

      {/* Topo: título e interruptor da comunidade (em destaque, ao alcance do polegar no telemóvel via barra inferior). */}
      <div className={cx('pointer-events-none absolute z-20 flex items-center gap-2', desktop ? 'left-4 right-4 top-3' : 'inset-x-3 top-3 flex-wrap')}>
        <h1 ref={headingRef} tabIndex={-1} className="pointer-events-auto rounded-full bg-[#0a2230]/90 px-4 py-2 font-display text-[18px] font-semibold shadow-lg outline-none backdrop-blur">
          Mapa de pins
        </h1>
        <button
          type="button"
          role="switch"
          aria-checked={community}
          onClick={toggleCommunity}
          data-action="comunidade"
          className={cx('pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[13.5px] font-extrabold shadow-lg', community ? 'border-[#2f7cf6] bg-[#2f7cf6] text-white' : 'border-white/20 bg-[#0a2230]/95 text-[#f4f7f8]')}
        >
          <span className={cx('relative h-5 w-9 rounded-full transition-colors', community ? 'bg-white/40' : 'bg-white/15')} aria-hidden>
            <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', community ? 'left-[18px]' : 'left-0.5')} />
          </span>
          Incluir pins da comunidade
        </button>
        <span className="pointer-events-auto rounded-full bg-[#0a2230]/90 px-3 py-2 text-[12.5px] font-bold shadow-lg" aria-live="polite" data-in-view={countsReady ? merged.inView : ''}>
          {countsReady ? `${merged.inView.toLocaleString('pt-PT')} nesta área` : '… nesta área'}
        </span>
      </div>

      {desktop ? (
        <aside className="absolute bottom-4 left-4 top-[72px] z-20 flex w-[360px] flex-col gap-3 overflow-auto rounded-3xl border border-white/10 bg-[#0a2230]/95 p-4 shadow-2xl backdrop-blur" aria-label="Pesquisa e filtros">
          {panel}
          {card}
          {sheetView}
        </aside>
      ) : (
        <>
          {!curRow && !sheetSel && (
            <div className="absolute inset-x-3 top-[118px] z-10">
              <button type="button" onClick={() => setPanelOpen(true)} className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0a2230]/95 px-4 text-[13px] font-bold shadow-lg" data-action="abrir-filtros-tel">
                <Filter className="h-4 w-4" aria-hidden /> Pesquisa e filtros{chips.length ? ` (${chips.length})` : ''} · {countsReady ? plural(merged.total, 'resultado', 'resultados') : '…'}
              </button>
            </div>
          )}
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-20 space-y-2">
            {card}
            {sheetView}
          </div>
        </>
      )}

      {!sheetSel && (
        <button
          type="button"
          onClick={marcar}
          data-action="marcar-pin"
          className={cx('press absolute right-3 z-30 flex h-14 items-center gap-2 rounded-full bg-[#38c9d5] pl-4 pr-5 text-[15px] font-extrabold text-[#071923] shadow-[0_12px_30px_-10px_rgb(0_0_0/0.8)]', desktop ? 'bottom-6 right-6' : curRow ? 'bottom-[calc(env(safe-area-inset-bottom)+232px)]' : 'bottom-[calc(env(safe-area-inset-bottom)+16px)]')}
        >
          <MapPinPlus className="h-5 w-5" aria-hidden /> Marcar pin
        </button>
      )}

      {/* Lista equivalente (leitores de ecrã e quem não usa o mapa). */}
      <ul className="sr-only" aria-label="Resultados no mapa">
        {rows.slice(0, 200).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => openPager([r.id])}>
              {`${r.species ?? r.label ?? 'Pin'} · ${MARK_LABEL[markOf(r)]}${r.occurred_at ? ` · ${formatDateTime(r.occurred_at, r.occurred_tz ?? 'Europe/Lisbon')}` : ''}`}
            </button>
          </li>
        ))}
      </ul>

      <FilterSheet
        open={panelOpen}
        desktop={desktop}
        filter={filter}
        quickPanel={desktop ? null : panel}
        onClose={() => setPanelOpen(false)}
        onApply={(f) => {
          setFilter(f)
          setPanelOpen(false)
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------------ painel completo de filtros
function FilterSheet({ open, desktop, filter, quickPanel, onClose, onApply }: { open: boolean; desktop: boolean; filter: PinFilter; quickPanel: React.ReactNode; onClose: () => void; onApply: (f: PinFilter) => void }) {
  return open ? <FilterForm desktop={desktop} filter={filter} quickPanel={quickPanel} onClose={onClose} onApply={onApply} /> : null
}
function FilterForm({ filter, quickPanel, onClose, onApply }: { desktop: boolean; filter: PinFilter; quickPanel: React.ReactNode; onClose: () => void; onApply: (f: PinFilter) => void }) {
  const [species, setSpecies] = useState<string[]>(filter.species)
  const [wOp, setWOp] = useState<WeightOp | ''>(filter.weight?.op ?? '')
  const [wKg, setWKg] = useState(filter.weight ? String(filter.weight.grams / 1000).replace('.', ',') : '')
  const [from, setFrom] = useState(filter.dateFrom ?? '')
  const [to, setTo] = useState(filter.dateTo ?? '')
  const [yearly, setYearly] = useState(filter.yearly)
  const [tFrom, setTFrom] = useState(filter.timeFrom ?? '')
  const [tTo, setTTo] = useState(filter.timeTo ?? '')
  const grams = wKg ? parseKg(wKg) : null
  const wErr = !!wKg && grams == null
  const apply = () =>
    onApply({
      ...filter,
      species,
      weight: wOp && grams != null ? { op: wOp, grams } : null,
      dateFrom: from || null,
      dateTo: to || null,
      yearly: yearly && !!(from || to),
      timeFrom: tFrom || null,
      timeTo: tTo || null,
    })
  const input = 'h-11 w-full rounded-xl border border-line bg-white px-3 text-[14px] text-ink'
  return (
    <Sheet
      open
      onClose={onClose}
      title="Pesquisa e filtros"
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={() => onApply({ ...EMPTY_FILTER, water: filter.water })} className="press min-h-11 flex-1 rounded-2xl border border-line text-[14px] font-bold">
            Limpar
          </button>
          <button type="button" onClick={apply} disabled={wErr} className="press min-h-11 flex-[2] rounded-2xl bg-ink text-[14px] font-extrabold text-white disabled:opacity-50" data-action="aplicar-filtros">
            Aplicar filtros
          </button>
        </div>
      }
    >
      {quickPanel && <div className="-mx-1 mb-4 rounded-2xl bg-[#071923] p-3 text-[#f4f7f8]">{quickPanel}</div>}
      <div className="space-y-4 text-ink">
        <fieldset>
          <legend className="text-[13px] font-extrabold">Espécie</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SPECIES.map((s) => {
              const on = species.includes(s.name)
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => setSpecies(on ? species.filter((x) => x !== s.name) : [...species, s.name])} className={cx('press min-h-11 rounded-full border px-3 text-[13px] font-bold', on ? 'border-ink bg-ink text-white' : 'border-line')}>
                  {s.name}
                </button>
              )
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[13px] font-extrabold">Peso</legend>
          <div className="mt-1.5 grid grid-cols-[1fr_1fr] gap-2">
            <select value={wOp} onChange={(e) => setWOp(e.target.value as WeightOp | '')} className={input} aria-label="Comparação de peso">
              <option value="">Qualquer peso</option>
              <option value="gt">Mais de</option>
              <option value="lt">Menos de</option>
              <option value="eq">Exatamente</option>
            </select>
            <input value={wKg} onChange={(e) => setWKg(e.target.value)} inputMode="decimal" placeholder="kg (ex.: 2,1)" className={input} aria-label="Peso em kg" aria-invalid={wErr} disabled={!wOp} />
          </div>
          {wErr && <p className="mt-1 text-[12px] text-danger">Peso inválido (use, por exemplo, 2,1).</p>}
          <p className="mt-1 text-[12px] text-muted">Sem filtro de peso, as capturas de peso desconhecido continuam incluídas.</p>
        </fieldset>
        <fieldset>
          <legend className="text-[13px] font-extrabold">Datas (inclusivas)</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <label className="text-[12px] text-muted">
              Início
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
            </label>
            <label className="text-[12px] text-muted">
              Fim
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
            </label>
          </div>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-[13px] font-bold">
            <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} className="h-5 w-5" /> Repetir em todos os anos
          </label>
        </fieldset>
        <fieldset>
          <legend className="text-[13px] font-extrabold">Horas (hora local do sítio da captura)</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <label className="text-[12px] text-muted">
              Das
              <input type="time" value={tFrom} onChange={(e) => setTFrom(e.target.value)} className={input} />
            </label>
            <label className="text-[12px] text-muted">
              Até (inclui o minuto)
              <input type="time" value={tTo} onChange={(e) => setTTo(e.target.value)} className={input} />
            </label>
          </div>
          <p className="mt-1 text-[12px] text-muted">Aplica-se a cada dia escolhido. Uma janela como 22h–02h junta a madrugada ao dia em que começou.</p>
        </fieldset>
      </div>
    </Sheet>
  )
}
