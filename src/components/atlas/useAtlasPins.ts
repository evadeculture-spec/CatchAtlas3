import type { Feature, FeatureCollection } from 'geojson'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { ACTIVITY, speciesById } from '../../data/catalog'
import type { Activity, Report, SpeciesId } from '../../data/types'
import { diffDays } from '../../lib/dates'
import { displayType, fetchAtlasPins, fetchCommunity, fieldStoreFor, myShares, type AtlasPinRow, type FieldStore, type SharedReport } from '../../lib/lanca/fieldPins'
import { pingPosition } from '../../lib/pings'
import type { AtlasMapHandle, ViewInfo } from './AtlasMap'
import { COMM_LAYERS, ensurePinLayers, MY_LAYERS, setLayerVisibility, setPinData, setSelectedPoint } from './pinLayers'
import type { SelectedPin } from './PinSheet'

export interface CommunityFilter {
  days: number
  species: SpeciesId | null
  activity: Activity | null
}
export type CommunityItem =
  | { kind: 'demo'; id: string; lat: number; lng: number; report: Report }
  | { kind: 'shared'; id: string; lat: number; lng: number; shared: SharedReport }

const noopSubscribe = () => () => {}

/** Célula de agregação no servidor conforme a escala (Península → região → albufeira/margem). */
export function cellFor(view: ViewInfo | null): number | null {
  if (!view) return 0.5
  const rel = view.zoom - view.fit
  return rel < 2 ? 0.5 : rel < 3.6 ? 0.1 : null
}

/**
 * Pins no Atlas: os meus (servidor por área visível + registos locais por sincronizar) e a camada
 * comunitária (demonstração identificada + partilhas reais aproximadas). Pedidos obsoletos são
 * cancelados; o mapa (uma única instância) recebe só os dados, sem ser recriado.
 */
export function useAtlasPins({
  uid,
  mapHandle,
  ready,
  view,
  showMine,
  showCommunity,
  filter,
  demoReports,
  anchor,
  selectedPinId,
  selectedRepId,
  waterFilter,
}: {
  uid: string | null
  mapHandle: RefObject<AtlasMapHandle | null>
  ready: boolean
  view: ViewInfo | null
  showMine: boolean
  showCommunity: boolean
  filter: CommunityFilter
  demoReports: Report[]
  anchor: string
  selectedPinId: string | null
  selectedRepId: string | null
  waterFilter: string | null
}) {
  const store: FieldStore | null = uid ? fieldStoreFor(uid) : null
  // Versão do armazenamento local (re-render quando um pin muda de estado).
  const version = useSyncExternalStore(
    store ? (cb) => store.subscribe(cb) : noopSubscribe,
    () => (store ? store.list().map((p) => `${p.id}:${p.sync}:${p.updatedAt}:${p.photos.map((f) => f.state).join('')}`).join('|') + store.deletedIds().size : ''),
  )
  const [rows, setRows] = useState<{ key: string; rows: AtlasPinRow[] }>({ key: '', rows: [] })
  const [shared, setShared] = useState<SharedReport[]>([])
  const [shares, setShares] = useState<Map<string, string>>(new Map())
  const [sharesNonce, setSharesNonce] = useState(0)
  const [reload, setReload] = useState(0)

  // Sincronização em segundo plano: ao abrir, ao voltar à rede e ao regressar à app.
  useEffect(() => {
    if (!store) return
    void store.ready().then(() => store.sync())
    const on = () => void store.sync()
    const vis = () => document.visibilityState === 'visible' && on()
    window.addEventListener('online', on)
    document.addEventListener('visibilitychange', vis)
    const t = window.setInterval(() => store.pendingCount() && on(), 45000)
    return () => {
      window.removeEventListener('online', on)
      document.removeEventListener('visibilitychange', vis)
      window.clearInterval(t)
    }
  }, [store])

  // Pins do servidor na área visível (com margem); cancela o pedido anterior.
  const cell = cellFor(view)
  const b = view?.bounds
  const key = b ? `${cell}:${b.map((v) => v.toFixed(3)).join(',')}:${reload}` : ''
  const abort = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!uid || !b || !showMine) return
    const t = window.setTimeout(() => {
      abort.current?.abort()
      const ctl = new AbortController()
      abort.current = ctl
      const dx = (b[2] - b[0]) * 0.15
      const dy = (b[3] - b[1]) * 0.15
      fetchAtlasPins([b[0] - dx, b[1] - dy, b[2] + dx, b[3] + dy], cell, ctl.signal)
        .then((r) => !ctl.signal.aborted && setRows({ key, rows: r }))
        .catch(() => undefined)
    }, 250)
    return () => window.clearTimeout(t)
    // `key` resume bounds, célula e recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key, showMine])
  useEffect(() => () => abort.current?.abort(), [])
  // Depois de uma sincronização, os registos passam a vir do servidor: recarrega a área visível.
  const syncedCount = store ? store.list().filter((p) => p.sync === 'synced').length + store.deletedIds().size : 0
  const lastSynced = useRef(syncedCount)
  useEffect(() => {
    if (syncedCount !== lastSynced.current) {
      lastSynced.current = syncedCount
      // Recarga pedida por um evento externo (a sincronização terminou).
      setReload((n) => n + 1)
    }
  }, [syncedCount])

  // Partilhas reais (aproximadas) na área visível.
  const days = filter.days
  useEffect(() => {
    if (!uid || !b || !showCommunity) return
    const ctl = new AbortController()
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const t = window.setTimeout(() => {
      fetchCommunity([b[0] - 0.5, b[1] - 0.5, b[2] + 0.5, b[3] + 0.5], since, ctl.signal)
        .then((r) => !ctl.signal.aborted && setShared(r))
        .catch(() => undefined)
    }, 300)
    return () => {
      ctl.abort()
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key, showCommunity, days])
  useEffect(() => {
    if (!uid) return
    let alive = true
    myShares()
      .then((m) => alive && setShares(m))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [uid, sharesNonce])

  // ---------- dados para o mapa ----------
  const local = useMemo(() => (store ? store.list() : []), [store, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const deleted = useMemo(() => (store ? store.deletedIds() : new Set<string>()), [store, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const serverRows = rows.rows
  const mineFC: FeatureCollection = useMemo(() => {
    const localIds = new Set(local.map((p) => p.id))
    const feats: Feature[] = []
    for (const r of serverRows) {
      if (r.id && (localIds.has(r.id) || deleted.has(r.id))) continue
      if (waterFilter && r.kind !== 'grupo' && r.water_body_ref !== waterFilter) continue
      feats.push({ type: 'Feature', properties: { id: r.id ?? `g${r.lat},${r.lng}`, type: r.kind === 'grupo' ? 'grupo' : displayType(r.kind), title: r.title ?? undefined, n: r.n, pending: false }, geometry: { type: 'Point', coordinates: [r.lng, r.lat] } })
    }
    for (const p of local) {
      if (waterFilter && p.waterRef !== waterFilter) continue
      const pending = p.sync !== 'synced' || p.photos.some((f) => f.state !== 'synced')
      feats.push({ type: 'Feature', properties: { id: p.id, type: p.type, title: (p.type === 'local' ? p.name : p.species) ?? undefined, n: 1, pending }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })
    }
    return { type: 'FeatureCollection', features: feats }
  }, [serverRows, local, deleted, waterFilter])

  const communityItems: CommunityItem[] = useMemo(() => {
    if (!showCommunity) return []
    const out: CommunityItem[] = []
    for (const r of demoReports) {
      const age = diffDays(anchor, r.date)
      if (age < 0 || age > filter.days || (filter.species && r.speciesId !== filter.species) || (filter.activity && r.activity !== filter.activity)) continue
      const p = pingPosition(r)
      out.push({ kind: 'demo', id: r.id, lat: p.lat, lng: p.lon, report: r })
    }
    if (!filter.activity)
      for (const s of shared) {
        if (filter.species && s.species?.toLowerCase() !== speciesById[filter.species]?.name.toLowerCase()) continue
        out.push({ kind: 'shared', id: s.id, lat: s.approx_lat, lng: s.approx_lng, shared: s })
      }
    return out
  }, [showCommunity, demoReports, anchor, filter, shared])
  const commFC: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: communityItems.map((c) => ({
        type: 'Feature',
        properties: { id: c.id, demo: c.kind === 'demo', color: c.kind === 'demo' ? ACTIVITY[c.report.activity].color : '#e6b65a' },
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      })),
    }),
    [communityItems],
  )

  // ---------- seleção ----------
  const [fetched, setFetched] = useState<{ id: string; sel: SelectedPin | null } | null>(null)
  const selected: SelectedPin | null = useMemo(() => {
    if (!selectedPinId || deleted.has(selectedPinId)) return null
    const l = local.find((p) => p.id === selectedPinId)
    if (l) return { id: l.id, type: l.type, lat: l.lat, lng: l.lng, title: l.type === 'local' ? l.name : l.species, occurredAt: l.type === 'local' ? null : l.occurredAt, tz: l.tz, waterName: l.waterName, waterRef: l.waterRef, thumbPath: null, local: l }
    const r = serverRows.find((x) => x.id === selectedPinId)
    if (r) return { id: r.id!, type: displayType(r.kind), lat: r.lat, lng: r.lng, title: r.title, occurredAt: r.kind === 'local' ? null : r.occurred_at, tz: r.occurred_tz, waterName: r.water_body_name, waterRef: r.water_body_ref, thumbPath: r.thumb_path, local: null }
    return fetched?.id === selectedPinId ? fetched.sel : null
  }, [selectedPinId, local, serverRows, deleted, fetched])
  // Pin aberto a partir do diário (ainda fora da área carregada): lê-o do servidor.
  useEffect(() => {
    if (!store || !selectedPinId || selected) return
    let alive = true
    store
      .fromServer(selectedPinId)
      .then((p) => alive && setFetched({ id: selectedPinId, sel: { id: p.id, type: p.type, lat: p.lat, lng: p.lng, title: p.type === 'local' ? p.name : p.species, occurredAt: p.type === 'local' ? null : p.occurredAt, tz: p.tz, waterName: p.waterName, waterRef: p.waterRef, thumbPath: null, local: null } }))
      .catch(() => alive && setFetched({ id: selectedPinId, sel: null }))
    return () => {
      alive = false
    }
  }, [store, selectedPinId, selected])
  const selectedRep = selectedRepId ? communityItems.find((c) => c.id === selectedRepId) ?? null : null

  // ---------- camadas no mapa ----------
  useEffect(() => {
    const map = mapHandle.current?.getMap()
    if (!map || !ready) return
    ensurePinLayers(map)
    setPinData(map, showMine ? mineFC : { type: 'FeatureCollection', features: [] }, commFC)
    setLayerVisibility(map, MY_LAYERS, showMine)
    setLayerVisibility(map, COMM_LAYERS, showCommunity)
  }, [ready, mineFC, commFC, showMine, showCommunity, mapHandle])
  const selPoint = selected ? { lng: selected.lng, lat: selected.lat } : selectedRep ? { lng: selectedRep.lng, lat: selectedRep.lat } : null
  useEffect(() => {
    const map = mapHandle.current?.getMap()
    if (!map || !ready || !map.getSource('lanca-pin-sel')) return
    setSelectedPoint(map, selPoint)
  }, [ready, selPoint?.lng, selPoint?.lat, mapHandle]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    store,
    local,
    serverRows,
    selected,
    selectedMissing: !!selectedPinId && !selected && fetched?.id === selectedPinId && !fetched.sel,
    communityItems,
    selectedRep,
    shares,
    refreshShares: () => setSharesNonce((n) => n + 1),
    refresh: () => setReload((n) => n + 1),
  }
}
