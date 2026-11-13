/**
 * Catálogo «Carpa» na app: carregamento (o mesmo ficheiro para o mapa e para a pesquisa), índices, pesquisa,
 * camadas do mapa (agrupamento ao longe, locais individuais ao perto) e estado por data/modalidade.
 */
import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { CARP_CATALOG_URL, classify, type Activity, type CarpCatalog, type CarpSector, type CarpWater, type LngLat, type PermissionState } from '../../lib/carpa/model'

export interface CarpIndex {
  cat: CarpCatalog
  water: Map<string, CarpWater>
  sector: Map<string, CarpSector>
  sectorsOf: Map<string, CarpSector[]>
}
let cache: Promise<CarpIndex> | null = null
export function loadCarp(): Promise<CarpIndex> {
  cache ??= fetch(CARP_CATALOG_URL, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<CarpCatalog>) : Promise.reject(new Error(`catálogo: HTTP ${r.status}`))))
    .then((cat) => {
      const sectorsOf = new Map<string, CarpSector[]>()
      for (const s of cat.sectors) sectorsOf.set(s.waterKey, [...(sectorsOf.get(s.waterKey) ?? []), s])
      return { cat, water: new Map(cat.waters.map((w) => [w.key, w])), sector: new Map(cat.sectors.map((s) => [s.key, s])), sectorsOf }
    })
  cache.catch(() => (cache = null))
  return cache
}
export function useCarp(enabled: boolean) {
  const [st, setSt] = useState<{ idx: CarpIndex | null; error: boolean }>({ idx: null, error: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled || st.idx) return
    let alive = true
    loadCarp().then(
      (idx) => alive && setSt({ idx, error: false }),
      () => alive && setSt({ idx: null, error: true }),
    )
    return () => {
      alive = false
    }
  }, [enabled, st.idx, attempt])
  return { ...st, retry: () => setAttempt((n) => n + 1) }
}

/** Ponto que representa o setor no mapa (extremo A, ponto do setor, ou ponto geral da água). */
export function anchorOf(idx: CarpIndex, s: CarpSector): LngLat | null {
  return s.a ?? s.point ?? idx.water.get(s.waterKey)?.point ?? null
}
export function bboxOf(idx: CarpIndex, s: CarpSector): [number, number, number, number] | null {
  const pts = [s.a, s.b, s.point].filter(Boolean) as LngLat[]
  if (!pts.length) {
    const p = idx.water.get(s.waterKey)?.point
    if (p) pts.push(p)
  }
  if (!pts.length) return null
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

export const stateOf = (idx: CarpIndex, s: CarpSector, date: string, activity: Activity): PermissionState => classify(idx.cat, s.waterKey, s, date, activity).permission.state

// ------------------------------------------------------------------ pesquisa (água ou setor; PT/ES; sem acentos)
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export interface CarpFilter {
  country: 'PT' | 'ES' | null
  type: string | null
  state: PermissionState | null
}
export function searchCarp(idx: CarpIndex, q: string, f: CarpFilter, date: string, activity: Activity, limit = 40): CarpSector[] {
  const t = norm(q.trim())
  const out: CarpSector[] = []
  for (const s of idx.cat.sectors) {
    const w = idx.water.get(s.waterKey)
    if (!w) continue
    if (f.country && w.country !== f.country) continue
    if (f.type && w.type !== f.type) continue
    if (t.length >= 2 && ![w.name, w.original, ...w.variants, s.name, s.original, w.province ?? ''].some((x) => norm(x).includes(t))) continue
    if (f.state && stateOf(idx, s, date, activity) !== f.state) continue
    out.push(s)
    if (out.length >= limit) break
  }
  return out
}

// ------------------------------------------------------------------ camadas
export const CARP_SRC = 'carpa-src'
export const CARP_SEL = 'carpa-sel'
export const CARP_LAYERS = ['carpa-cluster', 'carpa-cluster-n', 'carpa-pt', 'carpa-glyph']
export const STATE_COLOR: Record<PermissionState, string> = { permitida: '#3fbf7f', proibida: '#e5484d', 'por-confirmar': '#f2b544' }
/** Texto além da cor (lê-se sem distinguir cores). */
export const STATE_GLYPH: Record<PermissionState, string> = { permitida: '+', proibida: '×', 'por-confirmar': '?' }

export function carpFeatures(idx: CarpIndex, date: string, activity: Activity): FeatureCollection {
  const feats: FeatureCollection['features'] = []
  for (const s of idx.cat.sectors) {
    const st = stateOf(idx, s, date, activity)
    const props = (role: string, label: string) => ({ key: s.key, state: st, role, label })
    // Extremos A/B: os limites conhecidos do setor, sem traçar um percurso de margem que a fonte não dá.
    if (s.a) feats.push({ type: 'Feature', properties: props('a', 'A'), geometry: { type: 'Point', coordinates: s.a } })
    if (s.b) feats.push({ type: 'Feature', properties: props('b', 'B'), geometry: { type: 'Point', coordinates: s.b } })
    if (!s.a && !s.b) {
      const p = s.point ?? idx.water.get(s.waterKey)?.point
      if (p) feats.push({ type: 'Feature', properties: props(s.point ? 'setor' : 'agua', STATE_GLYPH[st]), geometry: { type: 'Point', coordinates: p } })
    }
  }
  return { type: 'FeatureCollection', features: feats }
}

export function ensureCarpLayers(map: MLMap) {
  if (map.getSource(CARP_SRC)) return
  // Por baixo dos pins pessoais: o local do Atlas nunca tapa um pin do pescador.
  const before = map.getLayer('lanca-my-cluster') ? 'lanca-my-cluster' : undefined
  map.addSource(CARP_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 42, clusterMaxZoom: 10 })
  map.addLayer({ id: 'carpa-cluster', type: 'circle', source: CARP_SRC, filter: ['has', 'point_count'], paint: { 'circle-color': '#5b4a1f', 'circle-stroke-color': '#e6c36a', 'circle-stroke-width': 2, 'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 24], 'circle-pitch-alignment': 'map' } }, before)
  map.addLayer({ id: 'carpa-cluster-n', type: 'symbol', source: CARP_SRC, filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': '#f7e7b8' } }, before)
  map.addLayer({
    id: 'carpa-pt', type: 'circle', source: CARP_SRC, filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['case', ['in', ['get', 'role'], ['literal', ['a', 'b']]], 9, 11],
      'circle-color': ['match', ['get', 'state'], 'permitida', STATE_COLOR.permitida, 'proibida', STATE_COLOR.proibida, STATE_COLOR['por-confirmar']],
      'circle-stroke-color': ['case', ['==', ['get', 'role'], 'agua'], '#f4f7f8', '#071923'],
      'circle-stroke-width': ['case', ['==', ['get', 'role'], 'agua'], 3, 2],
      // Ancorado à superfície (inclina com o terreno, em vez de flutuar virado para a câmara).
      'circle-pitch-alignment': 'map',
    },
  }, before)
  map.addLayer({ id: 'carpa-glyph', type: 'symbol', source: CARP_SRC, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-allow-overlap': true, 'text-pitch-alignment': 'map' }, paint: { 'text-color': '#071923' } }, before)
  map.addSource(CARP_SEL, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'carpa-sel-ring', type: 'circle', source: CARP_SEL, paint: { 'circle-radius': 18, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#e6c36a', 'circle-stroke-width': 3.5, 'circle-pitch-alignment': 'map' } }, before)
}
export function setCarpData(map: MLMap, fc: FeatureCollection, visible: boolean) {
  ;(map.getSource(CARP_SRC) as GeoJSONSource | undefined)?.setData(fc)
  for (const l of CARP_LAYERS) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', visible ? 'visible' : 'none')
}
export function setCarpSelected(map: MLMap, pts: LngLat[]) {
  ;(map.getSource(CARP_SEL) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })) })
}
