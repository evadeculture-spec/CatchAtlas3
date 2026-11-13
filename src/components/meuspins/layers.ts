/**
 * Camadas do «Mapa de pins» (MapLibre, sobre a cartografia do Atlas).
 *  - Símbolos legíveis sem cor: privado = violeta com cadeado; público = azul com globo; localização pública
 *    aproximada = pin azul com ≈. O nome acessível de cada símbolo está na lista e nas fichas.
 *  - Agrupamento pelo motor, sobre as posições AUTORIZADAS que este observador recebeu (nunca o ponto exato de
 *    uma partilha por zona). O número do grupo conta reports individuais.
 *  - Realce da zona pública da ficha selecionada (quadrícula estável de 0,05°), em turquesa suave.
 */
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import type { PinRow } from '../../lib/lanca/pinSearch'

export const MP_SRC = 'mp-pins'
export const MP_ZONE_SRC = 'mp-zone'
export const MP_SEL_SRC = 'mp-sel'
export const MP_LAYERS = ['mp-cluster', 'mp-cluster-n', 'mp-pin']
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export type Mark = 'privado' | 'publico' | 'aprox'
export const MARK_LABEL: Record<Mark, string> = { privado: 'Privado', publico: 'Público (ponto exato)', aprox: 'Público, localização aproximada' }
const VIOLET = '#7c4dff'
const BLUE = '#2f7cf6'
const INK = '#071923'

/** Símbolo de um resultado: os meus privados (violeta), públicos exatos (azul) e por zona (azul ≈). */
export function markOf(r: PinRow): Mark {
  if (r.source === 'comm') return r.precision === 'zona' ? 'aprox' : 'publico'
  return r.visibility === 'privado' ? 'privado' : r.visibility === 'zona' ? 'aprox' : 'publico'
}

function drawIcon(mark: Mark): ImageData {
  const S = 60
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  const cx = S / 2, cy = 24
  // Gota (pin) com contorno escuro.
  g.beginPath()
  g.moveTo(cx, S - 4)
  g.bezierCurveTo(cx - 6, S - 16, cx - 20, cy + 10, cx - 20, cy)
  g.arc(cx, cy, 20, Math.PI, 0)
  g.bezierCurveTo(cx + 20, cy + 10, cx + 6, S - 16, cx, S - 4)
  g.closePath()
  g.fillStyle = mark === 'privado' ? VIOLET : BLUE
  g.strokeStyle = INK
  g.lineWidth = 4
  g.fill()
  g.stroke()
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'
  g.lineWidth = 3
  if (mark === 'privado') {
    // Cadeado.
    g.beginPath()
    g.arc(cx, cy - 4, 6, Math.PI, 0)
    g.stroke()
    g.fillRect(cx - 9, cy - 4, 18, 13)
  } else if (mark === 'publico') {
    // Globo.
    g.beginPath()
    g.arc(cx, cy, 10, 0, Math.PI * 2)
    g.moveTo(cx - 10, cy)
    g.lineTo(cx + 10, cy)
    g.stroke()
    g.beginPath()
    g.ellipse(cx, cy, 4.5, 10, 0, 0, Math.PI * 2)
    g.stroke()
  } else {
    g.font = 'bold 26px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('≈', cx, cy + 1)
  }
  return g.getImageData(0, 0, S, S)
}

export function ensureLayers(map: MLMap) {
  for (const m of ['privado', 'publico', 'aprox'] as Mark[]) if (!map.hasImage(`mp-${m}`)) map.addImage(`mp-${m}`, drawIcon(m), { pixelRatio: 2 })
  if (!map.getSource(MP_ZONE_SRC)) {
    map.addSource(MP_ZONE_SRC, { type: 'geojson', data: EMPTY })
    // Realce suave: preenchimento muito ténue e contorno difuso (nunca um ponto).
    map.addLayer({ id: 'mp-zone-fill', type: 'fill', source: MP_ZONE_SRC, paint: { 'fill-color': '#38c9d5', 'fill-opacity': 0.16 } })
    map.addLayer({ id: 'mp-zone-line', type: 'line', source: MP_ZONE_SRC, paint: { 'line-color': '#38c9d5', 'line-width': 6, 'line-blur': 6, 'line-opacity': 0.55 } })
  }
  if (!map.getSource(MP_SRC)) {
    map.addSource(MP_SRC, { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 44, clusterMaxZoom: 22 })
    map.addLayer({
      id: 'mp-cluster', type: 'circle', source: MP_SRC, filter: ['has', 'point_count'],
      paint: { 'circle-color': '#0a2230', 'circle-stroke-color': '#f4f7f8', 'circle-stroke-width': 2.5, 'circle-radius': ['step', ['get', 'point_count'], 17, 10, 21, 50, 26] },
    })
    map.addLayer({
      id: 'mp-cluster-n', type: 'symbol', source: MP_SRC, filter: ['has', 'point_count'],
      layout: { 'text-field': ['to-string', ['get', 'point_count']], 'text-size': 14, 'text-font': ['Noto Sans Medium'], 'text-allow-overlap': true },
      paint: { 'text-color': '#f4f7f8' },
    })
    map.addLayer({
      id: 'mp-pin', type: 'symbol', source: MP_SRC, filter: ['!', ['has', 'point_count']],
      layout: { 'icon-image': ['concat', 'mp-', ['get', 'mark']], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-size': 1 },
    })
  }
  if (!map.getSource(MP_SEL_SRC)) {
    map.addSource(MP_SEL_SRC, { type: 'geojson', data: EMPTY })
    map.addLayer({ id: 'mp-sel', type: 'circle', source: MP_SEL_SRC, paint: { 'circle-radius': 24, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#38c9d5', 'circle-stroke-width': 3.5 } })
  }
}

export function setRows(map: MLMap, rows: PinRow[]) {
  const fc: FeatureCollection = {
    type: 'FeatureCollection',
    features: rows.map((r) => ({ type: 'Feature', properties: { id: r.id, mark: markOf(r) }, geometry: { type: 'Point', coordinates: [r.lng, r.lat] } })),
  }
  ;(map.getSource(MP_SRC) as GeoJSONSource | undefined)?.setData(fc)
}

/** Quadrícula pública (zona) a partir do identificador estável «i:j» (células de 0,05°). */
export function zonePolygon(zoneId: string | null): Feature<Polygon> | null {
  const m = zoneId ? /^(-?\d+):(-?\d+)$/.exec(zoneId) : null
  if (!m) return null
  const s = Number(m[1]) * 0.05, w = Number(m[2]) * 0.05, n = s + 0.05, e = w + 0.05
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } }
}

export function setZone(map: MLMap, zoneId: string | null) {
  const f = zonePolygon(zoneId)
  ;(map.getSource(MP_ZONE_SRC) as GeoJSONSource | undefined)?.setData(f ? { type: 'FeatureCollection', features: [f] } : EMPTY)
}
export function setSelected(map: MLMap, p: { lng: number; lat: number } | null) {
  ;(map.getSource(MP_SEL_SRC) as GeoJSONSource | undefined)?.setData(p ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } }] } : EMPTY)
}
