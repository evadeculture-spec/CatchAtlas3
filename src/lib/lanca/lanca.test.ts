import { describe, expect, it } from 'vitest'
import { resolvePhotoTime } from './exif'
import { distanceM, locationDivergence, parseCoords, validLatLng } from './geo'
import { analyse, highlights, MIN_SAMPLE, mostSimilar, pressureClass, similarity } from './intelligence'
import { defaultChecklist, hourRows, safetyNotices, windowRows } from './planner'
import { offsetMinutes, tzForOffset, tzOffsetMin, utcToZonedLocal, zonedLocalToUtc } from './time'
import type { PingFull } from './types'
import { compass, fmt, toBaseLength, toBaseWeight } from './units'
import { fitWithin } from './image'

describe('fusos horários', () => {
  it('converte hora local de Lisboa para UTC, com hora de verão e de inverno', () => {
    expect(zonedLocalToUtc('2024-07-01T08:00', 'Europe/Lisbon')).toBe('2024-07-01T07:00:00.000Z')
    expect(zonedLocalToUtc('2024-01-15T08:00', 'Europe/Lisbon')).toBe('2024-01-15T08:00:00.000Z')
    expect(zonedLocalToUtc('2024-07-01T08:00', 'Europe/Madrid')).toBe('2024-07-01T06:00:00.000Z')
    expect(zonedLocalToUtc('2024-07-01T08:00', 'Atlantic/Azores')).toBe('2024-07-01T08:00:00.000Z')
  })
  it('ida e volta UTC ↔ hora local', () => {
    expect(utcToZonedLocal('2024-03-31T00:30:00Z', 'Europe/Lisbon')).toBe('2024-03-31T00:30')
    expect(utcToZonedLocal('2024-03-31T01:30:00Z', 'Europe/Lisbon')).toBe('2024-03-31T02:30')
    expect(tzOffsetMin('Europe/Madrid', Date.UTC(2024, 0, 1))).toBe(60)
    expect(zonedLocalToUtc('lixo', 'Europe/Lisbon')).toBeNull()
  })
  it('escolhe um fuso coerente com o offset gravado pela câmara', () => {
    const verao = Date.UTC(2023, 5, 10, 6, 15)
    expect(offsetMinutes('+01:00')).toBe(60)
    expect(offsetMinutes('-01:00')).toBe(-60)
    expect(tzForOffset('+01:00', verao, 'UTC')).toBe('Europe/Lisbon')
    expect(tzForOffset('+02:00', verao, 'Europe/Lisbon')).toBe('Europe/Madrid')
    expect(tzForOffset('+02:00', verao, 'Europe/Madrid')).toBe('Europe/Madrid')
    expect(tzForOffset('+09:00', verao, 'Europe/Lisbon')).toBe('Europe/Lisbon')
  })
})

describe('hora da fotografia (EXIF)', () => {
  const now = Date.UTC(2026, 10, 8, 12)
  it('EXIF com fuso: hora exata, fiabilidade alta', () => {
    const r = resolvePhotoTime({ takenLocal: '2024:05:04 19:10:00', offset: '+01:00', gps: null, camera: null }, 'Europe/Lisbon', { now })
    expect(r).toMatchObject({ occurredAt: '2024-05-04T18:10:00.000Z', source: 'foto-exif', reliability: 'alta' })
  })
  it('EXIF sem fuso: interpretado no fuso escolhido, fiabilidade média', () => {
    const r = resolvePhotoTime({ takenLocal: '2024:05:04 19:10:00', offset: null, gps: null, camera: null }, 'Europe/Madrid', { now })
    expect(r).toMatchObject({ occurredAt: '2024-05-04T17:10:00.000Z', source: 'foto-exif', reliability: 'media' })
  })
  it('fotografia antiga mantém a sua data (nunca a de hoje)', () => {
    const r = resolvePhotoTime({ takenLocal: '2015:08:20 06:05:00', offset: '+01:00', gps: null, camera: null }, 'Europe/Lisbon', { now })
    expect(r.occurredAt.startsWith('2015-08-20')).toBe(true)
  })
  it('data impossível é ignorada; sem EXIF usa a data do ficheiro com fiabilidade baixa', () => {
    const fut = resolvePhotoTime({ takenLocal: '2031:01:01 10:00:00', offset: '+00:00', gps: null, camera: null }, 'Europe/Lisbon', { now, fileLastModified: Date.UTC(2026, 9, 1) })
    expect(fut).toMatchObject({ source: 'dispositivo', reliability: 'baixa', occurredAt: '2026-10-01T00:00:00.000Z' })
    const cam = resolvePhotoTime(null, 'Europe/Lisbon', { now, capturedNow: true })
    expect(cam).toMatchObject({ source: 'dispositivo', reliability: 'alta' })
  })
})

describe('geografia', () => {
  it('distância e divergência entre fotografia e dispositivo', () => {
    expect(Math.round(distanceM({ lat: 38.7223, lng: -9.1393 }, { lat: 41.1579, lng: -8.6291 }) / 1000)).toBe(274)
    expect(locationDivergence({ lat: 39.46, lng: -8.19 }, { lat: 39.4601, lng: -8.1901 })).toBeNull()
    expect(locationDivergence({ lat: 39.46, lng: -8.19 }, { lat: 38.72, lng: -9.14 })).toBeGreaterThan(100000)
    expect(locationDivergence(null, { lat: 1, lng: 1 })).toBeNull()
  })
  it('aceita coordenadas escritas à mão', () => {
    expect(parseCoords('38,7223 -9,1393')).toEqual({ lat: 38.7223, lng: -9.1393 })
    expect(parseCoords('38.7, -9.1')).toEqual({ lat: 38.7, lng: -9.1 })
    expect(parseCoords('200, 10')).toBeNull()
    expect(validLatLng(0, 0)).toBe(false)
  })
})

describe('unidades', () => {
  it('formata nas unidades do perfil', () => {
    const imp = { unit_temperature: 'f', unit_length: 'in', unit_weight: 'lb', unit_wind: 'kn' } as const
    expect(fmt.temp(20)).toBe('20 °C')
    expect(fmt.temp(20, imp)).toBe('68 °F')
    expect(fmt.wind(18.52, imp)).toBe('10 nós')
    expect(fmt.weight(1180)).toBe('1,18 kg')
    expect(fmt.weight(450)).toBe('450 g')
    expect(fmt.length(41, imp)).toBe('16,1 in')
    expect(fmt.temp(null)).toBeNull()
    expect(toBaseLength(10, imp)).toBe(25.4)
    expect(toBaseWeight(2, imp)).toBe(907)
    expect(compass(270)).toBe('O')
    expect(compass(10)).toBe('N')
  })
  it('reduz imagens mantendo a proporção', () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual([2048, 1536])
    expect(fitWithin(800, 600, 2048)).toEqual([800, 600])
  })
})

let seq = 0
function ping(o: Partial<PingFull> & { env?: Partial<NonNullable<PingFull['ping_environment']>> }): PingFull {
  const { env, ...rest } = o
  return {
    id: `p${++seq}`, owner_id: 'u', pin_id: null, journey_id: null, kind: 'sem-captura', occurred_at: '2024-05-04T07:00:00Z', occurred_tz: 'Europe/Lisbon',
    time_source: 'manual', time_reliability: 'alta', client_created_at: null, server_received_at: '', lat: null, lng: null, accuracy_m: null, location_source: 'nenhuma',
    location_measured_at: null, modality: null, technique: null, bait: null, equipment: null, depth_m: null, bottom_type: null, fishing_minutes: null, catch_count: null,
    outcome: null, notes: null, enrichment_status: 'concluido', enrichment_attempts: 1, enrichment_error: null, enriched_at: null, created_at: '', updated_at: '',
    catches: [], ping_media: [], pin: null,
    ping_environment: env ? ({ air_temp_c: null, pressure_trend_3h_hpa: null, wind_kmh: null, moon_phase: null, ...env } as PingFull['ping_environment']) : null,
    ...rest,
  }
}

describe('Fishing Intelligence (descritiva)', () => {
  it('agrupa por período do dia com tamanho da amostra', () => {
    const ps = [
      ...Array.from({ length: 6 }, (_, i) => ping({ kind: i < 4 ? 'captura' : 'sem-captura', occurred_at: `2024-05-0${i + 1}T06:30:00Z` })),
      ...Array.from({ length: 2 }, () => ping({ kind: 'sem-captura', occurred_at: '2024-05-10T16:00:00Z' })),
      ping({ kind: 'observacao' }),
    ]
    const r = analyse(ps)
    expect(r.sessions).toBe(8)
    const manha = r.byPeriod.find((b) => b.key === 'manha')!
    expect(manha).toMatchObject({ n: 6, successes: 4, sufficient: true })
    const tarde = r.byPeriod.find((b) => b.key === 'tarde')!
    expect(tarde).toMatchObject({ n: 2, sufficient: false })
  })
  it('sem destaques com amostra insuficiente', () => {
    const r = analyse(Array.from({ length: MIN_SAMPLE - 1 }, () => ping({ kind: 'captura' })))
    expect(r.highlights).toEqual([])
    expect(highlights({ ...r, sessions: 2 })).toEqual([])
  })
  it('classes de pressão e espécies', () => {
    expect(pressureClass(-1.5)).toBe('descer')
    expect(pressureClass(0.4)).toBe('estavel')
    expect(pressureClass(null)).toBeNull()
    const r = analyse([ping({ kind: 'captura', catches: [{ id: 'c', owner_id: 'u', ping_id: 'x', species: 'Achigã', weight_g: 1200, length_cm: 42, released: true, notes: null, created_at: '' }] })])
    expect(r.bySpecies[0]).toMatchObject({ species: 'Achigã', count: 1, maxLengthCm: 42, released: 1 })
  })
})

describe('índice de semelhança (não é probabilidade)', () => {
  it('condições iguais = 100; usa só fatores disponíveis e explica-os', () => {
    const v = { month: 5, hour: 7, airTempC: 18, pressureTrend: -1.2, windKmh: 8, moonPhase: 0.5 }
    expect(similarity(v, v).score).toBe(100)
    const s = similarity(v, { month: 5, hour: 7, airTempC: null, pressureTrend: null, windKmh: null, moonPhase: null })
    expect(s.factors.map((f) => f.key)).toEqual(['month', 'hour'])
    expect(s.missing).toContain('Temperatura do ar')
  })
  it('meses e fases da lua são circulares', () => {
    const dez = similarity({ month: 12 }, { month: 1 }).factors[0]
    expect(dez.similarity).toBeCloseTo(1 - 1 / 6)
    const lua = similarity({ moonPhase: 0.98 }, { moonPhase: 0.02 }).factors[0]
    expect(lua.similarity).toBeGreaterThan(0.8)
  })
  it('sessões mais semelhantes exigem pelo menos 3 fatores', () => {
    const ps = [ping({ kind: 'captura', env: { air_temp_c: 18, wind_kmh: 5 } }), ping({ kind: 'captura' })]
    const top = mostSimilar({ month: 5, hour: 8, airTempC: 18, windKmh: 6 }, ps)
    expect(top).toHaveLength(1)
    expect(top[0].sim.score).toBeGreaterThan(80)
  })
})

describe('planeador', () => {
  it('lista de verificação inclui licenças e segurança da modalidade', () => {
    const l = defaultChecklist('caiaque', [{ environment: 'costa' }], true)
    const ids = l.map((i) => i.id)
    expect(ids).toEqual(expect.arrayContaining(['licenca', 'colete', 'mares', 'licenca-mar', 'luz']))
    expect(defaultChecklist('margem', [], false).map((i) => i.id)).not.toContain('colete')
  })
  it('avisos de segurança a partir das condições', () => {
    const rows = hourRows({ available: true, data: { hourly: { time: ['2026-11-10T06:00', '2026-11-10T07:00'], temperature_2m: [12, 13], wind_gusts_10m: [30, 55], weather_code: [3, 95] } } })
    const w = windowRows(rows, '06:00', '08:00')
    expect(w).toHaveLength(2)
    const notes = safetyNotices(w, null, { boat: true, coastal: false })
    expect(notes.filter((n) => n.level === 'perigo')).toHaveLength(2)
    expect(safetyNotices(w.slice(0, 1), null, { boat: false, coastal: true }).map((n) => n.level)).toEqual(['info'])
  })
})
