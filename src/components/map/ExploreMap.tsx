/**
 * Mapa do «Explorar barragens»: o MESMO motor cartográfico do Atlas (terreno DEM real, albufeiras, rios e
 * estruturas do Atlas Ibérico), com as fichas do catálogo filtradas pela lista. Substitui o antigo mapa plano
 * (IberiaMap) mantendo a mesma interface para o ecrã: seleção, «Ver no mapa», ?agua= e Portugal/Península.
 */
import type { FeatureCollection } from 'geojson'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AtlasMap, type AtlasMapHandle, type AtlasPick, type AtlasSelection, type AtlasStatus } from '../atlas/AtlasMap'
import { MapQuickControls } from '../atlas/MapQuickControls'
import catalogWater from '../../data/map/catalogWater.json'
import type { Dam } from '../../data/types'
import { ATLAS_CONFIG } from '../../lib/atlas/config'
import { memoryCamera, memoryMode, writeCamera } from '../../lib/atlas/cameraMemory'
import { atlasIdForCatalog, linkByCatalog, loadRegistry } from '../../lib/atlas/registry'
import { cx } from '../ui'

export type MapView = 'pt' | 'iberia'
const CATALOG_LABEL = catalogWater as unknown as Record<string, { waterId: string; label: [number, number] }>
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const NO_FILTERS = { countries: [], types: [], favOnly: false }
const PT_BBOX: [number, number, number, number] = [-9.6, 36.9, -6.1, 42.2]

export default function ExploreMap({ dams, selectedDamId, focus, focusWaterId, onSelectDam, view, onView, className, children }: {
  dams: Dam[]
  selectedDamId?: string
  focus?: { damId: string; n: number }
  focusWaterId?: string
  onSelectDam: (id: string | null) => void
  view: MapView
  onView: (v: MapView) => void
  className?: string
  children?: ReactNode
}) {
  const handle = useRef<AtlasMapHandle>(null)
  const [status, setStatus] = useState<AtlasStatus>({ map: 'loading', dem: ATLAS_CONFIG.dem.enabled ? 'loading' : 'off', basemap: 'ok', water: 'ok', detailLoading: false })
  const [mode, setMode] = useState<'2d' | '3d'>(() => memoryMode('3d'))
  const [initialCamera] = useState(() => (focusWaterId || focus ? undefined : memoryCamera()))
  const [waterSel, setWaterSel] = useState<string | null>(focusWaterId ?? null)
  const ready = status.map === 'ready'
  const effMode = status.dem === 'failed' ? '2d' : mode

  const catalog: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: dams.map((d) => {
        const w = CATALOG_LABEL[d.id]
        return { type: 'Feature' as const, properties: { id: atlasIdForCatalog(d.id), catalog: d.id, water: linkByCatalog.get(d.id)?.atlasId ?? '', name: d.name, country: d.country, fav: false }, geometry: { type: 'Point' as const, coordinates: w ? w.label : [d.approx.lon, d.approx.lat] } }
      }),
    }),
    [dams],
  )
  const selection: AtlasSelection | null = useMemo(() => {
    if (selectedDamId) {
      const water = linkByCatalog.get(selectedDamId)?.atlasId
      return water ? { id: water, kind: 'water', mapId: water } : { id: atlasIdForCatalog(selectedDamId), kind: 'catalog', mapId: atlasIdForCatalog(selectedDamId) }
    }
    return waterSel ? { id: waterSel, kind: 'unknown', mapId: waterSel } : null
  }, [selectedDamId, waterSel])

  // «Ver no mapa» de um cartão da lista.
  useEffect(() => {
    if (!ready || !focus) return
    const d = dams.find((x) => x.id === focus.damId)
    const w = CATALOG_LABEL[focus.damId]
    const p = w?.label ?? (d ? [d.approx.lon, d.approx.lat] : null)
    if (p) handle.current?.frame({ bbox: [p[0], p[1], p[0], p[1]], kind: 'point' })
    // Só reage a novos pedidos de enquadramento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n, ready])
  // Albufeira pedida pelo endereço (?agua=): enquadra a geometria real do Atlas.
  useEffect(() => {
    if (!ready || !focusWaterId) return
    let alive = true
    loadRegistry().then((reg) => {
      const f = reg.byId.get(focusWaterId)
      if (alive && f) handle.current?.frame({ bbox: f.bbox, kind: f.type === 'rio' ? 'river' : 'water', tier: f.tier })
    }, () => undefined)
    return () => {
      alive = false
    }
  }, [ready, focusWaterId])
  // Portugal / Península.
  const lastView = useRef(view)
  useEffect(() => {
    if (!ready || lastView.current === view) return
    lastView.current = view
    if (view === 'pt') handle.current?.frame({ bbox: PT_BBOX, kind: 'water' })
    else handle.current?.peninsula()
  }, [ready, view])

  const onPick = (picks: AtlasPick[]) => {
    const c = picks.find((p) => p.props.catalog)
    if (c) {
      setWaterSel(null)
      onSelectDam(String(c.props.catalog))
      return
    }
    const w = picks.find((p) => p.kind === 'water')
    setWaterSel(w?.mapId ?? null)
    onSelectDam(null)
  }

  return (
    <div className={cx('relative overflow-hidden rounded-[var(--radius-card)] bg-[#071923]', className)} data-explore-map data-map-status={status.map}>
      {status.map === 'webgl-error' ? (
        <p className="grid h-full place-items-center p-6 text-center text-[13px] text-[#b5c5cc]" role="alert">Este navegador não consegue mostrar o mapa (WebGL indisponível). A lista continua disponível.</p>
      ) : (
        <AtlasMap
          handle={handle}
          mode={effMode}
          initialCamera={initialCamera}
          selection={selection}
          favoriteIds={[]}
          filters={NO_FILTERS}
          catalog={catalog}
          zones={EMPTY}
          padding={{ top: 56, right: 64, bottom: 12, left: 12 }}
          attribution="bottom-left"
          onPick={onPick}
          onView={(v) => writeCamera(v, effMode)}
          onStatus={setStatus}
          className="absolute inset-0"
        />
      )}
      <div className="absolute left-2 top-2 z-10 flex overflow-hidden rounded-full border border-white/12 bg-[#0a2230]/92 shadow-lg" role="group" aria-label="Enquadramento">
        {(['pt', 'iberia'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => onView(v)} className={cx('min-h-11 px-3.5 text-[13px] font-extrabold', view === v ? 'bg-white text-[#071923]' : 'text-[#f4f7f8]')}>
            {v === 'pt' ? 'Portugal' : 'Península'}
          </button>
        ))}
      </div>
      <MapQuickControls handle={handle} mode={effMode} onMode={setMode} dem={status.dem} className="absolute right-2 top-2 z-10" />
      {status.dem === 'failed' && <p className="absolute bottom-10 left-2 z-10 rounded-full bg-amber-50 px-3 py-1 text-[11.5px] font-bold text-amber-900" role="status">Relevo indisponível: mapa em 2D</p>}
      {children}
    </div>
  )
}
