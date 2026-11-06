import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { Tier } from './waterConfig'

/** Cores do mapa (identidade CatchAtlas: terra clara, água azul, seleção na cor de marca). */
export const MAP_COLORS = {
  sea: '#cfe2ea',
  land: '#f3f1ea',
  wood: '#e2e9d8',
  water: '#4b9cc3',
  waterCatalog: '#3a8bb4',
  waterOutline: '#2a6f93',
  river: '#8ec0d8',
  border: '#a9a397',
  region: '#cfc9bd',
  road: '#ded5c6',
  roadMajor: '#d3c7b3',
  label: '#3f4b52',
  waterLabel: '#1f5f80',
  brand: '#20bfa9',
  ink: '#102b3a',
  zone: '#c98a12',
  zoneText: '#7a4f00',
  dam: '#3d4b53',
  weir: '#6a7c86',
  structLabel: '#46565e',
}

/** Mapa base vetorial (OpenStreetMap, esquema OpenMapTiles) servido pelo OpenFreeMap: gratuito, sem chave. */
export const BASEMAP_TILEJSON = 'https://tiles.openfreemap.org/planet'
const OMT_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> Dados <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contribuidores do OpenStreetMap</a>'
const WATER_ATTRIBUTION =
  'Albufeiras: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contribuidores do OpenStreetMap</a> (ODbL), extração <a href="https://github.com/bquelhas/barragens" target="_blank" rel="noopener">bquelhas/barragens</a>'

export const TIERS: Tier[] = [1, 2, 3, 4, 5]
export const OVERVIEW_TIERS: Tier[] = [1, 2]
const nameLatin: ExpressionSpecification = ['coalesce', ['get', 'name:pt'], ['get', 'name:latin'], ['get', 'name']]
const LABEL_SIZE: Record<Tier, number> = { 1: 13, 2: 12.5, 3: 12, 4: 11.5, 5: 11 }

export const layerIds = {
  fill: (src: 'ov' | 'dt', t: Tier) => `water-${src}-fill-${t}`,
  label: (src: 'ov' | 'dt', t: Tier) => `water-${src}-label-${t}`,
}

/**
 * Estilo do mapa. Os limiares de zoom por escalão são aplicados depois, em função do
 * enquadramento real da Península (ver applyZoomPolicy no componente).
 */
export function buildStyle(origin: string): StyleSpecification {
  const waterFill = (src: 'ov' | 'dt', t: Tier): LayerSpecification => ({
    id: layerIds.fill(src, t),
    type: 'fill',
    source: src === 'ov' ? 'water-overview' : 'water-detail',
    filter: ['all', ['==', ['get', 'kind'], 'area'], ['==', ['get', 'tier'], t]],
    paint: {
      'fill-color': ['case', ['!=', ['get', 'catalog'], ''], MAP_COLORS.waterCatalog, MAP_COLORS.water],
      'fill-outline-color': ['case', ['!=', ['get', 'catalog'], ''], MAP_COLORS.waterOutline, MAP_COLORS.water],
      'fill-antialias': true,
    },
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
      'symbol-sort-key': ['-', 0, ['get', 'area_km2']],
      'text-padding': 2,
      'text-optional': true,
      // Nas albufeiras pequenas o nome pode ficar ao lado, se não couber por cima.
      ...(t >= 3 ? { 'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'] as ('center' | 'top' | 'bottom' | 'left' | 'right')[], 'text-radial-offset': 0.6 } : {}),
    },
    paint: { 'text-color': MAP_COLORS.waterLabel, 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.4, 'text-halo-blur': 0.4 },
  })

  return {
    version: 8,
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    sources: {
      base: { type: 'geojson', data: `${origin}/map/base.geojson`, attribution: '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>', tolerance: 0.6 },
      omt: { type: 'vector', url: BASEMAP_TILEJSON, attribution: OMT_ATTRIBUTION },
      'water-overview': { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: WATER_ATTRIBUTION, maxzoom: 11, promoteId: 'id' },
      'water-detail': { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: WATER_ATTRIBUTION, maxzoom: 14, promoteId: 'id' },
      dams: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      structures: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Açudes e barragens: © contribuidores do OpenStreetMap (ODbL)', maxzoom: 15 },
      zones: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': MAP_COLORS.sea } },
      { id: 'ne-land', type: 'fill', source: 'base', filter: ['==', ['get', 'layer'], 'land'], paint: { 'fill-color': MAP_COLORS.land } },
      { id: 'omt-wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], minzoom: 7, paint: { 'fill-color': MAP_COLORS.wood, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 0.7] } },
      // Oceano do mapa base: refina a linha de costa a qualquer escala.
      { id: 'omt-ocean', type: 'fill', source: 'omt', 'source-layer': 'water', filter: ['==', ['get', 'class'], 'ocean'], paint: { 'fill-color': MAP_COLORS.sea } },
      // Restante água do mapa base (lagos, lagoas, albufeiras < 5 ha): só à escala local (ver BASEMAP_WATER_OFFSET).
      { id: 'omt-water', type: 'fill', source: 'omt', 'source-layer': 'water', filter: ['all', ['!=', ['get', 'class'], 'ocean'], ['!=', ['get', 'class'], 'swimming_pool']], minzoom: 9, paint: { 'fill-color': MAP_COLORS.water, 'fill-opacity': 1 } },
      { id: 'ne-river', type: 'line', source: 'base', filter: ['all', ['==', ['get', 'layer'], 'river'], ['<=', ['get', 'rank'], 9]], paint: { 'line-color': MAP_COLORS.river, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 8, 1.4] } },
      { id: 'omt-river', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['in', ['get', 'class'], ['literal', ['river', 'canal']]], minzoom: 8, paint: { 'line-color': MAP_COLORS.river, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 12, 2.2, 15, 5] } },
      { id: 'omt-stream', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['in', ['get', 'class'], ['literal', ['stream']]], minzoom: 11, paint: { 'line-color': MAP_COLORS.river, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 1.4] } },
      { id: 'omt-region', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], minzoom: 6, paint: { 'line-color': MAP_COLORS.region, 'line-width': 0.7, 'line-dasharray': [3, 2] } },
      { id: 'ne-border', type: 'line', source: 'base', filter: ['==', ['get', 'layer'], 'border'], paint: { 'line-color': MAP_COLORS.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 8, 1.4] } },
      { id: 'omt-border', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], minzoom: 7, paint: { 'line-color': MAP_COLORS.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.2, 12, 1.8] } },
      { id: 'omt-road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]], minzoom: 9, paint: { 'line-color': MAP_COLORS.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 14, 2.5] } },
      { id: 'omt-road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]], minzoom: 6, paint: { 'line-color': MAP_COLORS.roadMajor, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 10, 1.4, 14, 3.5] } },

      ...OVERVIEW_TIERS.map((t) => waterFill('ov', t)),
      ...TIERS.map((t) => waterFill('dt', t)),
      // Concessões e zonas de pesca: contorno tracejado dourado sobre a albufeira (zonas que a abrangem por inteiro).
      { id: 'zone-line-dt', type: 'line', source: 'water-detail', filter: ['all', ['==', ['get', 'kind'], 'area'], ['!=', ['get', 'zone_full'], '']], paint: { 'line-color': MAP_COLORS.zone, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, 2.4], 'line-dasharray': [2, 1.2] } },
      // Seleção: halo discreto (para a encontrar mesmo quando é pequena) + cor de marca; a geometria não muda.
      { id: 'water-sel-halo-ov', type: 'line', source: 'water-overview', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': MAP_COLORS.brand, 'line-width': 8, 'line-opacity': 0.35, 'line-blur': 3 } },
      { id: 'water-sel-halo-dt', type: 'line', source: 'water-detail', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': MAP_COLORS.brand, 'line-width': 8, 'line-opacity': 0.35, 'line-blur': 3 } },
      // Seleção: cor de marca, por cima de tudo (visível mesmo se o escalão estiver oculto).
      { id: 'water-sel-ov', type: 'fill', source: 'water-overview', filter: ['==', ['get', 'id'], ''], paint: { 'fill-color': MAP_COLORS.brand, 'fill-opacity': 0.85 } },
      { id: 'water-sel-dt', type: 'fill', source: 'water-detail', filter: ['==', ['get', 'id'], ''], paint: { 'fill-color': MAP_COLORS.brand, 'fill-opacity': 0.85 } },
      { id: 'water-sel-line', type: 'line', source: 'water-detail', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': MAP_COLORS.ink, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 9, 1.1, 13, 1.8] } },
      { id: 'water-sel-line-ov', type: 'line', source: 'water-overview', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': MAP_COLORS.ink, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 9, 1.1, 13, 1.8] } },

      // Estruturas (OSM): barragens e açudes. Zoom aplicado em applyZoomPolicy.
      { id: 'st-weir-fill', type: 'fill', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'weir'], ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]], paint: { 'fill-color': MAP_COLORS.weir } },
      { id: 'st-weir-line', type: 'line', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'weir'], ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]]], layout: { 'line-cap': 'round' }, paint: { 'line-color': MAP_COLORS.weir, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 15, 3.5] } },
      { id: 'st-dam-fill', type: 'fill', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'dam'], ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]], paint: { 'fill-color': MAP_COLORS.dam } },
      { id: 'st-dam-line', type: 'line', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'dam'], ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]]], layout: { 'line-cap': 'round' }, paint: { 'line-color': MAP_COLORS.dam, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 5] } },
      { id: 'st-weir-pt', type: 'circle', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'skind'], 'weir']], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 13, 3.5], 'circle-color': MAP_COLORS.weir, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 } },
      { id: 'st-dam-pt', type: 'circle', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'skind'], 'dam']], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 2.6, 13, 4.2], 'circle-color': MAP_COLORS.dam, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.2 } },

      // Barragens do catálogo (infraestrutura): ponto discreto em escalas de detalhe.
      {
        id: 'dams', type: 'circle', source: 'dams', minzoom: 7, // pontos das fichas sem contorno
        paint: {
          'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 6, 3.5],
          'circle-color': ['case', ['boolean', ['get', 'selected'], false], MAP_COLORS.brand, MAP_COLORS.ink],
          'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
        },
      },
      { id: 'dams-selected', type: 'circle', source: 'dams', filter: ['boolean', ['get', 'selected'], false], paint: { 'circle-radius': 7, 'circle-color': MAP_COLORS.brand, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } },

      // Localidades e países.
      { id: 'omt-place', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]], minzoom: 5, layout: { 'text-field': nameLatin, 'text-font': ['Noto Sans Regular'], 'text-size': ['match', ['get', 'class'], 'city', 13, 'town', 11.5, 10.5], 'symbol-sort-key': ['get', 'rank'], 'text-max-width': 8, visibility: 'visible' }, paint: { 'text-color': MAP_COLORS.label, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.2 } },
      { id: 'ne-place', type: 'symbol', source: 'base', filter: ['==', ['get', 'layer'], 'place'], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['get', 'rank'], 0, 13, 8, 10.5], 'symbol-sort-key': ['get', 'rank'], visibility: 'none' }, paint: { 'text-color': MAP_COLORS.label, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.2 } },
      { id: 'ne-country', type: 'symbol', source: 'base', filter: ['==', ['get', 'layer'], 'country'], maxzoom: 8, layout: { 'text-field': ['upcase', ['get', 'name']], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-letter-spacing': 0.25 }, paint: { 'text-color': '#7d847f', 'text-halo-color': 'rgba(255,255,255,0.8)', 'text-halo-width': 1 } },

      // Nomes de lagos, lagoas e outras massas de água do mapa base (fora das albufeiras da CatchAtlas).
      // Ficam ocultos até haver a lista de nomes das albufeiras, para não repetir nomes (applyBasemapWaterNames).
      { id: 'omt-water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name', filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['in', ['get', 'class'], ['literal', ['ocean', 'sea', 'bay', 'strait']]]]], minzoom: 9, layout: { 'text-field': nameLatin, 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-max-width': 7, 'text-optional': true, visibility: 'none' }, paint: { 'text-color': MAP_COLORS.waterLabel, 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.3 } },
      { id: 'omt-water-name-line', type: 'symbol', source: 'omt', 'source-layer': 'water_name', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['in', ['get', 'class'], ['literal', ['ocean', 'sea', 'bay', 'strait']]]]], minzoom: 9, layout: { 'text-field': nameLatin, 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'symbol-placement': 'line', 'text-optional': true, visibility: 'none' }, paint: { 'text-color': MAP_COLORS.waterLabel, 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.3 } },

      ...TIERS.map((t) => waterLabel('dt', t)),
      ...OVERVIEW_TIERS.map((t) => waterLabel('ov', t)),

      { id: 'st-dam-label', type: 'symbol', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'skind'], 'dam'], ['has', 'name']], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 10.5, 'text-max-width': 9, 'text-anchor': 'top', 'text-offset': [0, 0.7], 'text-optional': true }, paint: { 'text-color': MAP_COLORS.structLabel, 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.3 } },
      { id: 'st-weir-label', type: 'symbol', source: 'structures', filter: ['all', ['==', ['get', 'kind'], 'spt'], ['==', ['get', 'skind'], 'weir'], ['has', 'name']], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-max-width': 9, 'text-anchor': 'top', 'text-offset': [0, 0.6], 'text-optional': true }, paint: { 'text-color': MAP_COLORS.structLabel, 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.3 } },

      // Concessões e zonas de pesca: marca dourada no ponto interior da albufeira, com o tipo.
      { id: 'zone-dot', type: 'circle', source: 'zones', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3.5, 10, 5.5], 'circle-color': MAP_COLORS.zone, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } },
      { id: 'zone-badge', type: 'symbol', source: 'zones', layout: { 'text-field': ['get', 'badge'], 'text-font': ['Noto Sans Medium'], 'text-size': 11, 'text-anchor': 'left', 'text-offset': [0.8, 0], 'text-optional': true, 'symbol-sort-key': 0 }, paint: { 'text-color': MAP_COLORS.zoneText, 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.6 } },
    ],
  }
}
