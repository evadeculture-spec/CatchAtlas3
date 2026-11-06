/**
 * Constantes geográficas e de câmara do Atlas Ibérico (sem dependências do browser:
 * usadas também pelo pipeline de dados e pelos testes).
 *
 * Os limiares de zoom são RELATIVOS ao enquadramento da Península (`fit`, zoom com que a
 * Península cabe no ecrã com inclinação 0), tal como em src/lib/map/waterConfig.ts: assim a mesma
 * hierarquia aparece num telemóvel (fit ≈ 4,1), num tablet (≈ 5,3) ou num computador (≈ 5,0).
 */

/**
 * Recorte da laje peninsular [oeste, sul, este, norte]. O norte (44,25° N) e o este (4,0° E) cortam
 * a terra francesa de propósito: o contorno continua para lá dos Pirenéus (que não são costa) e
 * termina num corte reto, como numa peça de museu. O sul e o oeste ficam no mar.
 */
export const SLAB_BOX: [number, number, number, number] = [-10.5, 35.0, 4.0, 44.25]

/** Câmara inicial (graus). Inclinação confortável e ligeira rotação para mostrar as paredes sul e oeste. */
export const CAMERA = {
  pitch3d: 44,
  /** Ecrãs estreitos (telemóvel em retrato): menos inclinação para a Península caber. */
  pitch3dNarrow: 38,
  bearing3d: 10,
  maxPitch: 68,
  minZoom: 3,
  maxZoom: 16.5,
}

/** Política de níveis de detalhe da vista geral → escala local (offsets relativos a `fit`). */
export const ATLAS_ZOOM = {
  /** Paredes da laje: totalmente visíveis até `wallsFull`, desaparecem até `wallsGone`. */
  wallsFull: 0.9,
  wallsGone: 2.2,
  /** Terreno 3D (só no modo 3D): liga-se depois de as paredes desaparecerem, com histerese. */
  terrainOn: 2.35,
  terrainOff: 2.15,
  terrainFullAt: 3.6,
  terrainExaggeration: 1.45,
  /** Linha de costa detalhada do mapa base (cobre a área das paredes, por isso só depois delas). */
  coastDetail: 2.2,
  /** Terra para lá do corte (França, Itália): aparece quando a peça dá lugar ao mapa contínuo. */
  beyondFrom: 1.5,
  beyondFull: 2.2,
  /** Marcadores das fichas: agrupados até aqui. */
  clusterMaxOffset: 2.0,
}

/**
 * Espessura gráfica da laje (metros) com a Península enquadrada. Representação estilizada: não é
 * um modelo geológico nem batimétrico. Ao aproximar, encolhe na mesma proporção do zoom (a altura
 * no ecrã mantém-se) e desaparece; ao afastar mantém a espessura geográfica.
 */
export const SLAB_DEPTH_AT_FIT_M = 36000

/** Espessura (metros) para um zoom, dado o enquadramento da Península. */
export function slabDepthM(zoom: number, fit: number): number {
  return SLAB_DEPTH_AT_FIT_M * 2 ** -Math.max(0, zoom - fit)
}

/** Opacidade das paredes (0–1) para um zoom; 0 fora do modo 3D. */
export function wallOpacity(zoom: number, fit: number): number {
  const a = fit + ATLAS_ZOOM.wallsFull
  const b = fit + ATLAS_ZOOM.wallsGone
  if (zoom <= a) return 1
  if (zoom >= b) return 0
  const t = (zoom - a) / (b - a)
  return 1 - t * t * (3 - 2 * t)
}

/** Exagero do terreno para um zoom (0 = desligado), com rampa suave depois das paredes. */
export function terrainExaggeration(zoom: number, fit: number): number {
  const a = fit + ATLAS_ZOOM.terrainOn
  const b = fit + ATLAS_ZOOM.terrainFullAt
  if (zoom < a) return 0
  if (zoom >= b) return ATLAS_ZOOM.terrainExaggeration
  return ATLAS_ZOOM.terrainExaggeration * Math.max(0.02, (zoom - a) / (b - a))
}
