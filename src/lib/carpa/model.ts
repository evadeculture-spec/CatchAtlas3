/**
 * Catálogo «Carpa» (Cyprinus carpio) — modelo e regra de classificação (lógica pura, partilhada pela app,
 * pela importação e pelos testes).
 *
 * A app calcula SEPARADAMENTE três coisas, sem nunca deduzir uma da outra:
 *  1. presença documentada da carpa (evidência de presença na água/setor);
 *  2. permissão de pesca para a data e a modalidade consultadas;
 *  3. acesso físico à margem.
 *
 * «Pesca permitida» exige uma regra de fonte COMPETENTE que cubra a espécie (carpa), o setor (ou a água inteira),
 * a modalidade e a data consultada. Em dúvida, regra caducada, regra sem termo e sem verificação independente,
 * ou conflito sem resolução: «Por confirmar», com a razão. Uma proibição expressa tem estado próprio. Uma
 * concessão extinta invalida o título anterior: o regime atual tem de ser apurado. A data de importação nunca
 * conta como verificação.
 */

export const CARP_CATALOG_URL = '/data/carpa/catalogo.json'
export const CARP_SPECIES = 'carpa'

export type Country = 'PT' | 'ES'
export type WaterType = 'albufeira' | 'barragem' | 'acude' | 'rio' | 'curso-agua' | 'lagoa' | 'carpodromo' | 'pista' | 'concessao' | 'outro'
/** Modalidades/atividades distinguidas pelas fontes (preservando as designações locais em `localName`). */
export type Activity = 'pesca-individual' | 'carpfishing' | 'carpfishing-noturno' | 'provas' | 'todas'
export type Tri = 'sim' | 'nao' | 'desconhecido'
export type LngLat = [number, number]

export interface Provenance {
  sheet: string
  row: number
}
export interface CarpSource {
  key: string
  organism: string | null
  url: string | null
  ref: string | null
  /** Idioma original do documento (a ficha mostra a referência original). */
  lang: 'pt' | 'es' | null
  /** Competência regulamentar do organismo (ICNF, DGRM, confederações, juntas autonómicas…). Desconhecido ≠ não. */
  competent: Tri
  /** Última verificação independente conhecida (AAAA-MM-DD); nunca a data de importação. */
  verifiedAt: string | null
}
export interface CarpWater {
  key: string
  name: string
  /** Nome tal como aparece na fonte e variantes PT/ES. */
  original: string
  variants: string[]
  country: Country
  type: WaterType
  province: string | null
  /** Água do Atlas cruzada por identificador oficial (OSM, SNIRH, CEDEX…), quando houver. */
  atlasId: string | null
  officialIds: { scheme: string; id: string }[]
  /** Localização geral da água (um ponto dentro da albufeira localiza a ÁGUA, não um setor). */
  point: LngLat | null
  provenance: Provenance[]
}
export interface CarpSector {
  key: string
  waterKey: string
  name: string
  original: string
  /** Limites tal como descritos na fonte. */
  limitsText: string | null
  /** Extremos A/B conhecidos (delimitam o setor segundo a fonte; não são um percurso de margem). */
  a: LngLat | null
  b: LngLat | null
  point: LngLat | null
  /** Precisão da localização: extremos do setor, ponto do setor, ponto geral da água, ou sem coordenadas. */
  precision: 'extremos-ab' | 'ponto-setor' | 'agua' | 'sem-coordenadas'
  provenance: Provenance[]
}
export interface CarpEvidence {
  key: string
  waterKey: string
  sectorKey: string | null
  species: string
  present: Tri
  sourceKey: string | null
  observedAt: string | null
  provenance: Provenance[]
}
export interface CarpConditions {
  licence: string | null
  season: string | null
  /** Pesca noturna: permitida (sim), proibida (nao) ou não documentada. */
  night: Tri
  /** Devolução obrigatória (sim), retenção permitida (nao) ou não documentada. */
  catchAndRelease: Tri
  manager: string | null
  hours: string | null
  notes: string | null
}
export interface CarpRule {
  key: string
  waterKey: string
  sectorKey: string | null
  /** Espécies abrangidas pela regra (minúsculas). «todas» só quando a fonte o diz expressamente. */
  species: string[]
  activity: Activity
  /** Designação local da modalidade (ex.: «carpfishing nocturno», «concurso»). */
  localActivity: string | null
  effect: 'permitida' | 'proibida'
  validFrom: string | null
  validTo: string | null
  conditions: CarpConditions
  sourceKey: string | null
  /** Concessão que dá título à regra (se extinta, a regra deixa de valer). */
  concessionKey: string | null
  provenance: Provenance[]
}
export interface CarpAccess {
  key: string
  sectorKey: string | null
  waterKey: string
  kind: 'publico' | 'restrito' | 'privado' | 'desconhecido'
  text: string | null
  sourceKey: string | null
  provenance: Provenance[]
}
export interface CarpConcession {
  key: string
  waterKey: string | null
  name: string
  status: 'ativa' | 'extinta' | 'desconhecido'
  validTo: string | null
  sourceKey: string | null
  provenance: Provenance[]
}
export interface CarpCatalog {
  version: 1
  edition: { file: string; sha256: string; sheets: { name: string; rows: number; role: string }[]; importedAt: string } | null
  waters: CarpWater[]
  sectors: CarpSector[]
  evidence: CarpEvidence[]
  rules: CarpRule[]
  access: CarpAccess[]
  sources: CarpSource[]
  concessions: CarpConcession[]
}

// ------------------------------------------------------------------ classificação
export type PermissionState = 'permitida' | 'proibida' | 'por-confirmar'
export type ReasonCode =
  | 'sem-regra'
  | 'outra-especie'
  | 'outra-modalidade'
  | 'outro-setor'
  | 'fora-de-vigencia'
  | 'ainda-nao-vigente'
  | 'fonte-nao-competente'
  | 'sem-termo-sem-verificacao'
  | 'concessao-extinta'
  | 'conflito'
export interface Reason {
  code: ReasonCode
  /** Dados para a frase (datas, espécies, modalidades). */
  detail?: Record<string, string>
}
export interface Classification {
  presence: { state: 'documentada' | 'ausencia-documentada' | 'desconhecida'; evidence: CarpEvidence[] }
  permission: { state: PermissionState; reasons: Reason[]; rules: CarpRule[]; conditions: CarpConditions | null }
  access: { state: CarpAccess['kind']; entries: CarpAccess[] }
}

const sameSpecies = (r: CarpRule) => r.species.includes(CARP_SPECIES) || r.species.includes('todas')
/** Modalidades distintas nunca se substituem (carpfishing noturno ≠ pesca individual ≠ provas). */
const activityCovers = (r: CarpRule, a: Activity) => r.activity === 'todas' || r.activity === a
const scopeCovers = (r: CarpRule, s: CarpSector | null, waterKey: string) => r.waterKey === waterKey && (r.sectorKey === null || r.sectorKey === s?.key)

/**
 * Estado da pesca à carpa num setor (ou na água, se `sector` for null) para uma data (AAAA-MM-DD, dia da
 * jornada) e uma modalidade. Puro e determinístico: a mesma entrada dá sempre a mesma decisão.
 */
export function classify(cat: Pick<CarpCatalog, 'rules' | 'sources' | 'concessions' | 'evidence' | 'access'>, waterKey: string, sector: CarpSector | null, date: string, activity: Activity): Classification {
  const src = new Map(cat.sources.map((s) => [s.key, s]))
  const conc = new Map(cat.concessions.map((c) => [c.key, c]))

  // 1) Presença (setor ou água inteira).
  const ev = cat.evidence.filter((e) => e.waterKey === waterKey && (e.sectorKey === null || e.sectorKey === sector?.key) && e.species === CARP_SPECIES)
  const presence = ev.some((e) => e.present === 'sim') ? 'documentada' : ev.some((e) => e.present === 'nao') ? 'ausencia-documentada' : 'desconhecida'

  // 3) Acesso (só com evidência específica).
  const acc = cat.access.filter((a) => a.waterKey === waterKey && (a.sectorKey === null || a.sectorKey === sector?.key))
  const accessState: CarpAccess['kind'] = acc.find((a) => a.sectorKey === sector?.key)?.kind ?? acc[0]?.kind ?? 'desconhecido'

  // 2) Permissão.
  const reasons: Reason[] = []
  const inWater = cat.rules.filter((r) => r.waterKey === waterKey)
  if (!inWater.length) reasons.push({ code: 'sem-regra' })
  const valid: CarpRule[] = []
  for (const r of inWater) {
    if (!scopeCovers(r, sector, waterKey)) {
      reasons.push({ code: 'outro-setor', detail: { setor: r.sectorKey ?? '' } })
      continue
    }
    if (!sameSpecies(r)) {
      reasons.push({ code: 'outra-especie', detail: { especies: r.species.join(', ') } })
      continue
    }
    if (!activityCovers(r, activity)) {
      reasons.push({ code: 'outra-modalidade', detail: { modalidade: r.localActivity ?? r.activity } })
      continue
    }
    if (r.validFrom && date < r.validFrom) {
      reasons.push({ code: 'ainda-nao-vigente', detail: { desde: r.validFrom } })
      continue
    }
    if (r.validTo && date > r.validTo) {
      reasons.push({ code: 'fora-de-vigencia', detail: { ate: r.validTo } })
      continue
    }
    const s = r.sourceKey ? src.get(r.sourceKey) : undefined
    if (!s || s.competent !== 'sim') {
      reasons.push({ code: 'fonte-nao-competente', detail: { fonte: s?.organism ?? 'desconhecida' } })
      continue
    }
    if (r.concessionKey && conc.get(r.concessionKey)?.status === 'extinta') {
      reasons.push({ code: 'concessao-extinta', detail: { concessao: conc.get(r.concessionKey)!.name } })
      continue
    }
    // Sem termo expresso: só sustenta uma decisão com verificação independente (nunca a data de importação).
    if (!r.validTo && !s.verifiedAt) {
      reasons.push({ code: 'sem-termo-sem-verificacao' })
      continue
    }
    valid.push(r)
  }

  let state: PermissionState = 'por-confirmar'
  const bans = valid.filter((r) => r.effect === 'proibida')
  const oks = valid.filter((r) => r.effect === 'permitida')
  if (bans.length && oks.length) {
    // A regra mais específica (setor) prevalece sobre a da água inteira; empate → conflito por resolver.
    const banSector = bans.some((r) => r.sectorKey), okSector = oks.some((r) => r.sectorKey)
    if (banSector && !okSector) state = 'proibida'
    else if (okSector && !banSector) state = 'permitida'
    else reasons.push({ code: 'conflito' })
  } else if (bans.length) state = 'proibida'
  else if (oks.length) state = 'permitida'

  const decisive = state === 'permitida' ? oks.filter((r) => !bans.length || r.sectorKey) : state === 'proibida' ? bans : []
  return {
    presence: { state: presence, evidence: ev },
    permission: { state, reasons: state === 'por-confirmar' ? dedupe(reasons) : [], rules: decisive, conditions: decisive[0]?.conditions ?? null },
    access: { state: accessState, entries: acc },
  }
}
function dedupe(rs: Reason[]): Reason[] {
  const seen = new Set<string>()
  return rs.filter((r) => {
    const k = r.code + JSON.stringify(r.detail ?? {})
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ------------------------------------------------------------------ textos (PT-PT / ES)
export type Lang = 'pt' | 'es'
const fmtDate = (iso: string, lang: Lang) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === 'es' ? 'es-ES' : 'pt-PT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export const T = {
  pt: {
    layer: 'Carpa',
    state: { permitida: 'Pesca permitida', proibida: 'Pesca proibida', 'por-confirmar': 'Por confirmar' } as Record<PermissionState, string>,
    presence: { documentada: 'Presença de carpa documentada', 'ausencia-documentada': 'Ausência de carpa documentada', desconhecida: 'Presença de carpa não documentada' },
    access: { publico: 'Acesso público à margem documentado', restrito: 'Acesso restrito', privado: 'Acesso privado', desconhecido: 'Acesso à margem não documentado' },
    precision: { 'extremos-ab': 'Limites conhecidos: extremos A e B do setor', 'ponto-setor': 'Ponto do setor', agua: 'Localização geral da água (não do setor)', 'sem-coordenadas': 'Localização por confirmar' },
    activity: { 'pesca-individual': 'Pesca individual', carpfishing: 'Carpfishing', 'carpfishing-noturno': 'Carpfishing noturno', provas: 'Provas organizadas', todas: 'Todas as modalidades' } as Record<Activity, string>,
    reason: (r: Reason, lang: Lang = 'pt'): string => {
      const d = r.detail ?? {}
      switch (r.code) {
        case 'sem-regra': return 'Não há regra documentada para esta água.'
        case 'outra-especie': return `O documento cobre ${d.especies}, não a carpa.`
        case 'outra-modalidade': return `A regra documentada é para outra modalidade (${d.modalidade}).`
        case 'outro-setor': return 'A regra documentada é de outro setor.'
        case 'fora-de-vigencia': return `A regra terminou em ${fmtDate(d.ate, lang)}.`
        case 'ainda-nao-vigente': return `A regra só começa em ${fmtDate(d.desde, lang)}.`
        case 'fonte-nao-competente': return `A fonte (${d.fonte}) não é a entidade competente para autorizar.`
        case 'sem-termo-sem-verificacao': return 'A regra não tem termo expresso e não há verificação independente da vigência.'
        case 'concessao-extinta': return `A concessão «${d.concessao}» foi extinta; o regime atual tem de ser apurado.`
        case 'conflito': return 'Há fontes em conflito sem resolução.'
      }
    },
  },
  es: {
    layer: 'Carpa',
    state: { permitida: 'Pesca permitida', proibida: 'Pesca prohibida', 'por-confirmar': 'Por confirmar' } as Record<PermissionState, string>,
    presence: { documentada: 'Presencia de carpa documentada', 'ausencia-documentada': 'Ausencia de carpa documentada', desconhecida: 'Presencia de carpa no documentada' },
    access: { publico: 'Acceso público a la orilla documentado', restrito: 'Acceso restringido', privado: 'Acceso privado', desconhecido: 'Acceso a la orilla no documentado' },
    precision: { 'extremos-ab': 'Límites conocidos: extremos A y B del tramo', 'ponto-setor': 'Punto del tramo', agua: 'Ubicación general del agua (no del tramo)', 'sem-coordenadas': 'Ubicación por confirmar' },
    activity: { 'pesca-individual': 'Pesca individual', carpfishing: 'Carpfishing', 'carpfishing-noturno': 'Carpfishing nocturno', provas: 'Concursos organizados', todas: 'Todas las modalidades' } as Record<Activity, string>,
    reason: (r: Reason): string => {
      const d = r.detail ?? {}
      switch (r.code) {
        case 'sem-regra': return 'No hay norma documentada para esta agua.'
        case 'outra-especie': return `El documento se refiere a ${d.especies}, no a la carpa.`
        case 'outra-modalidade': return `La norma documentada es para otra modalidad (${d.modalidade}).`
        case 'outro-setor': return 'La norma documentada es de otro tramo.'
        case 'fora-de-vigencia': return `La norma terminó el ${fmtDate(d.ate, 'es')}.`
        case 'ainda-nao-vigente': return `La norma empieza el ${fmtDate(d.desde, 'es')}.`
        case 'fonte-nao-competente': return `La fuente (${d.fonte}) no es el organismo competente para autorizar.`
        case 'sem-termo-sem-verificacao': return 'La norma no tiene plazo expreso y no hay verificación independiente de su vigencia.'
        case 'concessao-extinta': return `La concesión «${d.concessao}» se extinguió; hay que averiguar el régimen actual.`
        case 'conflito': return 'Hay fuentes en conflicto sin resolver.'
      }
    },
  },
}
