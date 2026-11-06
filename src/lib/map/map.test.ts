import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import { describe, expect, it } from 'vitest'
import catalog from '../../data/map/catalogWater.json'
import { buildStyle } from './style'
import { AREA_TIERS, OVERVIEW_MAX_TIER, tierForArea } from './waterConfig'

const dir = join(__dirname, '..', '..', '..', 'public', 'map', 'water')
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'))
type F = { properties: Record<string, string | number>; geometry: { type: string } }

describe('estilo do mapa', () => {
  it('é válido segundo a especificação MapLibre', () => {
    expect(validateStyleMin(buildStyle('https://exemplo.pt'))).toEqual([])
  })
  it('é plano e sem terreno nem globo', () => {
    const st = buildStyle('https://exemplo.pt') as unknown as Record<string, unknown>
    expect(st.terrain).toBeUndefined()
    expect(st.projection).toBeUndefined()
  })
})

describe('escalões por área', () => {
  it('limiares ordenados e classificação coerente', () => {
    expect(AREA_TIERS.map((t) => t.minKm2)).toEqual([...AREA_TIERS.map((t) => t.minKm2)].sort((a, b) => b - a))
    expect(tierForArea(224)).toBe(1)
    expect(tierForArea(20)).toBe(2)
    expect(tierForArea(5)).toBe(3)
    expect(tierForArea(1)).toBe(4)
    expect(tierForArea(0.1)).toBe(5)
  })
})

describe('dados das albufeiras', () => {
  const index = read('index.json')
  const overview = read('overview.geojson').features as F[]
  const chunks = (index.chunks as { key: string; count: number }[]).map((c) => ({ c, f: read(`${c.key}.geojson`).features as F[] }))
  const areas = chunks.flatMap((x) => x.f.filter((f) => f.properties.kind === 'area'))

  it('cada albufeira aparece uma só vez nos blocos (sem duplicar transfronteiriças)', () => {
    const ids = areas.map((f) => f.properties.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(index.counts.total)
    const alq = areas.filter((f) => String(f.properties.name).includes('Alqueva'))
    expect(alq).toHaveLength(1)
    expect(alq[0].properties.countries).toBe('ES,PT')
  })
  it('geometrias Polygon/MultiPolygon e escalão a partir da área do contorno completo', () => {
    for (const f of areas) {
      expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type)
      expect(f.properties.tier).toBe(tierForArea(Number(f.properties.area_km2)))
    }
  })
  it('visão geral tem exatamente os escalões 1–2', () => {
    const ov = overview.filter((f) => f.properties.kind === 'area')
    expect(ov.every((f) => Number(f.properties.tier) <= OVERVIEW_MAX_TIER)).toBe(true)
    expect(ov.length).toBe(areas.filter((f) => Number(f.properties.tier) <= OVERVIEW_MAX_TIER).length)
  })
  it('grandes albufeiras: Alqueva e Alcântara no escalão 1, com área plausível', () => {
    const by = (n: string) => overview.find((f) => f.properties.kind === 'area' && f.properties.name === n)!
    expect(Number(by('Albufeira de Alqueva').properties.area_km2)).toBeGreaterThan(200)
    expect(Number(by('Albufeira de Alqueva').properties.tier)).toBe(1)
    expect(Number(by('Embalse de Alcántara').properties.tier)).toBe(1)
  })
  it('ligações às fichas apontam para albufeiras existentes', () => {
    const ids = new Set(areas.map((f) => f.properties.id))
    for (const v of Object.values(catalog)) expect(ids.has(v.waterId)).toBe(true)
    expect((catalog as Record<string, { waterId: string }>).alqueva.waterId).toBe('osm-relation-8988700')
  })
  it('não há ficheiros de blocos órfãos', () => {
    const files = readdirSync(dir).filter((f) => f.startsWith('c_'))
    expect(files.length).toBe(index.chunks.length)
  })
})

describe('estruturas (açudes e barragens) e zonas de pesca no mapa', async () => {
  const { ZONES } = await import('../../data/zones')
  const { default: zoneWater } = await import('../../data/map/zoneWater.json')
  const sdir = join(__dirname, '..', '..', '..', 'public', 'map', 'structures')
  const sIndex = JSON.parse(readFileSync(join(sdir, 'index.json'), 'utf8'))
  const sFeatures = (sIndex.chunks as { key: string }[]).flatMap((c) => JSON.parse(readFileSync(join(sdir, `${c.key}.geojson`), 'utf8')).features as F[])
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'))
  const areas = (index.chunks as { key: string }[]).flatMap((c) => (read(`${c.key}.geojson`).features as F[]).filter((f) => f.properties.kind === 'area'))

  it('cada estrutura tem um ponto (posição a escalas médias) e as contagens batem com o índice', () => {
    const pts = sFeatures.filter((f) => f.properties.kind === 'spt')
    expect(pts.length).toBe(sIndex.counts.weirs + sIndex.counts.dams)
    const ptIds = new Set(pts.map((f) => f.properties.id))
    expect(ptIds.size).toBe(pts.length)
    for (const f of sFeatures.filter((f) => f.properties.kind !== 'spt')) {
      expect(['dam', 'weir']).toContain(f.properties.kind)
      expect(ptIds.has(f.properties.id)).toBe(true)
    }
  })
  it('zonas no mapa apontam para albufeiras reais e marcam o polígono', () => {
    const byId = new Map(areas.map((f) => [String(f.properties.id), f]))
    for (const [zid, ws] of Object.entries(zoneWater as Record<string, { waterId: string }[]>)) {
      expect(ZONES.some((z) => z.id === zid)).toBe(true)
      for (const w of ws) expect(String(byId.get(w.waterId)?.properties.zone).split(',')).toContain(zid)
    }
  })
  it('Venda Velha I e Coutada no mapa; Herdade da Urgueira não (barragens desconhecidas)', () => {
    const zw = zoneWater as Record<string, { waterId: string }[]>
    expect(zw['zpl-venda-velha'][0].waterId).toBe('osm-relation-5366185')
    expect(zw['conc-coutada-rodao'][0].waterId).toBe('osm-way-194995899')
    expect(zw['ref-herdade-urgueira']).toBeUndefined()
    expect(ZONES.find((z) => z.id === 'ref-herdade-urgueira')?.evidence).toBe('noticia')
  })
  it('albufeira sem nome próprio recebe o nome da barragem associada só como rótulo', () => {
    const c = areas.find((f) => f.properties.id === 'osm-way-194995899')!
    expect(c.properties.name).toBe('')
    expect(c.properties.dam).toBe('Barragem da Coutada')
    expect(c.properties.short).toBe('Coutada')
  })
})
