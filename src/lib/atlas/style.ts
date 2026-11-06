import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import { layerIds, OVERVIEW_TIERS, TIERS } from '../map/style'
import type { Tier } from '../map/waterConfig'
import { ATLAS_CONFIG } from './config'
import { DEM_PROTOCOL } from './dem'

/** Paleta do atlas (atlas natural, escuro). Terra e água distinguem-se pelo valor e pela tonalidade. */
export const ATLAS_COLORS = {
  ocean: '#0d2c3b',
  oceanDeep: '#071923',
  land: '#3b5446',
  landContext: '#1d3a3b',
  veil: 'rgba(7,25,35,0.46)',
  wallTop: '#3a5246',
  wallBottom: '#12201d',
  wallCut: '#56665b',
  water: '#38c9d5',
  waterBase: '#2aa7b4',
  river: '#2fb6c3',
  selection: '#83e5ef',
  favorite: '#e6b65a',
  text: '#f4f7f8',
  textMuted: '#b5c5cc',
  halo: 'rgba(7,25,35,0.85)',
  border: 'rgba(244,247,248,0.32)',
  region: 'rgba(181,197,204,0.20)',
  road: 'rgba(181,197,204,0.16)',
  wood: 'rgba(22,48,34,0.35)',
  structure: '#c9d6db',
  zone: '#e6b65a',
}
const C = ATLAS_COLORS

const WATER_ATTRIBUTION =
  'Albufeiras e estruturas: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contribuidores do OpenStreetMap</a> (ODbL), extração <a href="https://github.com/bquelhas/barragens" target="_blank" rel="noopener">bquelhas/barragens</a>'
const OMT_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> Dados <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contribuidores do OpenStreetMap</a>'
const NE_ATTRIBUTION = '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'
const nameLatin: ExpressionSpecification = ['coalesce', ['get', 'name:pt'], ['get', 'name:latin'], ['get', 'name']]
const LABEL_SIZE: Record<Tier, number> = { 1: 13.5, 2: 12.5, 3: 12, 4: 11.5, 5: 11 }

/** Camadas que dependem do mapa base OpenFreeMap (escondidas se ele falhar). */
export const OMT_LAYERS = ['omt-wood', 'omt-ocean', 'omt-water', 'omt-river', 'omt-stream', 'omt-region', 'omt-border', 'omt-road-major', 'omt-road-minor', 'omt-place', 'omt-water-name', 'omt-water-name-line']
export const DEM_LAYERS = ['dem-relief', 'dem-hillshade']
export const ATLAS_FILL_LAYERS = [...OVERVIEW_TIERS.map((t) => layerIds.fill('ov', t)), ...TIERS.map((t) => layerIds.fill('dt', t))]
export const ATLAS_LABEL_LAYERS = [...TIERS.map((t) => layerIds.label('dt', t)), ...OVERVIEW_TIERS.map((t) => layerIds.label('ov', t))]
export const STRUCT_LAYERS = ['st-dam-pt', 'st-weir-pt', 'st-dam-line', 'st-dam-fill', 'st-weir-line', 'st-weir-fill']
export const RIVER_LAYERS = ['river-line']
/** A camada personalizada das paredes entra imediatamente antes desta. */
export const SLAB_WALLS_BEFORE = 'omt-wood'
const empty = { type: 'FeatureCollection' as const, features: [] }

export function buildAtlasStyle(origin: string, opts: { dem: boolean }): StyleSpecification {
  const dem = opts.dem && ATLAS_CONFIG.dem.enabled
  const waterFill = (src: 'ov' | 'dt', t: Tier): LayerSpecification => ({
    id: layerIds.fill(src, t),
    type: 'fill',
    source: src === 'ov' ? 'water-overview' : 'water-detail',
    filter: ['all', ['==', ['get', 'kind'], 'area'], ['==', ['get', 'tier'], t]],
    paint: { 'fill-color': C.water, 'fill-outline-color': C.water, 'fill-antialias': true },
  })
  const waterLabel = (src: 'ov' | 'dt', t: Tier): LayerSpecification => ({
    id: layerIds.label(src, t),
    type: 'symbol',
    source: src === 'ov' ? 'water-overview' : 'water-detail',
    filter: ['all', ['==', ['get', 'kind'], 'label'], ['==', ['get', 'tier'], t], ['!=', ['get', 'short'], '']],
    layout: {
      'text-field': ['get', 'short'],
      'text-font': ['Noto Sans Italic'],
      'text-size': LABEL_SIZE[t],
      'text-max-width': 7,
      // Prioridade: seleção e favoritas (feature-state não serve no layout; ver setLabelPriority) e depois a área.
      'symbol-sort-key': ['-', 0, ['get', 'area_km2']],
      'text-padding': 3,
      'text-optional': true,
      ...(t >= 3 ? { 'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'] as ('center' | 'top' | 'bottom' | 'left' | 'right')[], 'text-radial-offset': 0.6 } : {}),
    },
    paint: { 'text-color': '#bff3f7', 'text-halo-color': C.halo, 'text-halo-width': 1.4, 'text-halo-blur': 0.4 },
  })

  const sources: StyleSpecification['sources'] = {
    base: { type: 'geojson', data: `${origin}/map/base.geojson`, attribution: NE_ATTRIBUTION, tolerance: 0.6 },
    slab: { type: 'geojson', data: `${origin}/map/atlas/slab.geojson`, tolerance: 0.3 },
    'atlas-rivers': { type: 'geojson', data: `${origin}/map/atlas/rivers.geojson`, attribution: `Rios: ${NE_ATTRIBUTION}`, tolerance: 0.5, promoteId: 'id' },
    omt: { type: 'vector', url: ATLAS_CONFIG.basemapTileJson, attribution: OMT_ATTRIBUTION },
    'water-overview': { type: 'geojson', data: empty, attribution: WATER_ATTRIBUTION, maxzoom: 11, promoteId: 'id' },
    'water-detail': { type: 'geojson', data: empty, attribution: WATER_ATTRIBUTION, maxzoom: 14, promoteId: 'id' },
    structures: { type: 'geojson', data: empty, maxzoom: 15 },
    catalog: { type: 'geojson', data: empty, cluster: true, clusterRadius: 36, clusterMaxZoom: 7 },
    zones: { type: 'geojson', data: empty },
    me: { type: 'geojson', data: empty },
  }
  if (dem) {
    const demSrc = { type: 'raster-dem' as const, tiles: [`${DEM_PROTOCOL}://{z}/{x}/{y}`], encoding: ATLAS_CONFIG.dem.encoding, tileSize: 256, maxzoom: ATLAS_CONFIG.dem.maxzoom, attribution: ATLAS_CONFIG.dem.attribution }
    sources['dem-shade'] = demSrc
    const { attribution: _omit, ...terrainSrc } = demSrc
    void _omit
    sources['dem-terrain'] = terrainSrc
  }

  const layers: LayerSpecification[] = [
    { id: 'bg', type: 'background', paint: { 'background-color': C.ocean } },
    // Terra fora da laje como base contínua (visível quando a peça dá lugar ao mapa local).
    { id: 'ctx-base', type: 'fill', source: 'slab', filter: ['in', ['get', 'kind'], ['literal', ['context', 'beyond']]], paint: { 'fill-color': C.land } },
    // Topo da laje (terra ibérica).
    { id: 'slab-top', type: 'fill', source: 'slab', filter: ['==', ['get', 'kind'], 'slab'], paint: { 'fill-color': C.land, 'fill-antialias': true } },
    ...(dem
      ? ([
          {
            id: 'dem-relief', type: 'color-relief', source: 'dem-shade',
            paint: {
              'color-relief-opacity': 0.9,
              // Tons minerais por altitude; 0 m transparente (o mar e o litoral mostram a cor de base).
              'color-relief-color': ['interpolate', ['linear'], ['elevation'],
                0, 'rgba(59,84,70,0)', 40, 'rgba(62,88,71,0.25)', 250, 'rgba(72,96,74,0.55)', 600, 'rgba(92,104,78,0.75)',
                1000, 'rgba(112,114,88,0.85)', 1600, 'rgba(140,134,108,0.9)', 2300, 'rgba(176,170,150,0.92)', 3200, 'rgba(214,210,198,0.95)'],
            },
          },
          {
            id: 'dem-hillshade', type: 'hillshade', source: 'dem-shade',
            paint: {
              'hillshade-method': 'multidirectional',
              'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 4, 0.55, 8, 0.45, 12, 0.35],
              'hillshade-shadow-color': ['rgba(4,14,18,0.55)'],
              'hillshade-highlight-color': ['rgba(236,232,214,0.16)'],
              'hillshade-accent-color': 'rgba(4,14,18,0.25)',
              'hillshade-illumination-direction': [315],
              'hillshade-illumination-altitude': [45],
            },
          },
        ] as LayerSpecification[])
      : []),
    // Vista geral: mar por cima de tudo o que está fora da peça (relevo incluído) e contexto discreto.
    { id: 'slab-mask', type: 'fill', source: 'slab', filter: ['==', ['get', 'kind'], 'mask'], paint: { 'fill-color': C.ocean, 'fill-antialias': false } },
    { id: 'ctx-overview', type: 'fill', source: 'slab', filter: ['==', ['get', 'kind'], 'context'], paint: { 'fill-color': C.landContext } },
    // (camada personalizada 'atlas-slab-walls' inserida aqui, antes de SLAB_WALLS_BEFORE)
    { id: 'omt-wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], minzoom: 7, paint: { 'fill-color': C.wood, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 9, 1] } },
    // Fora da Península (França no recorte e, à escala local, o restante contexto): atenuado.
    { id: 'slab-veil', type: 'fill', source: 'slab', filter: ['in', ['get', 'kind'], ['literal', ['veil', 'beyond', 'context']]], paint: { 'fill-color': C.veil } },
    { id: 'slab-cut', type: 'line', source: 'slab', filter: ['==', ['get', 'kind'], 'cut'], paint: { 'line-color': 'rgba(181,197,204,0.45)', 'line-width': 1, 'line-dasharray': [4, 3] } },
    // Lábio da laje: aresta clara na linha de costa (vista geral).
    { id: 'slab-edge', type: 'line', source: 'slab', filter: ['==', ['get', 'kind'], 'slab'], paint: { 'line-color': 'rgba(214,226,220,0.35)', 'line-width': 0.9, 'line-opacity': 1 } },
    // Costa detalhada do mapa base (só depois de as paredes desaparecerem).
    { id: 'omt-ocean', type: 'fill', source: 'omt', 'source-layer': 'water', filter: ['==', ['get', 'class'], 'ocean'], paint: { 'fill-color': C.ocean, 'fill-opacity': 0 } },
    // Lagos, lagoas e albufeiras < 5 ha do mapa base: só à escala local.
    { id: 'omt-water', type: 'fill', source: 'omt', 'source-layer': 'water', filter: ['all', ['!=', ['get', 'class'], 'ocean'], ['!=', ['get', 'class'], 'swimming_pool']], minzoom: 9, paint: { 'fill-color': C.waterBase, 'fill-opacity': 1 } },
    { id: 'omt-river', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['in', ['get', 'class'], ['literal', ['river', 'canal']]], minzoom: 8, paint: { 'line-color': C.river, 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 12, 2, 15, 4.5] } },
    { id: 'omt-stream', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'stream'], minzoom: 11, paint: { 'line-color': C.river, 'line-opacity': 0.5, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 1.3] } },
    { id: 'river-line', type: 'line', source: 'atlas-rivers', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.river, 'line-opacity': 0.8, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, ['match', ['get', 'rank'], 1, 1.1, 0.7], 8, ['match', ['get', 'rank'], 1, 2.2, 1.4], 11, 2.6] } },
    { id: 'omt-region', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], minzoom: 6, paint: { 'line-color': C.region, 'line-width': 0.7, 'line-dasharray': [3, 2] } },
    // Fronteiras: subtis (a fronteira Portugal–Espanha não parte a peça).
    { id: 'ne-border', type: 'line', source: 'slab', filter: ['==', ['get', 'kind'], 'border'], paint: { 'line-color': C.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.1], 'line-dasharray': [2.5, 2] } },
    { id: 'omt-border', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], minzoom: 7, paint: { 'line-color': C.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 1.6], 'line-dasharray': [2.5, 2] } },
    { id: 'omt-road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]], minzoom: 10, paint: { 'line-color': C.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 2.2] } },
    { id: 'omt-road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]], minzoom: 7, paint: { 'line-color': C.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 10, 1.2, 14, 3] } },

    ...OVERVIEW_TIERS.map((t) => waterFill('ov', t)),
    ...TIERS.map((t) => waterFill('dt', t)),
    { id: 'zone-line-dt', type: 'line', source: 'water-detail', filter: ['all', ['==', ['get', 'kind'], 'area'], ['!=', ['get', 'zone_full'], '']], paint: { 'line-color': C.zone, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 12, 2.2], 'line-dasharray': [2, 1.2] } },
    // Favoritas: contorno dourado discreto.
    { id: 'fav-line-ov', type: 'line', source: 'water-overview', filter: ['==', ['get', 'id'], '__none__'], paint: { 'line-color': C.favorite, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.4], 'line-opacity': 0.9 } },
    { id: 'fav-line-dt', type: 'line', source: 'water-detail', filter: ['==', ['get', 'id'], '__none__'], paint: { 'line-color': C.favorite, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, 2.2] } },
    // Seleção: halo + preenchimento claro + contorno; a geometria não muda.
    { id: 'sel-halo-ov', type: 'line', source: 'water-overview', filter: ['==', ['get', 'id'], '__none__'], paint: { 'line-color': C.selection, 'line-width': 9, 'line-opacity': 0.35, 'line-blur': 4 } },
    { id: 'sel-halo-dt', type: 'line', source: 'water-detail', filter: ['==', ['get', 'id'], '__none__'], paint: { 'line-color': C.selection, 'line-width': 9, 'line-opacity': 0.35, 'line-blur': 4 } },
    { id: 'sel-fill-ov', type: 'fill', source: 'water-overview', filter: ['==', ['get', 'id'], '__none__'], paint: { 'fill-color': C.selection, 'fill-opacity': 0.95 } },
    { id: 'sel-fill-dt', type: 'fill', source: 'water-detail', filter: ['==', ['get', 'id'], '__none__'], paint: { 'fill-color': C.selection, 'fill-opacity': 0.95 } },
    { id: 'sel-line-ov', type: 'line', source: 'water-overview', filter: ['==', ['get', 'id'], '__none__'], paint: { 'line-color': C.text, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 10, 1.4, 14, 2] } },
    { id: 'sel-line-dt', type: 'line', source: 'water-detail', filter: ['==', ['get', 'id'], '__none__'], paint: { 'line-color': C.text, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 10, 1.4, 14, 2] } },
    { id: 'river-sel', type: 'line', source: 'atlas-rivers', filter: ['==', ['get', 'river'], '__none__'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.selection, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2.2, 10, 4], 'line-opacity': 0.55 } },
    { id: 'river-sel-section', type: 'line', source: 'atlas-rivers', filter: ['==', ['get', 'id'], '__none__'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.selection, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3.2, 10, 6] } },

    { id: 'st-weir-fill', type: 'fill', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'weir'], ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]], paint: { 'fill-color': C.structure } },
    { id: 'st-weir-line', type: 'line', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'weir'], ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]]], layout: { 'line-cap': 'round' }, paint: { 'line-color': C.structure, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 15, 3.5] } },
    { id: 'st-dam-fill', type: 'fill', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'dam'], ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]], paint: { 'fill-color': C.text } },
    { id: 'st-dam-line', type: 'line', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'dam'], ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]]], layout: { 'line-cap': 'round' }, paint: { 'line-color': C.text, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 5] } },
    { id: 'st-weir-pt', type: 'circle', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'skind'], 'weir']], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1.8, 13, 3.2], 'circle-color': C.structure, 'circle-stroke-color': C.oceanDeep, 'circle-stroke-width': 1 } },
    { id: 'st-dam-pt', type: 'circle', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'skind'], 'dam']], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 2.4, 13, 4], 'circle-color': C.text, 'circle-stroke-color': C.oceanDeep, 'circle-stroke-width': 1.2 } },
    { id: 'st-sel', type: 'circle', source: 'structures', filter: ['==', ['get', 'id'], '__none__'], paint: { 'circle-radius': 8, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': C.selection, 'circle-stroke-width': 2.5 } },

    // Localidades e países.
    { id: 'omt-place', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]], minzoom: 6, layout: { 'text-field': nameLatin, 'text-font': ['Noto Sans Regular'], 'text-size': ['match', ['get', 'class'], 'city', 13, 'town', 11.5, 10.5], 'symbol-sort-key': ['get', 'rank'], 'text-max-width': 8 }, paint: { 'text-color': C.textMuted, 'text-halo-color': C.halo, 'text-halo-width': 1.2 } },
    { id: 'ne-place', type: 'symbol', source: 'base', filter: ['all', ['==', ['get', 'layer'], 'place'], ['<=', ['get', 'rank'], 5]], minzoom: 5.5, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['get', 'rank'], 0, 12.5, 8, 10.5], 'symbol-sort-key': ['get', 'rank'], visibility: 'none' }, paint: { 'text-color': C.textMuted, 'text-halo-color': C.halo, 'text-halo-width': 1.2 } },
    { id: 'ne-country', type: 'symbol', source: 'base', filter: ['all', ['==', ['get', 'layer'], 'country'], ['in', ['get', 'name'], ['literal', ['Portugal', 'Espanha']]]], maxzoom: 7, layout: { 'text-field': ['upcase', ['get', 'name']], 'text-font': ['Noto Sans Medium'], 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 6, 13], 'text-letter-spacing': 0.35 }, paint: { 'text-color': 'rgba(244,247,248,0.55)', 'text-halo-color': C.halo, 'text-halo-width': 1 } },
    { id: 'river-label', type: 'symbol', source: 'atlas-rivers', layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'symbol-spacing': 320, 'text-optional': true }, paint: { 'text-color': '#8fdde5', 'text-halo-color': C.halo, 'text-halo-width': 1.3 } },
    { id: 'omt-water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name', filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['in', ['get', 'class'], ['literal', ['ocean', 'sea', 'bay', 'strait']]]]], minzoom: 10, layout: { 'text-field': nameLatin, 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-max-width': 7, 'text-optional': true }, paint: { 'text-color': '#9fe3ea', 'text-halo-color': C.halo, 'text-halo-width': 1.3 } },
    { id: 'omt-water-name-line', type: 'symbol', source: 'omt', 'source-layer': 'water_name', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['in', ['get', 'class'], ['literal', ['ocean', 'sea', 'bay', 'strait']]]]], minzoom: 10, layout: { 'text-field': nameLatin, 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'symbol-placement': 'line', 'text-optional': true }, paint: { 'text-color': '#9fe3ea', 'text-halo-color': C.halo, 'text-halo-width': 1.3 } },

    ...TIERS.map((t) => waterLabel('dt', t)),
    ...OVERVIEW_TIERS.map((t) => waterLabel('ov', t)),
    { id: 'st-dam-label', type: 'symbol', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'skind'], 'dam'], ['has', 'name']], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 10.5, 'text-max-width': 9, 'text-anchor': 'top', 'text-offset': [0, 0.7], 'text-optional': true }, paint: { 'text-color': C.textMuted, 'text-halo-color': C.halo, 'text-halo-width': 1.3 } },
    { id: 'st-weir-label', type: 'symbol', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'skind'], 'weir'], ['has', 'name']], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-max-width': 9, 'text-anchor': 'top', 'text-offset': [0, 0.6], 'text-optional': true }, paint: { 'text-color': C.textMuted, 'text-halo-color': C.halo, 'text-halo-width': 1.3 } },

    // Zonas de pesca (só as documentadas, com fonte): marca dourada.
    { id: 'zone-dot', type: 'circle', source: 'zones', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 5], 'circle-color': C.zone, 'circle-stroke-color': C.oceanDeep, 'circle-stroke-width': 1.2 } },

    // Fichas CatchAtlas: marcadores independentes da geometria da água (agrupados em escalas pequenas).
    { id: 'cat-cluster', type: 'circle', source: 'catalog', filter: ['has', 'point_count'], paint: { 'circle-radius': ['step', ['get', 'point_count'], 10, 5, 12, 15, 14], 'circle-color': 'rgba(7,25,35,0.86)', 'circle-stroke-color': C.water, 'circle-stroke-width': 1.4 } },
    { id: 'cat-cluster-count', type: 'symbol', source: 'catalog', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 11, 'text-allow-overlap': true }, paint: { 'text-color': C.text } },
    { id: 'cat-point', type: 'circle', source: 'catalog', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': ['case', ['boolean', ['get', 'fav'], false], 5, 4], 'circle-color': ['case', ['boolean', ['get', 'fav'], false], C.favorite, C.text], 'circle-stroke-color': C.oceanDeep, 'circle-stroke-width': 1.5 } },
    { id: 'cat-sel', type: 'circle', source: 'catalog', filter: ['==', ['get', 'id'], '__none__'], paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': C.selection, 'circle-stroke-width': 2.5 } },
    // Posição do utilizador (só depois de "A minha localização").
    { id: 'me-accuracy', type: 'circle', source: 'me', paint: { 'circle-radius': 18, 'circle-color': 'rgba(131,229,239,0.16)', 'circle-stroke-color': 'rgba(131,229,239,0.4)', 'circle-stroke-width': 1 } },
    { id: 'me-dot', type: 'circle', source: 'me', paint: { 'circle-radius': 6, 'circle-color': C.selection, 'circle-stroke-color': C.text, 'circle-stroke-width': 2 } },
  ]

  return { version: 8, glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`, sources, layers }
}
