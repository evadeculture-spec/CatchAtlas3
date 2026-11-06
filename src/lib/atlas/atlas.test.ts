import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import { describe, expect, it } from 'vitest'
import links from '../../data/atlas/catalogLinks.json'
import { ATLAS_RIVERS } from '../../data/atlas/riverNames'
import { DAMS } from '../../data/dams'
import { ATLAS_ZOOM, SLAB_BOX, slabDepthM, terrainExaggeration, wallOpacity } from './constants'
import { clampNegativeElevation, decodeElevation } from './dem'
import { decodeRegistry, encodeRegistry, type AtlasFeature, type CatalogLink, type RegistryFile } from './model'
import { itemsInView, matchesFilters, normalize, searchAtlas, visibleAtZoom } from './search'
import { buildSlabMesh, eyeFromMatrix, invert4, mercator, multiply4, visibleWallIndices, type LngLat } from './slabMesh'
import { buildAtlasStyle } from './style'
import { cameraParam, flowUrls, parseAtlasUrl, patchParams } from './urlState'

const PUB = join(__dirname, '..', '..', '..', 'public', 'map')
const readPub = <T,>(f: string): T => JSON.parse(readFileSync(join(PUB, f), 'utf8')) as T
type F = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }
const slabFC = readPub<{ features: F[] }>('atlas/slab.geojson')
const slab = slabFC.features.find((f) => f.properties.kind === 'slab')!
const ring = (slab.geometry.coordinates as LngLat[][])[0]
const reg = decodeRegistry(readPub<RegistryFile>('atlas/registry.json'))
const byId = new Map(reg.items.map((i) => [i.id, i]))

function inRing([x, y]: LngLat, r: LngLat[]) {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

describe('laje peninsular (dados reais, contorno contínuo)', () => {
  it('é um único polígono com Portugal, Espanha, Andorra e Gibraltar, sem fronteira interior', () => {
    expect(slabFC.features.filter((f) => f.properties.kind === 'slab')).toHaveLength(1)
    expect(slab.geometry.type).toBe('Polygon')
    for (const pt of [[-9.14, 38.72], [-8.61, 41.15], [-3.70, 40.42], [2.17, 41.39], [1.52, 42.51], [-5.35, 36.14], [-7.93, 37.02]] as LngLat[]) expect(inRing(pt, ring)).toBe(true)
  })
  it('deixa de fora os territórios extra-peninsulares e Marrocos', () => {
    for (const pt of [[2.65, 39.57], [-5.32, 35.89], [-5.81, 35.77], [-16.25, 28.46], [-25.67, 37.74], [-16.91, 32.65]] as LngLat[]) expect(inRing(pt, ring)).toBe(false)
  })
  it('tem um corte deliberado no limite norte do recorte (e a França atenuada dentro dele)', () => {
    const cut = slabFC.features.find((f) => f.properties.kind === 'cut')!
    const coords = cut.geometry.coordinates as LngLat[]
    expect(coords.some(([, y]) => Math.abs(y - SLAB_BOX[3]) < 1e-6)).toBe(true)
    expect(slabFC.features.some((f) => f.properties.kind === 'veil')).toBe(true)
    // A costa francesa a norte do corte não pertence à peça (os Pirenéus não ficam como costa).
    expect(inRing([-1.2, 44.6], ring)).toBe(false)
    expect(inRing([0.5, 43.6], ring)).toBe(true)
  })
})

describe('malha das paredes', () => {
  const eps = 1e-6
  const isCut = (a: LngLat, b: LngLat) => Math.abs(a[1] - SLAB_BOX[3]) < eps && Math.abs(b[1] - SLAB_BOX[3]) < eps
  const mesh = buildSlabMesh(slab.geometry.coordinates as LngLat[][], isCut)
  it('uma parede por aresta, normais unitárias e viradas para fora da terra', () => {
    expect(mesh.edges.length).toBeGreaterThan(1000)
    let outward = 0
    for (const e of mesh.edges) {
      expect(Math.hypot(...e.n)).toBeCloseTo(1, 5)
      // Ponto ligeiramente para fora (em Mercator) → fora do polígono.
      const mx = e.mid[0] + mesh.origin[0] + e.n[0] * 1e-5
      const my = e.mid[1] + mesh.origin[1] + e.n[1] * 1e-5
      const lng = mx * 360 - 180
      const lat = (360 / Math.PI) * Math.atan(Math.exp(((180 - my * 360) * Math.PI) / 180)) - 90
      if (!inRing([lng, lat], ring)) outward++
    }
    expect(outward / mesh.edges.length).toBeGreaterThan(0.97)
    expect(mesh.edges.some((e) => e.cut)).toBe(true)
  })
  it('topo triangulado para o pré-passo de profundidade', () => {
    expect(mesh.topIndices.length % 3).toBe(0)
    expect(mesh.topIndices.length / 3).toBeGreaterThan(ring.length - 10)
  })
  it('só desenha as paredes voltadas para a câmara, da mais distante para a mais próxima', () => {
    const eye: [number, number] = [0, 0.05] // câmara a sul
    const idx = visibleWallIndices(mesh, eye)
    expect(idx.length % 6).toBe(0)
    const walls = [...idx].filter((_, i) => i % 6 === 0).map((v) => mesh.edges[v / 4])
    expect(walls.every((e) => (eye[0] - e.mid[0]) * e.n[0] + (eye[1] - e.mid[1]) * e.n[1] > 0)).toBe(true)
    const d = walls.map((e) => (eye[0] - e.mid[0]) ** 2 + (eye[1] - e.mid[1]) ** 2)
    expect(d.every((v, i) => i === 0 || v <= d[i - 1])).toBe(true)
    expect(walls.length).toBeLessThan(mesh.edges.length)
  })
  it('recupera a posição da câmara a partir da matriz de projeção', () => {
    // Perspetiva simples a olhar para -z a partir de (0.3, 0.4, 2).
    const f = 1 / Math.tan(0.35), n = 0.1, far = 100
    const P = [f, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + n) / (n - far), -1, 0, 0, (2 * far * n) / (n - far), 0]
    const V = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.3, -0.4, -2, 1]
    const eye = eyeFromMatrix(multiply4(P, V))!
    expect(eye[0]).toBeCloseTo(0.3, 6)
    expect(eye[1]).toBeCloseTo(0.4, 6)
    expect(eye[2]).toBeCloseTo(2, 6)
    expect(invert4([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull()
  })
  it('Mercator igual ao do MapLibre', () => {
    const [x, y] = mercator([0, 0])
    expect(x).toBeCloseTo(0.5, 9)
    expect(y).toBeCloseTo(0.5, 9)
  })
})

describe('níveis de detalhe da peça', () => {
  const fit = 5
  it('paredes visíveis na Península e desaparecidas antes do terreno local', () => {
    expect(wallOpacity(fit, fit)).toBe(1)
    expect(wallOpacity(fit + ATLAS_ZOOM.wallsGone, fit)).toBe(0)
    expect(wallOpacity(fit + 1.5, fit)).toBeGreaterThan(wallOpacity(fit + 1.9, fit))
    expect(terrainExaggeration(fit + ATLAS_ZOOM.wallsGone, fit)).toBe(0)
    expect(terrainExaggeration(fit + ATLAS_ZOOM.terrainFullAt + 1, fit)).toBe(ATLAS_ZOOM.terrainExaggeration)
    expect(ATLAS_ZOOM.terrainOn).toBeGreaterThan(ATLAS_ZOOM.wallsGone)
  })
  it('espessura constante no ecrã ao aproximar (metade por nível de zoom)', () => {
    expect(slabDepthM(fit + 1, fit)).toBeCloseTo(slabDepthM(fit, fit) / 2)
    expect(slabDepthM(fit - 1, fit)).toBe(slabDepthM(fit, fit))
  })
})

describe('relevo sem batimetria', () => {
  it('cotas negativas passam a 0 m (Terrarium e Mapbox)', () => {
    const px = new Uint8ClampedArray([100, 20, 0, 255, 130, 10, 0, 255])
    clampNegativeElevation(px, 'terrarium')
    expect(decodeElevation(px[0], px[1], px[2], 'terrarium')).toBe(0)
    expect(decodeElevation(px[4], px[5], px[6], 'terrarium')).toBe(130 * 256 + 10 - 32768)
    const mb = new Uint8ClampedArray([1, 0, 0, 255])
    clampNegativeElevation(mb, 'mapbox')
    expect(decodeElevation(mb[0], mb[1], mb[2], 'mapbox')).toBeCloseTo(0, 5)
  })
})

describe('registo tipado e proveniência', () => {
  it('IDs únicos, fontes com licença e datas, extensão válida', () => {
    expect(new Set(reg.items.map((i) => i.id)).size).toBe(reg.items.length)
    for (const s of Object.values(reg.sources)) {
      expect(s.license).toBeTruthy()
      expect(s.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    for (const it of reg.items) {
      expect(reg.sources[it.source]).toBeDefined()
      expect(it.sourceRefs.length).toBeGreaterThan(0)
      expect(it.bbox[0]).toBeLessThanOrEqual(it.bbox[2])
      expect(it.bbox[1]).toBeLessThanOrEqual(it.bbox[3])
    }
  })
  it('distingue a albufeira da barragem física e do rio', () => {
    const types = new Set(reg.items.map((i) => i.type))
    expect(types).toEqual(new Set(['albufeira', 'barragem', 'acude', 'rio']))
    // O mesmo objeto OSM marcado como albufeira e estrutura dá dois IDs distintos.
    expect(byId.get('osm-way-228486904')?.type).toBe('albufeira')
    expect(['barragem', 'acude']).toContain(byId.get('osm-way-228486904-estrutura')?.type)
  })
  it('a geometria referenciada existe', () => {
    const chunks = new Set(reg.items.filter((i) => i.geometryRef.chunk).map((i) => `${i.geometryRef.layer}/${i.geometryRef.chunk}`))
    for (const c of chunks) expect(existsSync(join(PUB, c.replace('water/', 'water/').replace('structures/', 'structures/') + '.geojson'))).toBe(true)
  })
  it('codificação compacta reversível', () => {
    const sample = { ...reg, items: reg.items.slice(0, 50).concat(reg.items.filter((i) => i.type === 'rio').slice(0, 3)) }
    const back = decodeRegistry(encodeRegistry(sample))
    expect(back.items).toEqual(sample.items)
  })
  it('nomes transfronteiriços dos rios', () => {
    expect(byId.get('ne-rio-tejo')?.altNames).toEqual(expect.arrayContaining(['Tejo', 'Tajo']))
    expect(byId.get('ne-rio-douro')?.countries.sort()).toEqual(['ES', 'PT'])
    expect(ATLAS_RIVERS.every((r) => byId.has(`ne-rio-${r.id}`))).toBe(true)
  })
})

describe('tabela ficha ↔ cartografia', () => {
  const L = links as CatalogLink[]
  it('cobre todas as fichas, uma vez, com elementos existentes', () => {
    expect(L.map((l) => l.catalogId).sort()).toEqual(DAMS.map((d) => d.id).sort())
    const used = L.filter((l) => l.atlasId).map((l) => l.atlasId)
    expect(new Set(used).size).toBe(used.length)
    for (const l of L) {
      if (l.atlasId) {
        expect(byId.get(l.atlasId)?.type).toBe('albufeira')
        expect(byId.get(l.atlasId)?.catalogId).toBe(l.catalogId)
        expect(l.method).toBeTruthy()
      } else {
        expect(l.status).toBe('sem-contorno')
        expect(byId.get(`ficha-${l.catalogId}`)?.approximate).toBe(true)
      }
    }
  })
})

describe('pesquisa', () => {
  const first = (q: string) => searchAtlas(reg.items, q)[0]?.item
  it('nomes alternativos e transfronteiriços', () => {
    expect(first('Tajo')?.id).toBe('ne-rio-tejo')
    expect(first('tejo')?.id).toBe('ne-rio-tejo')
    expect(first('Duero')?.id).toBe('ne-rio-douro')
    expect(first('Miño')?.id).toBe('ne-rio-minho')
  })
  it('tolerante a acentos e a termos genéricos', () => {
    expect(first('alcantara')?.name).toMatch(/Alcántara/)
    expect(first('barragem do castelo do bode')?.catalogId).toBe('castelo-de-bode')
    expect(first('Castelo de Bode')?.catalogId).toBe('castelo-de-bode')
    expect(first('rio guadiana')?.type).toBe('rio')
    expect(normalize('  Ébro – Delta ')).toBe('ebro delta')
  })
  it('pesquisa vazia ou sem resultados', () => {
    expect(searchAtlas(reg.items, '')).toEqual([])
    expect(searchAtlas(reg.items, 'a')).toEqual([])
    expect(searchAtlas(reg.items, 'zzqqxx')).toEqual([])
  })
  it('respeita os filtros partilhados com o mapa e a lista', () => {
    const es = searchAtlas(reg.items, 'alqueva', { countries: ['ES'] })
    expect(es.every((h) => h.item.countries.includes('ES'))).toBe(true)
    const fav = searchAtlas(reg.items, 'alqueva', { favorites: new Set(['osm-relation-8988700']) })
    expect(fav.map((h) => h.item.id)).toEqual(['osm-relation-8988700'])
  })
})

describe('lista sincronizada com o mapa', () => {
  const alqueva = byId.get('osm-relation-8988700') as AtlasFeature
  it('mostra só o que está desenhado no zoom atual', () => {
    expect(visibleAtZoom(alqueva, 0)).toBe(true)
    const small = reg.items.find((i) => i.type === 'albufeira' && i.tier === 5)!
    expect(visibleAtZoom(small, 0)).toBe(false)
    expect(visibleAtZoom(small, 5)).toBe(true)
    expect(visibleAtZoom(byId.get('ne-rio-tejo')!, 0)).toBe(true)
  })
  it('na Península inteira, favoritas e fichas primeiro', () => {
    const list = itemsInView(reg.items, [-10, 36, 4, 44], 0, {}, new Set([alqueva.id]))
    expect(list[0].id).toBe(alqueva.id)
    expect(list.every((i) => visibleAtZoom(i, 0))).toBe(true)
  })
  it('filtros por país e tipo', () => {
    expect(matchesFilters(alqueva, { countries: ['PT'] })).toBe(true)
    expect(matchesFilters(byId.get('ne-rio-ebro')!, { countries: ['PT'] })).toBe(false)
    expect(matchesFilters(alqueva, { types: ['rio'] })).toBe(false)
    expect(matchesFilters(byId.get('osm-way-228486904-estrutura')!, { types: ['barragem'] })).toBe(true) // açudes contam como "Barragens e açudes"
  })
})

describe('estado no endereço e fluxos', () => {
  it('seleção, filtros, modo e câmara', () => {
    const s = parseAtlasUrl(new URLSearchParams('sel=osm-relation-8988700&pais=ES&tipo=albufeira,rio,xx&fav=1&modo=2d&v=-7.5,38.2,9.5,45,10&painel=lista'))
    expect(s).toMatchObject({ sel: 'osm-relation-8988700', countries: ['ES'], types: ['albufeira', 'rio'], favOnly: true, mode: '2d', list: true })
    expect(s.camera).toEqual({ center: [-7.5, 38.2], zoom: 9.5, pitch: 45, bearing: 10 })
    expect(parseAtlasUrl(new URLSearchParams('v=abc')).camera).toBeNull()
    expect(cameraParam({ center: [-7.51234, 38.2], zoom: 9.512, pitch: 44.6, bearing: 10.2 })).toBe('-7.5123,38.2000,9.51,45,10')
    expect(patchParams(new URLSearchParams('a=1&b=2'), { a: null, c: '3', b: undefined }).toString()).toBe('b=2&c=3')
  })
  it('jornada e captura recebem o ID da ficha', () => {
    expect(flowUrls('castelo-de-bode')).toEqual({ ficha: '/barragens/castelo-de-bode', jornada: '/jornada/nova?barragem=castelo-de-bode', captura: '/capturas/nova?barragem=castelo-de-bode' })
  })
})

describe('estilo do atlas', () => {
  it('é válido segundo a especificação MapLibre (com e sem relevo)', () => {
    expect(validateStyleMin(buildAtlasStyle('https://exemplo.pt', { dem: true }))).toEqual([])
    expect(validateStyleMin(buildAtlasStyle('https://exemplo.pt', { dem: false }))).toEqual([])
  })
})
