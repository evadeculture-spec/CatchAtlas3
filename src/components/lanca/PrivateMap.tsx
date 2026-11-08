import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, LngLatBoundsLike, Map as MLMap, MapGeoJSONFeature, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { FeatureCollection } from 'geojson'
import { MapPinOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PIN_CATEGORIES, PING_KINDS } from '../../lib/lanca/labels'
import { BASEMAP_TILEJSON, MAP_COLORS } from '../../lib/map/style'
import type { Pin, PingKind } from '../../lib/lanca/types'
import { cx } from '../ui'

maplibregl.setWorkerUrl(workerUrl)

export interface PingPoint {
  id: string
  lat: number
  lng: number
  kind: PingKind
  occurred_at: string
}
export type Selection = { type: 'pin' | 'ping'; id: string } | null
type LngLat = { lat: number; lng: number }

const OMT_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> Dados <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contribuidores do OpenStreetMap</a>'
const IBERIA: LngLatBoundsLike = [[-9.9, 36.0], [3.4, 43.8]]
const nameLatin: ExpressionSpecification = ['coalesce', ['get', 'name:pt'], ['get', 'name:latin'], ['get', 'name']]

const pinColor: ExpressionSpecification = ['match', ['get', 'category'], ...PIN_CATEGORIES.flatMap((c) => [c.id, c.color]), '#8a9ba2'] as unknown as ExpressionSpecification
const pingColor: ExpressionSpecification = ['match', ['get', 'kind'], ...PING_KINDS.flatMap((k) => [k.id, k.color]), '#3e7cb1'] as unknown as ExpressionSpecification

/** Mapa base claro (OpenStreetMap via OpenFreeMap) para a área privada. */
function privateStyle(origin: string): StyleSpecification {
  const C = MAP_COLORS
  return {
    version: 8,
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    sources: { omt: { type: 'vector', url: BASEMAP_TILEJSON, attribution: OMT_ATTRIBUTION } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': C.land } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': C.wood, 'fill-opacity': 0.7 } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': ['case', ['==', ['get', 'class'], 'ocean'], C.sea, C.water] } },
      { id: 'river', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['in', ['get', 'class'], ['literal', ['river', 'canal']]], paint: { 'line-color': C.river, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 12, 2, 16, 5] } },
      { id: 'stream', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'stream'], minzoom: 11, paint: { 'line-color': C.river, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 16, 1.6] } },
      { id: 'border', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': C.border, 'line-width': 1.2 } },
      { id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'minor', 'track']]], minzoom: 10, paint: { 'line-color': C.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 15, 3] } },
      { id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]], minzoom: 5, paint: { 'line-color': C.roadMajor, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 1.4, 15, 4] } },
      { id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name', minzoom: 9, filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': nameLatin, 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-optional': true }, paint: { 'text-color': C.waterLabel, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.2 } },
      { id: 'place', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'hamlet']]], minzoom: 5, layout: { 'text-field': nameLatin, 'text-font': ['Noto Sans Regular'], 'text-size': ['match', ['get', 'class'], 'city', 13, 'town', 11.5, 10.5], 'symbol-sort-key': ['get', 'rank'], 'text-max-width': 8 }, paint: { 'text-color': C.label, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.2 } },
    ],
  }
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
function pinsFC(pins: Pin[]): FeatureCollection {
  return { type: 'FeatureCollection', features: pins.map((p) => ({ type: 'Feature', id: undefined, geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, name: p.name, category: p.category, fav: p.is_favorite ? 1 : 0, archived: p.status === 'arquivado' ? 1 : 0 } })) }
}
function pingsFC(pings: PingPoint[]): FeatureCollection {
  return { type: 'FeatureCollection', features: pings.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, kind: p.kind } })) }
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
}

export function PrivateMap({ pins = [], pings = [], showPins = true, showPings = true, selected, onSelect, pick, onCreateAt, fitKey, flyTo, className, label = 'Mapa' }: PrivateMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  const [ready, setReady] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)
  const cb = useRef({ onSelect, pick, onCreateAt })
  useEffect(() => {
    cb.current = { onSelect, pick, onCreateAt }
  })
  const fitted = useRef<string | undefined>(undefined)

  useEffect(() => {
    const el = box.current
    if (!el) return
    let map: MLMap
    try {
      map = new maplibregl.Map({ container: el, style: privateStyle(window.location.origin), bounds: IBERIA, fitBoundsOptions: { padding: 20 }, maxZoom: 18, minZoom: 3, dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: false })
    } catch {
      const t = window.setTimeout(() => setFatal('Este navegador não consegue mostrar o mapa (WebGL indisponível). Os dados continuam disponíveis em lista.'))
      return () => window.clearTimeout(t)
    }
    mapRef.current = map
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 100 }), 'bottom-left')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('error', (e) => {
      if (/tile|source|Failed to fetch|AJAX/i.test(String((e as unknown as { error?: { message?: string } }).error?.message ?? ''))) setTilesFailed(true)
    })
    map.on('load', () => {
      map.addSource('pins', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 42, clusterMaxZoom: 13 })
      map.addSource('pings', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 36, clusterMaxZoom: 14 })
      map.addSource('sel', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'pings-cluster', type: 'circle', source: 'pings', filter: ['has', 'point_count'], paint: { 'circle-color': '#3e7cb1', 'circle-opacity': 0.85, 'circle-radius': ['step', ['get', 'point_count'], 13, 10, 17, 50, 22], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
      map.addLayer({ id: 'pings-count', type: 'symbol', source: 'pings', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12 }, paint: { 'text-color': '#fff' } })
      map.addLayer({ id: 'pings-pt', type: 'circle', source: 'pings', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': pingColor, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 14, 7], 'circle-stroke-color': '#102b3a', 'circle-stroke-width': 1.5 } })
      map.addLayer({ id: 'pins-cluster', type: 'circle', source: 'pins', filter: ['has', 'point_count'], paint: { 'circle-color': '#102b3a', 'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 24], 'circle-stroke-color': '#20bfa9', 'circle-stroke-width': 2.5 } })
      map.addLayer({ id: 'pins-count', type: 'symbol', source: 'pins', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12.5 }, paint: { 'text-color': '#fff' } })
      map.addLayer({ id: 'pins-pt', type: 'circle', source: 'pins', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': pinColor, 'circle-opacity': ['case', ['==', ['get', 'archived'], 1], 0.45, 1], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 6, 14, 10], 'circle-stroke-color': ['case', ['==', ['get', 'fav'], 1], '#f2b544', '#ffffff'], 'circle-stroke-width': ['case', ['==', ['get', 'fav'], 1], 3.5, 2.5] } })
      map.addLayer({ id: 'pins-label', type: 'symbol', source: 'pins', filter: ['!', ['has', 'point_count']], minzoom: 11, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 9 }, paint: { 'text-color': '#102b3a', 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.4 } })
      map.addLayer({ id: 'sel-ring', type: 'circle', source: 'sel', paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': 16, 'circle-stroke-color': '#102b3a', 'circle-stroke-width': 3 } })
      setReady(true)
    })
    const hit = (layers: string[], point: maplibregl.PointLike): MapGeoJSONFeature | undefined => {
      const present = layers.filter((l) => map.getLayer(l) && map.getLayoutProperty(l, 'visibility') !== 'none')
      return present.length ? map.queryRenderedFeatures(point, { layers: present })[0] : undefined
    }
    map.on('click', async (e) => {
      const { pick: pk, onSelect: sel } = cb.current
      if (pk) {
        pk.onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        return
      }
      const f = hit(['pins-cluster', 'pings-cluster', 'pins-pt', 'pings-pt'], e.point)
      if (!f) return sel?.(null)
      if (f.properties?.cluster_id !== undefined) {
        const src = map.getSource(f.layer.id.startsWith('pins') ? 'pins' : 'pings') as GeoJSONSource
        const z = await src.getClusterExpansionZoom(f.properties.cluster_id as number)
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z + 0.3 })
        return
      }
      sel?.({ type: f.layer.id.startsWith('pins') ? 'pin' : 'ping', id: String(f.properties?.id) })
    })
    map.on('mousemove', (e) => {
      map.getCanvas().style.cursor = cb.current.pick ? 'crosshair' : hit(['pins-cluster', 'pings-cluster', 'pins-pt', 'pings-pt'], e.point) ? 'pointer' : ''
    })
    map.on('contextmenu', (e) => cb.current.onCreateAt?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }))
    let press: number | undefined
    map.on('touchstart', (e) => {
      if (e.originalEvent.touches.length !== 1 || !cb.current.onCreateAt) return
      const at = { lat: e.lngLat.lat, lng: e.lngLat.lng }
      press = window.setTimeout(() => cb.current.onCreateAt?.(at), 650)
    })
    const cancel = () => window.clearTimeout(press)
    map.on('touchend', cancel)
    map.on('touchmove', cancel)
    map.on('dragstart', cancel)
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      window.clearTimeout(press)
      marker.current?.remove()
      marker.current = null
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // Dados e visibilidade das camadas.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    ;(map.getSource('pins') as GeoJSONSource).setData(pinsFC(pins))
    ;(map.getSource('pings') as GeoJSONSource).setData(pingsFC(pings))
    for (const l of ['pins-cluster', 'pins-count', 'pins-pt', 'pins-label']) map.setLayoutProperty(l, 'visibility', showPins ? 'visible' : 'none')
    for (const l of ['pings-cluster', 'pings-count', 'pings-pt']) map.setLayoutProperty(l, 'visibility', showPings ? 'visible' : 'none')
    if (fitted.current !== (fitKey ?? 'auto')) {
      const pts = [...(showPins ? pins : []), ...(showPings ? pings : [])]
      const pk = cb.current.pick?.value
      if (pk) {
        map.jumpTo({ center: [pk.lng, pk.lat], zoom: Math.max(map.getZoom(), 13) })
        fitted.current = fitKey ?? 'auto'
      } else if (pts.length) {
        const b = new maplibregl.LngLatBounds()
        pts.forEach((p) => b.extend([p.lng, p.lat]))
        map.fitBounds(b, { padding: 56, maxZoom: 13, duration: 0 })
        fitted.current = fitKey ?? 'auto'
      }
    }
  }, [ready, pins, pings, showPins, showPings, fitKey])

  // Seleção.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const item = selected ? (selected.type === 'pin' ? pins.find((p) => p.id === selected.id) : pings.find((p) => p.id === selected.id)) : null
    ;(map.getSource('sel') as GeoJSONSource).setData(item ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [item.lng, item.lat] }, properties: {} }] } : EMPTY)
  }, [ready, selected, pins, pings])

  // Marcador do modo de escolha.
  const pv = pick?.value
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (!pv) {
      marker.current?.remove()
      marker.current = null
      return
    }
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ color: '#20bfa9', draggable: true }).setLngLat([pv.lng, pv.lat]).addTo(map)
      marker.current.on('dragend', () => {
        const ll = marker.current!.getLngLat()
        cb.current.pick?.onChange({ lat: ll.lat, lng: ll.lng })
      })
      marker.current.getElement().setAttribute('aria-label', 'Marcador da localização escolhida (arraste para ajustar)')
    } else marker.current.setLngLat([pv.lng, pv.lat])
    if (!map.getBounds().contains([pv.lng, pv.lat])) map.easeTo({ center: [pv.lng, pv.lat], zoom: Math.max(map.getZoom(), 13) })
  }, [ready, pv?.lat, pv?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !flyTo) return
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 14, essential: true })
  }, [ready, flyTo])

  if (fatal)
    return (
      <div className={cx('grid place-items-center rounded-[var(--radius-card)] bg-mist p-6 text-center text-[13px] text-muted', className)} role="alert">
        <div>
          <MapPinOff className="mx-auto mb-2 h-6 w-6" aria-hidden />
          {fatal}
        </div>
      </div>
    )
  return (
    // O contentor tem de estar posicionado (relative por omissão, ou absolute/fixed vindo de className).
    <div className={cx('overflow-hidden', /\b(absolute|fixed)\b/.test(className ?? '') ? '' : 'relative', className)}>
      {/* Estilo inline: a CSS do MapLibre (.maplibregl-map) impõe position: relative ao contentor. */}
      <div ref={box} style={{ position: 'absolute', inset: 0 }} role="region" aria-label={label} />
      {tilesFailed && <p className="absolute left-2 top-2 z-10 rounded-full bg-white/95 px-3 py-1 text-[11.5px] font-bold text-amber-800 shadow-card">Cartografia parcialmente indisponível</p>}
    </div>
  )
}
