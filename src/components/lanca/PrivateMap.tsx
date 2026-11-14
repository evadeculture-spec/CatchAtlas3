/**
 * Mapa da área privada (Mapa, Painel, fichas de Pin e Ping, escolha de localização).
 *
 * Usa o MESMO motor cartográfico do Atlas (AtlasMap: MapLibre GL com terreno DEM real, massas de água,
 * rios e estruturas do Atlas Ibérico) em vez de um segundo mapa plano. Mantém a interface pública anterior
 * (pins, pings, seleção, escolha de local com marcador arrastável, «criar aqui», voo e enquadramento), por isso
 * os ecrãs que o usam não mudaram. Acrescenta 2D/3D, zoom e norte, e partilha a câmara com os outros mapas.
 */
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { MapPinOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AtlasMap, type AtlasMapHandle, type AtlasStatus } from '../atlas/AtlasMap'
import { MapQuickControls } from '../atlas/MapQuickControls'
import { ATLAS_CONFIG } from '../../lib/atlas/config'
import { memoryCamera, memoryMode, writeCamera } from '../../lib/atlas/cameraMemory'
import { PIN_CATEGORIES, PING_KINDS } from '../../lib/lanca/labels'
import type { Pin, PingKind } from '../../lib/lanca/types'
import { cx } from '../ui'

export interface PingPoint {
  id: string
  lat: number
  lng: number
  kind: PingKind
  occurred_at: string
}
export type Selection = { type: 'pin' | 'ping'; id: string } | null
type LngLat = { lat: number; lng: number }

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const NO_FILTERS = { countries: [], types: [], favOnly: false }
const pinColor: ExpressionSpecification = ['match', ['get', 'category'], ...PIN_CATEGORIES.flatMap((c) => [c.id, c.color]), '#8a9ba2'] as unknown as ExpressionSpecification
const pingColor: ExpressionSpecification = ['match', ['get', 'kind'], ...PING_KINDS.flatMap((k) => [k.id, k.color]), '#3e7cb1'] as unknown as ExpressionSpecification
const PM_LAYERS = ['pm-pins-cluster', 'pm-pings-cluster', 'pm-pins-pt', 'pm-pings-pt']

function pinsFC(pins: Pin[]): FeatureCollection {
  return { type: 'FeatureCollection', features: pins.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, name: p.name, category: p.category, fav: p.is_favorite ? 1 : 0, archived: p.status === 'arquivado' ? 1 : 0 } })) }
}
function pingsFC(pings: PingPoint[]): FeatureCollection {
  return { type: 'FeatureCollection', features: pings.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, kind: p.kind } })) }
}

/** Camadas dos pins e pings privados sobre a cartografia do Atlas (pontos assentes no terreno). */
function ensureLayers(map: MLMap) {
  if (map.getSource('pm-pins')) return
  map.addSource('pm-pins', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 42, clusterMaxZoom: 13 })
  map.addSource('pm-pings', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 36, clusterMaxZoom: 14 })
  map.addSource('pm-sel', { type: 'geojson', data: EMPTY })
  const flat = { 'circle-pitch-alignment': 'map' as const }
  map.addLayer({ id: 'pm-pings-cluster', type: 'circle', source: 'pm-pings', filter: ['has', 'point_count'], paint: { 'circle-color': '#3e7cb1', 'circle-opacity': 0.9, 'circle-radius': ['step', ['get', 'point_count'], 13, 10, 17, 50, 22], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, ...flat } })
  map.addLayer({ id: 'pm-pings-count', type: 'symbol', source: 'pm-pings', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } })
  map.addLayer({ id: 'pm-pings-pt', type: 'circle', source: 'pm-pings', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': pingColor, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 5, 14, 8], 'circle-stroke-color': '#f4f7f8', 'circle-stroke-width': 2, ...flat } })
  map.addLayer({ id: 'pm-pins-cluster', type: 'circle', source: 'pm-pins', filter: ['has', 'point_count'], paint: { 'circle-color': '#0a2230', 'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 24], 'circle-stroke-color': '#38c9d5', 'circle-stroke-width': 2.5, ...flat } })
  map.addLayer({ id: 'pm-pins-count', type: 'symbol', source: 'pm-pins', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12.5, 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } })
  map.addLayer({ id: 'pm-pins-pt', type: 'circle', source: 'pm-pins', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': pinColor, 'circle-opacity': ['case', ['==', ['get', 'archived'], 1], 0.45, 1], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 7, 14, 11], 'circle-stroke-color': ['case', ['==', ['get', 'fav'], 1], '#f2b544', '#f4f7f8'], 'circle-stroke-width': ['case', ['==', ['get', 'fav'], 1], 3.5, 2.5], ...flat } })
  map.addLayer({ id: 'pm-pins-label', type: 'symbol', source: 'pm-pins', filter: ['!', ['has', 'point_count']], minzoom: 11, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 9 }, paint: { 'text-color': '#f4f7f8', 'text-halo-color': 'rgba(7,25,35,0.9)', 'text-halo-width': 1.4 } })
  map.addLayer({ id: 'pm-sel-ring', type: 'circle', source: 'pm-sel', paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': 17, 'circle-stroke-color': '#38c9d5', 'circle-stroke-width': 3.5, ...flat } })
}

export interface PrivateMapProps {
  pins?: Pin[]
  pings?: PingPoint[]
  showPins?: boolean
  showPings?: boolean
  selected?: Selection
  onSelect?: (s: Selection) => void
  /** Modo de escolha de localização: clique ou arraste o marcador. */
  pick?: { value: LngLat | null; onChange: (v: LngLat) => void }
  /** Pressão longa (toque) ou botão direito: "criar aqui". */
  onCreateAt?: (v: LngLat) => void
  /** Mudar este valor volta a enquadrar os dados. */
  fitKey?: string
  /** Pedido de voo para um ponto. */
  flyTo?: (LngLat & { zoom?: number; key: number }) | null
  className?: string
  label?: string
  /** Posição dos controlos 2D/3D (quando o ecrã tem outros elementos sobre o mapa). */
  controlsClassName?: string
}

export function PrivateMap({ pins = [], pings = [], showPins = true, showPings = true, selected, onSelect, pick, onCreateAt, fitKey, flyTo, className, label = 'Mapa', controlsClassName = 'right-2 top-2' }: PrivateMapProps) {
  const handle = useRef<AtlasMapHandle>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  const [status, setStatus] = useState<AtlasStatus>({ map: 'loading', dem: ATLAS_CONFIG.dem.enabled ? 'loading' : 'off', basemap: 'ok', water: 'ok', detailLoading: false })
  const [mode, setMode] = useState<'2d' | '3d'>(() => memoryMode('3d'))
  // Sem dados para enquadrar, reabre onde o utilizador deixou o último mapa (mesma sessão).
  const [initialCamera] = useState(() => (pick?.value || pins.length || pings.length ? undefined : memoryCamera()))
  const cb = useRef({ onSelect, pick, onCreateAt })
  useEffect(() => {
    cb.current = { onSelect, pick, onCreateAt }
  })
  const fitted = useRef<string | undefined>(undefined)
  const ready = status.map === 'ready'
  // Relevo indisponível: o mapa continua em 2D com toda a cartografia (sem bloquear).
  const effMode = status.dem === 'failed' ? '2d' : mode
  const map = () => handle.current?.getMap() ?? null

  useEffect(() => {
    const m = map()
    if (!m || !ready) return
    ensureLayers(m)
    ;(m.getSource('pm-pins') as GeoJSONSource).setData(pinsFC(pins))
    ;(m.getSource('pm-pings') as GeoJSONSource).setData(pingsFC(pings))
    for (const l of ['pm-pins-cluster', 'pm-pins-count', 'pm-pins-pt', 'pm-pins-label']) m.setLayoutProperty(l, 'visibility', showPins ? 'visible' : 'none')
    for (const l of ['pm-pings-cluster', 'pm-pings-count', 'pm-pings-pt']) m.setLayoutProperty(l, 'visibility', showPings ? 'visible' : 'none')
    if (fitted.current !== (fitKey ?? 'auto')) {
      const pts = [...(showPins ? pins : []), ...(showPings ? pings : [])]
      const pk = cb.current.pick?.value
      if (pk) {
        m.jumpTo({ center: [pk.lng, pk.lat], zoom: Math.max(m.getZoom(), 13) })
        fitted.current = fitKey ?? 'auto'
      } else if (pts.length) {
        const b = new maplibregl.LngLatBounds()
        pts.forEach((p) => b.extend([p.lng, p.lat]))
        m.fitBounds(b, { padding: 56, maxZoom: 13, duration: 0 })
        fitted.current = fitKey ?? 'auto'
      }
    }
  }, [ready, pins, pings, showPins, showPings, fitKey])

  useEffect(() => {
    const m = map()
    if (!m || !ready || !m.getSource('pm-sel')) return
    const item = selected ? (selected.type === 'pin' ? pins.find((p) => p.id === selected.id) : pings.find((p) => p.id === selected.id)) : null
    ;(m.getSource('pm-sel') as GeoJSONSource).setData(item ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [item.lng, item.lat] }, properties: {} }] } : EMPTY)
  }, [ready, selected, pins, pings])

  const pv = pick?.value
  useEffect(() => {
    const m = map()
    if (!m || !ready) return
    if (!pv) {
      marker.current?.remove()
      marker.current = null
      return
    }
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ color: '#38c9d5', draggable: true }).setLngLat([pv.lng, pv.lat]).addTo(m)
      marker.current.on('dragend', () => {
        const ll = marker.current!.getLngLat()
        cb.current.pick?.onChange({ lat: ll.lat, lng: ll.lng })
      })
      marker.current.getElement().setAttribute('aria-label', 'Marcador da localização escolhida (arraste para ajustar)')
    } else marker.current.setLngLat([pv.lng, pv.lat])
    if (!m.getBounds().contains([pv.lng, pv.lat])) m.easeTo({ center: [pv.lng, pv.lat], zoom: Math.max(m.getZoom(), 13) })
  }, [ready, pv?.lat, pv?.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      marker.current?.remove()
      marker.current = null
    },
    [],
  )

  useEffect(() => {
    const m = map()
    if (!m || !ready || !flyTo) return
    m.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 14, essential: true })
  }, [ready, flyTo])

  const onMapClick = useCallback(({ point, lngLat, touch }: { point: { x: number; y: number }; lngLat: { lng: number; lat: number }; touch: boolean }) => {
    const m = handle.current?.getMap()
    if (!m) return false
    const { pick: pk, onSelect: sel } = cb.current
    if (pk) {
      pk.onChange({ lat: lngLat.lat, lng: lngLat.lng })
      return true
    }
    const layers = PM_LAYERS.filter((l) => m.getLayer(l) && m.getLayoutProperty(l, 'visibility') !== 'none')
    const pad = touch ? 14 : 6
    const f = layers.length ? m.queryRenderedFeatures([[point.x - pad, point.y - pad], [point.x + pad, point.y + pad]], { layers })[0] : undefined
    if (!f) {
      if (sel) {
        sel(null)
        return true
      }
      return false
    }
    if (f.properties?.cluster_id !== undefined) {
      const src = m.getSource(f.layer.id.startsWith('pm-pins') ? 'pm-pins' : 'pm-pings') as GeoJSONSource
      void src.getClusterExpansionZoom(f.properties.cluster_id as number).then((z) => m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z + 0.3 }))
      return true
    }
    sel?.({ type: f.layer.id.startsWith('pm-pins') ? 'pin' : 'ping', id: String(f.properties?.id) })
    return true
  }, [])

  if (status.map === 'webgl-error')
    return (
      <div className={cx('grid place-items-center rounded-[var(--radius-card)] bg-mist p-6 text-center text-[13px] text-muted', className)} role="alert">
        <div>
          <MapPinOff className="mx-auto mb-2 h-6 w-6" aria-hidden />
          Este navegador não consegue mostrar o mapa (WebGL indisponível). Os dados continuam disponíveis em lista.
        </div>
      </div>
    )
  return (
    <div className={cx('overflow-hidden bg-[#071923]', /\b(absolute|fixed)\b/.test(className ?? '') ? '' : 'relative', className)} role="region" aria-label={label} data-private-map data-map-status={status.map}>
      <AtlasMap
        handle={handle}
        mode={effMode}
        initialCamera={initialCamera}
        selection={null}
        favoriteIds={[]}
        filters={NO_FILTERS}
        catalog={EMPTY}
        zones={EMPTY}
        padding={{ top: 8, right: 64, bottom: 8, left: 8 }}
        attribution="bottom-left"
        onPick={() => undefined}
        onView={(v) => writeCamera(v, effMode)}
        onStatus={setStatus}
        onMapClick={onMapClick}
        onLongPress={onCreateAt ? (ll) => cb.current.onCreateAt?.({ lat: ll.lat, lng: ll.lng }) : undefined}
        className="absolute inset-0"
      />
      <MapQuickControls handle={handle} mode={effMode} onMode={setMode} dem={status.dem} className={cx('absolute z-10', controlsClassName)} />
      {status.dem === 'failed' && <p className="absolute left-2 top-2 z-10 max-w-[60%] rounded-full bg-amber-50 px-3 py-1 text-[11.5px] font-bold text-amber-900 shadow-card" role="status">Relevo indisponível: mapa em 2D</p>}
      {status.basemap === 'failed' && <p className="absolute bottom-10 left-2 z-10 rounded-full bg-amber-50 px-3 py-1 text-[11.5px] font-bold text-amber-900 shadow-card">Cartografia parcialmente indisponível</p>}
    </div>
  )
}
