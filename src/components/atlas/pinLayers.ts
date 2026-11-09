/**
 * Camadas dos pins no Atlas (MapLibre): os meus pins (privados) e a camada comunitária.
 *  - Forma por tipo (legível sem cor): captura = círculo, observação = losango, local para voltar = marcador quadrado com bandeira.
 *  - Preenchimento claro com contorno petróleo (lê-se sobre terreno claro ou escuro); a cor de destaque
 *    (turquesa) fica reservada ao pin selecionado e à ação principal.
 *  - Pendente de sincronização: pequeno ponto âmbar no canto.
 *  - Agrupamento: no servidor a pequena escala (células), no motor (clusters) à escala da albufeira,
 *    pins individuais à escala da margem.
 */
import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'

export const MY_SRC = 'lanca-my-pins'
export const SEL_SRC = 'lanca-pin-sel'
export const COMM_SRC = 'lanca-community'
export const MY_LAYERS = ['lanca-my-cluster', 'lanca-my-cluster-n', 'lanca-my-pin', 'lanca-my-label']
export const COMM_LAYERS = ['lanca-comm-cluster', 'lanca-comm-cluster-n', 'lanca-comm-pt']
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

const INK = '#071923'
const FILL = '#f4f7f8'
const ACCENT = '#38c9d5'
const PENDING = '#f2b544'

type Shape = 'captura' | 'observacao' | 'local'

function drawIcon(shape: Shape, pending: boolean): ImageData {
  const S = 56
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.lineJoin = 'round'
  g.lineWidth = 5
  g.strokeStyle = INK
  g.fillStyle = FILL
  const cx = S / 2
  const cy = S / 2
  g.beginPath()
  if (shape === 'captura') g.arc(cx, cy, 17, 0, Math.PI * 2)
  else if (shape === 'observacao') {
    g.moveTo(cx, cy - 21)
    g.lineTo(cx + 21, cy)
    g.lineTo(cx, cy + 21)
    g.lineTo(cx - 21, cy)
    g.closePath()
  } else {
    const r = 6
    const x = cx - 16, y = cy - 18, w = 32, h = 32
    g.moveTo(x + r, y)
    g.arcTo(x + w, y, x + w, y + h, r)
    g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r)
    g.arcTo(x, y, x + w, y, r)
    g.closePath()
  }
  g.fill()
  g.stroke()
  g.fillStyle = INK
  g.strokeStyle = INK
  if (shape === 'captura') {
    // Peixe estilizado.
    g.beginPath()
    g.ellipse(cx - 2, cy, 8, 5, 0, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(cx + 5, cy)
    g.lineTo(cx + 11, cy - 5)
    g.lineTo(cx + 11, cy + 5)
    g.closePath()
    g.fill()
  } else if (shape === 'observacao') {
    g.beginPath()
    g.arc(cx, cy, 5, 0, Math.PI * 2)
    g.fill()
  } else {
    // Bandeira ("voltar aqui").
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(cx - 6, cy + 9)
    g.lineTo(cx - 6, cy - 10)
    g.stroke()
    g.beginPath()
    g.moveTo(cx - 6, cy - 10)
    g.lineTo(cx + 8, cy - 5)
    g.lineTo(cx - 6, cy)
    g.closePath()
    g.fill()
  }
  if (pending) {
    g.beginPath()
    g.arc(S - 11, 11, 7.5, 0, Math.PI * 2)
    g.fillStyle = PENDING
    g.fill()
    g.lineWidth = 3
    g.strokeStyle = INK
    g.stroke()
  }
  return g.getImageData(0, 0, S, S)
}

/** Ícone em SVG (lista e legenda), coerente com o do mapa. */
export function pinIconSvg(shape: Shape) {
  const body =
    shape === 'captura'
      ? '<circle cx="12" cy="12" r="8" fill="#f4f7f8" stroke="#071923" stroke-width="2.4"/><ellipse cx="11" cy="12" rx="3.6" ry="2.3" fill="#071923"/><path d="M14 12l3-2.4v4.8z" fill="#071923"/>'
      : shape === 'observacao'
        ? '<path d="M12 2.5L21.5 12 12 21.5 2.5 12z" fill="#f4f7f8" stroke="#071923" stroke-width="2.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.4" fill="#071923"/>'
        : '<rect x="4.5" y="3.5" width="15" height="15" rx="3" fill="#f4f7f8" stroke="#071923" stroke-width="2.4"/><path d="M9.5 15.5v-9l6 2.4-6 2.4" stroke="#071923" stroke-width="1.8" fill="#071923" stroke-linejoin="round"/>'
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${body}</svg>`
}

export function ensurePinLayers(map: MLMap) {
  if (map.getSource(MY_SRC)) return
  for (const shape of ['captura', 'observacao', 'local'] as Shape[])
    for (const pending of [false, true]) {
      const name = `lanca-${shape}${pending ? '-p' : ''}`
      if (!map.hasImage(name)) map.addImage(name, drawIcon(shape, pending), { pixelRatio: 2 })
    }
  map.addSource(MY_SRC, { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 46, clusterMaxZoom: 15, clusterProperties: { total: ['+', ['get', 'n']] } })
  map.addSource(SEL_SRC, { type: 'geojson', data: EMPTY })
  map.addSource(COMM_SRC, { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 40, clusterMaxZoom: 11 })

  // Comunidade (por baixo dos meus pins).
  map.addLayer({ id: 'lanca-comm-cluster', type: 'circle', source: COMM_SRC, filter: ['has', 'point_count'], paint: { 'circle-color': '#0a2230', 'circle-opacity': 0.9, 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 40, 23], 'circle-stroke-color': '#e6b65a', 'circle-stroke-width': 2 } })
  map.addLayer({ id: 'lanca-comm-cluster-n', type: 'symbol', source: COMM_SRC, filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': '#f4f7f8' } })
  map.addLayer({
    id: 'lanca-comm-pt',
    type: 'circle',
    source: COMM_SRC,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['coalesce', ['get', 'color'], '#b5c5cc'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 9],
      'circle-stroke-color': INK,
      'circle-stroke-width': 2,
      'circle-opacity': ['case', ['==', ['get', 'demo'], true], 0.85, 1],
    },
  })

  // Os meus pins.
  map.addLayer({
    id: 'lanca-my-cluster',
    type: 'circle',
    source: MY_SRC,
    filter: ['any', ['has', 'point_count'], ['>', ['get', 'n'], 1]],
    paint: { 'circle-color': INK, 'circle-opacity': 0.92, 'circle-radius': ['step', ['coalesce', ['get', 'total'], ['get', 'n']], 15, 10, 19, 50, 24], 'circle-stroke-color': FILL, 'circle-stroke-width': 2.5 },
  })
  map.addLayer({
    id: 'lanca-my-cluster-n',
    type: 'symbol',
    source: MY_SRC,
    filter: ['any', ['has', 'point_count'], ['>', ['get', 'n'], 1]],
    layout: { 'text-field': ['to-string', ['coalesce', ['get', 'total'], ['get', 'n']]], 'text-font': ['Noto Sans Medium'], 'text-size': 12.5, 'text-allow-overlap': true },
    paint: { 'text-color': FILL },
  })
  map.addLayer({ id: 'lanca-sel-outer', type: 'circle', source: SEL_SRC, paint: { 'circle-radius': 20, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': INK, 'circle-stroke-width': 6 } })
  map.addLayer({ id: 'lanca-sel-inner', type: 'circle', source: SEL_SRC, paint: { 'circle-radius': 20, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ACCENT, 'circle-stroke-width': 3 } })
  map.addLayer({
    id: 'lanca-my-pin',
    type: 'symbol',
    source: MY_SRC,
    filter: ['all', ['!', ['has', 'point_count']], ['<=', ['get', 'n'], 1]],
    layout: {
      'icon-image': ['concat', 'lanca-', ['get', 'type'], ['case', ['get', 'pending'], '-p', '']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.75, 13, 1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  })
  map.addLayer({
    id: 'lanca-my-label',
    type: 'symbol',
    source: MY_SRC,
    minzoom: 13,
    filter: ['all', ['!', ['has', 'point_count']], ['<=', ['get', 'n'], 1], ['has', 'title']],
    layout: { 'text-field': ['get', 'title'], 'text-font': ['Noto Sans Medium'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 9 },
    paint: { 'text-color': FILL, 'text-halo-color': 'rgba(7,25,35,0.9)', 'text-halo-width': 1.4 },
  })
}

export function setPinData(map: MLMap, mine: FeatureCollection, community: FeatureCollection) {
  ;(map.getSource(MY_SRC) as GeoJSONSource | undefined)?.setData(mine)
  ;(map.getSource(COMM_SRC) as GeoJSONSource | undefined)?.setData(community)
}

export function setSelectedPoint(map: MLMap, p: { lng: number; lat: number } | null) {
  ;(map.getSource(SEL_SRC) as GeoJSONSource | undefined)?.setData(p ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } }] } : EMPTY)
}

export function setLayerVisibility(map: MLMap, layers: string[], on: boolean) {
  for (const l of layers) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none')
}
