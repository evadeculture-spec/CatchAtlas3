import type { ExpressionSpecification, Map as MLMap } from 'maplibre-gl'
import { layerIds, OVERVIEW_TIERS, TIERS } from '../map/style'
import {
  BASEMAP_WATER_NAME_OFFSET,
  BASEMAP_WATER_OFFSET,
  DETAIL_FROM_OFFSET,
  FADE,
  LABEL_ZOOM_OFFSET,
  RIVER_OFFSET,
  STRUCTURE_OFFSET,
  TIER_ZOOM_OFFSET,
  ZONE_OFFSET,
  type Tier,
} from '../map/waterConfig'
import { ATLAS_ZOOM } from './constants'

type Expr = ExpressionSpecification
const ramp = (from: number, to: number, a = 0, b = 1): Expr => ['interpolate', ['linear'], ['zoom'], from, a, to, b]

/** Opacidade de um escalão: aparece com fade (e a visão geral sai quando entram os blocos de detalhe). */
export function tierOpacity(fit: number, t: Tier, overview: boolean): Expr {
  const start = fit + TIER_ZOOM_OFFSET[t]
  const detailFrom = fit + DETAIL_FROM_OFFSET
  if (overview) return ['interpolate', ['linear'], ['zoom'], start, 0, start + FADE, 1, detailFrom + 0.2, 1, detailFrom + 0.6, 0]
  return ['interpolate', ['linear'], ['zoom'], start, 0, start + FADE, 1]
}

/**
 * Níveis de detalhe do atlas, relativos ao enquadramento da Península (`fit`).
 * Tudo por expressões de zoom do próprio MapLibre (sem trabalho por frame em JavaScript), com fades
 * para evitar aparecimentos bruscos e oscilações junto aos limiares. Reversível ao afastar.
 *
 *  Península (fit … fit+1)     laje com volume, países, rios principais, maiores albufeiras (≥ 40 km²)
 *  Região    (fit+1 … fit+2,4) bacias/rios regionais, albufeiras ≥ 15 e ≥ 3 km², limites regionais
 *  Local     (fit+2,4 … +4,2)  terreno 3D, albufeiras pequenas, afluentes, localidades, barragens
 *  Detalhe   (> fit+4,2)       todas as albufeiras ≥ 5 ha, açudes, água do mapa base e nomes locais
 */
export function applyAtlasZoomPolicy(map: MLMap, fit: number) {
  const set = (id: string, fn: () => void) => {
    if (map.getLayer(id)) fn()
  }
  const detailFrom = fit + DETAIL_FROM_OFFSET
  for (const t of OVERVIEW_TIERS) {
    const start = fit + TIER_ZOOM_OFFSET[t]
    set(layerIds.fill('ov', t), () => {
      map.setLayerZoomRange(layerIds.fill('ov', t), Math.max(0, start), detailFrom + 0.6)
      map.setPaintProperty(layerIds.fill('ov', t), 'fill-opacity', tierOpacity(fit, t, true))
    })
    set(layerIds.label('ov', t), () => map.setLayerZoomRange(layerIds.label('ov', t), Math.max(0, fit + LABEL_ZOOM_OFFSET[t]), detailFrom))
  }
  for (const t of TIERS) {
    const start = t <= 2 ? detailFrom : fit + TIER_ZOOM_OFFSET[t]
    set(layerIds.fill('dt', t), () => {
      map.setLayerZoomRange(layerIds.fill('dt', t), Math.max(0, start), 24)
      map.setPaintProperty(layerIds.fill('dt', t), 'fill-opacity', t <= 2 ? 1 : tierOpacity(fit, t, false))
    })
    set(layerIds.label('dt', t), () => map.setLayerZoomRange(layerIds.label('dt', t), Math.max(0, t <= 2 ? detailFrom : fit + LABEL_ZOOM_OFFSET[t]), 24))
  }

  // Rios do atlas por importância: principais na Península, regionais depois, os restantes à escala regional.
  const r1 = fit + 0.6, r2 = fit + 1.4, r3 = fit + 2.2
  const riverOpacity: Expr = [
    'interpolate', ['linear'], ['zoom'],
    r1 - 0.6, ['match', ['get', 'rank'], 1, 0.7, 0],
    r1, ['match', ['get', 'rank'], 1, 0.8, 0],
    r2, ['match', ['get', 'rank'], 3, 0, 0.8],
    r3, 0.8,
    // À escala local o traçado generalizado dá lugar aos rios detalhados do mapa base.
    fit + RIVER_OFFSET.minor, 0.8,
    fit + RIVER_OFFSET.minor + 0.8, 0.25,
  ]
  set('river-line', () => map.setPaintProperty('river-line', 'line-opacity', riverOpacity))
  set('river-label', () => {
    map.setLayerZoomRange('river-label', Math.max(0, fit + 0.4), fit + RIVER_OFFSET.minor + 0.6)
    map.setPaintProperty('river-label', 'text-opacity', ['interpolate', ['linear'], ['zoom'], fit + 0.4, ['match', ['get', 'rank'], 1, 1, 0], r2, ['match', ['get', 'rank'], 3, 0, 1], r3, 1])
  })

  // Peça → mapa contínuo.
  set('slab-edge', () => map.setPaintProperty('slab-edge', 'line-opacity', ramp(fit + ATLAS_ZOOM.wallsFull, fit + ATLAS_ZOOM.wallsGone, 1, 0)))
  set('slab-cut', () => map.setPaintProperty('slab-cut', 'line-opacity', ramp(fit + ATLAS_ZOOM.beyondFrom, fit + ATLAS_ZOOM.beyondFull, 1, 0)))
  set('slab-mask', () => map.setPaintProperty('slab-mask', 'fill-opacity', ramp(fit + ATLAS_ZOOM.beyondFrom, fit + ATLAS_ZOOM.beyondFull, 1, 0)))
  set('ctx-overview', () => map.setPaintProperty('ctx-overview', 'fill-opacity', ramp(fit + ATLAS_ZOOM.beyondFrom, fit + ATLAS_ZOOM.beyondFull, 1, 0)))
  set('omt-ocean', () => {
    map.setLayerZoomRange('omt-ocean', fit + ATLAS_ZOOM.coastDetail, 24)
    map.setPaintProperty('omt-ocean', 'fill-opacity', ramp(fit + ATLAS_ZOOM.coastDetail, fit + ATLAS_ZOOM.coastDetail + 0.3))
  })

  // Mapa base: água local, nomes, rios detalhados, limites, estradas e localidades.
  const bw = fit + BASEMAP_WATER_OFFSET
  set('omt-water', () => {
    map.setLayerZoomRange('omt-water', bw, 24)
    map.setPaintProperty('omt-water', 'fill-opacity', ramp(bw, bw + FADE))
  })
  set('omt-water-name', () => map.setLayerZoomRange('omt-water-name', fit + BASEMAP_WATER_NAME_OFFSET, 24))
  set('omt-water-name-line', () => map.setLayerZoomRange('omt-water-name-line', fit + BASEMAP_WATER_NAME_OFFSET, 24))
  set('omt-river', () => map.setLayerZoomRange('omt-river', fit + RIVER_OFFSET.minor, 24))
  set('omt-stream', () => map.setLayerZoomRange('omt-stream', fit + RIVER_OFFSET.streams, 24))
  set('omt-region', () => map.setLayerZoomRange('omt-region', fit + 1.4, 24))
  set('omt-border', () => map.setLayerZoomRange('omt-border', fit + 2.6, 24))
  set('ne-border', () => map.setPaintProperty('ne-border', 'line-opacity', ramp(fit + 2.6, fit + 3.2, 1, 0)))
  set('omt-road-major', () => map.setLayerZoomRange('omt-road-major', fit + 2.6, 24))
  set('omt-road-minor', () => map.setLayerZoomRange('omt-road-minor', fit + 4.4, 24))
  set('omt-wood', () => map.setLayerZoomRange('omt-wood', fit + 2.8, 24))
  set('omt-place', () => {
    map.setLayerZoomRange('omt-place', fit + 1.6, 24)
    map.setFilter('omt-place', ['step', ['zoom'], ['==', ['get', 'class'], 'city'], fit + 2.6, ['in', ['get', 'class'], ['literal', ['city', 'town']]], fit + 3.6, ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]]])
  })
  set('ne-place', () => map.setLayerZoomRange('ne-place', fit + 1.6, 24))
  set('ne-country', () => map.setLayerZoomRange('ne-country', 0, fit + 2))

  // Estruturas: ponto discreto primeiro; forma real quando já se distingue.
  const so = STRUCTURE_OFFSET
  const shape = fit + so.shape
  const pointOpacity = (from: number): Expr => [
    'interpolate', ['linear'], ['zoom'],
    from, 0, from + FADE, 1,
    shape + 0.2, 1, shape + 0.7, ['case', ['boolean', ['get', 'ptonly'], false], 1, 0],
  ]
  for (const [layer, from] of [['st-dam-pt', fit + so.damPoint], ['st-weir-pt', fit + so.weirPoint]] as const)
    set(layer, () => {
      map.setLayerZoomRange(layer, from, 24)
      map.setPaintProperty(layer, 'circle-opacity', pointOpacity(from))
      map.setPaintProperty(layer, 'circle-stroke-opacity', pointOpacity(from))
    })
  for (const layer of ['st-dam-line', 'st-dam-fill', 'st-weir-line', 'st-weir-fill'])
    set(layer, () => {
      map.setLayerZoomRange(layer, shape, 24)
      map.setPaintProperty(layer, layer.endsWith('fill') ? 'fill-opacity' : 'line-opacity', ramp(shape, shape + FADE))
    })
  set('st-dam-label', () => map.setLayerZoomRange('st-dam-label', fit + so.damLabel, 24))
  set('st-weir-label', () => map.setLayerZoomRange('st-weir-label', fit + so.weirLabel, 24))

  // Fichas CatchAtlas: a partir da escala regional (na Península inteira competiriam com a peça).
  for (const l of ['cat-cluster', 'cat-cluster-count', 'cat-point']) set(l, () => map.setLayerZoomRange(l, fit + 0.8, 24))
  set('zone-dot', () => map.setLayerZoomRange('zone-dot', fit + ZONE_OFFSET.badge, 24))
  set('zone-line-dt', () => map.setLayerZoomRange('zone-line-dt', fit + ZONE_OFFSET.outline, 24))
}
