import { ExternalLink, Loader2, Locate, Search, TriangleAlert, X } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, LngLatBoundsLike, Map as MLMap, MapGeoJSONFeature } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import catalogWater from '../../data/map/catalogWater.json'
import zoneWaterJson from '../../data/map/zoneWater.json'
import type { Dam, FishingZone } from '../../data/types'
import { ZONE_KIND, ZONES } from '../../data/zones'
import { buildStyle, layerIds, OVERVIEW_TIERS, TIERS } from '../../lib/map/style'
import {
  AREA_TIERS,
  BASEMAP_WATER_NAME_OFFSET,
  BASEMAP_WATER_OFFSET,
  DAM_POINT_OFFSET,
  DETAIL_FROM_OFFSET,
  DETAIL_PREFETCH_OFFSET,
  FADE,
  IBERIA_BOUNDS,
  LABEL_ZOOM_OFFSET,
  MAX_BOUNDS,
  PORTUGAL_BOUNDS,
  RIVER_OFFSET,
  STRUCTURE_OFFSET,
  TIER_ZOOM_OFFSET,
  ZONE_OFFSET,
  type Tier,
} from '../../lib/map/waterConfig'
import { cx } from '../ui'
import { makeChunkLoader, type ChunkIndex } from '../../lib/map/chunks'

maplibregl.setWorkerUrl(workerUrl)

export type MapView = 'pt' | 'iberia'
type CatalogWater = Record<string, { waterId: string; name: string; areaKm2: number; tier: number; bbox: number[]; label: [number, number]; distanceKm: number }>
const CATALOG = catalogWater as unknown as CatalogWater
type ZoneWater = Record<string, { waterId: string; name: string; short: string; label: [number, number]; bbox: number[]; tier: number; areaKm2: number; partial: boolean }[]>
const ZONE_WATER = zoneWaterJson as unknown as ZoneWater
const zoneById = new Map(ZONES.map((z) => [z.id, z]))
/** Marca curta do tipo de zona (mapa). */
const ZONE_BADGE: Record<FishingZone['kind'], string> = { zpl: 'ZPL', zpr: 'Reservada', concessao: 'Concessão', coto: 'Coto' }
/** Marcas das zonas com albufeira conhecida (ponto interior da albufeira). */
const ZONE_POINTS: FeatureCollection = {
  type: 'FeatureCollection',
  features: Object.entries(ZONE_WATER).flatMap(([zid, ws]) =>
    ws.map((w) => ({
      type: 'Feature' as const,
      properties: { zone: zid, water: w.waterId, badge: ZONE_BADGE[zoneById.get(zid)!.kind], tier: w.tier },
      geometry: { type: 'Point' as const, coordinates: w.label },
    })),
  ),
}
/** Extensão e escalão de uma albufeira conhecida sem descarregar dados (fichas e zonas). */
function knownWater(id: string): { bbox: number[]; tier: Tier } | null {
  const c = Object.values(CATALOG).find((w) => w.waterId === id)
  if (c) return { bbox: c.bbox, tier: c.tier as Tier }
  for (const ws of Object.values(ZONE_WATER)) for (const w of ws) if (w.waterId === id) return { bbox: w.bbox, tier: w.tier as Tier }
  return null
}

/** [id, nome, nomes alternativos, bbox, escalão, área km², ficha] */
type SearchEntry = [string, string, string, [number, number, number, number], Tier, number, string]

let searchCache: Promise<SearchEntry[]> | null = null
/** Índice de nomes (pesquisa e exclusão de nomes repetidos do mapa base); descarregado uma vez. */
const loadSearch = (): Promise<SearchEntry[]> =>
  (searchCache ??= fetch('/map/water/search.json')
    .then((r) => (r.ok ? (r.json() as Promise<SearchEntry[]>) : Promise.reject(r.status)))
    .catch((): SearchEntry[] => {
      searchCache = null
      return []
    }))

export interface WaterInfo {
  id: string
  name: string
  /** Nome da barragem associada, quando a albufeira não tem nome próprio no OSM. */
  dam?: string
  alt: string
  areaKm2: number
  tier: Tier
  countries: string
  catalog: string
  zones?: string[]
  fromBasemap?: boolean
}
interface StructInfo { id: string; kind: 'dam' | 'weir'; name: string; operator: string; height: string; catalog: string }

const tierLabel = (t: number) => AREA_TIERS.find((x) => x.tier === t)?.label ?? ''
const fmtArea = (km2: number) =>
  km2 >= 1 ? `${km2.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} km²` : km2 * 100 < 1 ? '< 1 ha' : `${Math.round(km2 * 100).toLocaleString('pt-PT')} ha`
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const FILL_LAYERS = [...OVERVIEW_TIERS.map((t) => layerIds.fill('ov', t)), ...TIERS.map((t) => layerIds.fill('dt', t))]
const LABEL_LAYERS = [...TIERS.map((t) => layerIds.label('dt', t)), ...OVERVIEW_TIERS.map((t) => layerIds.label('ov', t))]
const STRUCT_LAYERS = ['st-dam-pt', 'st-weir-pt', 'st-dam-line', 'st-dam-fill', 'st-weir-line', 'st-weir-fill']
const SEA_CLASSES = ['ocean', 'sea', 'bay', 'strait']
const waterInfoOf = (p: Record<string, unknown>): WaterInfo => ({
  id: String(p.id),
  name: String(p.name || ''),
  dam: String(p.dam || ''),
  alt: String(p.alt || ''),
  areaKm2: Number(p.area_km2),
  tier: Number(p.tier) as Tier,
  countries: String(p.countries || ''),
  catalog: String(p.catalog || ''),
  zones: String(p.zone || '').split(',').filter(Boolean),
})

/**
 * Mapa real, plano e interativo da Península Ibérica com as albufeiras à escala.
 * MapLibre GL JS (Mercator, norte para cima, sem rotação nem inclinação).
 */
export default function IberiaMap({
  dams,
  selectedDamId,
  focus,
  focusWaterId,
  onSelectDam,
  view,
  onView,
  className,
  children,
}: {
  dams: Dam[]
  selectedDamId?: string
  /** Pedido explícito de enquadramento (ex.: "Ver no mapa" num cartão). Muda `n` para repetir. */
  focus?: { damId: string; n: number }
  /** Albufeira a enquadrar e selecionar ao abrir (ex.: ligação "Ver no mapa" de uma zona de pesca). */
  focusWaterId?: string
  onSelectDam: (id: string | null) => void
  view: MapView
  onView: (v: MapView) => void
  className?: string
  children?: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const fitZoom = useRef(5)
  const onSelectRef = useRef(onSelectDam)
  useEffect(() => {
    onSelectRef.current = onSelectDam
  })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [fatal, setFatal] = useState<string | null>(null)
  const [baseFailed, setBaseFailed] = useState(false)
  const [waterError, setWaterError] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [picked, setPicked] = useState<WaterInfo | null>(null)
  const [pickedStruct, setPickedStruct] = useState<StructInfo | null>(null)
  const [meta, setMeta] = useState<ChunkIndex['source'] | null>(null)

  const damsGeo = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      // Só as fichas sem contorno nos dados têm ponto (localização aproximada); as restantes são o próprio polígono.
      features: dams.filter((d) => !CATALOG[d.id]).map((d) => ({
        type: 'Feature' as const,
        properties: { id: d.id, name: d.name, selected: d.id === selectedDamId, contour: !!CATALOG[d.id] },
        geometry: { type: 'Point' as const, coordinates: [d.approx.lon, d.approx.lat] },
      })),
    }),
    [dams, selectedDamId],
  )
  const damsGeoRef = useRef(damsGeo)

  // ---------- criação do mapa ----------
  useEffect(() => {
    const el = box.current
    if (!el) return
    let map: MLMap
    try {
      map = new maplibregl.Map({
        container: el,
        style: buildStyle(window.location.origin),
        bounds: IBERIA_BOUNDS as LngLatBoundsLike,
        fitBoundsOptions: { padding: 16 },
        maxBounds: MAX_BOUNDS as LngLatBoundsLike,
        minZoom: 3,
        maxZoom: 16,
        maxPitch: 0,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        attributionControl: false,
        cooperativeGestures: false,
      })
    } catch {
      // Falha do sistema externo (WebGL): comunicada na próxima volta do ciclo de eventos.
      const t = window.setTimeout(() => {
        setFatal('Este dispositivo ou navegador não consegue mostrar o mapa (WebGL indisponível).')
        setStatus('error')
      })
      return () => window.clearTimeout(t)
    }
    mapRef.current = map
    // Enquanto o utilizador não mexer no mapa, mantém o enquadramento da Península (o contentor pode mudar de tamanho).
    let interacted = false
    const markInteraction = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) interacted = true
    }
    map.on('dragstart', markInteraction)
    map.on('zoomstart', markInteraction)
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 110 }), 'bottom-left')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    const timeout = window.setTimeout(() => {
      if (!map.loaded()) setFatal('A cartografia está a demorar a carregar. Verifique a ligação à internet.')
    }, 20000)

    let omtFailed = false
    map.on('error', (e) => {
      const src = (e as unknown as { sourceId?: string }).sourceId
      if (src === 'omt') {
        omtFailed = true
        setBaseFailed(true)
      }
    })

    // Blocos carregados pela área visível: contornos de detalhe e estruturas (açudes, barragens).
    const loaders = [
      makeChunkLoader(map, '/map/water', 'water-detail', () => fitZoom.current + DETAIL_PREFETCH_OFFSET),
      makeChunkLoader(map, '/map/structures', 'structures', () => fitZoom.current + STRUCTURE_OFFSET.prefetch),
    ]
    const loadVisible = async () => {
      setDetailLoading(true)
      const failed = (await Promise.all(loaders.map((l) => l.loadVisible()))).some((ok) => !ok)
      if (failed) setWaterError(true)
      setDetailLoading(loaders.some((l) => l.busy()))
    }

    // Nomes da água do mapa base: só depois de conhecer os nomes das albufeiras, para não os repetir.
    let namesApplied = false
    const applyBasemapWaterNames = async () => {
      if (namesApplied || omtFailed || map.getZoom() < fitZoom.current + BASEMAP_WATER_NAME_OFFSET - 0.6) return
      namesApplied = true
      const entries = await loadSearch()
      const names = [...new Set(entries.flatMap((e) => [e[1], ...e[2].split(' | ')]).filter(Boolean))]
      const notOurs: maplibregl.FilterSpecification = ['!', ['in', ['get', 'name'], ['literal', names]]]
      const notSea: maplibregl.FilterSpecification = ['!', ['in', ['get', 'class'], ['literal', SEA_CLASSES]]]
      if (!map.getLayer('omt-water-name')) return
      map.setFilter('omt-water-name', ['all', ['==', ['geometry-type'], 'Point'], notSea, notOurs])
      map.setFilter('omt-water-name-line', ['all', ['==', ['geometry-type'], 'LineString'], notSea, notOurs])
      map.setLayoutProperty('omt-water-name', 'visibility', 'visible')
      map.setLayoutProperty('omt-water-name-line', 'visibility', 'visible')
    }

    map.on('load', async () => {
      window.clearTimeout(timeout)
      applyZoomPolicy(map, fitZoom)
      if (!interacted) map.fitBounds(IBERIA_BOUNDS as LngLatBoundsLike, { padding: 16, duration: 0 })
      ;(map.getSource('dams') as GeoJSONSource).setData(damsGeoRef.current)
      ;(map.getSource('zones') as GeoJSONSource).setData(ZONE_POINTS)
      try {
        const [idx, ov] = await Promise.all([
          fetch('/map/water/index.json').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
          fetch('/map/water/overview.geojson').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        ])
        loaders[0].setIndex(idx)
        setMeta(idx.source)
        ;(map.getSource('water-overview') as GeoJSONSource).setData(ov)
        setStatus('ready')
        loadVisible()
      } catch {
        setWaterError(true)
        setStatus('ready')
      }
    })
    map.on('moveend', () => {
      loadVisible()
      applyBasemapWaterNames()
    })

    // Estado observável (testes e diagnóstico): zoom, enquadramento e o que está desenhado.
    map.on('idle', () => {
      const wrap = el.parentElement
      if (!wrap) return
      const z = map.getZoom()
      const active = (l: string) => {
        const ly = map.getLayer(l)
        return !!ly && z >= (ly.minzoom ?? 0) && z < (ly.maxzoom ?? 24) && map.getLayoutProperty(l, 'visibility') !== 'none'
      }
      const drawn = map.queryRenderedFeatures({ layers: FILL_LAYERS.filter(active) })
      const visible = new Map<string, { n: string; a: number }>()
      for (const f of drawn) visible.set(String(f.properties.id), { n: String(f.properties.short || ''), a: Number(f.properties.area_km2) })
      const labels = map.queryRenderedFeatures({ layers: LABEL_LAYERS.filter(active) })
      const structs = map.queryRenderedFeatures({ layers: STRUCT_LAYERS.filter(active) })
      const structLabels = map.queryRenderedFeatures({ layers: ['st-dam-label', 'st-weir-label'].filter(active) })
      const zones = map.queryRenderedFeatures({ layers: ['zone-dot'].filter(active) })
      wrap.dataset.zoom = z.toFixed(2)
      wrap.dataset.fitZoom = fitZoom.current.toFixed(2)
      wrap.dataset.waterCount = String(visible.size)
      wrap.dataset.minArea = String(Math.min(...[...visible.values()].map((v) => v.a), 9999))
      wrap.dataset.waterNames = [...visible.values()].filter((v) => v.n).sort((a, b) => b.a - a.a).slice(0, 60).map((v) => v.n).join('|')
      wrap.dataset.labels = labels.map((f) => String(f.properties.short)).join('|')
      wrap.dataset.structCount = String(new Set(structs.map((f) => String(f.properties.id))).size)
      wrap.dataset.structLabels = structLabels.map((f) => String(f.properties.name)).slice(0, 40).join('|')
      wrap.dataset.zoneCount = String(zones.length)
      wrap.dataset.chunks = String(loaders[0].count())
      wrap.dataset.structChunks = String(loaders[1].count())
      wrap.dataset.activeTiers = TIERS.filter((t) => active(layerIds.fill('dt', t)) || (t <= 2 && active(layerIds.fill('ov', t)))).join(',')
      // Pontos no ecrã (rótulos de albufeiras, estruturas e zonas): permitem aos testes tocar em elementos reais.
      const proj = (f: MapGeoJSONFeature) => {
        const c = (f.geometry as unknown as { coordinates: [number, number] }).coordinates
        const px = map.project(c)
        return { x: Math.round(px.x), y: Math.round(px.y) }
      }
      wrap.dataset.probes = JSON.stringify(labels.slice(0, 12).map((f) => ({ name: String(f.properties.short), catalog: String(f.properties.catalog || ''), zone: String(f.properties.zone || ''), ...proj(f) })))
      wrap.dataset.structProbes = JSON.stringify(map.queryRenderedFeatures({ layers: ['st-dam-pt', 'st-weir-pt'].filter(active) }).slice(0, 8).map((f) => ({ name: String(f.properties.name ?? ''), kind: String(f.properties.skind), ...proj(f) })))
      wrap.dataset.zoneProbes = JSON.stringify(zones.slice(0, 8).map((f) => ({ zone: String(f.properties.zone), ...proj(f) })))
    })

    // Toque/clique: estruturas > marcas de zona > albufeiras > água do mapa base (área de toque alargada).
    const box4 = (pt: maplibregl.Point, pad: number): [[number, number], [number, number]] => [[pt.x - pad, pt.y - pad], [pt.x + pad, pt.y + pad]]
    const q = (pt: maplibregl.Point, pad: number, layers: string[]) => map.queryRenderedFeatures(box4(pt, pad), { layers: layers.filter((l) => map.getLayer(l)) })
    map.on('mousemove', (e) => {
      const any = q(e.point, 3, [...STRUCT_LAYERS, 'zone-dot', ...FILL_LAYERS, 'omt-water']).length > 0
      map.getCanvas().style.cursor = any ? 'pointer' : ''
    })
    map.on('click', (e) => {
      const pad = (e.originalEvent as PointerEvent).pointerType === 'touch' ? 14 : 5
      // A marca de zona está desenhada por cima das estruturas: tem prioridade no toque.
      const zoneDot = q(e.point, pad + 2, ['zone-dot'])[0]
      const st = zoneDot ? undefined : q(e.point, pad, STRUCT_LAYERS)[0]
      if (st) {
        const p = st.properties as Record<string, unknown>
        // As formas não guardam todas as propriedades: completa-as com o ponto da mesma estrutura.
        const full = (map.querySourceFeatures('structures', { filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'id'], String(p.id)]] })[0]?.properties ?? p) as Record<string, unknown>
        setPickedStruct({ id: String(p.id), kind: (full.skind ?? p.kind) === 'dam' ? 'dam' : 'weir', name: String(full.name ?? ''), operator: String(full.operator ?? ''), height: String(full.height ?? ''), catalog: String(full.catalog ?? '') })
        setPicked(null)
        highlight(map, '')
        onSelectRef.current(full.catalog ? String(full.catalog) : null)
        return
      }
      setPickedStruct(null)
      const waterId = zoneDot ? String(zoneDot.properties.water) : null
      const feats = waterId
        ? map.querySourceFeatures('water-detail', { filter: ['all', ['==', ['get', 'kind'], 'area'], ['==', ['get', 'id'], waterId]] }).concat(map.querySourceFeatures('water-overview', { filter: ['all', ['==', ['get', 'kind'], 'area'], ['==', ['get', 'id'], waterId]] }))
        : q(e.point, pad, FILL_LAYERS).sort((a, b) => Number(a.properties.area_km2) - Number(b.properties.area_km2))
      const f = feats[0]
      if (f || zoneDot) {
        const info = f ? waterInfoOf(f.properties) : zoneOnlyInfo(String(zoneDot!.properties.water))
        setPicked(info)
        highlight(map, info.id)
        onSelectRef.current(info.catalog || null)
        return
      }
      const base = q(e.point, pad, ['omt-water'])[0]
      if (base) {
        setPicked({ id: '', name: String(base.properties.name ?? ''), alt: '', areaKm2: NaN, tier: 5, countries: '', catalog: '', fromBasemap: true })
        highlight(map, '')
        onSelectRef.current(null)
        return
      }
      setPicked(null)
      highlight(map, '')
    })

    // Redimensionamento: recalcula o enquadramento da Península e os limiares relativos.
    const ro = new ResizeObserver(() => {
      map.resize()
      applyZoomPolicy(map, fitZoom)
      if (!interacted && map.isStyleLoaded()) map.fitBounds(IBERIA_BOUNDS as LngLatBoundsLike, { padding: 16, duration: 0 })
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      window.clearTimeout(timeout)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Base Natural Earth como recurso: localidades e fronteiras a todas as escalas.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !baseFailed) return
    const apply = () => {
      map.setLayoutProperty('ne-place', 'visibility', 'visible')
      map.setPaintProperty('ne-border', 'line-opacity', 1)
      for (const l of ['omt-place', 'omt-border', 'omt-region', 'omt-road-major', 'omt-road-minor', 'omt-wood', 'omt-ocean', 'omt-water', 'omt-river', 'omt-stream', 'omt-water-name', 'omt-water-name-line'])
        if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', 'none')
      // Sem mapa base detalhado, os contornos da CatchAtlas são a única água: mantêm-se a todas as escalas.
      for (const t of TIERS) map.setPaintProperty(layerIds.fill('dt', t), 'fill-opacity', tierOpacity(fitZoom.current, t, false))
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [baseFailed])

  // Barragens do catálogo (resultados atuais dos filtros).
  useEffect(() => {
    damsGeoRef.current = damsGeo
    const src = mapRef.current?.getSource('dams') as GeoJSONSource | undefined
    src?.setData(damsGeo)
  }, [damsGeo])

  // Destaque sincronizado com a ficha selecionada na lista (sem mover o mapa).
  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return
    const w = selectedDamId ? CATALOG[selectedDamId] : undefined
    highlight(map, w?.waterId ?? '')
  }, [selectedDamId, status])

  // Enquadramento pedido explicitamente (cartão da lista).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus || status !== 'ready') return
    const w = CATALOG[focus.damId]
    if (w) frameWater(map, w.bbox, w.tier as Tier, fitZoom.current)
    else {
      const d = dams.find((x) => x.id === focus.damId)
      if (d) map.easeTo({ center: [d.approx.lon, d.approx.lat], zoom: Math.max(map.getZoom(), fitZoom.current + DAM_POINT_OFFSET + 0.6), duration: 700 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a novos pedidos de enquadramento
  }, [focus?.n, status])

  // Albufeira pedida pelo endereço (?agua=…), por exemplo a partir de uma zona de pesca.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusWaterId || status !== 'ready') return
    let cancelled = false
    const known = knownWater(focusWaterId)
    const go = (bbox: number[], tier: Tier, info: WaterInfo) => {
      if (cancelled) return
      setPicked(info)
      highlight(map, focusWaterId)
      onSelectRef.current(info.catalog || null)
      frameWater(map, bbox, tier, fitZoom.current)
    }
    if (known) go(known.bbox, known.tier, zoneOnlyInfo(focusWaterId))
    else
      loadSearch().then((entries) => {
        const e = entries.find((x) => x[0] === focusWaterId)
        if (e) go(e[3], e[4], { id: e[0], name: e[1], alt: e[2], areaKm2: e[5], tier: e[4], countries: '', catalog: e[6] })
      })
    return () => {
      cancelled = true
    }
  }, [focusWaterId, status])

  // Botões Portugal / Península.
  const frameView = (v: MapView) => {
    onView(v)
    mapRef.current?.fitBounds((v === 'pt' ? PORTUGAL_BOUNDS : IBERIA_BOUNDS) as LngLatBoundsLike, { padding: 16, duration: 700 })
  }

  const pickFromSearch = (e: SearchEntry) => {
    const map = mapRef.current
    if (!map) return
    const [id, name, alt, bbox, tier, area, catalog] = e
    setPickedStruct(null)
    setPicked({ id, name, alt, areaKm2: area, tier, countries: '', catalog, zones: zonesOfWater(id) })
    highlight(map, id)
    onSelectRef.current(catalog || null)
    frameWater(map, bbox, tier, fitZoom.current)
  }

  const closePanel = () => {
    setPicked(null)
    setPickedStruct(null)
    if (mapRef.current) highlight(mapRef.current, '')
  }
  const noContour = selectedDamId && !CATALOG[selectedDamId] ? dams.find((d) => d.id === selectedDamId) : null
  // Com uma ficha selecionada, o cartão da ficha substitui o painel da massa de água.
  const shownPicked = picked && !selectedDamId ? picked : null
  const shownStruct = pickedStruct && !(pickedStruct.catalog && selectedDamId === pickedStruct.catalog) ? pickedStruct : null
  const panel = shownStruct || (shownPicked && !shownPicked.catalog) || noContour

  return (
    <div className={cx('relative overflow-hidden rounded-[var(--radius-card)] bg-[#cfe2ea] shadow-card', className)} data-map-status={status}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} role="region" aria-label="Mapa das albufeiras de Portugal e Espanha" />

      <MapSearch onPick={pickFromSearch} />

      <div className="absolute bottom-9 left-2 z-10 flex flex-col items-start gap-2 sm:left-auto sm:right-2 sm:items-end">
        {children}
        <div className="flex gap-1.5">
          <button type="button" onClick={() => frameView('iberia')} aria-label="Repor vista da Península" title="Repor vista da Península" className="press grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-card hover:bg-mist">
            <Locate className="h-[18px] w-[18px]" />
          </button>
          <div className="flex rounded-full bg-white p-1 shadow-card" role="group" aria-label="Zona do mapa">
            {(['pt', 'iberia'] as const).map((v) => (
              <button key={v} type="button" onClick={() => frameView(v)} aria-pressed={view === v} className={cx('press h-8 rounded-full px-3 text-[12.5px] font-bold', view === v ? 'bg-ink text-white' : 'text-ink hover:bg-mist')}>
                {v === 'pt' ? 'Portugal' : 'Península'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {status === 'loading' && !fatal && (
        <div className="absolute inset-0 grid place-items-center bg-[#cfe2ea]/70" aria-live="polite">
          <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-ink shadow-card">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar o mapa…
          </span>
        </div>
      )}
      {fatal && (
        <div className="absolute inset-0 grid place-items-center bg-[#eef3f4] p-6 text-center" role="alert">
          <div>
            <TriangleAlert className="mx-auto h-6 w-6 text-amber-800" aria-hidden />
            <p className="mt-2 text-[14px] font-bold text-ink">{fatal}</p>
            <p className="mt-1 text-[12.5px] text-muted">A lista de barragens continua disponível.</p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-2 top-[60px] z-10 flex flex-col items-center gap-1.5">
        {baseFailed && (
          <p className="pointer-events-auto rounded-xl bg-amber-50 px-3 py-1.5 text-center text-[12px] font-semibold text-amber-800 shadow-card" role="status">
            Mapa base detalhado indisponível · a mostrar a base simplificada (Natural Earth)
          </p>
        )}
        {waterError && (
          <p className="pointer-events-auto rounded-xl bg-amber-50 px-3 py-1.5 text-center text-[12px] font-semibold text-amber-800 shadow-card" role="alert">
            Não foi possível carregar parte dos dados do mapa. Mova o mapa para tentar de novo.
          </p>
        )}
        {detailLoading && (
          <p className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11.5px] font-bold text-muted shadow-card" aria-live="polite">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> A carregar detalhe…
          </p>
        )}
      </div>

      {panel ? (
        <div className="absolute inset-x-2 bottom-24 z-20 max-h-[55%] overflow-y-auto rounded-2xl bg-white p-3.5 shadow-lift sm:left-auto sm:right-2 sm:w-[320px]" role="dialog" aria-label="Elemento selecionado no mapa">
          <button type="button" onClick={closePanel} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-mist" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
          {shownStruct ? (
            <StructPanel s={shownStruct} />
          ) : noContour ? (
            <>
              <p className="pr-8 text-[15px] font-extrabold text-ink">{noContour.name}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">Contorno da albufeira não disponível nos dados cartográficos. O ponto indica a localização aproximada da barragem.</p>
              <Link to={`/barragens/${noContour.id}`} className="mt-2 inline-block text-[13px] font-bold text-teal-700 hover:underline">Abrir ficha da barragem</Link>
            </>
          ) : shownPicked?.fromBasemap ? (
            <>
              <p className="pr-8 text-[15px] font-extrabold text-ink">{shownPicked.name || 'Massa de água'}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                Do mapa base do OpenStreetMap{shownPicked.name ? '' : ', sem nome nos dados usados aqui'}. Ficha ainda não disponível.
              </p>
            </>
          ) : shownPicked ? (
            <WaterPanel w={shownPicked} />
          ) : null}
        </div>
      ) : null}

      {meta && (
        <a href={meta.url} target="_blank" rel="noopener noreferrer" className="sr-only">
          Fonte dos contornos: {meta.attribution}, {meta.license} <ExternalLink aria-hidden />
        </a>
      )}
    </div>
  )
}

function zonesOfWater(waterId: string) {
  return Object.entries(ZONE_WATER).filter(([, ws]) => ws.some((w) => w.waterId === waterId)).map(([zid]) => zid)
}

/** Informação mínima de uma albufeira conhecida por ficha ou zona (antes de os blocos estarem carregados). */
function zoneOnlyInfo(waterId: string): WaterInfo {
  const zw = Object.values(ZONE_WATER).flat().find((w) => w.waterId === waterId)
  const cat = Object.entries(CATALOG).find(([, w]) => w.waterId === waterId)
  return {
    id: waterId,
    name: zw?.name ?? cat?.[1].name ?? '',
    alt: '',
    areaKm2: zw?.areaKm2 ?? cat?.[1].areaKm2 ?? NaN,
    tier: (zw?.tier ?? cat?.[1].tier ?? 5) as Tier,
    countries: '',
    catalog: cat?.[0] ?? '',
    zones: zonesOfWater(waterId),
  }
}

function WaterPanel({ w }: { w: WaterInfo }) {
  const zones = (w.zones ?? []).map((id) => zoneById.get(id)).filter(Boolean) as FishingZone[]
  const partial = (zid: string) => ZONE_WATER[zid]?.some((x) => x.waterId === w.id && x.partial)
  // Albufeiras sem nome próprio: o índice e as zonas usam "Albufeira (nome da barragem)".
  const fromDam = w.name.match(/^Albufeira \((.+)\)$/)
  const dam = w.dam || fromDam?.[1] || ''
  const name = fromDam ? '' : w.name
  return (
    <>
      <p className="pr-8 text-[15px] font-extrabold text-ink">{name || (dam ? `Albufeira · ${dam}` : 'Albufeira sem nome nos dados')}</p>
      {!name && dam && <p className="text-[12px] text-muted">Sem nome próprio no OpenStreetMap · barragem associada: {dam}</p>}
      {w.alt && !fromDam && !w.alt.startsWith('sem nome próprio') && <p className="text-[12px] text-muted">{w.alt}</p>}
      {Number.isFinite(w.areaKm2) && (
        <p className="mt-1 text-[12.5px] text-text">
          Área do contorno: {fmtArea(w.areaKm2)} · {tierLabel(w.tier)}
        </p>
      )}
      {zones.map((z) => (
        <div key={z.id} className="mt-2.5 rounded-xl bg-amber-50 p-2.5" data-zone-panel={z.id}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">{ZONE_KIND[z.kind]}{z.evidence === 'noticia' ? ' · sem documento oficial' : ''}</p>
          <p className="mt-0.5 text-[13px] font-bold leading-snug text-ink">{z.name}</p>
          {z.manager && <p className="text-[12px] text-muted">{z.manager}</p>}
          {partial(z.id) && <p className="mt-1 text-[11.5px] text-muted">A zona abrange só parte desta albufeira e/ou troços de rio: limites no documento.</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-bold">
            <a href={z.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-700 hover:underline">
              {z.source.label} <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <Link to={`/zonas?pais=${z.country}`} className="text-ink hover:underline">Zonas de pesca</Link>
          </div>
        </div>
      ))}
      <p className="mt-2 text-[12.5px] font-bold text-amber-800">Ficha ainda não disponível</p>
    </>
  )
}

function StructPanel({ s }: { s: StructInfo }) {
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{s.kind === 'dam' ? 'Barragem (estrutura)' : 'Açude'}</p>
      <p className="pr-8 text-[15px] font-extrabold text-ink">{s.name || (s.kind === 'dam' ? 'Barragem sem nome nos dados' : 'Açude sem nome nos dados')}</p>
      {(s.operator || s.height) && (
        <p className="mt-1 text-[12.5px] text-text">
          {s.operator && <>Entidade: {s.operator}</>}
          {s.operator && s.height ? ' · ' : ''}
          {s.height && <>Altura: {s.height} m</>}
        </p>
      )}
      <p className="mt-1 text-[12px] text-muted">Dados do OpenStreetMap (posição e forma de referência).</p>
      {s.catalog ? (
        <Link to={`/barragens/${s.catalog}`} className="mt-2 inline-block text-[13px] font-bold text-teal-700 hover:underline">Abrir ficha da barragem</Link>
      ) : (
        <p className="mt-1.5 text-[12.5px] font-bold text-amber-800">Ficha ainda não disponível</p>
      )}
    </>
  )
}

/** Opacidade de um escalão em função do zoom (fade de entrada; sem fade de saída quando não há mapa base). */
function tierOpacity(fit: number, t: Tier, overview: boolean): maplibregl.ExpressionSpecification | number {
  const start = fit + TIER_ZOOM_OFFSET[t]
  const detailFrom = fit + DETAIL_FROM_OFFSET
  if (overview) return ['interpolate', ['linear'], ['zoom'], start, 0, start + FADE, 1, detailFrom + 0.2, 1, detailFrom + 0.6, 0]
  return ['interpolate', ['linear'], ['zoom'], start, 0, start + FADE, 1]
}

/** Aplica os limiares relativos ao enquadramento atual da Península. */
function applyZoomPolicy(map: MLMap, fitRef: { current: number }) {
  if (!map.isStyleLoaded()) return
  const cam = map.cameraForBounds(IBERIA_BOUNDS as LngLatBoundsLike, { padding: 16 })
  const fit = cam?.zoom ?? 5
  if (Math.abs(fit - fitRef.current) < 0.02 && map.getLayer(layerIds.fill('dt', 1)) && fitRef.current !== 5) return
  fitRef.current = fit
  const detailFrom = fit + DETAIL_FROM_OFFSET
  for (const t of OVERVIEW_TIERS) {
    const start = fit + TIER_ZOOM_OFFSET[t]
    map.setLayerZoomRange(layerIds.fill('ov', t), Math.max(0, start), detailFrom + 0.6)
    map.setPaintProperty(layerIds.fill('ov', t), 'fill-opacity', tierOpacity(fit, t, true))
    map.setLayerZoomRange(layerIds.label('ov', t), Math.max(0, fit + LABEL_ZOOM_OFFSET[t]), detailFrom)
  }
  for (const t of TIERS) {
    const start = t <= 2 ? detailFrom : fit + TIER_ZOOM_OFFSET[t]
    map.setLayerZoomRange(layerIds.fill('dt', t), Math.max(0, start), 24)
    map.setPaintProperty(layerIds.fill('dt', t), 'fill-opacity', t <= 2 ? 1 : tierOpacity(fit, t, false))
    map.setLayerZoomRange(layerIds.label('dt', t), Math.max(0, t <= 2 ? detailFrom : fit + LABEL_ZOOM_OFFSET[t]), 24)
  }
  const bw = fit + BASEMAP_WATER_OFFSET
  map.setLayerZoomRange('omt-water', bw, 24)
  map.setPaintProperty('omt-water', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], bw, 0, bw + FADE, 1])
  map.setLayerZoomRange('omt-water-name', fit + BASEMAP_WATER_NAME_OFFSET, 24)
  map.setLayerZoomRange('omt-water-name-line', fit + BASEMAP_WATER_NAME_OFFSET, 24)
  map.setLayerZoomRange('ne-river', Math.max(0, fit + RIVER_OFFSET.major - 0.6), fit + RIVER_OFFSET.minor + 0.5)
  // Rios por importância (scalerank do Natural Earth): os principais primeiro, os restantes depois.
  const r0 = fit + RIVER_OFFSET.major
  map.setPaintProperty('ne-river', 'line-opacity', [
    'interpolate', ['linear'], ['zoom'],
    r0 - 0.6, 0,
    r0, ['case', ['<=', ['get', 'rank'], 6], 1, 0],
    r0 + 1, ['case', ['<=', ['get', 'rank'], 8], 1, 0],
    r0 + 2, 1,
  ])
  map.setLayerZoomRange('omt-river', fit + RIVER_OFFSET.minor, 24)
  map.setLayerZoomRange('omt-stream', fit + RIVER_OFFSET.streams, 24)
  map.setLayerZoomRange('dams', fit + DAM_POINT_OFFSET, 24)
  // Fronteiras: Natural Earth nas escalas pequenas; OSM (mais detalhada) a partir da escala regional.
  map.setPaintProperty('ne-border', 'line-opacity', ['interpolate', ['linear'], ['zoom'], fit + 2.6, 1, fit + 3.2, 0])
  map.setLayerZoomRange('omt-border', fit + 2.6, 24)

  // Estruturas: ponto discreto primeiro; forma real quando já se distingue (o ponto mantém-se se for a única forma).
  const so = STRUCTURE_OFFSET
  const shape = fit + so.shape
  const pointOpacity = (from: number): maplibregl.ExpressionSpecification => [
    'interpolate', ['linear'], ['zoom'],
    from, 0, from + FADE, 1,
    shape + 0.2, 1, shape + 0.7, ['case', ['boolean', ['get', 'ptonly'], false], 1, 0],
  ]
  for (const [layer, from] of [['st-dam-pt', fit + so.damPoint], ['st-weir-pt', fit + so.weirPoint]] as const) {
    map.setLayerZoomRange(layer, from, 24)
    map.setPaintProperty(layer, 'circle-opacity', pointOpacity(from))
    map.setPaintProperty(layer, 'circle-stroke-opacity', pointOpacity(from))
  }
  for (const layer of ['st-dam-line', 'st-dam-fill', 'st-weir-line', 'st-weir-fill']) {
    map.setLayerZoomRange(layer, shape, 24)
    map.setPaintProperty(layer, layer.endsWith('fill') ? 'fill-opacity' : 'line-opacity', ['interpolate', ['linear'], ['zoom'], shape, 0, shape + FADE, 1])
  }
  map.setLayerZoomRange('st-dam-label', fit + so.damLabel, 24)
  map.setLayerZoomRange('st-weir-label', fit + so.weirLabel, 24)

  // Concessões e zonas de pesca.
  map.setLayerZoomRange('zone-dot', fit + ZONE_OFFSET.badge, 24)
  map.setLayerZoomRange('zone-badge', fit + ZONE_OFFSET.badgeLabel, 24)
  map.setLayerZoomRange('zone-line-dt', fit + ZONE_OFFSET.outline, 24)
}

function highlight(map: MLMap, id: string) {
  if (!map.getLayer('water-sel-ov')) return
  const f: maplibregl.FilterSpecification = ['all', ['==', ['get', 'kind'], 'area'], ['==', ['get', 'id'], id]]
  for (const l of ['water-sel-halo-ov', 'water-sel-halo-dt', 'water-sel-ov', 'water-sel-dt', 'water-sel-line', 'water-sel-line-ov']) if (map.getLayer(l)) map.setFilter(l, f)
}

/** Enquadra os limites reais da albufeira e garante zoom suficiente para ela estar visível. */
function frameWater(map: MLMap, bbox: number[], tier: Tier, fit: number) {
  const b: LngLatBoundsLike = [bbox[0], bbox[1], bbox[2], bbox[3]]
  const cam = map.cameraForBounds(b, { padding: 60, maxZoom: 14 })
  if (!cam) return
  const minVisible = fit + (tier <= 2 ? DETAIL_FROM_OFFSET : TIER_ZOOM_OFFSET[tier]) + FADE + 0.3
  map.easeTo({ center: cam.center, zoom: Math.min(15, Math.max(cam.zoom ?? 8, minVisible)), duration: 800 })
}

/** Pesquisa de massas de água pelo nome (inclui albufeiras sem ficha); índice carregado só ao usar. */
function MapSearch({ onPick }: { onPick: (e: SearchEntry) => void }) {
  const [q, setQ] = useState('')
  const [data, setData] = useState<SearchEntry[] | null>(null)
  const [open, setOpen] = useState(false)
  const load = () => {
    if (data) return
    loadSearch().then(setData)
  }
  const results = useMemo(() => {
    const n = norm(q.trim())
    if (!data || n.length < 2) return []
    return data.filter((e) => norm(`${e[1]} ${e[2]}`).includes(n)).slice(0, 8)
  }, [q, data])
  return (
    <div className="absolute left-2 right-14 top-2 z-20 sm:right-auto sm:w-[300px]" data-no-swipe>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          type="search"
          value={q}
          onFocus={() => { load(); setOpen(true) }}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && results[0]) { onPick(results[0]); setOpen(false) } }}
          placeholder="Procurar albufeira no mapa"
          aria-label="Procurar albufeira no mapa"
          className="h-10 w-full rounded-full border border-line bg-white pl-9 pr-3 text-[13.5px] shadow-card outline-none placeholder:text-subtle focus:border-teal focus:ring-4 focus:ring-teal/15"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="mt-1.5 max-h-[260px] overflow-y-auto rounded-2xl bg-white py-1 shadow-lift" role="listbox" aria-label="Resultados">
          {results.map((e) => (
            <li key={e[0]}>
              <button type="button" role="option" aria-selected={false} onClick={() => { onPick(e); setOpen(false); setQ(e[1]) }} className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left hover:bg-mist">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-bold text-ink">{e[1]}</span>
                  <span className="block text-[11.5px] text-muted">{fmtArea(e[5])} · {tierLabel(e[4])}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {zonesOfWater(e[0]).length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">Pesca</span>}
                  {e[6] ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10.5px] font-bold text-teal-700">Ficha</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && data && q.trim().length >= 2 && results.length === 0 && (
        <p className="mt-1.5 rounded-2xl bg-white px-3.5 py-2 text-[12.5px] text-muted shadow-lift">Sem albufeiras com esse nome nos dados (Portugal e Espanha, ≥ 5 ha).</p>
      )}
    </div>
  )
}
