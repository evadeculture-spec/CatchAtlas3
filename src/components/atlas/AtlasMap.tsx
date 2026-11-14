import * as maplibregl from 'maplibre-gl'
import type { FilterSpecification, GeoJSONSource, LngLatBoundsLike, Map as MLMap, MapGeoJSONFeature } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { FeatureCollection } from 'geojson'
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { CountryId } from '../../data/types'
import { ATLAS_CONFIG } from '../../lib/atlas/config'
import { ATLAS_ZOOM, CAMERA, SLAB_BOX, slabDepthM, terrainExaggeration, wallOpacity } from '../../lib/atlas/constants'
import { registerDemProtocol } from '../../lib/atlas/dem'
import type { AtlasType } from '../../lib/atlas/model'
import { buildSlabMesh, type LngLat } from '../../lib/atlas/slabMesh'
import { createSlabLayer } from '../../lib/atlas/slabLayer'
import { ATLAS_COLORS, ATLAS_FILL_LAYERS, ATLAS_LABEL_LAYERS, buildAtlasStyle, DEM_LAYERS, OMT_LAYERS, SLAB_WALLS_BEFORE, STRUCT_LAYERS } from '../../lib/atlas/style'
import { applyAtlasZoomPolicy } from '../../lib/atlas/zoomPolicy'
import { makeChunkLoader, type ChunkIndex } from '../../lib/map/chunks'
import { DETAIL_FROM_OFFSET, DETAIL_PREFETCH_OFFSET, FADE, IBERIA_BOUNDS, STRUCTURE_OFFSET, TIER_ZOOM_OFFSET, type Tier } from '../../lib/map/waterConfig'

maplibregl.setWorkerUrl(workerUrl)

export interface CameraState {
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
}
export interface ViewInfo extends CameraState {
  bounds: [number, number, number, number]
  /** Zoom com que a Península cabe no ecrã (referência dos níveis de detalhe). */
  fit: number
}
export interface AtlasStatus {
  map: 'loading' | 'ready' | 'webgl-error' | 'context-lost'
  dem: 'off' | 'loading' | 'ok' | 'failed'
  basemap: 'ok' | 'failed'
  water: 'ok' | 'failed'
  detailLoading: boolean
}
export type PickKind = 'water' | 'structure' | 'river' | 'catalog' | 'basemap-water' | 'basemap-river'
export interface AtlasPick {
  kind: PickKind
  /** ID do elemento na camada do mapa (albufeira/estrutura OSM, rio, ID do registo da ficha). */
  mapId: string
  name: string
  sectionId?: string
  props: Record<string, unknown>
}
export interface AtlasSelection {
  /** ID do registo do atlas (estável; é o que vai no URL e para os fluxos). */
  id: string
  /** 'unknown': ID OSM antes de o registo carregar (realça albufeira e estrutura com o mesmo ID). */
  kind: 'water' | 'structure' | 'river' | 'catalog' | 'basemap' | 'unknown'
  mapId: string
  sectionId?: string
}
export interface AtlasFilters {
  countries: CountryId[]
  types: AtlasType[]
  favOnly: boolean
}
export interface FrameTarget {
  bbox: [number, number, number, number]
  kind: 'water' | 'structure' | 'river' | 'point'
  tier?: Tier
}
export interface AtlasMapHandle {
  peninsula: () => void
  north: () => void
  rotateBy: (deg: number) => void
  tiltBy: (deg: number) => void
  zoomBy: (d: number) => void
  frame: (t: FrameTarget) => void
  showMe: (pos: { lng: number; lat: number } | null) => void
  getView: () => ViewInfo | null
  /** Instância MapLibre (camadas dos pins e da comunidade, colocação de pins). */
  getMap: () => MLMap | null
}
interface Padding {
  top: number
  right: number
  bottom: number
  left: number
}

const WATER_LAYERS = [...ATLAS_FILL_LAYERS, ...ATLAS_LABEL_LAYERS]
const RIVER_DRAW = ['river-line', 'river-label']
const STRUCT_DRAW = [...STRUCT_LAYERS, 'st-dam-label', 'st-weir-label']
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const dur = (ms: number) => (prefersReducedMotion() ? 0 : ms)

/** Dispositivo modesto: limita a resolução do canvas (pixel ratio). */
function pixelRatio() {
  const dpr = window.devicePixelRatio || 1
  const nav = navigator as Navigator & { deviceMemory?: number }
  const modest = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
  return Math.min(dpr, modest ? 1.5 : 2)
}

/** Zoom de referência: a Península inteira no ecrã, sem inclinação. */
function peninsulaFit(map: MLMap) {
  const cam = map.cameraForBounds(IBERIA_BOUNDS as LngLatBoundsLike, { padding: 16, absolutePadding: true, bearing: 0, pitch: 0 })
  return cam?.zoom ?? 5
}

/** Extremos da peça (cabos e cantos do recorte): a câmara inclinada é ajustada para os conter. */
const PENINSULA_EXTREMES: [number, number][] = [
  [-8.99, 37.02], [-9.5, 38.78], [-9.3, 42.88], [-7.68, 43.79], [-1.45, 44.25], [4.0, 44.25], [3.32, 42.32], [0.21, 38.73], [-2.19, 36.72], [-5.6, 36.0], [-7.4, 37.17],
]

/**
 * Câmara da Península: enquadrada na área livre (o padding do mapa reserva o painel e o cabeçalho),
 * com inclinação confortável e ligeira rotação no modo 3D. Sem rotação automática.
 * Com inclinação, a perspetiva aumenta o sul e a rotação desloca o sudoeste: em vez de um ajuste
 * empírico, projeta os extremos com a câmara candidata e corrige zoom e centro até caberem
 * (síncrono: não há frame desenhado entre as tentativas).
 */
function peninsulaCamera(map: MLMap, mode: '2d' | '3d', fit: number): CameraState {
  const narrow = map.getContainer().clientWidth < 640
  const base = map.cameraForBounds(IBERIA_BOUNDS as LngLatBoundsLike, { padding: 12, bearing: 0, pitch: 0 })
  const c = base?.center ? maplibregl.LngLat.convert(base.center) : new maplibregl.LngLat(-3.1, 39.9)
  let cam: CameraState = { center: [c.lng, c.lat], zoom: base?.zoom ?? fit, pitch: 0, bearing: 0 }
  if (mode === '2d') return cam
  cam = { ...cam, pitch: narrow ? CAMERA.pitch3dNarrow : CAMERA.pitch3d, bearing: CAMERA.bearing3d }
  const saved = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() }
  const pp = map.getPadding()
  const pad = { left: pp.left ?? 0, right: pp.right ?? 0, top: pp.top ?? 0, bottom: pp.bottom ?? 0 }
  const W = map.getContainer().clientWidth
  const H = map.getContainer().clientHeight
  const availW = Math.max(80, W - pad.left - pad.right - 24)
  const availH = Math.max(80, H - pad.top - pad.bottom - 24)
  for (let i = 0; i < 8; i++) {
    map.jumpTo(cam)
    const ps = PENINSULA_EXTREMES.map((p) => map.project(p))
    const minX = Math.min(...ps.map((p) => p.x)), maxX = Math.max(...ps.map((p) => p.x))
    const minY = Math.min(...ps.map((p) => p.y)), maxY = Math.max(...ps.map((p) => p.y))
    const k = Math.min(availW / (maxX - minX), availH / (maxY - minY))
    const mid = map.unproject([(minX + maxX) / 2, (minY + maxY) / 2])
    const done = Math.abs(Math.log2(k)) < 0.03
    cam = { ...cam, center: [mid.lng, mid.lat], zoom: cam.zoom + Math.log2(k) * 0.9 }
    if (done) break
  }
  map.jumpTo(saved)
  return cam
}

export function AtlasMap({
  mode,
  initialCamera,
  selection,
  favoriteIds,
  filters,
  catalog,
  zones,
  padding,
  attribution,
  onPick,
  onView,
  onStatus,
  onInteract,
  onUserCamera,
  onMapClick,
  onLongPress,
  handle,
  className,
}: {
  mode: '2d' | '3d'
  initialCamera?: CameraState
  selection: AtlasSelection | null
  favoriteIds: string[]
  filters: AtlasFilters
  catalog: FeatureCollection
  zones: FeatureCollection
  padding: Padding
  attribution: 'bottom-right' | 'bottom-left'
  onPick: (picks: AtlasPick[], at: [number, number]) => void
  onView: (v: ViewInfo) => void
  onStatus: (s: AtlasStatus) => void
  onInteract?: () => void
  /** Gesto do utilizador na câmara (pinça, roda, duplo toque, teclado, arrasto, rotação, inclinação). Nunca para movimentos programáticos. */
  onUserCamera?: (kind: 'zoom' | 'drag' | 'rotate' | 'pitch') => void
  /** Chamado antes da escolha de águas/rios: devolve true se o toque foi tratado (pins, colocação). */
  onMapClick?: (e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number }; touch: boolean }) => boolean
  /** Toque prolongado (ou botão direito): atalho opcional para marcar um pin naquele ponto. */
  onLongPress?: (lngLat: { lng: number; lat: number }) => void
  handle: Ref<AtlasMapHandle>
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const fitRef = useRef(5)
  const modeRef = useRef(mode)
  const paddingRef = useRef(padding)
  const readyRef = useRef(false)
  const statusRef = useRef<AtlasStatus>({ map: 'loading', dem: ATLAS_CONFIG.dem.enabled ? 'loading' : 'off', basemap: 'ok', water: 'ok', detailLoading: false })
  const cb = useRef({ onPick, onView, onStatus, onInteract, onUserCamera, onMapClick, onLongPress })
  useEffect(() => {
    cb.current = { onPick, onView, onStatus, onInteract, onUserCamera, onMapClick, onLongPress }
    modeRef.current = mode
    paddingRef.current = padding
  })
  const baseFilters = useRef(new Map<string, FilterSpecification | undefined>())
  const updateTerrainRef = useRef<() => void>(() => {})
  const ctrlsRef = useRef<{ attrib: maplibregl.AttributionControl; scale: maplibregl.ScaleControl } | null>(null)
  const dataRef = useRef({ catalog, zones })
  useEffect(() => {
    dataRef.current = { catalog, zones }
  })

  const setStatus = (p: Partial<AtlasStatus>) => {
    const next = { ...statusRef.current, ...p }
    if (Object.entries(p).every(([k, v]) => statusRef.current[k as keyof AtlasStatus] === v)) return
    statusRef.current = next
    cb.current.onStatus(next)
  }

  // ---------- filtros, favoritas e seleção (aplicados sem recriar o mapa) ----------
  // ---------- filtros, favoritas e seleção (sem recriar o mapa) ----------
  const stateRef = useRef({ selection, favoriteIds, filters })
  const applyAll = () => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const { selection: sel, favoriteIds: favs, filters: f } = stateRef.current
    const typeOn = (t: AtlasType) => !f.types.length || f.types.includes(t)
    const vis = (ids: string[], on: boolean) =>
      ids.forEach((l) => {
        if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none')
      })
    vis(WATER_LAYERS, typeOn('albufeira'))
    vis(RIVER_DRAW, typeOn('rio'))
    vis(STRUCT_DRAW, typeOn('barragem') || typeOn('acude'))
    vis(['cat-point', 'cat-cluster', 'cat-cluster-count'], typeOn('albufeira'))
    const both = !f.countries.length || f.countries.length >= 2
    const country = (prop: string): FilterSpecification | null => (both ? null : ['in', f.countries[0], ['coalesce', ['get', prop], '']])
    const fav = (prop: string): FilterSpecification | null => (f.favOnly ? ['in', ['get', prop], ['literal', favs]] : null)
    const combine = (layer: string, extra: (FilterSpecification | null)[]) => {
      if (!map.getLayer(layer)) return
      const base = baseFilters.current.get(layer)
      const parts = [base, ...extra].filter(Boolean) as FilterSpecification[]
      map.setFilter(layer, parts.length ? (parts.length === 1 ? parts[0] : (['all', ...parts] as FilterSpecification)) : null)
    }
    for (const l of WATER_LAYERS) combine(l, [country('countries'), fav('id')])
    for (const l of RIVER_DRAW) combine(l, [country('countries'), fav('river')])
    for (const l of STRUCT_DRAW) combine(l, [f.favOnly ? (['==', ['get', 'id'], '__none__'] as FilterSpecification) : null])
    for (const l of ['cat-point', 'cat-cluster', 'cat-cluster-count']) combine(l, l === 'cat-point' ? [country('country'), f.favOnly ? ['boolean', ['get', 'fav'], false] : null] : [])

    // Favoritas (contorno dourado).
    const favF: FilterSpecification = ['all', ['==', ['get', 'kind'], 'area'], ['in', ['get', 'id'], ['literal', favs]]]
    for (const l of ['fav-line-ov', 'fav-line-dt']) if (map.getLayer(l)) map.setFilter(l, favF)

    // Seleção.
    const none = '__none__'
    const wid = sel && (sel.kind === 'water' || sel.kind === 'structure' || sel.kind === 'unknown') ? sel.mapId : none
    const area: FilterSpecification = ['all', ['==', ['get', 'kind'], 'area'], ['==', ['get', 'id'], sel?.kind === 'water' || sel?.kind === 'unknown' ? wid : none]]
    for (const l of ['sel-halo-ov', 'sel-halo-dt', 'sel-fill-ov', 'sel-fill-dt', 'sel-line-ov', 'sel-line-dt']) if (map.getLayer(l)) map.setFilter(l, area)
    map.setFilter('st-sel', ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'id'], sel?.kind === 'structure' || sel?.kind === 'unknown' ? wid : none]])
    map.setFilter('river-sel', ['==', ['get', 'river'], sel?.kind === 'river' ? sel.mapId : none])
    map.setFilter('river-sel-section', ['==', ['get', 'id'], sel?.kind === 'river' && sel.sectionId ? sel.sectionId : none])
    map.setFilter('cat-sel', ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], sel?.kind === 'catalog' ? sel.id : none]])
  }


  // ---------- criação do mapa (uma vez; filtros e seleção não recriam o mapa) ----------
  useEffect(() => {
    const el = box.current
    if (!el) return
    if (ATLAS_CONFIG.dem.enabled)
      registerDemProtocol(ATLAS_CONFIG.dem.tiles, ATLAS_CONFIG.dem.encoding, (ok) => demResult(ok))
    let map: MLMap
    try {
      map = new maplibregl.Map({
        container: el,
        style: buildAtlasStyle(window.location.origin, { dem: ATLAS_CONFIG.dem.enabled }),
        bounds: IBERIA_BOUNDS as LngLatBoundsLike,
        fitBoundsOptions: { padding: 16 },
        maxBounds: [-34, 22, 20, 55],
        minZoom: CAMERA.minZoom,
        maxZoom: CAMERA.maxZoom,
        maxPitch: modeRef.current === '3d' ? CAMERA.maxPitch : 0,
        renderWorldCopies: false,
        attributionControl: false,
        pixelRatio: pixelRatio(),
        maxTileCacheSize: 160,
        cancelPendingTileRequestsWhileZooming: true,
        reduceMotion: prefersReducedMotion(),
        fadeDuration: 180,
        canvasContextAttributes: { antialias: true },
      })
    } catch {
      const t = window.setTimeout(() => setStatus({ map: 'webgl-error' }))
      return () => window.clearTimeout(t)
    }
    mapRef.current = map
    const ctrls = { attrib: new maplibregl.AttributionControl({ compact: true }), scale: new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 96 }) }
    ctrlsRef.current = ctrls
    map.addControl(ctrls.attrib, attribution)
    map.addControl(ctrls.scale, attribution)
    map.touchZoomRotate.enableRotation()
    map.keyboard.enable()

    // Câmara inicial (o padding reserva o espaço dos painéis: a Península fica na área livre).
    map.setPadding(paddingRef.current)
    fitRef.current = peninsulaFit(map)
    map.jumpTo(initialCamera ?? peninsulaCamera(map, modeRef.current, fitRef.current))
    let interacted = !!initialCamera

    // ---------- relevo (DEM) ----------
    let demOk = 0
    let demFail = 0
    function demResult(ok: boolean) {
      if (ok) demOk++
      else demFail++
      if (ok && statusRef.current.dem === 'loading') setStatus({ dem: 'ok' })
      // Falha persistente (sem nenhum tile válido): o atlas continua em 2D com a cartografia.
      if (!ok && demFail >= 3 && demOk === 0 && statusRef.current.dem !== 'failed') disableDem()
    }
    const disableDem = () => {
      setStatus({ dem: 'failed' })
      if (!mapRef.current) return
      const m = mapRef.current
      if (m.getTerrain()) m.setTerrain(null)
      for (const l of DEM_LAYERS) if (m.getLayer(l)) m.setLayoutProperty(l, 'visibility', 'none')
    }

    // ---------- laje (camada personalizada) ----------
    let slabAdded = false
    const slabState = () => {
      const z = map.getZoom()
      if (modeRef.current !== '3d') return { depthM: 0, opacity: 0 }
      const p = map.getPitch()
      const pitchFactor = Math.min(1, Math.max(0, (p - 4) / 14))
      return { depthM: slabDepthM(z, fitRef.current), opacity: wallOpacity(z, fitRef.current) * pitchFactor }
    }
    let slabLayer: ReturnType<typeof createSlabLayer> | null = null
    const addSlab = () => {
      if (!slabLayer || slabAdded || !map.getLayer(SLAB_WALLS_BEFORE)) return
      map.addLayer(slabLayer, SLAB_WALLS_BEFORE)
      slabAdded = true
    }
    fetch('/map/atlas/slab.geojson')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((fc: FeatureCollection) => {
        const f = fc.features.find((x) => x.properties?.kind === 'slab')
        if (!f || f.geometry.type !== 'Polygon') return
        const eps = 1e-6
        const isCut = (a: LngLat, b: LngLat) =>
          (Math.abs(a[1] - SLAB_BOX[3]) < eps && Math.abs(b[1] - SLAB_BOX[3]) < eps) || (Math.abs(a[0] - SLAB_BOX[2]) < eps && Math.abs(b[0] - SLAB_BOX[2]) < eps)
        const mesh = buildSlabMesh(f.geometry.coordinates as LngLat[][], isCut)
        slabLayer = createSlabLayer(mesh, slabState, { top: ATLAS_COLORS.wallTop, bottom: ATLAS_COLORS.wallBottom, cut: ATLAS_COLORS.wallCut })
        if (readyRef.current) addSlab()
        map.triggerRepaint()
      })
      .catch(() => {
        /* sem laje: o mapa continua plano e utilizável */
      })

    // ---------- terreno local (só no modo 3D, depois das paredes) ----------
    let terrainOn = false
    let lastExag = 0
    const updateTerrain = () => {
      if (!readyRef.current || !map.getSource('dem-terrain') || statusRef.current.dem === 'failed') return
      const z = map.getZoom()
      const fit = fitRef.current
      const want = modeRef.current === '3d' && (terrainOn ? z >= fit + ATLAS_ZOOM.terrainOff : z >= fit + ATLAS_ZOOM.terrainOn)
      if (!want) {
        if (terrainOn) {
          map.setTerrain(null)
          terrainOn = false
          lastExag = 0
        }
        return
      }
      const ex = Math.max(0.02, terrainExaggeration(z, fit))
      if (!terrainOn || Math.abs(ex - lastExag) > 0.04) {
        map.setTerrain({ source: 'dem-terrain', exaggeration: ex })
        terrainOn = true
        lastExag = ex
      }
    }

    // ---------- blocos de dados (área visível) ----------
    const loaders = [
      makeChunkLoader(map, '/map/water', 'water-detail', () => fitRef.current + DETAIL_PREFETCH_OFFSET, { maxChunks: 40 }),
      makeChunkLoader(map, '/map/structures', 'structures', () => fitRef.current + STRUCTURE_OFFSET.prefetch, { maxChunks: 24 }),
    ]
    const loadVisible = async () => {
      if (!readyRef.current) return
      setStatus({ detailLoading: true })
      const failed = (await Promise.all(loaders.map((l) => l.loadVisible()))).some((ok) => !ok)
      setStatus({ detailLoading: loaders.some((l) => l.busy()), ...(failed ? { water: 'failed' as const } : {}) })
    }

    const markInteraction = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return
      if (!interacted) cb.current.onInteract?.()
      interacted = true
    }
    map.on('dragstart', markInteraction)
    map.on('zoomstart', markInteraction)
    map.on('rotatestart', markInteraction)
    // Só eventos com originalEvent (gesto real): flyTo, ajustes de padding e dados não mexem na interface.
    for (const kind of ['zoom', 'drag', 'rotate', 'pitch'] as const)
      map.on(`${kind}start`, (e: { originalEvent?: unknown }) => {
        if (e.originalEvent) cb.current.onUserCamera?.(kind)
      })
    // A roda do rato aproxima por animação sem originalEvent no «zoomstart»: o próprio evento «wheel» é o gesto.
    map.on('wheel', () => cb.current.onUserCamera?.('zoom'))

    map.on('error', (e) => {
      const src = (e as unknown as { sourceId?: string }).sourceId
      if (import.meta.env.DEV) console.warn('[atlas]', src ?? '', e.error?.message ?? e)
      if (src === 'omt' && statusRef.current.basemap !== 'failed') {
        setStatus({ basemap: 'failed' })
        for (const l of OMT_LAYERS) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', 'none')
        if (map.getLayer('ne-place')) map.setLayoutProperty('ne-place', 'visibility', 'visible')
      }
    })

    const timeout = window.setTimeout(() => {
      if (!map.loaded() && !readyRef.current) setStatus({ water: 'failed' })
    }, 20000)

    map.on('load', async () => {
      window.clearTimeout(timeout)
      for (const l of [...WATER_LAYERS, ...RIVER_DRAW, ...STRUCT_DRAW, 'cat-point', 'cat-cluster', 'cat-cluster-count']) baseFilters.current.set(l, map.getFilter(l) ?? undefined)
      applyAtlasZoomPolicy(map, fitRef.current)
      addSlab()
      ;(map.getSource('catalog') as GeoJSONSource).setData(dataRef.current.catalog)
      ;(map.getSource('zones') as GeoJSONSource).setData(dataRef.current.zones)
      map.setSky({ 'sky-color': ATLAS_COLORS.oceanDeep, 'horizon-color': '#123a4a', 'fog-color': ATLAS_COLORS.ocean, 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.25, 'atmosphere-blend': 0 })
      readyRef.current = true
      // Atribuição compacta e recolhida (o botão "i" abre-a; as fontes completas estão no painel Fontes).
      el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      applyAll()
      try {
        const [idx, ov] = await Promise.all([
          fetch('/map/water/index.json').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
          fetch('/map/water/overview.geojson').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        ])
        loaders[0].setIndex(idx as ChunkIndex)
        ;(map.getSource('water-overview') as GeoJSONSource).setData(ov)
      } catch {
        setStatus({ water: 'failed' })
      }
      setStatus({ map: 'ready' })
      loadVisible()
      updateTerrain()
      emitView()
    })

    // Diagnóstico de desempenho: frames desenhados durante cada movimento.
    let frames = 0
    let moveStart = 0
    map.on('movestart', () => {
      frames = 0
      moveStart = performance.now()
    })
    map.on('render', () => {
      frames++
    })
    const emitView = () => {
      const c = map.getCenter()
      const b = map.getBounds()
      cb.current.onView({ center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], fit: fitRef.current })
    }
    updateTerrainRef.current = updateTerrain
    map.on('zoom', updateTerrain)
    map.on('moveend', () => {
      const secs = (performance.now() - moveStart) / 1000
      if (secs > 0.25 && el.parentElement) el.parentElement.dataset.fps = String(Math.round(frames / secs))
      if (!readyRef.current) return
      loadVisible()
      emitView()
    })

    // Estado observável (testes e diagnóstico).
    map.on('idle', () => {
      const wrap = el.parentElement
      if (!wrap) return
      const z = map.getZoom()
      const active = (l: string) => {
        const ly = map.getLayer(l)
        return !!ly && z >= (ly.minzoom ?? 0) && z < (ly.maxzoom ?? 24) && map.getLayoutProperty(l, 'visibility') !== 'none'
      }
      const s = slabState()
      const drawn = map.queryRenderedFeatures({ layers: ATLAS_FILL_LAYERS.filter(active) })
      const ids = new Set(drawn.map((f) => String(f.properties.id)))
      const labels = map.queryRenderedFeatures({ layers: ATLAS_LABEL_LAYERS.filter(active) })
      const proj = (f: MapGeoJSONFeature) => {
        const px = map.project((f.geometry as unknown as { coordinates: [number, number] }).coordinates)
        return { x: Math.round(px.x), y: Math.round(px.y) }
      }
      Object.assign(wrap.dataset, {
        zoom: z.toFixed(2),
        fit: fitRef.current.toFixed(2),
        pitch: map.getPitch().toFixed(1),
        bearing: map.getBearing().toFixed(1),
        walls: s.opacity.toFixed(2),
        depth: Math.round(s.depthM).toString(),
        terrain: String(map.getTerrain()?.exaggeration ?? 0),
        slab: String(slabAdded),
        waterCount: String(ids.size),
        labels: labels.map((f) => String(f.properties.short)).slice(0, 40).join('|'),
        probes: JSON.stringify(labels.slice(0, 12).map((f) => ({ id: String(f.properties.id), name: String(f.properties.short), catalog: String(f.properties.catalog || ''), ...proj(f) }))),
        chunks: String(loaders[0].count()),
        sel: stateRef.current.selection?.mapId ?? '',
        basemap: statusRef.current.basemap,
        dem: statusRef.current.dem,
      })
    })

    // ---------- toque/clique ----------
    const box4 = (pt: maplibregl.Point, pad: number): [[number, number], [number, number]] => [[pt.x - pad, pt.y - pad], [pt.x + pad, pt.y + pad]]
    const q = (pt: maplibregl.Point, pad: number, layers: string[]) => {
      const ls = layers.filter((l) => map.getLayer(l) && map.getLayoutProperty(l, 'visibility') !== 'none')
      return ls.length ? map.queryRenderedFeatures(pad ? box4(pt, pad) : pt, { layers: ls }) : []
    }
    map.on('mousemove', (e) => {
      const any = q(e.point, 3, [...STRUCT_LAYERS, 'zone-dot', 'cat-point', 'cat-cluster', ...ATLAS_FILL_LAYERS, 'river-line', 'omt-water']).length > 0
      map.getCanvas().style.cursor = any ? 'pointer' : ''
    })
    // Toque prolongado: atalho opcional (arrastar o mapa nunca cria nada).
    let press: number | undefined
    const cancelPress = () => window.clearTimeout(press)
    map.on('touchstart', (e) => {
      cancelPress()
      if (e.originalEvent.touches.length !== 1 || !cb.current.onLongPress) return
      const at = { lng: e.lngLat.lng, lat: e.lngLat.lat }
      press = window.setTimeout(() => cb.current.onLongPress?.(at), 650)
    })
    map.on('touchend', cancelPress)
    map.on('touchcancel', cancelPress)
    map.on('touchmove', cancelPress)
    map.on('movestart', cancelPress)
    map.on('contextmenu', (e) => cb.current.onLongPress?.({ lng: e.lngLat.lng, lat: e.lngLat.lat }))
    map.on('click', async (e) => {
      const touch = (e.originalEvent as PointerEvent).pointerType === 'touch'
      if (cb.current.onMapClick?.({ point: { x: e.point.x, y: e.point.y }, lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat }, touch })) return
      const pad = touch ? 14 : 5
      const at: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      const cluster = q(e.point, pad, ['cat-cluster'])[0]
      if (cluster) {
        const src = map.getSource('catalog') as GeoJSONSource
        const z = await src.getClusterExpansionZoom(Number(cluster.properties.cluster_id))
        map.easeTo({ center: (cluster.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom: z + 0.2, duration: dur(600) })
        return
      }
      const picks: AtlasPick[] = []
      const seen = new Set<string>()
      const add = (p: AtlasPick) => {
        const k = `${p.kind === 'catalog' ? 'water' : p.kind}:${p.mapId}`
        if (seen.has(k) || seen.has(`catalog:${p.mapId}`)) return
        seen.add(k)
        picks.push(p)
      }
      // Marcas das fichas (o ID é o do registo: albufeira ligada ou ficha sem contorno).
      for (const f of q(e.point, pad + 2, ['cat-point'])) add({ kind: f.properties.water ? 'water' : 'catalog', mapId: String(f.properties.water || f.properties.id), name: String(f.properties.name), props: f.properties })
      // Estruturas: as formas não guardam todas as propriedades, o ponto da mesma estrutura sim.
      for (const f of q(e.point, pad, STRUCT_LAYERS)) {
        const id = String(f.properties.id)
        const full = (map.querySourceFeatures('structures', { filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'id'], id]] })[0]?.properties ?? f.properties) as Record<string, unknown>
        add({ kind: 'structure', mapId: id, name: String(full.name ?? ''), props: full })
      }
      // Massas de água: a mais pequena primeiro (uma albufeira dentro de outra continua tocável).
      const exact = q(e.point, 0, ATLAS_FILL_LAYERS)
      const waters = (exact.length ? exact : q(e.point, pad, ATLAS_FILL_LAYERS)).sort((a, b) => Number(a.properties.area_km2) - Number(b.properties.area_km2))
      for (const f of waters) add({ kind: 'water', mapId: String(f.properties.id), name: String(f.properties.name || f.properties.dam || ''), props: f.properties })
      for (const f of q(e.point, pad + 2, ['zone-dot'])) add({ kind: 'water', mapId: String(f.properties.water), name: '', props: f.properties })
      // Rios: só quando o toque não está dentro de uma massa de água (o traçado atravessa as albufeiras).
      if (!exact.length)
        for (const f of q(e.point, pad, ['river-line'])) add({ kind: 'river', mapId: String(f.properties.river), sectionId: String(f.properties.id), name: String(f.properties.name), props: f.properties })
      // Água do mapa base (sem ficha nem ID estável): só se nada mais foi tocado.
      if (!picks.length) {
        const bw = q(e.point, pad, ['omt-water'])[0]
        if (bw) add({ kind: 'basemap-water', mapId: `omt:${bw.id ?? `${at[0].toFixed(4)},${at[1].toFixed(4)}`}`, name: String(bw.properties['name:pt'] ?? bw.properties.name ?? ''), props: bw.properties })
        else {
          const br = q(e.point, pad, ['omt-river', 'omt-stream'])[0]
          if (br) add({ kind: 'basemap-river', mapId: `omt:${br.id ?? `${at[0].toFixed(4)},${at[1].toFixed(4)}`}`, name: String(br.properties['name:pt'] ?? br.properties.name ?? ''), props: br.properties })
        }
      }
      cb.current.onPick(picks, at)
    })

    // ---------- perda do contexto WebGL ----------
    map.on('webglcontextlost', () => setStatus({ map: 'context-lost' }))
    map.on('webglcontextrestored', () => {
      if (slabLayer && map.getLayer(slabLayer.id)) {
        map.removeLayer(slabLayer.id)
        slabAdded = false
        addSlab()
      }
      setStatus({ map: 'ready' })
    })

    // Redimensionamento: recalcula o enquadramento de referência e os limiares.
    const ro = new ResizeObserver(() => {
      map.resize()
      const fit = peninsulaFit(map)
      if (Math.abs(fit - fitRef.current) < 0.02) return
      fitRef.current = fit
      if (readyRef.current) applyAtlasZoomPolicy(map, fit)
      if (!interacted) map.jumpTo(peninsulaCamera(map, modeRef.current, fit))
    })
    ro.observe(el)
    ;(el as HTMLDivElement & { __map?: MLMap }).__map = map
    return () => {
      ro.disconnect()
      window.clearTimeout(timeout)
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // O mapa é criado uma única vez; as props seguintes são aplicadas pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    stateRef.current = { selection, favoriteIds, filters }
    applyAll()
  }, [selection, favoriteIds, filters])


  // Painéis (lateral ou inferior): o centro visual do mapa acompanha a área livre.
  const padKey = `${padding.top},${padding.right},${padding.bottom},${padding.left}`
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    map.easeTo({ padding: paddingRef.current, duration: dur(300) })
  }, [padKey])

  // Canto da atribuição e da escala (muda entre telemóvel e computador sem recriar o mapa).
  const firstCorner = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    const c = ctrlsRef.current
    if (firstCorner.current) {
      firstCorner.current = false
      return
    }
    if (!map || !c) return
    map.removeControl(c.attrib)
    map.removeControl(c.scale)
    map.addControl(c.attrib, attribution)
    map.addControl(c.scale, attribution)
  }, [attribution])

  // Dados das fichas e zonas.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    ;(map.getSource('catalog') as GeoJSONSource | undefined)?.setData(catalog)
  }, [catalog])

  // Modo 2D / 3D.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (mode === '2d') {
      map.setMaxPitch(0)
      map.easeTo({ pitch: 0, duration: dur(500) })
      if (readyRef.current && map.getTerrain()) map.setTerrain(null)
    } else {
      map.setMaxPitch(CAMERA.maxPitch)
      if (map.getPitch() < 5) map.easeTo({ pitch: map.getContainer().clientWidth < 640 ? CAMERA.pitch3dNarrow : CAMERA.pitch3d, duration: dur(600) })
    }
    map.triggerRepaint()
    updateTerrainRef.current()
  }, [mode])

  useImperativeHandle(handle, (): AtlasMapHandle => ({
    peninsula: () => {
      const map = mapRef.current
      if (!map) return
      const cam = peninsulaCamera(map, modeRef.current, fitRef.current)
      map.flyTo({ ...cam, duration: dur(1100), essential: false })
    },
    north: () => mapRef.current?.easeTo({ bearing: 0, duration: dur(400) }),
    rotateBy: (d) => mapRef.current && mapRef.current.easeTo({ bearing: mapRef.current.getBearing() + d, duration: dur(300) }),
    tiltBy: (d) => mapRef.current && mapRef.current.easeTo({ pitch: Math.max(0, Math.min(CAMERA.maxPitch, mapRef.current.getPitch() + d)), duration: dur(300) }),
    zoomBy: (d) => mapRef.current && mapRef.current.easeTo({ zoom: mapRef.current.getZoom() + d, duration: dur(300) }),
    frame: (t) => {
      const map = mapRef.current
      if (!map) return
      const fit = fitRef.current
      const pad = paddingRef.current
      const padding = { top: pad.top + 40, right: pad.right + 40, bottom: pad.bottom + 40, left: pad.left + 40 }
      const b: LngLatBoundsLike = [t.bbox[0], t.bbox[1], t.bbox[2], t.bbox[3]]
      const cam = map.cameraForBounds(b, { padding, absolutePadding: true, maxZoom: 14.5 })
      if (!cam) return
      // Zoom mínimo para o elemento estar realmente desenhado (a geometria aparece por escalão).
      const tier = t.tier ?? 5
      const minVisible =
        t.kind === 'water' ? fit + (tier <= 2 ? DETAIL_FROM_OFFSET : TIER_ZOOM_OFFSET[tier]) + FADE + 0.3 : t.kind === 'structure' ? fit + STRUCTURE_OFFSET.damPoint + 0.9 : t.kind === 'river' ? fit + 0.8 : fit + 3
      map.easeTo({ center: cam.center, zoom: Math.min(15, Math.max(cam.zoom ?? 8, minVisible)), padding, duration: dur(900) })
    },
    showMe: (pos) => {
      const map = mapRef.current
      if (!map) return
      ;(map.getSource('me') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: pos ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] } }] : [] })
      if (pos) map.easeTo({ center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), fitRef.current + 3.2), duration: dur(900) })
    },
    getMap: () => mapRef.current,
    getView: () => {
      const map = mapRef.current
      if (!map) return null
      const c = map.getCenter()
      const b = map.getBounds()
      return { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], fit: fitRef.current }
    },
  }))

  return (
    <div className={className} data-atlas-map data-mode={mode}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} role="region" aria-label="Mapa 3D da Península Ibérica com albufeiras, rios e barragens. Use a lista de resultados como alternativa." data-no-swipe />
    </div>
  )
}
