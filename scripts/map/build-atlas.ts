/**
 * Prepara os dados do Atlas Ibérico (npm run atlas:build). Corre depois de `npm run map:build`.
 *
 * Fontes (versões fixadas, descarregadas uma vez para .cache/map-src):
 *  - Natural Earth 10 m (domínio público), commit NE_COMMIT de nvkelso/natural-earth-vector:
 *      land → laje peninsular (contorno contínuo, sem fronteiras) e terra de contexto;
 *      admin_0 → parte francesa do recorte (atenuada); admin_1 → distrito/província e região;
 *      rivers_lake_centerlines + rivers_europe → rios principais (com a tabela src/data/atlas/riverNames.ts);
 *      populated_places_simple → nome dos troços de rio ("perto de …").
 *  - Albufeiras e estruturas OSM já preparadas por `npm run map:build` (public/map/water, public/map/structures).
 *  - Catálogo CatchAtlas (src/data/dams.ts) e correspondências (src/data/map/catalogWater.json).
 *
 * Saídas:
 *  - public/map/atlas/slab.geojson     laje, véu francês, contexto, linhas de corte
 *  - public/map/atlas/rivers.geojson   rios por troços
 *  - public/map/atlas/registry.json    registo tipado (formato compacto, ver src/lib/atlas/model.ts)
 *  - src/data/atlas/catalogLinks.json  tabela auditável ficha ↔ cartografia
 *  - docs/atlas/COBERTURA.md           auditoria de cobertura gerada
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import geodesic from 'geographiclib-geodesic'
import { clipPolyline } from 'lineclip'
import pc from 'polygon-clipping'
import type { MultiPolygon as PCMulti, Polygon as PCPoly } from 'polygon-clipping'
import { DAMS } from '../../src/data/dams'
import { riverForDam } from '../../src/data/rivers'
import { ATLAS_RIVERS } from '../../src/data/atlas/riverNames'
import type { CountryId } from '../../src/data/types'
import { encodeRegistry, structureAtlasId, type AtlasFeature, type AtlasRegistry, type AtlasSource, type CatalogLink, type RegionInfo } from '../../src/lib/atlas/model'
import { SLAB_BOX } from '../../src/lib/atlas/constants'
import type { Tier } from '../../src/lib/map/waterConfig'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE = join(ROOT, '.cache', 'map-src')
const OUT = join(ROOT, 'public', 'map', 'atlas')
const NE_COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19'
const NE_VERSION = '5.2.0-pre'
const NE_BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_COMMIT}/geojson`
/** Área com terra de contexto (inclui Açores, Madeira e Canárias, para os registos insulares). */
const CONTEXT_BOX: Box = [-32, 26, 14, 52]
const MADRID: Pos = [-3.7038, 40.4168]
/** Simplificação (metros): laje com forma reconhecível e paredes leves; contexto mais grosseiro. */
const SLAB_TOL_M = 150
const CONTEXT_TOL_M = 1500
const RIVER_TOL_M = 250
/** Troços de rio: comprimento máximo, para enquadrar uma parte útil de um rio longo. */
const SECTION_KM = 90

type Pos = [number, number]
type Ring = Pos[]
type Poly = Ring[]
type Box = [number, number, number, number]
interface GJFeature { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null }

async function cachedNE(name: string): Promise<{ features: GJFeature[] }> {
  mkdirSync(CACHE, { recursive: true })
  const p = join(CACHE, `ne_${NE_COMMIT.slice(0, 7)}_${name}.geojson`)
  if (!existsSync(p)) {
    const url = `${NE_BASE}/${name}.geojson`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
    writeFileSync(p, Buffer.from(await r.arrayBuffer()))
  }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const readJSON = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T

// ---------- geometria ----------
const WGS84 = geodesic.Geodesic.WGS84
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
const polysOf = (g: GJFeature['geometry']): Poly[] => (!g ? [] : g.type === 'Polygon' ? [g.coordinates as Poly] : g.type === 'MultiPolygon' ? (g.coordinates as Poly[]) : [])
const linesOf = (g: GJFeature['geometry']): Pos[][] => (!g ? [] : g.type === 'LineString' ? [g.coordinates as Pos[]] : g.type === 'MultiLineString' ? (g.coordinates as Pos[][]) : [])
function bboxOfPts(pts: Pos[], b: Box = [Infinity, Infinity, -Infinity, -Infinity]): Box {
  for (const [x, y] of pts) {
    if (x < b[0]) b[0] = x
    if (y < b[1]) b[1] = y
    if (x > b[2]) b[2] = x
    if (y > b[3]) b[3] = y
  }
  return b
}
const bboxOfPolys = (ps: Poly[]) => ps.reduce<Box>((b, p) => bboxOfPts(p[0], b), [Infinity, Infinity, -Infinity, -Infinity])
const overlaps = (a: Box, b: Box) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
const boxPoly = (b: Box): PCPoly => [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]]

/** Douglas-Peucker em metros (projeção equirretangular local). `closed`: preserva o fecho do anel. */
function simplify(r: Pos[], tolM: number, closed: boolean): Pos[] {
  const min = closed ? 4 : 2
  if (r.length <= min) return r
  const lat0 = (r[0][1] * Math.PI) / 180
  const kx = 111320 * Math.cos(lat0), ky = 110540
  const keep = new Uint8Array(r.length)
  keep[0] = keep[r.length - 1] = 1
  const stack: [number, number][] = [[0, r.length - 1]]
  const t2 = tolM * tolM
  while (stack.length) {
    const [i, j] = stack.pop()!
    const ax = r[i][0] * kx, ay = r[i][1] * ky, bx = r[j][0] * kx, by = r[j][1] * ky
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy
    let best = -1, bi = -1
    for (let k = i + 1; k < j; k++) {
      const px = r[k][0] * kx, py = r[k][1] * ky
      let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0
      t = Math.max(0, Math.min(1, t))
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d2 = ex * ex + ey * ey
      if (d2 > best) { best = d2; bi = k }
    }
    if (best > t2) { keep[bi] = 1; stack.push([i, bi], [bi, j]) }
  }
  const out = r.filter((_, k) => keep[k])
  return out.length >= min ? out : r
}
/** Simplifica e devolve polígonos válidos (a união normaliza anéis que a simplificação tenha cruzado). */
function simplifyPolys(ps: Poly[], tolM: number, minAreaDeg2 = 0): Poly[] {
  const s = ps
    .map((p) => p.map((r) => simplify(r, tolM, true)).filter((r) => r.length >= 4))
    .filter((p) => p.length && Math.abs(ringAreaDeg2(p[0])) > minAreaDeg2)
  if (!s.length) return []
  return (pc.union(s as PCPoly[]) as Poly[]).map((p) => p.map((r) => r.map(([x, y]) => [round(x, 4), round(y, 4)] as Pos)))
}
function ringAreaDeg2(r: Ring) {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1])
  return a / 2
}
function pointInRing([x, y]: Pos, r: Ring) {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const pointInPoly = (pt: Pos, p: Poly) => pointInRing(pt, p[0]) && !p.slice(1).some((h) => pointInRing(pt, h))
const lineKm = (l: Pos[]) => l.slice(1).reduce((s, b, i) => s + (WGS84.Inverse(l[i][1], l[i][0], b[1], b[0]).s12 ?? 0), 0) / 1000
const distKm = (a: Pos, b: Pos) => (WGS84.Inverse(a[1], a[0], b[1], b[0]).s12 ?? 0) / 1000

// ---------- regiões (Natural Earth admin-1) ----------
const REGION_PT: Record<string, string> = {
  Andalucía: 'Andaluzia', Aragón: 'Aragão', Asturias: 'Astúrias', 'Canary Is.': 'Canárias', Cantabria: 'Cantábria',
  'Castilla y León': 'Castela e Leão', 'Castilla-La Mancha': 'Castela-Mancha', Cataluña: 'Catalunha', Ceuta: 'Ceuta',
  Extremadura: 'Estremadura', 'Foral de Navarra': 'Navarra', Galicia: 'Galiza', 'Islas Baleares': 'Ilhas Baleares',
  'La Rioja': 'La Rioja', Madrid: 'Comunidade de Madrid', Melilla: 'Melilla', Murcia: 'Região de Múrcia', 'País Vasco': 'País Basco',
  Valenciana: 'Comunidade Valenciana', Lisbon: 'Lisboa', 'Norte, Centro': 'Norte / Centro', Norte: 'Norte', Centro: 'Centro',
  Alentejo: 'Alentejo', Algarve: 'Algarve',
}
interface Admin { country: CountryId | 'AD' | 'GI'; info: RegionInfo; polys: Poly[]; bbox: Box }
function buildAdmins(fc: { features: GJFeature[] }): Admin[] {
  const out: Admin[] = []
  for (const f of fc.features) {
    const p = f.properties as Record<string, string | null>
    const a3 = p.adm0_a3
    const country = a3 === 'PRT' ? 'PT' : a3 === 'ESP' ? 'ES' : a3 === 'AND' ? 'AD' : a3 === 'GIB' ? 'GI' : null
    if (!country) continue
    const polys = polysOf(f.geometry)
    const province = (p.name_pt as string) || (p.name as string)
    // Portugal: os distritos não encaixam nas regiões NUTS II (ex.: Santarém divide-se entre Centro e
    // Alentejo), por isso só se indica o distrito. Espanha: província dentro da comunidade autónoma (exato).
    const region =
      country === 'AD' ? 'Andorra' : country === 'GI' ? 'Gibraltar' : country === 'PT' ? (province === 'Azores' ? 'Açores' : province) : p.region ? REGION_PT[p.region] ?? String(p.region) : province
    out.push({ country, info: { province: province === 'Azores' ? 'Açores' : province, region }, polys, bbox: bboxOfPolys(polys) })
  }
  return out
}
function adminAt(admins: Admin[], pt: Pos): Admin | undefined {
  const hit = admins.find((a) => pt[0] >= a.bbox[0] && pt[0] <= a.bbox[2] && pt[1] >= a.bbox[1] && pt[1] <= a.bbox[3] && a.polys.some((p) => pointInPoly(pt, p)))
  if (hit) return hit
  // Pontos na linha de costa ou num estuário (fora do polígono simplificado): região mais próxima, até ~8 km.
  let best: Admin | undefined, bd = 8
  for (const a of admins) {
    if (pt[0] < a.bbox[0] - 0.1 || pt[0] > a.bbox[2] + 0.1 || pt[1] < a.bbox[1] - 0.1 || pt[1] > a.bbox[3] + 0.1) continue
    for (const p of a.polys) for (const v of p[0]) {
      const d = distKm(pt, v)
      if (d < bd) { bd = d; best = a }
    }
  }
  return best
}

// ---------- principal ----------
async function main() {
  const today = new Date().toISOString().slice(0, 10)
  mkdirSync(OUT, { recursive: true })
  const [land, admin0, admin1, riversA, riversB, places] = await Promise.all([
    cachedNE('ne_10m_land'),
    cachedNE('ne_10m_admin_0_countries'),
    cachedNE('ne_10m_admin_1_states_provinces'),
    cachedNE('ne_10m_rivers_lake_centerlines'),
    cachedNE('ne_10m_rivers_europe'),
    cachedNE('ne_10m_populated_places_simple'),
  ])

  // ---------- laje peninsular ----------
  const landPolys = land.features.flatMap((f) => polysOf(f.geometry)).filter((p) => overlaps(bboxOfPts(p[0]), CONTEXT_BOX))
  const inSlabBox = pc.intersection(landPolys.filter((p) => overlaps(bboxOfPts(p[0]), SLAB_BOX)) as PCPoly[], boxPoly(SLAB_BOX)) as Poly[]
  const slabRaw = inSlabBox.find((p) => pointInPoly(MADRID, p))
  if (!slabRaw) throw new Error('Laje: polígono peninsular não encontrado')
  const slab = simplifyPolys([slabRaw], SLAB_TOL_M, 0.002)
  if (slab.length !== 1) throw new Error(`Laje: esperava 1 polígono contínuo, obtive ${slab.length}`)
  for (const [n, pt] of [['Lisboa', [-9.14, 38.72]], ['Madrid', MADRID], ['Andorra', [1.52, 42.51]], ['Gibraltar', [-5.35, 36.14]], ['Porto', [-8.61, 41.15]], ['Barcelona', [2.17, 41.39]]] as [string, Pos][])
    if (!pointInPoly(pt, slab[0])) throw new Error(`Laje: ${n} fora do contorno`)

  // Linhas de corte: arestas da laje sobre o limite norte/leste do recorte.
  const eps = 1e-6
  const onCut = (a: Pos, b: Pos) =>
    (Math.abs(a[1] - SLAB_BOX[3]) < eps && Math.abs(b[1] - SLAB_BOX[3]) < eps) || (Math.abs(a[0] - SLAB_BOX[2]) < eps && Math.abs(b[0] - SLAB_BOX[2]) < eps)
  const cuts: Pos[][] = []
  for (const r of slab[0]) {
    let cur: Pos[] = []
    for (let i = 1; i < r.length; i++) {
      if (onCut(r[i - 1], r[i])) {
        if (!cur.length) cur.push(r[i - 1])
        cur.push(r[i])
      } else if (cur.length) { cuts.push(cur); cur = [] }
    }
    if (cur.length) cuts.push(cur)
  }
  if (!cuts.length) throw new Error('Laje: sem corte deliberado no limite norte')

  // Parte francesa dentro do recorte: mantém o contorno contínuo nos Pirenéus, mas atenuada.
  const fr = admin0.features.find((f) => (f.properties as Record<string, string>).ADM0_A3 === 'FRA')
  const veil = fr ? (pc.intersection(polysOf(fr.geometry).filter((p) => overlaps(bboxOfPts(p[0]), SLAB_BOX)) as PCPoly[], slab as PCPoly[]) as Poly[]) : []

  // Contexto: restante terra (ilhas, Norte de África, França para lá do corte).
  const ctxSimple = simplifyPolys(pc.intersection(landPolys as PCPoly[], boxPoly(CONTEXT_BOX)) as Poly[], CONTEXT_TOL_M, 0.00005)
  const context = pc.difference(ctxSimple as PCPoly[], slab as PCPoly[]) as Poly[]
  const touchesCut = (p: Poly) => p[0].some(([x, y]) => (Math.abs(y - SLAB_BOX[3]) < 1e-4 && x > SLAB_BOX[0] && x <= SLAB_BOX[2] + 1e-4) || (Math.abs(x - SLAB_BOX[2]) < 1e-4 && y > SLAB_BOX[1] && y <= SLAB_BOX[3] + 1e-4))
  const r4 = (ps: Poly[]) => ps.map((p) => p.map((r) => r.map(([x, y]) => [round(x, 4), round(y, 4)])))
  const bordersNE = await cachedNE('ne_10m_admin_0_boundary_lines_land')
  const borderLines = bordersNE.features
    .flatMap((f) => linesOf(f.geometry))
    .flatMap((l) => clipPolyline(l, SLAB_BOX) as Pos[][])
    .filter((l) => l.length > 1)
    .map((l) => simplify(l, SLAB_TOL_M, false).map(([x, y]) => [round(x, 4), round(y, 4)] as Pos))
  const slabFC = {
    type: 'FeatureCollection',
    properties: { box: SLAB_BOX, source: `Natural Earth 10 m land ${NE_VERSION} (${NE_COMMIT.slice(0, 7)}), domínio público; simplificação ${SLAB_TOL_M} m`, generatedAt: today },
    features: [
      { type: 'Feature', properties: { kind: 'slab' }, geometry: { type: 'Polygon', coordinates: r4(slab)[0] } },
      ...veil.map((p) => ({ type: 'Feature', properties: { kind: 'veil' }, geometry: { type: 'Polygon', coordinates: r4([p])[0] } })),
      ...context.map((p) => ({ type: 'Feature', properties: { kind: touchesCut(p) ? 'beyond' : 'context' }, geometry: { type: 'Polygon', coordinates: r4([p])[0] } })),
      ...cuts.map((l) => ({ type: 'Feature', properties: { kind: 'cut' }, geometry: { type: 'LineString', coordinates: l } })),
      // Fronteiras terrestres dentro do recorte (PT–ES, ES–FR, ES–AD, AD–FR, ES–GI): subtis, sem partir a peça.
      ...borderLines.map((l) => ({ type: 'Feature', properties: { kind: 'border' }, geometry: { type: 'LineString', coordinates: l } })),
      // Máscara (mar) fora da laje: na vista geral esconde o relevo e a terra fora da peça.
      ...(pc.difference(boxPoly(CONTEXT_BOX), slab as PCPoly[]) as Poly[]).map((p) => ({ type: 'Feature', properties: { kind: 'mask' }, geometry: { type: 'Polygon', coordinates: r4([p])[0] } })),
    ],
  }
  writeFileSync(join(OUT, 'slab.geojson'), JSON.stringify(slabFC))

  // Silhueta mínima para o cartão do Atlas no painel "Prepara a tua jornada" (SVG estático, sem WebGL).
  {
    const ring = simplify(slab[0][0], 9000, true)
    const lat0 = (40 * Math.PI) / 180
    const xs = ring.map(([x]) => x * Math.cos(lat0)), ys = ring.map(([, y]) => -y)
    const minX = Math.min(...xs), minY = Math.min(...ys), k = 300 / (Math.max(...xs) - minX)
    const d = ring.map((_, i) => `${i ? 'L' : 'M'}${((xs[i] - minX) * k).toFixed(1)} ${((ys[i] - minY) * k).toFixed(1)}`).join('') + 'Z'
    mkdirSync(join(ROOT, 'src', 'data', 'atlas'), { recursive: true })
    writeFileSync(join(ROOT, 'src', 'data', 'atlas', 'teaser.json'), JSON.stringify({ width: 300, height: Math.ceil((Math.max(...ys) - minY) * k), d, source: 'Natural Earth 10 m (domínio público), simplificado' }))
  }
  const inPeninsula = (pt: Pos) => pointInPoly(pt, slabRaw)

  const admins = buildAdmins(admin1)
  const regionOf = (pt: Pos) => adminAt(admins, pt)

  // ---------- fontes ----------
  const waterIndex = readJSON<{ generatedAt: string; source: { url: string; extractedAt: string; license: string; licenseUrl: string; attribution: string; notes: string } }>(join(ROOT, 'public', 'map', 'water', 'index.json'))
  const sources: Record<string, AtlasSource> = {
    'osm-albufeiras': {
      key: 'osm-albufeiras', name: 'OpenStreetMap — albufeiras (extração bquelhas/barragens)', url: waterIndex.source.url,
      license: waterIndex.source.license, licenseUrl: waterIndex.source.licenseUrl, attribution: waterIndex.source.attribution,
      observedAt: waterIndex.source.extractedAt, processedAt: waterIndex.generatedAt, notes: waterIndex.source.notes,
    },
    'osm-estruturas': {
      key: 'osm-estruturas', name: 'OpenStreetMap — barragens e açudes (extração bquelhas/barragens)', url: waterIndex.source.url,
      license: waterIndex.source.license, licenseUrl: waterIndex.source.licenseUrl, attribution: waterIndex.source.attribution,
      observedAt: waterIndex.source.extractedAt, processedAt: waterIndex.generatedAt, notes: 'Posição e forma de referência da estrutura física.',
    },
    'ne-rios': {
      key: 'ne-rios', name: 'Natural Earth 10 m — rios e suplemento europeu', url: `https://github.com/nvkelso/natural-earth-vector/tree/${NE_COMMIT}`,
      license: 'Domínio público', licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/', attribution: 'Natural Earth',
      observedAt: null, version: NE_VERSION, processedAt: today, notes: 'Escala 1:10 000 000: traçado generalizado, adequado à vista geral. Nomes unificados pela tabela src/data/atlas/riverNames.ts.',
    },
    'catchatlas-catalogo': {
      key: 'catchatlas-catalogo', name: 'Catálogo CatchAtlas (fichas de demonstração)', url: '',
      license: 'Dados de demonstração', attribution: 'CatchAtlas', observedAt: null, processedAt: today,
      notes: 'Posição aproximada da barragem; sem contorno nos dados cartográficos.',
    },
  }

  // ---------- catálogo ↔ cartografia ----------
  const catalogWater = readJSON<Record<string, { waterId: string; name: string; method: string; distanceKm: number }>>(join(ROOT, 'src', 'data', 'map', 'catalogWater.json'))
  const manualPath = join(ROOT, 'src', 'data', 'atlas', 'catalogLinks.manual.json')
  const manual = existsSync(manualPath) ? readJSON<{ catalogId: string; atlasId: string | null; reviewedAt: string; note: string }[]>(manualPath) : []
  const damById = new Map(DAMS.map((d) => [d.id, d]))

  // ---------- estruturas (OSM) ----------
  const items: AtlasFeature[] = []
  const structsByWater = new Map<string, string[]>()
  const structsByCatalog = new Map<string, string[]>()
  const sdir = join(ROOT, 'public', 'map', 'structures')
  const wdir = join(ROOT, 'public', 'map', 'water')
  const wIndex = readJSON<{ chunks: { key: string }[] }>(join(wdir, 'index.json'))
  const waterChunks = new Map(wIndex.chunks.map(({ key }) => [key, readJSON<{ features: GJFeature[] }>(join(wdir, `${key}.geojson`)).features]))
  const waterIds = new Set([...waterChunks.values()].flat().map((f) => String(f.properties.id)))
  for (const f of readdirSync(sdir).filter((n) => n.startsWith('s_') && n.endsWith('.geojson'))) {
    const chunk = f.replace('.geojson', '')
    for (const ft of readJSON<{ features: GJFeature[] }>(join(sdir, f)).features) {
      const p = ft.properties as Record<string, string | number | boolean | undefined>
      if (p.kind !== 'spt') continue
      const id = String(p.id)
      const rid = structureAtlasId(id, waterIds.has(id))
      if (p.water) structsByWater.set(String(p.water), [...(structsByWater.get(String(p.water)) ?? []), rid])
      if (p.catalog) structsByCatalog.set(String(p.catalog), [...(structsByCatalog.get(String(p.catalog)) ?? []), rid])
      if (!p.name) continue // estruturas sem nome: só no mapa (sem entrada na pesquisa)
      const pt = (ft.geometry!.coordinates as Pos).map((v) => round(v, 5)) as Pos
      const adm = regionOf(pt)
      const osmRef = id.replace(/^osm-/, '').replace('-', '/')
      items.push({
        // O mesmo objeto OSM pode estar marcado como albufeira e como estrutura: o ID do registo distingue-os.
        id: structureAtlasId(id, waterIds.has(id)), type: p.skind === 'dam' ? 'barragem' : 'acude', name: String(p.name), altNames: [],
        countries: adm && (adm.country === 'PT' || adm.country === 'ES') ? [adm.country] : [],
        ...(adm ? { region: adm.info } : {}),
        geometryRef: { layer: 'structures', chunk }, bbox: [pt[0], pt[1], pt[0], pt[1]], point: pt,
        ...(p.catalog ? { catalogId: String(p.catalog) } : {}),
        sourceRefs: [{ source: 'osm-estruturas', id: osmRef }], source: 'osm-estruturas', peninsular: inPeninsula(pt),
        ...(p.water ? { related: [String(p.water)] } : {}),
        extra: { ...(p.operator ? { operator: String(p.operator) } : {}), ...(p.height ? { heightM: String(p.height) } : {}) },
      })
    }
  }

  // ---------- albufeiras (OSM) ----------
  const catOfWater = new Map(Object.entries(catalogWater).map(([cid, w]) => [w.waterId, cid]))
  for (const [key, feats] of waterChunks) {
    const bboxes = new Map<string, Box>()
    for (const ft of feats) if (ft.properties.kind === 'area') bboxes.set(String(ft.properties.id), bboxOfPolys(polysOf(ft.geometry)))
    for (const ft of feats) {
      const p = ft.properties as Record<string, string | number>
      if (p.kind !== 'label') continue
      const id = String(p.id)
      const pt = ft.geometry!.coordinates as Pos
      const adm = regionOf(pt)
      const cid = catOfWater.get(id)
      const dam = cid ? damById.get(cid) : undefined
      const name = String(p.name || (p.dam ? `Albufeira (${p.dam})` : ''))
      const alt = new Set<string>([...String(p.alt || '').split(' | ').filter(Boolean)])
      if (p.short && p.short !== name) alt.add(String(p.short))
      if (p.dam) alt.add(String(p.dam))
      if (dam && dam.name !== name) alt.add(dam.name)
      const b = bboxes.get(id)!
      const basin = dam ? riverForDam(dam.river)?.basin : undefined
      items.push({
        id, type: 'albufeira', name, altNames: [...alt],
        countries: String(p.countries).split(',').filter(Boolean).sort().reverse() as CountryId[],
        ...(adm ? { region: adm.info } : {}),
        ...(basin ? { basin } : {}),
        geometryRef: { layer: 'water', chunk: key }, bbox: b.map((v) => round(v, 4)) as Box, point: [round(pt[0], 5), round(pt[1], 5)],
        ...(cid ? { catalogId: cid } : {}),
        sourceRefs: [{ source: 'osm-albufeiras', id: String(p.osm) }], source: 'osm-albufeiras',
        areaKm2: Number(p.area_km2), tier: Number(p.tier) as Tier, peninsular: inPeninsula(pt),
        ...(structsByWater.get(id) ? { related: structsByWater.get(id) } : {}),
        ...(p.dam ? { extra: { damName: String(p.dam) } } : {}),
      })
    }
  }

  // ---------- rios (Natural Earth) ----------
  const neToRiver = new Map(ATLAS_RIVERS.flatMap((r) => r.ne.map((n) => [n, r] as const)))
  const RIVER_BOX: Box = [SLAB_BOX[0], 35.8, SLAB_BOX[2], SLAB_BOX[3]]
  const riverLines = new Map<string, Pos[][]>()
  for (const f of [...riversA.features, ...riversB.features]) {
    const r = neToRiver.get(String(f.properties.name))
    if (!r) continue
    for (const l of linesOf(f.geometry))
      for (const part of clipPolyline(l, RIVER_BOX) as Pos[][])
        if (part.length > 1) riverLines.set(r.id, [...(riverLines.get(r.id) ?? []), simplify(part, RIVER_TOL_M, false).map(([x, y]) => [round(x, 4), round(y, 4)] as Pos)])
  }
  const towns = places.features
    .map((f) => ({ name: String(f.properties.name), rank: Number(f.properties.scalerank), at: f.geometry!.coordinates as Pos, iso: String(f.properties.adm0_a3) }))
    .filter((t) => (t.iso === 'PRT' || t.iso === 'ESP') && t.rank <= 9)
  const nearestTown = (pt: Pos) => towns.reduce((a, t) => (distKm(pt, t.at) < distKm(pt, a.at) ? t : a), towns[0])
  const riverFeatures: unknown[] = []
  for (const r of ATLAS_RIVERS) {
    const lines = (riverLines.get(r.id) ?? []).sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1])
    if (!lines.length) { console.warn(`rio sem geometria no NE: ${r.id}`); continue }
    const sections: { id: string; label: string; bbox: Box }[] = []
    const countries = new Set<CountryId>()
    let total = 0
    for (const l of lines) {
      const km = lineKm(l)
      total += km
      for (const v of l.filter((_, i) => i % 4 === 0)) {
        const a = regionOf(v)
        if (a?.country === 'PT' || a?.country === 'ES') countries.add(a.country)
      }
      // Divide em troços de até SECTION_KM, com cortes em vértices.
      const n = Math.max(1, Math.round(km / SECTION_KM))
      const target = km / n
      let cur: Pos[] = [l[0]], acc = 0
      const flush = () => {
        if (cur.length < 2) return
        const mid = cur[Math.floor(cur.length / 2)]
        const town = nearestTown(mid)
        const adm = regionOf(mid)
        const id = `ne-rio-${r.id}-t${sections.length + 1}`
        const label = `Troço perto de ${town.name}${adm ? ` · ${adm.info.province}` : ''}`
        sections.push({ id, label, bbox: bboxOfPts(cur).map((v) => round(v, 4)) as Box })
        const cs = new Set<string>()
        for (const v of cur.filter((_, i) => i % 3 === 0 || i === cur.length - 1)) {
          const a = regionOf(v)
          if (a?.country === 'PT' || a?.country === 'ES') cs.add(a.country)
        }
        riverFeatures.push({ type: 'Feature', properties: { id, river: `ne-rio-${r.id}`, name: r.name, rank: r.rank, countries: [...cs].sort().reverse().join(',') }, geometry: { type: 'LineString', coordinates: cur } })
      }
      for (let i = 1; i < l.length; i++) {
        acc += distKm(l[i - 1], l[i])
        cur.push(l[i])
        if (acc >= target && i < l.length - 1 && sections.length < 999) { flush(); cur = [l[i]]; acc = 0 }
      }
      flush()
    }
    const all = lines.flat()
    const longest = lines.reduce((a, b) => (lineKm(b) > lineKm(a) ? b : a))
    items.push({
      id: `ne-rio-${r.id}`, type: 'rio', name: r.name, altNames: r.alt, countries: [...countries].sort().reverse(),
      ...(regionOf(longest[Math.floor(longest.length / 2)]) && countries.size === 1 ? { region: regionOf(longest[Math.floor(longest.length / 2)])!.info } : {}),
      basin: r.basin, geometryRef: { layer: 'rivers' }, bbox: bboxOfPts(all).map((v) => round(v, 4)) as Box,
      point: longest[Math.floor(longest.length / 2)], sourceRefs: r.ne.map((n) => ({ source: 'ne-rios', id: `name=${n}` })), source: 'ne-rios',
      lengthKm: round(total, 0), tier: r.rank as Tier, peninsular: true, sections,
    })
  }
  writeFileSync(join(OUT, 'rivers.geojson'), JSON.stringify({ type: 'FeatureCollection', features: riverFeatures }))

  // ---------- fichas sem contorno (posição aproximada) e tabela de ligações ----------
  const links: CatalogLink[] = []
  for (const d of DAMS) {
    const w = catalogWater[d.id]
    const m = manual.find((x) => x.catalogId === d.id)
    const atlasId = m ? m.atlasId : w?.waterId ?? null
    links.push({
      catalogId: d.id, atlasId, structureIds: structsByCatalog.get(d.id) ?? [],
      status: m ? 'revista' : atlasId ? 'automatica' : 'sem-contorno',
      method: m ? `revisão humana: ${m.note}` : w ? w.method : 'nenhuma albufeira OSM com nome compatível a ≤ 15 km do ponto aproximado',
      distanceKm: w && !m ? w.distanceKm : null, reviewedAt: m?.reviewedAt ?? null,
    })
    if (!atlasId) {
      const pt: Pos = [d.approx.lon, d.approx.lat]
      const adm = regionOf(pt)
      items.push({
        id: `ficha-${d.id}`, type: 'albufeira', name: d.name, altNames: [], countries: [d.country],
        ...(adm ? { region: adm.info } : {}), ...(riverForDam(d.river) ? { basin: riverForDam(d.river)!.basin } : {}),
        geometryRef: { layer: 'none' }, bbox: [pt[0], pt[1], pt[0], pt[1]], point: pt, catalogId: d.id,
        sourceRefs: [{ source: 'catchatlas-catalogo', id: d.id }], source: 'catchatlas-catalogo', peninsular: inPeninsula(pt), approximate: true,
      })
    }
  }
  const ids = new Set(items.map((i) => i.id))
  if (ids.size !== items.length) {
    const seen = new Set<string>()
    const dup = items.filter((i) => (seen.has(i.id) ? true : (seen.add(i.id), false))).map((i) => `${i.id} (${i.type} ${i.name})`)
    throw new Error(`Registo: IDs repetidos: ${dup.slice(0, 10).join(", ")}`)
  }
  for (const l of links) if (l.atlasId && !ids.has(l.atlasId)) throw new Error(`Ligação ${l.catalogId} → ${l.atlasId}: elemento inexistente`)

  const registry: AtlasRegistry = { version: 1, generatedAt: today, sources, items }
  writeFileSync(join(OUT, 'registry.json'), JSON.stringify(encodeRegistry(registry)))
  mkdirSync(join(ROOT, 'src', 'data', 'atlas'), { recursive: true })
  writeFileSync(join(ROOT, 'src', 'data', 'atlas', 'catalogLinks.json'), JSON.stringify(links, null, 1))
  writeFileSync(
    join(OUT, 'LICENSE.txt'),
    `Atlas Ibérico (public/map/atlas/*)\n\nslab.geojson, rivers.geojson e as regiões do registry.json derivam do Natural Earth (domínio público),\nversão ${NE_VERSION}, commit ${NE_COMMIT}.\nOs elementos OSM do registry.json (albufeiras, barragens, açudes) derivam do OpenStreetMap:\n© contribuidores do OpenStreetMap, Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/\nGerado por scripts/map/build-atlas.ts em ${today}.\n`,
  )

  // ---------- auditoria de cobertura ----------
  const by = <T,>(xs: T[], k: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => ((m[k(x)] = (m[k(x)] ?? 0) + 1), m), {})
  const res = items.filter((i) => i.type === 'albufeira' && !i.approximate)
  const rivers = items.filter((i) => i.type === 'rio')
  const fmt = (o: Record<string, number>) => Object.entries(o).sort().map(([k, v]) => `${k || '—'}: ${v}`).join(' · ')
  const md = `# Auditoria de cobertura do Atlas Ibérico

Gerado por \`npm run atlas:build\` em ${today}. Não editar à mão.

## Cartografia (cobertura A)

| Tipo | Elementos | Notas |
|---|---|---|
| Albufeiras (OSM, ≥ 5 ha) | ${res.length} | com nome: ${res.filter((r) => r.name).length}; peninsulares: ${res.filter((r) => r.peninsular).length}; por país: ${fmt(by(res, (r) => r.countries.join('+')))} |
| Barragens com nome (estrutura, OSM) | ${items.filter((i) => i.type === 'barragem').length} | todas as estruturas (com e sem nome) aparecem no mapa à escala local |
| Açudes com nome (OSM) | ${items.filter((i) => i.type === 'acude').length} | idem |
| Rios principais (Natural Earth 10 m) | ${rivers.length} | ${rivers.reduce((s, r) => s + (r.lengthKm ?? 0), 0).toLocaleString('pt-PT')} km em ${rivers.reduce((s, r) => s + (r.sections?.length ?? 0), 0)} troços |
| Lagos e lagoas naturais | 0 no registo | só como água do mapa base (OpenFreeMap/OSM) à escala local, sem ID estável |
| Bacias hidrográficas | 0 polígonos | bacia indicada como atributo (tabela de rios e fichas); limites oficiais pendentes |

Albufeiras por escalão de área: ${fmt(by(res, (r) => `escalão ${r.tier}`))}.
Albufeiras peninsulares por distrito (PT) ou comunidade autónoma (ES): ${fmt(by(res.filter((r) => r.peninsular), (r) => r.region?.region ?? 'sem região'))}.

## Catálogo CatchAtlas (cobertura B)

- Fichas: ${DAMS.length}; ligadas a um contorno: ${links.filter((l) => l.atlasId).length}; sem contorno (posição aproximada): ${links.filter((l) => !l.atlasId).length}; revistas por humano: ${links.filter((l) => l.status === 'revista').length}.
- Fichas com estrutura física associada: ${links.filter((l) => l.structureIds.length).length}.
- Tabela completa: \`src/data/atlas/catalogLinks.json\` (método e distância de cada ligação).

## Limitações conhecidas

- O registo não contém "todas as massas de água": contém as albufeiras ≥ 5 ha marcadas como tal no OSM em 2026-11-02, as estruturas de barragem/açude do OSM e os rios do Natural Earth.
- Lagos e lagoas naturais, troços de rio de escala local, bacias e concessões completas exigem fontes ainda não ingeridas (ver docs/ATLAS.md, "Expansão da cobertura").
- Os contornos são de referência: não indicam o nível atual da água.
`
  mkdirSync(join(ROOT, 'docs', 'atlas'), { recursive: true })
  writeFileSync(join(ROOT, 'docs', 'atlas', 'COBERTURA.md'), md)

  const size = (p: string) => `${(readFileSync(p).length / 1024).toFixed(0)} KB`
  console.log(`laje: ${slab[0][0].length} vértices (${size(join(OUT, 'slab.geojson'))}); véu FR: ${veil.length}; contexto: ${context.length}; cortes: ${cuts.length}`)
  console.log(`rios: ${rivers.length} (${riverFeatures.length} troços, ${size(join(OUT, 'rivers.geojson'))})`)
  console.log(`registo: ${items.length} elementos (${size(join(OUT, 'registry.json'))}) · ${fmt(by(items, (i) => i.type))}`)
  console.log(`fichas: ${links.filter((l) => l.atlasId).length}/${DAMS.length} com contorno`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
