import { WARM_REGIONS } from '../data/catalog'
import type { Dam } from '../data/types'
import { parseISODate } from './dates'
import { hashString, mulberry32 } from './random'

export type Sky = 'limpo' | 'poucas-nuvens' | 'nublado' | 'chuva-fraca'

export interface HourPoint {
  hour: number
  air: number
  wind: number
}

export interface Conditions {
  date: string
  sky: Sky
  skyLabel: string
  airMin: number
  airMax: number
  water: number
  wind: number
  gust: number
  windDir: string
  pressure: number
  pressureTrend: 'a subir' | 'estável' | 'a descer'
  humidity: number
  sunrise: string
  sunset: string
  hourly: HourPoint[]
}

const SKY_LABEL: Record<Sky, string> = {
  limpo: 'Céu limpo',
  'poucas-nuvens': 'Poucas nuvens',
  nublado: 'Nublado',
  'chuva-fraca': 'Possibilidade de chuva fraca',
}
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

const fmtTime = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`

/**
 * Condições SIMULADAS. Não usam qualquer fonte meteorológica: dependem apenas
 * da época do ano, da região e de uma semente estável (barragem + data).
 */
export function simulateConditions(dam: Dam, date: string): Conditions {
  const d = parseISODate(date)
  const rand = mulberry32(hashString(`${dam.id}|${date}`))
  const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000)
  const season = Math.cos(((doy - 200) / 365) * 2 * Math.PI) // 1 no pico do verão, -1 no inverno
  const south = WARM_REGIONS.includes(dam.region) ? 1.5 : 0

  const airMax = 21 + season * 9 + south + (rand() - 0.5) * 5
  const airMin = airMax - 9 - rand() * 4
  const water = 15 + season * 7 + south * 0.5 + (rand() - 0.5) * 2
  const skyRoll = rand() + (season < 0 ? 0.25 : -0.1)
  const sky: Sky = skyRoll < 0.35 ? 'limpo' : skyRoll < 0.65 ? 'poucas-nuvens' : skyRoll < 0.9 ? 'nublado' : 'chuva-fraca'
  const wind = 5 + rand() * 20 + (sky === 'chuva-fraca' ? 6 : 0)
  const pressure = 1008 + rand() * 18
  const trendRoll = rand()
  const pressureTrend = trendRoll < 0.33 ? 'a subir' : trendRoll < 0.66 ? 'estável' : 'a descer'
  const dayLen = 12 * 60 + season * 160
  const noon = 13 * 60 + 25
  const sunrise = noon - dayLen / 2
  const sunset = noon + dayLen / 2

  const hourly: HourPoint[] = []
  for (let h = 5; h <= 22; h++) {
    const t = Math.max(0, Math.sin(((h - 6) / 18) * Math.PI))
    const air = airMin + (airMax - airMin) * Math.pow(t, 1.3)
    const windH = wind * (0.55 + 0.6 * Math.sin(((h - 8) / 14) * Math.PI) ** 2) + (rand() - 0.5) * 3
    hourly.push({ hour: h, air: Math.round(air * 10) / 10, wind: Math.max(1, Math.round(windH)) })
  }

  return {
    date,
    sky,
    skyLabel: SKY_LABEL[sky],
    airMin: Math.round(airMin),
    airMax: Math.round(airMax),
    water: Math.round(water),
    wind: Math.round(wind),
    gust: Math.round(wind * (1.4 + rand() * 0.5)),
    windDir: DIRS[Math.floor(rand() * DIRS.length)],
    pressure: Math.round(pressure),
    pressureTrend,
    humidity: Math.round(55 + rand() * 35),
    sunrise: fmtTime(sunrise),
    sunset: fmtTime(sunset),
    hourly,
  }
}
