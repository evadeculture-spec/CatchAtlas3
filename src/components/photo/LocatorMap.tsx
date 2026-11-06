import type { Dam } from '../../data/types'
import { IBERIA, PORTUGAL } from '../SchematicMap'

// Mesma projeção e contornos simplificados do mapa esquemático (vista da Península).
const LON = [-9.9, 3.6]
const LAT = [35.8, 44.0]
const W = 330
const H = 262
const px = (lon: number) => ((lon - LON[0]) / (LON[1] - LON[0])) * W
const py = (lat: number) => ((LAT[1] - lat) / (LAT[1] - LAT[0])) * H
const path = (pts: [number, number][]) => pts.map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join(' ') + ' Z'
const IBERIA_D = path(IBERIA)
const PT_D = path(PORTUGAL)

/** Mini-mapa de localização aproximada. Não é cartografia precisa. */
export function LocatorMap({ dam, className }: { dam: Dam; className?: string }) {
  const x = px(dam.approx.lon)
  const y = py(dam.approx.lat)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={`Localização aproximada de ${dam.name} na Península Ibérica`}>
      <path d={IBERIA_D} fill="rgb(255 255 255 / 0.06)" stroke="rgb(255 255 255 / 0.28)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={PT_D} fill="rgb(255 255 255 / 0.08)" stroke="rgb(255 255 255 / 0.4)" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx={x} cy={y} r="14" fill="rgb(32 191 169 / 0.22)" />
      <circle cx={x} cy={y} r="5.5" fill="#20BFA9" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}
