import { describe, expect, it } from 'vitest'
import SunCalc from 'suncalc'
import { astronomy, buildMarineUrl, buildWeatherUrl, cacheKey, cacheTtlMs, datasetPlan, dataKindFor, extractMarine, extractWeather, isCoastal, moonPhaseName, nearestHour, requestWindow, roundCell } from './enrichment.ts'
import { buildForecastUrl, forecastDataset, validateQuery } from './forecast.ts'

const NOW = new Date('2026-11-08T12:00:00Z')
const DAY = 86400000

describe('escolha do conjunto de dados', () => {
  it('acontecimento recente usa previsão e cai para arquivos', () => {
    expect(datasetPlan(new Date(NOW.getTime() - 3600000), NOW)).toEqual(['forecast', 'historical-forecast', 'archive'])
  })
  it('acontecimento com semanas usa o arquivo de previsões primeiro', () => {
    expect(datasetPlan(new Date(NOW.getTime() - 20 * DAY), NOW)).toEqual(['historical-forecast', 'forecast', 'archive'])
    expect(datasetPlan(new Date(NOW.getTime() - 200 * DAY), NOW)).toEqual(['historical-forecast', 'archive'])
  })
  it('fotografia anterior a 2022 só usa a reanálise (nunca o tempo atual)', () => {
    const plan = datasetPlan(new Date('2019-06-01T08:00:00Z'), NOW)
    expect(plan).toEqual(['archive'])
    expect(plan).not.toContain('forecast')
  })
  it('natureza do dado nunca é "observado"', () => {
    const past = new Date(NOW.getTime() - 5 * DAY)
    expect(dataKindFor('archive', past, NOW)).toBe('historico')
    expect(dataKindFor('historical-forecast', past, NOW)).toBe('estimado')
    expect(dataKindFor('forecast', new Date(NOW.getTime() - 60000), NOW)).toBe('estimado')
    expect(dataKindFor('forecast', new Date(NOW.getTime() + 2 * 3600000), NOW)).toBe('previsao')
  })
})

describe('privacidade das coordenadas', () => {
  it('arredonda a 0,01° antes de sair do servidor', () => {
    expect(roundCell(38.736946)).toBe(38.74)
    expect(roundCell(-9.142685)).toBe(-9.14)
    const url = new URL(buildWeatherUrl('archive', 38.736946, -9.142685, new Date('2020-05-02T07:30:00Z')))
    expect(url.searchParams.get('latitude')).toBe('38.74')
    expect(url.searchParams.get('longitude')).toBe('-9.14')
    expect(url.toString()).not.toContain('38.7369')
    const m = new URL(buildMarineUrl(38.736946, -9.142685, new Date('2026-11-01T07:30:00Z')))
    expect(m.searchParams.get('latitude')).toBe('38.74')
  })
  it('a chave de cache é por célula e janela', () => {
    const a = cacheKey('archive', 38.7361, -9.1412, new Date('2020-05-02T07:30:00Z'))
    const b = cacheKey('archive', 38.7449, -9.1449, new Date('2020-05-02T18:00:00Z'))
    expect(a).toBe(b)
    expect(a).toBe('om:archive:38.74:-9.14:2020-05-01:2020-05-02')
  })
})

describe('pedidos ao fornecedor', () => {
  it('a reanálise não pede variáveis que não tem', () => {
    const url = new URL(buildWeatherUrl('archive', 40, -8, new Date('2020-05-02T07:30:00Z')))
    expect(url.searchParams.get('hourly')).not.toContain('visibility')
    expect(url.searchParams.get('timezone')).toBe('GMT')
    expect(url.searchParams.get('timeformat')).toBe('unixtime')
    const f = new URL(buildWeatherUrl('forecast', 40, -8, new Date('2026-11-08T07:30:00Z')))
    expect(f.searchParams.get('hourly')).toContain('visibility')
  })
  it('janela do dia anterior ao dia do acontecimento (UTC)', () => {
    expect(requestWindow(new Date('2024-03-01T00:30:00Z'))).toEqual({ start: '2024-02-29', end: '2024-03-01' })
  })
  it('a cache de arquivo antigo não expira; previsões recentes expiram', () => {
    expect(cacheTtlMs('archive', new Date('2020-01-01T00:00:00Z'), NOW)).toBeNull()
    expect(cacheTtlMs('forecast', new Date(NOW.getTime() - 3600000), NOW)).toBe(3600000)
    expect(cacheTtlMs('historical-forecast', new Date(NOW.getTime() - DAY), NOW)).toBe(6 * 3600000)
  })
})

function hourlyFixture(startUnix: number, hours: number, overrides: Record<string, (number | null)[]> = {}) {
  const time = Array.from({ length: hours }, (_, i) => startUnix + i * 3600)
  const series = (f: (i: number) => number | null) => Array.from({ length: hours }, (_, i) => f(i))
  return {
    latitude: 38.75, longitude: -9.125, elevation: 60,
    hourly: {
      time,
      temperature_2m: series((i) => 10 + i * 0.5),
      apparent_temperature: series((i) => 9 + i * 0.5),
      relative_humidity_2m: series(() => 80),
      pressure_msl: series((i) => 1020 - i * 0.25),
      wind_speed_10m: series(() => 12.34),
      wind_direction_10m: series(() => 270),
      wind_gusts_10m: series(() => 25),
      precipitation: series((i) => (i % 2 ? 0.2 : 0)),
      cloud_cover: series(() => 50),
      weather_code: series(() => 3),
      is_day: series((i) => (i % 24 >= 7 && i % 24 <= 18 ? 1 : 0)),
      ...overrides,
    },
  }
}

describe('extração do instantâneo meteorológico', () => {
  const start = Date.UTC(2020, 4, 1) / 1000 // 2020-05-01T00:00Z
  const event = new Date('2020-05-02T07:20:00Z') // índice 31 (07:00) é o mais próximo
  it('usa a hora do acontecimento, com tendência de pressão e precipitação de 24 h', () => {
    const w = extractWeather(hourlyFixture(start, 48), event)!
    expect(w.reference_time).toBe('2020-05-02T07:00:00.000Z')
    expect(w.time_offset_min).toBe(-20)
    expect(w.air_temp_c).toBe(25.5)
    expect(w.pressure_hpa).toBe(1012.3)
    expect(w.pressure_trend_3h_hpa).toBe(-0.7) // −0,75 hPa arredondado (Math.round)
    expect(w.precip_24h_mm).toBe(2.4)
    expect(w.wind_kmh).toBe(12.3)
    expect(w.is_day).toBe(true)
    expect(w.grid_lat).toBe(38.75)
  })
  it('devolve null se a hora não está coberta (em vez de usar outra hora)', () => {
    expect(extractWeather(hourlyFixture(start, 10), event)).toBeNull()
    expect(nearestHour([], event)).toBeNull()
  })
  it('devolve null sem temperatura (para tentar o conjunto seguinte)', () => {
    const empty = hourlyFixture(start, 48, { temperature_2m: Array(48).fill(null) })
    expect(extractWeather(empty, event)).toBeNull()
  })
  it('valores em falta ficam null, não zero', () => {
    const w = extractWeather(hourlyFixture(start, 48), event)!
    expect(w.visibility_m).toBeNull()
    expect(w.uv_index).toBeNull()
  })
  it('mar: null quando o modelo marinho não tem dados', () => {
    const fx = { hourly: { time: [start + 31 * 3600], wave_height: [null], wave_period: [null], wave_direction: [null], sea_surface_temperature: [null] } }
    expect(extractMarine(fx, event)).toBeNull()
    const ok = { hourly: { time: [start + 31 * 3600], wave_height: [1.24], wave_period: [9.1], wave_direction: [300], sea_surface_temperature: [16.44] } }
    expect(extractMarine(ok, event)).toEqual({ wave_height_m: 1.2, wave_period_s: 9.1, wave_dir_deg: 300, sea_temp_c: 16.4 })
  })
})

describe('astronomia', () => {
  it('Lisboa ao meio-dia de verão: sol alto a sul, dia longo', () => {
    const a = astronomy(SunCalc, new Date('2024-06-21T12:30:00Z'), 38.72, -9.14)
    expect(a.sun_altitude_deg).toBeGreaterThan(70)
    expect(a.sun_azimuth_deg).toBeGreaterThan(150)
    expect(a.sun_azimuth_deg).toBeLessThan(210)
    expect(a.day_length_min).toBeGreaterThan(14 * 60)
    expect(a.sunrise).toMatch(/^2024-06-21T05:/)
    expect(a.moon_illumination).toBeGreaterThanOrEqual(0)
    expect(a.moon_illumination).toBeLessThanOrEqual(1)
  })
  it('nomes das fases', () => {
    expect(moonPhaseName(0)).toBe('Lua nova')
    expect(moonPhaseName(0.5)).toBe('Lua cheia')
    expect(moonPhaseName(0.25)).toBe('Quarto crescente')
    expect(moonPhaseName(0.75)).toBe('Quarto minguante')
  })
  it('só pede dados marinhos para costa/mar', () => {
    expect(isCoastal('costa')).toBe(true)
    expect(isCoastal('albufeira')).toBe(false)
    expect(isCoastal(null)).toBe(false)
  })
})

describe('planeador: condições para um dia', () => {
  it('valida a consulta', () => {
    expect(validateQuery({ lat: 100, lng: 0, date: '2026-11-10', timezone: 'Europe/Lisbon' })).toBe('Coordenadas inválidas')
    expect(validateQuery({ lat: 40, lng: -8, date: '10/11/2026', timezone: 'Europe/Lisbon' })).toBe('Data inválida')
    expect(validateQuery({ lat: 40, lng: -8, date: '2026-11-10', timezone: 'x;drop' })).toEqual({ lat: 40, lng: -8, date: '2026-11-10', timezone: 'Europe/Lisbon' })
  })
  it('previsão até 15 dias; para lá disso não há previsão', () => {
    expect(forecastDataset('2026-11-10', NOW)).toEqual({ dataset: 'forecast', kind: 'previsao' })
    expect(forecastDataset('2026-12-20', NOW)).toBeNull()
  })
  it('dias passados são estimativa/histórico, nunca previsão', () => {
    expect(forecastDataset('2026-10-01', NOW)?.kind).toBe('estimado')
    expect(forecastDataset('2018-10-01', NOW)).toEqual({ dataset: 'archive', kind: 'historico' })
  })
  it('probabilidade de precipitação só no conjunto de previsão (é do fornecedor, não nossa)', () => {
    const q = { lat: 38.7369, lng: -9.1426, date: '2026-11-10', timezone: 'Europe/Lisbon' }
    const f = new URL(buildForecastUrl('https://api.open-meteo.com/v1/forecast', q, 'forecast'))
    expect(f.searchParams.get('hourly')).toContain('precipitation_probability')
    expect(f.searchParams.get('latitude')).toBe('38.74')
    const a = new URL(buildForecastUrl('https://archive-api.open-meteo.com/v1/archive', q, 'archive'))
    expect(a.searchParams.get('hourly')).not.toContain('precipitation_probability')
  })
})
