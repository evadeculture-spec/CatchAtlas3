import type { CountryId } from '../../data/types'
import { STRUCTURE_OFFSET, TIER_ZOOM_OFFSET } from '../map/waterConfig'
import type { AtlasFeature, AtlasType } from './model'

/** Normaliza para comparar: sem acentos, minúsculas, só letras e números. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Palavras genéricas: não servem para identificar, mas indicam o tipo procurado. */
const GENERIC: Record<string, AtlasType | null> = {
  albufeira: 'albufeira', embalse: 'albufeira', pantano: 'albufeira', panta: 'albufeira', encoro: 'albufeira', embassament: 'albufeira', represa: 'albufeira',
  barragem: 'barragem', presa: 'barragem', dique: 'barragem',
  acude: 'acude', azud: 'acude', resclosa: 'acude',
  lagoa: 'lagoa', lago: 'lagoa', laguna: 'lagoa', lagoas: 'lagoa',
  rio: 'rio', ribeira: 'rio', arroyo: 'rio', riu: 'rio', ribeiro: 'rio',
  de: null, do: null, da: null, dos: null, das: null, del: null, la: null, el: null, los: null, las: null, o: null, a: null,
}

export interface SearchHit {
  item: AtlasFeature
  score: number
  /** Nome alternativo que coincidiu (para explicar resultados como "Tajo" → "Tejo / Tajo"). */
  matchedAlt?: string
}

export interface SearchQuery {
  /** Tokens identificadores (sem palavras genéricas). */
  tokens: string[]
  /** Tipo sugerido pelas palavras genéricas ("rio tejo" → rio). */
  typeHint: AtlasType | null
  full: string
}

export function parseQuery(q: string): SearchQuery {
  const full = normalize(q)
  const words = full.split(' ').filter(Boolean)
  let typeHint: AtlasType | null = null
  const tokens: string[] = []
  for (const w of words) {
    if (w in GENERIC) {
      typeHint ??= GENERIC[w]
      continue
    }
    tokens.push(w)
  }
  // Só palavras genéricas ("barragem"): procura-as como texto.
  return { tokens: tokens.length ? tokens : words, typeHint, full }
}

function scoreName(name: string, q: SearchQuery): number {
  const n = normalize(name)
  if (!n) return 0
  if (n === q.full) return 100
  const words = n.split(' ')
  const stripped = words.filter((w) => !(w in GENERIC)).join(' ')
  if (stripped && stripped === q.tokens.join(' ')) return 95
  if (stripped.startsWith(q.tokens.join(' ')) || n.startsWith(q.full)) return 80
  if (q.tokens.every((t) => words.some((w) => w.startsWith(t)))) return 60
  if (n.includes(q.tokens.join(' '))) return 40
  return 0
}

export interface SearchFilters {
  countries?: CountryId[]
  types?: AtlasType[]
  favorites?: Set<string> | null
}

/** Filtros partilhados pelo mapa, pela lista e pela pesquisa. */
export function matchesFilters(it: AtlasFeature, f: SearchFilters): boolean {
  if (f.countries?.length === 1 && !it.countries.includes(f.countries[0])) return false
  if (f.types?.length) {
    const t = it.type === 'acude' ? 'barragem' : it.type
    if (!f.types.includes(t)) return false
  }
  if (f.favorites && !f.favorites.has(it.id)) return false
  return true
}

/**
 * Pesquisa por nome e nomes alternativos (tolerante a acentos e a termos genéricos).
 * Ordena por qualidade da correspondência e depois por relevância (ficha, dimensão, nome).
 */
export function searchAtlas(items: AtlasFeature[], query: string, filters: SearchFilters = {}, limit = 30): SearchHit[] {
  const q = parseQuery(query)
  if (q.full.length < 2) return []
  const hits: SearchHit[] = []
  for (const it of items) {
    if (!it.name && !it.altNames.length) continue
    if (!matchesFilters(it, filters)) continue
    let best = scoreName(it.name, q)
    let matchedAlt: string | undefined
    for (const a of it.altNames) {
      const s = scoreName(a, q) - 2
      if (s > best) {
        best = s
        matchedAlt = a
      }
    }
    if (!best) continue
    let score = best
    if (q.typeHint && (it.type === q.typeHint || (q.typeHint === 'barragem' && it.type === 'albufeira' && it.catalogId))) score += 18
    if (it.catalogId) score += 12
    if (it.type === 'rio') score += 4 - (it.tier ?? 3)
    if (it.tier && it.tier <= 2) score += 5
    if (!it.peninsular) score -= 6
    score += Math.min(4, Math.log10(1 + (it.areaKm2 ?? it.lengthKm ?? 0)))
    hits.push({ item: it, score, ...(matchedAlt ? { matchedAlt } : {}) })
  }
  hits.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, 'pt'))
  return hits.slice(0, limit)
}

// ---------- lista "Nesta vista" (sincronizada com o que o mapa desenha) ----------

/** O elemento está desenhado neste zoom? (mesmos limiares relativos que o mapa; `rel` = zoom − fit) */
export function visibleAtZoom(it: AtlasFeature, rel: number): boolean {
  if (it.type === 'albufeira') return it.approximate ? true : rel >= TIER_ZOOM_OFFSET[it.tier ?? 5]
  if (it.type === 'rio') return (it.tier ?? 3) === 1 || (it.tier === 2 ? rel >= 0.8 : rel >= 1.6)
  if (it.type === 'barragem') return rel >= STRUCTURE_OFFSET.damPoint
  if (it.type === 'acude') return rel >= STRUCTURE_OFFSET.weirPoint
  return true
}

const overlaps = (a: number[], b: number[]) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

/** Elementos na área visível, pela ordem da lista: favoritas e fichas primeiro, depois dimensão. */
export function itemsInView(items: AtlasFeature[], bounds: [number, number, number, number], rel: number, filters: SearchFilters, favorites: Set<string>): AtlasFeature[] {
  const rank = (it: AtlasFeature) => (favorites.has(it.id) ? 0 : it.catalogId ? 1 : it.name ? 2 : 3)
  return items
    .filter((it) => overlaps(it.bbox, bounds) && visibleAtZoom(it, rel) && matchesFilters(it, filters))
    .sort((a, b) => rank(a) - rank(b) || (b.areaKm2 ?? (b.lengthKm ?? 0) / 10) - (a.areaKm2 ?? (a.lengthKm ?? 0) / 10) || a.name.localeCompare(b.name, 'pt'))
}
