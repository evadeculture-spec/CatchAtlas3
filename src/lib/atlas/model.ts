/**
 * Modelo de dados do Atlas Ibérico (partilhado pelo pipeline `npm run atlas:build` e pela aplicação).
 *
 * Duas coberturas diferentes, nunca confundidas:
 *  A. Cartografia: a hidrografia visível no mapa (albufeiras, rios, estruturas). Cada elemento tem
 *     um ID estável, a fonte, a licença e as datas.
 *  B. Catálogo CatchAtlas: as fichas (`src/data/dams.ts`). Um elemento cartográfico pode não ter
 *     ficha; uma ficha liga-se à cartografia pela tabela explícita `src/data/atlas/catalogLinks.json`.
 */
import type { CountryId } from '../../data/types'
import type { Tier } from '../map/waterConfig'

/** Tipos distintos: a albufeira (massa de água) não é a barragem (estrutura) nem o troço de rio. */
export type AtlasType = 'albufeira' | 'lagoa' | 'rio' | 'barragem' | 'acude' | 'bacia' | 'zona'

export const TYPE_LABEL: Record<AtlasType, string> = {
  albufeira: 'Albufeira',
  lagoa: 'Lago ou lagoa',
  rio: 'Curso de água',
  barragem: 'Barragem (estrutura)',
  acude: 'Açude',
  bacia: 'Bacia hidrográfica',
  zona: 'Zona ou concessão de pesca',
}
/** Tipos com filtro próprio no atlas (os outros ainda não têm cobertura própria nos dados). */
export const FILTER_TYPES: { id: AtlasType; label: string }[] = [
  { id: 'albufeira', label: 'Albufeiras' },
  { id: 'rio', label: 'Rios' },
  { id: 'barragem', label: 'Barragens e açudes' },
]

export interface AtlasSource {
  key: string
  name: string
  url: string
  license: string
  licenseUrl?: string
  attribution: string
  /** Data a que os dados de origem se referem (extração ou observação). null quando a fonte não a publica. */
  observedAt: string | null
  /** Versão publicada pela fonte (quando não há data de observação). */
  version?: string
  /** Data em que a CatchAtlas processou estes dados: é a "atualização do registo". */
  processedAt: string
  notes?: string
}

/** Identificador do elemento na fonte de origem (ex.: OSM relation/5366185). */
export interface SourceRef {
  source: string
  id: string
  url?: string
}

/** Onde está a geometria (o registo não a duplica). */
export interface GeometryRef {
  layer: 'water' | 'structures' | 'rivers' | 'none'
  /** Bloco de 1° com a geometria detalhada (ex.: "c_-8_39"). */
  chunk?: string
}

export interface RegionInfo {
  /** Distrito (PT), província (ES) ou equivalente; Natural Earth admin-1. */
  province: string
  /** Região (PT, NUTS II indicada pela fonte) ou comunidade autónoma (ES). */
  region: string
}

export interface AtlasSection {
  id: string
  label: string
  bbox: [number, number, number, number]
}

export interface AtlasFeature {
  id: string
  type: AtlasType
  name: string
  altNames: string[]
  countries: CountryId[]
  region?: RegionInfo
  basin?: string
  geometryRef: GeometryRef
  bbox: [number, number, number, number]
  /** Ponto de apresentação (interior à geometria quando é um polígono). */
  point: [number, number]
  /** Ficha CatchAtlas ligada pela tabela de correspondências (opcional). */
  catalogId?: string
  sourceRefs: SourceRef[]
  /** Chave da fonte em `AtlasRegistry.sources`. */
  source: string
  /** Área geodésica do contorno (km²), para massas de água. */
  areaKm2?: number
  /** Comprimento (km) para rios. */
  lengthKm?: number
  tier?: Tier
  /** Dentro do recorte peninsular (falso: Baleares, Canárias, Açores, Madeira, Ceuta, Melilla). */
  peninsular: boolean
  /** Elementos relacionados (ex.: estrutura da barragem ↔ albufeira). */
  related?: string[]
  /** Troços de um rio longo, para o enquadrar por partes. */
  sections?: AtlasSection[]
  /** Posição aproximada (só para fichas sem contorno nos dados cartográficos). */
  approximate?: boolean
  extra?: { operator?: string; heightM?: string; damName?: string }
}

export interface AtlasRegistry {
  version: 1
  generatedAt: string
  sources: Record<string, AtlasSource>
  items: AtlasFeature[]
}

// ---------- formato compacto (registry.json) ----------
// Linhas em vez de objetos: o registo tem ~5 000 elementos e é descarregado só quando é preciso
// (pesquisa, lista ou ficha), nunca na abertura do mapa.

const TYPE_CODES: AtlasType[] = ['albufeira', 'lagoa', 'rio', 'barragem', 'acude', 'bacia', 'zona']

export type RegistryRow = [
  id: string,
  type: number,
  name: string,
  alt: string,
  countries: string,
  region: number,
  bbox: number[],
  point: number[],
  metric: number,
  tier: number,
  catalog: string,
  source: number,
  sourceRefs: string,
  geom: string,
  extra: string,
]

export interface RegistryFile {
  version: 1
  generatedAt: string
  sources: AtlasSource[]
  /** "PT|Castelo Branco|Centro" */
  regions: string[]
  basins: string[]
  rows: RegistryRow[]
}

/** "w:c_-8_39" | "s:s_-8_39" | "r" | "" */
function encodeGeom(g: GeometryRef) {
  if (g.layer === 'none') return ''
  const p = g.layer === 'water' ? 'w' : g.layer === 'structures' ? 's' : 'r'
  return g.chunk ? `${p}:${g.chunk}` : p
}
function decodeGeom(s: string): GeometryRef {
  if (!s) return { layer: 'none' }
  const [p, chunk] = s.split(':')
  return { layer: p === 'w' ? 'water' : p === 's' ? 'structures' : 'rivers', ...(chunk ? { chunk } : {}) }
}

export function encodeRegistry(reg: AtlasRegistry): RegistryFile {
  const sources = Object.values(reg.sources)
  const srcIdx = new Map(sources.map((s, i) => [s.key, i]))
  const regions: string[] = []
  const regionIdx = new Map<string, number>()
  const basins: string[] = []
  const basinIdx = new Map<string, number>()
  const idxOf = (m: Map<string, number>, list: string[], k: string) => {
    let i = m.get(k)
    if (i === undefined) {
      i = list.length
      list.push(k)
      m.set(k, i)
    }
    return i
  }
  const rows = reg.items.map((it): RegistryRow => {
    const region = it.region ? idxOf(regionIdx, regions, `${it.countries[0] ?? ''}|${it.region.province}|${it.region.region}`) : -1
    const extra: Record<string, unknown> = {}
    if (it.related?.length) extra.r = it.related
    if (it.sections?.length) extra.s = it.sections.map((s) => [s.id, s.label, s.bbox])
    if (it.approximate) extra.a = 1
    if (it.extra && Object.keys(it.extra).length) extra.x = it.extra
    if (it.basin) extra.b = idxOf(basinIdx, basins, it.basin)
    if (!it.peninsular) extra.e = 1
    return [
      it.id,
      TYPE_CODES.indexOf(it.type),
      it.name,
      it.altNames.join('|'),
      it.countries.join(','),
      region,
      it.bbox,
      it.point,
      it.areaKm2 ?? it.lengthKm ?? 0,
      it.tier ?? 0,
      it.catalogId ?? '',
      srcIdx.get(it.source) ?? -1,
      it.sourceRefs.map((r) => `${srcIdx.get(r.source) ?? -1}~${r.id}`).join('|'),
      encodeGeom(it.geometryRef),
      Object.keys(extra).length ? JSON.stringify(extra) : '',
    ]
  })
  return { version: 1, generatedAt: reg.generatedAt, sources, regions, basins, rows }
}

/**
 * ID de registo de uma estrutura (barragem/açude). Reutiliza o ID cartográfico; só quando o mesmo
 * objeto OSM é também a albufeira (acontece na fonte) acrescenta "-estrutura", para não colidir.
 */
export const structureAtlasId = (mapId: string, collidesWithWater: boolean) => (collidesWithWater ? `${mapId}-estrutura` : mapId)

/** URL público de um elemento na fonte, quando existe. */
export function sourceUrl(source: AtlasSource | undefined, id: string): string | undefined {
  if (!source) return undefined
  if (source.key.startsWith('osm') && /^(node|way|relation)\/\d+$/.test(id)) return `https://www.openstreetmap.org/${id}`
  return undefined
}

export function decodeRegistry(file: RegistryFile): AtlasRegistry {
  const sources = Object.fromEntries(file.sources.map((s) => [s.key, s]))
  const items = file.rows.map((r): AtlasFeature => {
    const [id, type, name, alt, countries, region, bbox, point, metric, tier, catalog, src, refs, geom, extraJson] = r
    const t = TYPE_CODES[type] ?? 'albufeira'
    const extra = extraJson ? (JSON.parse(extraJson) as { r?: string[]; s?: [string, string, number[]][]; a?: 1; x?: AtlasFeature['extra']; b?: number; e?: 1 }) : {}
    const reg = region >= 0 ? file.regions[region]?.split('|') : undefined
    const sourceKey = file.sources[src]?.key ?? ''
    return {
      id,
      type: t,
      name,
      altNames: alt ? alt.split('|') : [],
      countries: (countries ? countries.split(',') : []) as CountryId[],
      ...(reg ? { region: { province: reg[1], region: reg[2] } } : {}),
      ...(extra.b !== undefined ? { basin: file.basins[extra.b] } : {}),
      geometryRef: decodeGeom(geom),
      bbox: bbox as AtlasFeature['bbox'],
      point: point as AtlasFeature['point'],
      ...(catalog ? { catalogId: catalog } : {}),
      sourceRefs: refs
        ? refs.split('|').map((x) => {
            const [si, rid] = x.split('~')
            const s = file.sources[Number(si)]
            return { source: s?.key ?? '', id: rid, ...(sourceUrl(s, rid) ? { url: sourceUrl(s, rid) } : {}) }
          })
        : [],
      source: sourceKey,
      ...(t === 'rio' ? { lengthKm: metric } : metric ? { areaKm2: metric } : {}),
      ...(tier ? { tier: tier as Tier } : {}),
      peninsular: !extra.e,
      ...(extra.r ? { related: extra.r } : {}),
      ...(extra.s ? { sections: extra.s.map(([sid, label, b]) => ({ id: sid, label, bbox: b as AtlasSection['bbox'] })) } : {}),
      ...(extra.a ? { approximate: true } : {}),
      ...(extra.x ? { extra: extra.x } : {}),
    }
  })
  return { version: 1, generatedAt: file.generatedAt, sources, items }
}

/** Relação explícita e auditável entre fichas do catálogo e elementos cartográficos. */
export interface CatalogLink {
  catalogId: string
  /** Elemento cartográfico da massa de água (albufeira), ou null quando não há contorno nos dados. */
  atlasId: string | null
  /** Estruturas físicas (barragem) associadas na fonte à mesma albufeira. */
  structureIds: string[]
  status: 'automatica' | 'revista' | 'sem-contorno'
  method: string
  distanceKm: number | null
  /** Data da última verificação humana (null: só correspondência automática). */
  reviewedAt: string | null
}
