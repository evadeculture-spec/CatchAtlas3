/**
 * Importação do Excel do Atlas Ibérico da Carpa → catálogo da app (lógica pura e determinística).
 *
 * Garantias:
 *  - Identidade estável por CONTEÚDO (identificador oficial quando existe; senão país + nome normalizado +
 *    província), nunca pelo número da linha. Repetir a mesma importação produz o mesmo catálogo (zero duplicados).
 *  - Cada linha relevante tem destino explícito ou motivo de exclusão (relatório `rows`).
 *  - Coincidências ambíguas (homónimos, várias águas do Atlas possíveis, eixos trocados) vão para revisão.
 *  - Evidências independentes sobre a mesma água conservam-se (proveniência de cada folha/linha).
 *  - Correções humanas (`correcoes`) são aplicadas DEPOIS, pela chave estável, e nunca são reescritas pela
 *    importação. Pins privados não fazem parte do catálogo (ficam no servidor, ligados pela chave do setor).
 *  - Nada é inventado: sem coordenadas → «sem-coordenadas»; ponto da água ≠ setor; desconhecido ≠ não.
 */
import type { CarpAccess, CarpCatalog, CarpConcession, CarpEvidence, CarpRule, CarpSector, CarpSource, CarpWater, Country, LngLat, Provenance, Tri, WaterType, Activity } from '../../src/lib/carpa/model'
import { excelDate, type Cell, type Sheet } from './xlsx'

export interface Mapping {
  folhas: { papel: string; padroes: string[] }[]
  colunas: Record<string, string[]>
  competentes: string[]
}
export interface AtlasIndexItem {
  id: string
  name: string
  alt: string[]
  country: string
  bbox: [number, number, number, number]
  refs: string[]
}
export interface Correction {
  /** Chave estável da entidade (água, setor, regra…). */
  key: string
  set: Record<string, unknown>
  autor?: string
  data?: string
  motivo?: string
}
export interface RowOutcome {
  sheet: string
  row: number
  role: string
  destination: string
  key?: string
  reason?: string
}
export interface ReviewItem {
  kind: 'homonimo' | 'atlas-ambiguo' | 'eixos-trocados' | 'fora-do-ambito' | 'conflito-dados' | 'candidato' | 'sintese-sem-registo'
  keys: string[]
  rows: Provenance[]
  detail: string
}
export interface ImportReport {
  sheets: { name: string; role: string; rows: number; headerRow: number | null; mapped: Record<string, string>; unmapped: string[] }[]
  rows: RowOutcome[]
  review: ReviewItem[]
  candidates: { key: string; name: string; country: string | null; provenance: Provenance[] }[]
  exclusions: { sheet: string; row: number; reason: string }[]
  lacunas: string[]
  totals: Record<string, number>
}

// ------------------------------------------------------------------ normalização
export const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
export const slug = (s: unknown) => norm(s).replace(/ /g, '-').slice(0, 80) || 'sem-nome'
const str = (v: Cell | undefined): string | null => (v == null || v === '' ? null : String(v).trim() || null)

/** Número com vírgula ou ponto decimal; DMS simples («39°36'12"N»). */
export function num(v: Cell | undefined): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  const dms = /^(-?\d+(?:[.,]\d+)?)\s*[°º]\s*(?:(\d+(?:[.,]\d+)?)\s*['’′])?\s*(?:(\d+(?:[.,]\d+)?)\s*["”″])?\s*([NSEWOnsewo])?$/.exec(s)
  if (dms) {
    const [d, m, sec] = [dms[1], dms[2] ?? '0', dms[3] ?? '0'].map((x) => Number(x.replace(',', '.')))
    let val = Math.abs(d) + m / 60 + sec / 3600
    if (d < 0 || /[SWOswo]/.test(dms[4] ?? '')) val = -val
    return val
  }
  const n = Number(s.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
export function tri(v: Cell | undefined): Tri {
  const s = norm(v)
  if (!s) return 'desconhecido'
  if (/^(sim|si|s|yes|y|x|verdadeiro|true|confirmad[oa]|presente|documentad[oa]|permitid[oa])$/.test(s) || s === '1') return 'sim'
  if (/^(nao|no|n|nunca|falso|false|ausente|proibid[oa]|prohibid[oa])$/.test(s) || s === '0') return 'nao'
  return 'desconhecido'
}

/** Âmbito: Portugal continental e Espanha peninsular. */
const IN_SCOPE = (lng: number, lat: number) => lng >= -9.6 && lng <= 3.4 && lat >= 35.9 && lat <= 43.9
/** Valida a ordem dos eixos (lat, lon). Devolve o ponto [lng, lat] ou a razão para revisão. */
export function point(lat: number | null, lon: number | null): { p: LngLat | null; issue?: 'eixos-trocados' | 'fora-do-ambito' } {
  if (lat == null || lon == null) return { p: null }
  if (IN_SCOPE(lon, lat)) return { p: [round6(lon), round6(lat)] }
  if (IN_SCOPE(lat, lon)) return { p: null, issue: 'eixos-trocados' }
  return { p: null, issue: 'fora-do-ambito' }
}
const round6 = (v: number) => Math.round(v * 1e6) / 1e6

const COUNTRY = (v: Cell | undefined): Country | null => {
  const s = norm(v)
  if (/^(pt|portugal|prt)$/.test(s)) return 'PT'
  if (/^(es|espanha|espana|spain|esp)$/.test(s)) return 'ES'
  return null
}
const TYPE = (v: Cell | undefined, name: string): WaterType => {
  const s = norm(v) || norm(name)
  if (/carpodromo/.test(s)) return 'carpodromo'
  if (/pista/.test(s)) return 'pista'
  if (/concess|coto/.test(s)) return 'concessao'
  if (/acude|azud/.test(s)) return 'acude'
  if (/albufeira|embalse|pantano/.test(s)) return 'albufeira'
  if (/barragem|presa/.test(s)) return 'barragem'
  if (/lagoa|laguna|lago/.test(s)) return 'lagoa'
  if (/ribeira|ribeiro|arroyo|canal|curso/.test(s)) return 'curso-agua'
  if (/\brio\b/.test(s)) return 'rio'
  return 'outro'
}
const ACTIVITY = (v: Cell | undefined): Activity => {
  const s = norm(v)
  if (!s) return 'todas'
  if (/prova|concurso|competic|campeonato/.test(s)) return 'provas'
  if (/carp\s?fishing/.test(s) && /noturn|nocturn|noite|noche/.test(s)) return 'carpfishing-noturno'
  if (/carp\s?fishing/.test(s)) return 'carpfishing'
  if (/individual|lazer|ludica|recreativ/.test(s)) return 'pesca-individual'
  if (/todas|qualquer|geral|general/.test(s)) return 'todas'
  return 'pesca-individual'
}
const EFFECT = (v: Cell | undefined): 'permitida' | 'proibida' | null => {
  const s = norm(v)
  if (/proib|prohib|vedad|interdit|nao permitid/.test(s)) return 'proibida'
  if (/permit|autoriz|livre|libre|^sim$|^si$/.test(s)) return 'permitida'
  return null
}

// ------------------------------------------------------------------ cabeçalhos
function headerMatch(header: string, mapping: Mapping): string | null {
  const h = norm(header)
  if (!h) return null
  for (const [k, syn] of Object.entries(mapping.colunas)) if (syn.some((x) => norm(x) === h)) return k
  // Cabeçalhos mais longos («Latitude (WGS84)»): o sinónimo mais longo contido como palavras inteiras.
  let best: { k: string; len: number } | null = null
  for (const [k, syn] of Object.entries(mapping.colunas))
    for (const x of syn) {
      const nx = norm(x)
      if (nx.length >= 3 && new RegExp(`(^| )${nx}( |$)`).test(h) && (!best || nx.length > best.len)) best = { k, len: nx.length }
    }
  return best?.k ?? null
}
function locateHeader(sheet: Sheet, mapping: Mapping) {
  for (const r of sheet.rows.slice(0, 12)) {
    const cols: Record<string, number> = {}
    const mapped: Record<string, string> = {}
    const unmapped: string[] = []
    r.cells.forEach((c, i) => {
      if (c == null) return
      const k = headerMatch(String(c), mapping)
      if (k && cols[k] === undefined) {
        cols[k] = i
        mapped[String(c)] = k
      } else unmapped.push(String(c))
    })
    const filled = r.cells.filter((c) => c != null).length
    // Cabeçalho: ≥2 colunas reconhecidas, ou uma reconhecida numa linha com várias colunas (folhas de controlo).
    if (Object.keys(cols).length >= 2 || (Object.keys(cols).length >= 1 && filled >= 2)) return { headerRow: r.row, cols, mapped, unmapped }
  }
  return null
}
const roleOf = (name: string, mapping: Mapping) => mapping.folhas.find((f) => f.padroes.some((p) => norm(name).includes(norm(p))))?.papel ?? 'desconhecida'

// ------------------------------------------------------------------ importação
export function buildCatalog(
  sheets: Sheet[],
  mapping: Mapping,
  opts: { file: string; sha256: string; importedAt: string; atlas?: AtlasIndexItem[]; corrections?: Correction[] },
): { catalog: CarpCatalog; report: ImportReport } {
  const waters = new Map<string, CarpWater>()
  const sectors = new Map<string, CarpSector>()
  const evidence = new Map<string, CarpEvidence>()
  const rules = new Map<string, CarpRule>()
  const access = new Map<string, CarpAccess>()
  const sources = new Map<string, CarpSource>()
  const concessions = new Map<string, CarpConcession>()
  const report: ImportReport = { sheets: [], rows: [], review: [], candidates: [], exclusions: [], lacunas: [], totals: {} }
  const candidates = new Map<string, ImportReport['candidates'][number]>()
  const syntheseRefs: { ref: string; prov: Provenance }[] = []
  const competentRe = new RegExp(`(^| )(${mapping.competentes.map((c) => norm(c)).join('|')})( |$)`)

  const addProv = (list: Provenance[], p: Provenance) => {
    if (!list.some((x) => x.sheet === p.sheet && x.row === p.row)) list.push(p)
  }
  const sourceFor = (g: (k: string) => Cell | undefined, prov: Provenance): string | null => {
    const org = str(g('organismo')), url = str(g('url')), ref = str(g('referencia'))
    if (!org && !url && !ref) return null
    const key = `fonte:${slug(url ?? `${org ?? ''} ${ref ?? ''}`)}`
    const comp = g('competente') != null ? tri(g('competente')) : org && competentRe.test(norm(org)) ? 'sim' : org ? 'desconhecido' : 'desconhecido'
    const verifiedAt = excelDate(g('verificado') ?? null)
    const lang = norm(g('idioma')).startsWith('es') ? 'es' : norm(g('idioma')).startsWith('pt') ? 'pt' : null
    const prev = sources.get(key)
    if (prev) {
      // Evidências independentes da mesma fonte: guarda a verificação mais recente conhecida.
      if (verifiedAt && (!prev.verifiedAt || verifiedAt > prev.verifiedAt)) prev.verifiedAt = verifiedAt
      if (prev.competent === 'desconhecido' && comp !== 'desconhecido') prev.competent = comp
    } else sources.set(key, { key, organism: org, url, ref, lang, competent: comp, verifiedAt })
    void prov
    return key
  }

  for (const sheet of sheets) {
    const role = roleOf(sheet.name, mapping)
    const head = locateHeader(sheet, mapping)
    report.sheets.push({ name: sheet.name, role, rows: sheet.rows.length, headerRow: head?.headerRow ?? null, mapped: head?.mapped ?? {}, unmapped: head?.unmapped ?? [] })
    const body = head ? sheet.rows.filter((r) => r.row > head.headerRow) : sheet.rows
    // Linhas de título e o próprio cabeçalho também ficam registadas (nenhuma linha some sem destino).
    if (head)
      for (const r of sheet.rows.filter((x) => x.row <= head.headerRow))
        report.rows.push({ sheet: sheet.name, row: r.row, role, destination: r.row === head.headerRow ? 'cabecalho' : 'titulo', reason: r.row === head.headerRow ? undefined : 'linha acima do cabeçalho' })
    for (const r of body) {
      const prov: Provenance = { sheet: sheet.name, row: r.row }
      const g = (k: string) => (head && head.cols[k] !== undefined ? r.cells[head.cols[k]] : undefined)
      const out = (destination: string, key?: string, reason?: string) => report.rows.push({ sheet: sheet.name, row: r.row, role, destination, ...(key ? { key } : {}), ...(reason ? { reason } : {}) })

      if (!head) {
        if (['leia_me', 'cobertura', 'auditoria', 'novidades', 'sintese'].includes(role)) out('informativa', undefined, `folha «${role}» sem colunas de dados reconhecidas`)
        else out('excluida', undefined, 'folha sem cabeçalho reconhecido: ajustar scripts/carpa/mapeamento.json')
        continue
      }
      if (role === 'leia_me' || role === 'cobertura' || role === 'auditoria' || role === 'novidades' || role === 'desconhecida') {
        // Folhas de controlo: não criam entidades. A síntese/novidades referenciam registos (verificados abaixo).
        if (role === 'novidades' && str(g('id'))) syntheseRefs.push({ ref: str(g('id'))!, prov })
        out('informativa', undefined, `folha «${role}»: controlo/resumo, sem entidades novas`)
        continue
      }
      if (role === 'sintese') {
        if (str(g('id'))) syntheseRefs.push({ ref: str(g('id'))!, prov })
        out('informativa', undefined, 'síntese: referencia registos já presentes')
        continue
      }
      if (role === 'fontes_gis') {
        const k = sourceFor(g, prov)
        out(k ? 'fonte' : 'excluida', k ?? undefined, k ? undefined : 'linha sem organismo, URL nem referência')
        continue
      }
      if (role === 'exclusoes') {
        const reason = str(g('motivo')) ?? str(g('notas')) ?? 'excluída pela folha de exclusões (sem motivo indicado)'
        report.exclusions.push({ sheet: sheet.name, row: r.row, reason })
        out('excluida', undefined, reason)
        continue
      }

      const name = str(g('agua'))
      const country = COUNTRY(g('pais'))
      if (!name) {
        out('excluida', undefined, 'sem nome de água')
        continue
      }
      const official = str(g('id_oficial'))
      const province = str(g('provincia'))
      const waterKey = official ? `oficial:${slug(official)}` : `${(country ?? 'xx').toLowerCase()}:${slug(name)}${province ? `:${slug(province)}` : ''}`

      if (role === 'candidatos') {
        const c = candidates.get(waterKey) ?? { key: waterKey, name, country, provenance: [] }
        addProv(c.provenance, prov)
        candidates.set(waterKey, c)
        out('candidato', waterKey)
        continue
      }
      if (role === 'concessoes') {
        const k = `concessao:${slug(name)}${province ? `:${slug(province)}` : ''}`
        const status = /extint|caduc|revogad|terminad/.test(norm(g('estado'))) ? 'extinta' : /ativ|vigent|em vigor/.test(norm(g('estado'))) ? 'ativa' : 'desconhecido'
        const prev = concessions.get(k)
        const c: CarpConcession = prev ?? { key: k, waterKey: null, name, status, validTo: excelDate(g('vigencia_fim') ?? null), sourceKey: sourceFor(g, prov), provenance: [] }
        addProv(c.provenance, prov)
        concessions.set(k, c)
        out('concessao', k)
        continue
      }
      if (role !== 'inventario') {
        out('excluida', undefined, `papel de folha sem destino (${role})`)
        continue
      }
      if (!country) {
        out('revisao', waterKey, 'país não identificado')
        report.review.push({ kind: 'fora-do-ambito', keys: [waterKey], rows: [prov], detail: `País «${str(g('pais')) ?? ''}» não reconhecido (âmbito: PT continental e ES peninsular).` })
        continue
      }

      // ---- água
      const wp = point(num(g('lat')), num(g('lon')))
      let w = waters.get(waterKey)
      if (!w) {
        w = { key: waterKey, name, original: name, variants: [], country, type: TYPE(g('tipo'), name), province, atlasId: null, officialIds: official ? [{ scheme: 'oficial', id: official }] : [], point: null, provenance: [] }
        waters.set(waterKey, w)
      } else if (norm(w.original) !== norm(name) && !w.variants.includes(name)) w.variants.push(name)
      addProv(w.provenance, prov)
      if (wp.issue) report.review.push({ kind: wp.issue, keys: [waterKey], rows: [prov], detail: wp.issue === 'eixos-trocados' ? 'Latitude e longitude parecem trocadas; coordenadas não usadas até revisão.' : 'Coordenadas fora de PT continental/ES peninsular; não usadas.' })

      // ---- setor (sem nome de setor: setor «geral» da água)
      const sName = str(g('setor'))
      const limits = str(g('limites'))
      const sectorKey = `${waterKey}/${sName ? slug(sName) : limits ? slug(limits) : 'geral'}`
      const pa = point(num(g('lat_a')), num(g('lon_a')))
      const pb = point(num(g('lat_b')), num(g('lon_b')))
      for (const x of [pa, pb]) if (x.issue) report.review.push({ kind: x.issue, keys: [sectorKey], rows: [prov], detail: 'Extremo A/B com coordenadas inválidas; não usado.' })
      let s = sectors.get(sectorKey)
      if (!s) {
        s = { key: sectorKey, waterKey, name: sName ?? (limits ? limits : 'Água inteira (sem setor definido)'), original: sName ?? limits ?? name, limitsText: limits, a: null, b: null, point: null, precision: 'sem-coordenadas', provenance: [] }
        sectors.set(sectorKey, s)
      }
      addProv(s.provenance, prov)
      if (pa.p && !s.a) s.a = pa.p
      if (pb.p && !s.b) s.b = pb.p
      // Um ponto num registo com setor localiza o setor; sem setor, localiza só a água.
      if (wp.p) {
        if (sName && !s.point) s.point = wp.p
        if (!w.point) w.point = wp.p
      }
      s.precision = s.a && s.b ? 'extremos-ab' : s.point ? 'ponto-setor' : w.point ? 'agua' : 'sem-coordenadas'

      // ---- fonte, presença, regra, acesso
      const src = sourceFor(g, prov)
      const pres = tri(g('presenca'))
      if (g('presenca') != null) {
        const ek = `${sectorKey}#presenca#${src ?? 'sem-fonte'}`
        const e = evidence.get(ek) ?? { key: ek, waterKey, sectorKey: sName ? sectorKey : null, species: 'carpa', present: pres, sourceKey: src, observedAt: excelDate(g('verificado') ?? null), provenance: [] }
        addProv(e.provenance, prov)
        evidence.set(ek, e)
      }
      const effect = EFFECT(g('regime'))
      if (effect) {
        const species = (str(g('especie')) ?? 'carpa').split(/[,;/]| e | y /).map((x) => norm(x)).filter(Boolean).map((x) => (/carp|cyprinus/.test(x) ? 'carpa' : /tod|all/.test(x) ? 'todas' : x))
        const activity = ACTIVITY(g('modalidade'))
        const vf = excelDate(g('vigencia_inicio') ?? null), vt = excelDate(g('vigencia_fim') ?? null)
        const rk = `${sectorKey}#${activity}#${[...new Set(species)].sort().join('+')}#${effect}#${vf ?? ''}#${vt ?? ''}#${src ?? ''}`
        const rule: CarpRule = rules.get(rk) ?? {
          key: rk, waterKey, sectorKey: sName ? sectorKey : null, species: [...new Set(species)], activity, localActivity: str(g('modalidade')), effect, validFrom: vf, validTo: vt,
          conditions: { licence: str(g('licenca')), season: str(g('epoca')), night: g('noturna') != null ? tri(g('noturna')) : 'desconhecido', catchAndRelease: g('devolucao') != null ? tri(g('devolucao')) : 'desconhecido', manager: str(g('gestor')), hours: str(g('horario')), notes: str(g('notas')) },
          sourceKey: src, concessionKey: null, provenance: [],
        }
        addProv(rule.provenance, prov)
        rules.set(rk, rule)
      }
      const accText = str(g('acesso'))
      if (accText) {
        const n = norm(accText)
        const kind: CarpAccess['kind'] = /public|livre|libre/.test(n) ? 'publico' : /privad/.test(n) ? 'privado' : /restrit|condicion|autoriza/.test(n) ? 'restrito' : 'desconhecido'
        const ak = `${sectorKey}#acesso#${src ?? ''}`
        const a = access.get(ak) ?? { key: ak, sectorKey: sName ? sectorKey : null, waterKey, kind, text: accText, sourceKey: src, provenance: [] }
        addProv(a.provenance, prov)
        access.set(ak, a)
      }
      if (str(g('id'))) syntheseRefs.push({ ref: `__inv__${str(g('id'))}`, prov })
      out(effect ? 'agua+setor+regra' : 'agua+setor', sectorKey)
    }
  }

  // ---- homónimos (mesmo nome e país em províncias diferentes) → revisão; continuam separados
  const byName = new Map<string, CarpWater[]>()
  for (const w of waters.values()) {
    const k = `${w.country}:${norm(w.name)}`
    byName.set(k, [...(byName.get(k) ?? []), w])
  }
  for (const ws of byName.values()) if (ws.length > 1) report.review.push({ kind: 'homonimo', keys: ws.map((w) => w.key), rows: ws.flatMap((w) => w.provenance), detail: `«${ws[0].name}» aparece em ${ws.length} sítios (${ws.map((w) => w.province ?? '?').join(', ')}); mantidos separados até revisão.` })

  // ---- cruzamento com a cartografia do Atlas (identificador oficial; senão nome + país + ponto dentro da água)
  if (opts.atlas)
    for (const w of waters.values()) {
      const off = w.officialIds.map((o) => o.id)
      let hits = opts.atlas.filter((a) => off.some((id) => a.refs.includes(id) || a.id === id))
      if (!hits.length) {
        const n = norm(w.name)
        hits = opts.atlas.filter((a) => a.country.includes(w.country) && (norm(a.name) === n || a.alt.some((x) => norm(x) === n)))
        if (w.point) hits = hits.filter((a) => w.point![0] >= a.bbox[0] - 0.02 && w.point![0] <= a.bbox[2] + 0.02 && w.point![1] >= a.bbox[1] - 0.02 && w.point![1] <= a.bbox[3] + 0.02)
      }
      if (hits.length === 1) w.atlasId = hits[0].id
      else if (hits.length > 1) report.review.push({ kind: 'atlas-ambiguo', keys: [w.key, ...hits.map((h) => h.id)], rows: w.provenance, detail: `${hits.length} águas do Atlas possíveis para «${w.name}»; ligação por decidir.` })
    }

  // ---- concessões ↔ águas (por nome)
  for (const c of concessions.values()) {
    const ws = [...waters.values()].filter((w) => norm(c.name).includes(norm(w.name)) || norm(w.name).includes(norm(c.name)))
    if (ws.length === 1) c.waterKey = ws[0].key
    else if (ws.length > 1) report.review.push({ kind: 'atlas-ambiguo', keys: [c.key, ...ws.map((w) => w.key)], rows: c.provenance, detail: `Concessão «${c.name}» coincide com ${ws.length} águas.` })
  }
  for (const c of candidates.values()) {
    report.review.push({ kind: 'candidato', keys: [c.key], rows: c.provenance, detail: `Candidato «${c.name}»: por confirmar antes de entrar no inventário.` })
    if ([...waters.values()].some((w) => w.country === c.country && norm(w.name) === norm(c.name))) report.lacunas.push(`Candidato «${c.name}» já existe no inventário (sobreposição).`)
  }
  // ---- síntese/novidades devem referenciar registos existentes
  const invIds = new Set(syntheseRefs.filter((x) => x.ref.startsWith('__inv__')).map((x) => x.ref.slice(7)))
  for (const x of syntheseRefs) if (!x.ref.startsWith('__inv__') && !invIds.has(x.ref)) report.review.push({ kind: 'sintese-sem-registo', keys: [x.ref], rows: [x.prov], detail: `A folha «${x.prov.sheet}» refere «${x.ref}», que não está no inventário.` })

  // ---- correções humanas (por chave estável; nunca reescritas pela importação)
  const all: Record<string, Map<string, object>> = { waters, sectors, evidence, rules, access, sources, concessions }
  for (const c of opts.corrections ?? []) {
    const target = Object.values(all).find((m) => m.has(c.key))?.get(c.key)
    if (target) Object.assign(target, c.set)
    else report.lacunas.push(`Correção para «${c.key}» sem entidade correspondente nesta edição (mantida no ficheiro de correções).`)
  }

  // ---- lacunas
  for (const s of sectors.values()) if (s.precision === 'sem-coordenadas') report.lacunas.push(`Sem coordenadas: ${waters.get(s.waterKey)?.name} — ${s.name}`)
  for (const w of waters.values()) if (![...rules.values()].some((r) => r.waterKey === w.key)) report.lacunas.push(`Sem regra documentada: ${w.name} (${w.country})`)
  for (const s of sources.values()) if (s.competent !== 'sim') report.lacunas.push(`Fonte sem competência confirmada: ${s.organism ?? s.url ?? s.key}`)

  const sortBy = <T extends { key: string }>(m: Map<string, T>) => [...m.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const catalog: CarpCatalog = {
    version: 1,
    edition: { file: opts.file, sha256: opts.sha256, sheets: report.sheets.map((s) => ({ name: s.name, rows: s.rows, role: s.role })), importedAt: opts.importedAt },
    waters: sortBy(waters),
    sectors: sortBy(sectors),
    evidence: sortBy(evidence),
    rules: sortBy(rules),
    access: sortBy(access),
    sources: sortBy(sources),
    concessions: sortBy(concessions),
  }
  report.candidates = sortBy(candidates)
  const inv = report.rows.filter((r) => r.role === 'inventario' && r.destination !== 'titulo' && r.destination !== 'cabecalho')
  report.totals = {
    linhas_inventario: inv.length,
    linhas_inventario_pt: 0,
    linhas_inventario_es: 0,
    aguas: catalog.waters.length,
    aguas_pt: catalog.waters.filter((w) => w.country === 'PT').length,
    aguas_es: catalog.waters.filter((w) => w.country === 'ES').length,
    setores: catalog.sectors.length,
    setores_sem_coordenadas: catalog.sectors.filter((s) => s.precision === 'sem-coordenadas').length,
    setores_extremos_ab: catalog.sectors.filter((s) => s.precision === 'extremos-ab').length,
    regras: catalog.rules.length,
    fontes: catalog.sources.length,
    concessoes: catalog.concessions.length,
    candidatos: report.candidates.length,
    exclusoes: report.exclusions.length,
    revisao: report.review.length,
    aguas_ligadas_atlas: catalog.waters.filter((w) => w.atlasId).length,
  }
  for (const r of inv) {
    const w = r.key ? catalog.waters.find((x) => r.key!.startsWith(x.key + '/')) : null
    if (w?.country === 'PT') report.totals.linhas_inventario_pt++
    if (w?.country === 'ES') report.totals.linhas_inventario_es++
  }
  return { catalog, report }
}

/** Diferenças entre dois catálogos por chave estável (pré-visualização). */
export function diffCatalogs(prev: CarpCatalog | null, next: CarpCatalog) {
  const kinds = ['waters', 'sectors', 'evidence', 'rules', 'access', 'sources', 'concessions'] as const
  const out: Record<string, { novos: number; alterados: number; removidos: number }> = {}
  for (const k of kinds) {
    const a = new Map(((prev?.[k] ?? []) as { key: string }[]).map((x) => [x.key, JSON.stringify(x)]))
    const b = new Map((next[k] as { key: string }[]).map((x) => [x.key, JSON.stringify(x)]))
    out[k] = { novos: [...b.keys()].filter((x) => !a.has(x)).length, alterados: [...b.keys()].filter((x) => a.has(x) && a.get(x) !== b.get(x)).length, removidos: [...a.keys()].filter((x) => !b.has(x)).length }
  }
  return out
}
