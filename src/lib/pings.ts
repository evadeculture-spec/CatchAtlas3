import { ACTIVITY, periodName, speciesById } from '../data/catalog'
import { damById } from '../data/dams'
import type { Report } from '../data/types'
import { diffDays } from './dates'
import { hashString, mulberry32 } from './random'

/**
 * Posição do ping: coordenada aproximada da barragem com um desvio estável,
 * para nunca expor a localização exata de quem fez o report.
 */
export function pingPosition(r: Report) {
  const dam = damById[r.damId]
  const rand = mulberry32(hashString(r.id))
  return { lat: dam.approx.lat + (rand() - 0.5) * 0.14, lon: dam.approx.lon + (rand() - 0.5) * 0.18 }
}

/** 1 = hoje; desce até 0 aos 30 dias. */
export const recencyWeight = (date: string, ref: string) => Math.max(0, 1 - diffDays(ref, date) / 30)

export function reportToPing(r: Report, ref: string) {
  return {
    id: r.id,
    ...pingPosition(r),
    color: ACTIVITY[r.activity].color,
    weight: recencyWeight(r.date, ref),
    label: `${speciesById[r.speciesId].name} em ${damById[r.damId].name}: ${ACTIVITY[r.activity].name.toLowerCase()}, ${periodName(r.period).toLowerCase()}`,
  }
}
