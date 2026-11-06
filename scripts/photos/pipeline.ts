/**
 * Pipeline de fotografias reais das albufeiras (Wikimedia Commons).
 *
 *   npm run photos -- discover [--dam id] [--limit N] [--dry-run]
 *   npm run photos -- derive   [--dam id] [--dry-run]
 *   npm run photos -- publish  [--dry-run]
 *   npm run photos -- audit
 *
 * inventariar → pesquisar → recolher candidatos → (curadoria humana em photos/curation.json)
 * → derivados → publicar aprovados → auditar cobertura.
 *
 * Regras: nada é publicado sem identidade confirmada, direitos aprovados e publicação
 * marcados na curadoria. A curadoria manual nunca é sobrescrita por um novo import.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DAMS } from '../../src/data/dams'
import type { Dam } from '../../src/data/types'
import type { DamPhotoLink, PhotoAsset, PhotoCatalog, PhotoObservation, PhotoRole, PhotoVariant } from '../../src/data/photos/types'
import { findDuplicateConflicts, isPublishable } from '../../src/lib/photos/rules'

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..')
const P = {
  candidates: join(ROOT, 'photos', 'candidates.json'),
  curation: join(ROOT, 'photos', 'curation.json'),
  runs: join(ROOT, 'photos', 'runs'),
  cache: join(ROOT, 'photos', '.cache'),
  originals: join(ROOT, 'photos', '.originals'),
  publicDir: join(ROOT, 'public', 'photos'),
  catalog: join(ROOT, 'src', 'data', 'photos', 'catalog.json'),
  coverage: join(ROOT, 'photos', 'coverage.json'),
}
const API = 'https://commons.wikimedia.org/w/api.php'
const FILE_HOST = 'upload.wikimedia.org'
const USER_AGENT = 'CatchAtlasPhotoPipeline/1.0 (https://github.com/evadeculture-spec/CatchAtlas)'
const MAX_BYTES = 60 * 1024 * 1024
const WIDTHS = [640, 1280, 1920]

// ---------- tipos de trabalho ----------

export interface Candidate {
  key: string // `${damId}:${externalId}`
  damId: string
  externalId: string
  assetId: string
  title: string
  sourcePageUrl: string
  originalFileUrl: string
  mime: string
  width: number
  height: number
  sha1: string
  author: string
  authorUrl: string | null
  licenseName: string
  licenseUrl: string | null
  attributionRequired: boolean
  capturedAt: string | null
  location: { lat: number; lon: number } | null
  categories: string[]
  collectedAt: string
  /** Sugestões automáticas (nunca publicam por si). */
  auto: {
    identity: 'candidato' | 'revisao' | 'rejeitado'
    identityScore: number
    identityEvidence: string[]
    rights: 'compativel' | 'incompativel' | 'desconhecido'
    rightsReason: string
  }
}

interface Decision {
  identity: PhotoAsset['identity']
  identityBasis: string
  identityReviewer: string
  rights: PhotoAsset['rights']
  rightsBasis: string
  publication: PhotoAsset['publication']
  role: PhotoRole
  order?: number
  focal?: DamPhotoLink['focal']
  alt: string
  exportAllowed?: boolean
  observations?: Omit<PhotoObservation, 'id' | 'assetId' | 'assetChecksum'>[]
}

// ---------- utilidades ----------

const args = process.argv.slice(2)
const cmd = args[0]
const flag = (name: string) => args.includes(`--${name}`)
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const DRY = flag('dry-run')

const readJSON = <T,>(p: string, fallback: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : fallback)
const writeJSON = (p: string, v: unknown) => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const log = (...m: unknown[]) => console.log('[photos]', ...m)

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/** GET à API com cache em disco, retries e backoff (respeita Retry-After). */
async function apiGet(params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`
  const cacheFile = join(P.cache, createHash('sha1').update(url).digest('hex') + '.json')
  if (existsSync(cacheFile) && !flag('no-cache')) return JSON.parse(readFileSync(cacheFile, 'utf8'))
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'error' })
    if (res.ok) {
      const json = await res.json()
      mkdirSync(P.cache, { recursive: true })
      writeFileSync(cacheFile, JSON.stringify(json))
      await sleep(250) // ritmo conservador
      return json
    }
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt
      log(`API ${res.status}, nova tentativa em ${wait} ms`)
      await sleep(wait)
      continue
    }
    throw new Error(`API respondeu ${res.status}`)
  }
  throw new Error('API indisponível após várias tentativas')
}

// ---------- licenças ----------

/** Compatível com uso comercial e derivados (redimensionar/recortar), com atribuição. */
export function evaluateLicense(shortName: string, usageTerms = ''): { rights: Candidate['auto']['rights']; reason: string } {
  const l = norm(`${shortName} ${usageTerms}`)
  if (!l.trim()) return { rights: 'desconhecido', reason: 'Licença não indicada nos metadados' }
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv|fair use|all rights reserved/.test(l)) return { rights: 'incompativel', reason: `Licença restritiva: ${shortName}` }
  if (/^gfdl(?!.*cc)/.test(l.trim())) return { rights: 'incompativel', reason: 'GFDL sem licença CC alternativa (exige texto integral)' }
  if (/cc0|public domain|dominio publico|^pd\b|\bpd-/.test(l)) return { rights: 'compativel', reason: `${shortName}: sem restrições de uso` }
  if (/cc by(-sa)? \d|cc-by(-sa)?-\d|cc by(-sa)?$/.test(l)) return { rights: 'compativel', reason: `${shortName}: uso comercial e derivados com atribuição${/sa/.test(l) ? ' e partilha nos mesmos termos' : ''}` }
  return { rights: 'desconhecido', reason: `Licença não reconhecida automaticamente: ${shortName}` }
}

// ---------- identidade ----------

const KIND_WORDS = ['albufeira', 'barragem', 'embalse', 'pantano', 'presa', 'reservoir', 'dam', 'lake', 'lago', 'represa', 'panta', 'embassament']

/** Pontuação automática de correspondência ao local (sugestão; a confirmação é humana). */
export function scoreIdentity(dam: Pick<Dam, 'id' | 'name' | 'approx' | 'river' | 'place'>, c: { title: string; categories: string[]; location: { lat: number; lon: number } | null }, otherDamNames: string[]) {
  const evidence: string[] = []
  let score = 0
  const text = norm(`${c.title} ${c.categories.join(' ')}`)
  const name = norm(dam.name)
  const nameRe = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  if (nameRe.test(text)) {
    score += 2
    evidence.push(`Nome "${dam.name}" no título ou categorias`)
    if (KIND_WORDS.some((k) => text.includes(`${k} de ${name}`) || text.includes(`${k} do ${name}`) || text.includes(`${k} da ${name}`) || text.includes(`${name} ${k}`))) {
      score += 2
      evidence.push('Nome associado a "albufeira/barragem/embalse"')
    }
  }
  if (c.location) {
    const km = haversineKm(dam.approx, c.location)
    evidence.push(`Coordenadas da fotografia a ${km.toFixed(1)} km da posição aproximada do registo`)
    if (km <= 8) score += 2
    else if (km <= 20) score += 1
    else score -= 2
  }
  const conflicts = otherDamNames.filter((n) => n !== name && n.length > 3 && new RegExp(`\\b${n}\\b`).test(text))
  if (conflicts.length) {
    score -= 3
    evidence.push(`Possível homónimo ou outra albufeira: ${conflicts.join(', ')}`)
  }
  const identity: Candidate['auto']['identity'] = score >= 4 && !conflicts.length ? 'candidato' : score <= 0 ? 'rejeitado' : 'revisao'
  return { identity, score, evidence }
}

// ---------- descoberta ----------

function queriesFor(dam: Dam) {
  const kind = dam.country === 'PT' ? ['Albufeira', 'Barragem'] : ['Embalse', 'Pantano']
  return [...kind.map((k) => `${k} de ${dam.name}`), `${dam.name} ${dam.river.replace(/^Rio /, '')}`]
}

async function fetchFileInfo(params: Record<string, string>) {
  const json = await apiGet({
    action: 'query',
    prop: 'imageinfo|coordinates|categories',
    iiprop: 'url|size|sha1|mime|extmetadata',
    iiextmetadatalanguage: 'pt',
    cllimit: '50',
    clshow: '!hidden',
    ...params,
  })
  return (json?.query?.pages ?? []) as Record<string, unknown>[]
}

function toCandidate(dam: Dam, page: Record<string, unknown>, others: string[]): Candidate | null {
  const ii = (page.imageinfo as Record<string, unknown>[] | undefined)?.[0]
  if (!ii) return null
  const mime = String(ii.mime ?? '')
  if (!/^image\/(jpeg|png|webp|tiff)$/.test(mime)) return null
  const meta = (ii.extmetadata ?? {}) as Record<string, { value?: string }>
  const v = (k: string) => (meta[k]?.value ? stripHtml(String(meta[k].value)) : '')
  const coords = (page.coordinates as { lat: number; lon: number }[] | undefined)?.[0]
  const categories = ((page.categories as { title: string }[] | undefined) ?? []).map((c) => c.title.replace(/^Category:/, ''))
  const title = String(page.title ?? '')
  const lic = evaluateLicense(v('LicenseShortName'), v('UsageTerms'))
  const location = coords ? { lat: coords.lat, lon: coords.lon } : null
  const id = scoreIdentity(dam, { title, categories, location }, others)
  const captured = v('DateTimeOriginal')
  return {
    key: `${dam.id}:${page.pageid}`,
    damId: dam.id,
    externalId: String(page.pageid),
    assetId: `wmc-${page.pageid}`,
    title,
    sourcePageUrl: String(ii.descriptionurl ?? ''),
    originalFileUrl: String(ii.url ?? ''),
    mime,
    width: Number(ii.width),
    height: Number(ii.height),
    sha1: String(ii.sha1 ?? ''),
    author: v('Artist') || 'Autor não indicado',
    authorUrl: null,
    licenseName: v('LicenseShortName'),
    licenseUrl: v('LicenseUrl') || null,
    attributionRequired: v('AttributionRequired') !== 'false',
    // Apenas DateTimeOriginal (captação). Nunca a data de upload.
    capturedAt: /^\d{4}(-\d{2}(-\d{2})?)?/.test(captured) ? captured.slice(0, 10) : null,
    location,
    categories,
    collectedAt: new Date().toISOString(),
    auto: { identity: id.identity, identityScore: id.score, identityEvidence: id.evidence, rights: lic.rights, rightsReason: lic.reason },
  }
}

async function discover() {
  const run = { kind: 'discover', startedAt: new Date().toISOString(), dryRun: DRY, dams: 0, found: 0, added: 0, errors: [] as string[], pending: [] as string[] }
  const store = readJSON<{ candidates: Candidate[] }>(P.candidates, { candidates: [] })
  const known = new Set(store.candidates.map((c) => c.key))
  const only = opt('dam')
  const limit = Number(opt('limit') ?? Infinity)
  const maxPerDam = Number(opt('max-per-dam') ?? 15)
  const targets = DAMS.filter((d) => !only || d.id === only).slice(0, limit)
  const names = DAMS.map((d) => norm(d.name))
  for (const dam of targets) {
    run.dams++
    try {
      const pages = new Map<string, Record<string, unknown>>()
      for (const q of queriesFor(dam)) {
        for (const p of await fetchFileInfo({ generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '10' })) pages.set(String(p.pageid), p)
      }
      for (const p of await fetchFileInfo({ generator: 'geosearch', ggscoord: `${dam.approx.lat}|${dam.approx.lon}`, ggsradius: '10000', ggsnamespace: '6', ggslimit: '20' })) pages.set(String(p.pageid), p)
      const cands = [...pages.values()].map((p) => toCandidate(dam, p, names)).filter((c): c is Candidate => !!c && c.auto.identity !== 'rejeitado').sort((a, b) => b.auto.identityScore - a.auto.identityScore).slice(0, maxPerDam)
      run.found += cands.length
      for (const c of cands) if (!known.has(c.key)) { store.candidates.push(c); known.add(c.key); run.added++ }
      if (!cands.length) run.pending.push(dam.id)
      log(`${dam.name}: ${cands.length} candidatos`)
    } catch (e) {
      run.errors.push(`${dam.id}: ${(e as Error).message}`)
      log(`Erro em ${dam.name}: ${(e as Error).message}`)
    }
  }
  if (!DRY) writeJSON(P.candidates, store)
  writeRun({ ...run, finishedAt: new Date().toISOString() })
}

// ---------- derivados ----------

/** Descarrega apenas de upload.wikimedia.org, sem seguir redirecionamentos, com limite de tamanho. */
async function safeDownload(url: string): Promise<Buffer> {
  const u = new URL(url)
  if (u.protocol !== 'https:' || u.hostname !== FILE_HOST) throw new Error(`Origem não permitida: ${u.hostname}`)
  const res = await fetch(u, { headers: { 'User-Agent': USER_AGENT }, redirect: 'manual' })
  if (res.status >= 300 && res.status < 400) throw new Error('Redirecionamento recusado')
  if (!res.ok) throw new Error(`Download falhou: ${res.status}`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_BYTES) throw new Error('Ficheiro demasiado grande')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) throw new Error('Ficheiro demasiado grande')
  return buf
}

async function derive() {
  const sharp = (await import('sharp')).default
  const { candidates } = readJSON<{ candidates: Candidate[] }>(P.candidates, { candidates: [] })
  const curation = readJSON<{ decisions: Record<string, Decision> }>(P.curation, { decisions: {} })
  const run = { kind: 'derive', startedAt: new Date().toISOString(), dryRun: DRY, processed: 0, skipped: 0, errors: [] as string[] }
  for (const c of candidates) {
    const d = curation.decisions[c.key]
    if (!d || d.identity !== 'confirmado' || d.rights !== 'aprovado' || (opt('dam') && c.damId !== opt('dam'))) { run.skipped++; continue }
    const outDir = join(P.publicDir, c.damId)
    if (WIDTHS.every((w) => w > c.width || existsSync(join(outDir, `${c.assetId}-${w}.webp`)))) { run.skipped++; continue }
    try {
      const origPath = join(P.originals, `${c.assetId}`)
      let buf: Buffer
      if (existsSync(origPath)) buf = readFileSync(origPath)
      else {
        buf = await safeDownload(c.originalFileUrl)
        mkdirSync(P.originals, { recursive: true })
        writeFileSync(origPath, buf)
      }
      const sha1 = createHash('sha1').update(buf).digest('hex')
      if (c.sha1 && sha1 !== c.sha1) throw new Error('Checksum diferente do indicado pela fonte')
      const meta = await sharp(buf).metadata()
      if (!meta.format || !['jpeg', 'png', 'webp', 'tiff'].includes(meta.format)) throw new Error(`Formato real não suportado: ${meta.format}`)
      if (!DRY) {
        mkdirSync(outDir, { recursive: true })
        for (const w of WIDTHS.filter((x) => x <= (meta.width ?? 0)).concat((meta.width ?? 0) < WIDTHS[0] ? [meta.width ?? 0] : [])) {
          // rotate() aplica a orientação EXIF; sharp não copia metadados (EXIF/GPS removidos).
          const base = sharp(buf).rotate().resize({ width: w, withoutEnlargement: true })
          await base.clone().webp({ quality: 78 }).toFile(join(outDir, `${c.assetId}-${w}.webp`))
          await base.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(join(outDir, `${c.assetId}-${w}.jpg`))
        }
      }
      run.processed++
      log(`Derivados: ${c.title}`)
    } catch (e) {
      run.errors.push(`${c.key}: ${(e as Error).message}`)
    }
  }
  writeRun({ ...run, finishedAt: new Date().toISOString() })
}

// ---------- publicação ----------

function variantsFor(c: Candidate): PhotoVariant[] {
  const out: PhotoVariant[] = []
  for (const w of [...WIDTHS, c.width]) {
    for (const [ext, format] of [['webp', 'webp'], ['jpg', 'jpeg']] as const) {
      const file = join(P.publicDir, c.damId, `${c.assetId}-${w}.${ext}`)
      if (existsSync(file) && !out.some((v) => v.width === w && v.format === format)) {
        out.push({ width: w, height: Math.round((c.height / c.width) * w), format, src: `/photos/${c.damId}/${c.assetId}-${w}.${ext}` })
      }
    }
  }
  return out
}

async function publish() {
  const { candidates } = readJSON<{ candidates: Candidate[] }>(P.candidates, { candidates: [] })
  const curation = readJSON<{ decisions: Record<string, Decision> }>(P.curation, { decisions: {} })
  const previous = readJSON<PhotoCatalog>(P.catalog, { generatedAt: null, assets: [], links: [], observations: [], adjacentPairs: [] })
  const catalog: PhotoCatalog = { generatedAt: new Date().toISOString(), assets: [], links: [], observations: [], adjacentPairs: previous.adjacentPairs }
  for (const c of candidates) {
    const d = curation.decisions[c.key]
    if (!d) continue
    const asset: PhotoAsset = {
      id: c.assetId,
      provider: 'wikimedia-commons',
      externalId: c.externalId,
      title: c.title,
      sourcePageUrl: c.sourcePageUrl,
      originalFileUrl: c.originalFileUrl,
      author: c.author,
      authorUrl: c.authorUrl,
      license: { name: c.licenseName, url: c.licenseUrl, requiresAttribution: c.attributionRequired, shareAlike: /sa/i.test(c.licenseName), commercialUse: true, derivatives: true },
      attribution: `${c.author}, ${c.licenseName}, via Wikimedia Commons`,
      changes: 'Redimensionada e convertida para WebP/JPEG; metadados EXIF/GPS removidos; sem outras alterações.',
      width: c.width,
      height: c.height,
      capturedAt: c.capturedAt,
      collectedAt: c.collectedAt,
      checksumSha1: c.sha1,
      location: c.location,
      locationEvidence: c.auto.identityEvidence,
      identity: d.identity,
      identityBasis: d.identityBasis,
      identityMethod: d.identityReviewer ? 'humana' : 'automatica',
      identityReviewer: d.identityReviewer || null,
      rights: d.rights,
      rightsBasis: d.rightsBasis,
      publication: d.publication,
      exportAllowed: d.exportAllowed ?? true,
      variants: variantsFor(c),
      alt: d.alt,
    }
    if (!isPublishable(asset)) continue
    if (!catalog.assets.some((a) => a.id === asset.id)) catalog.assets.push(asset)
    catalog.links.push({ assetId: asset.id, damId: c.damId, role: d.role, order: d.order ?? 0, basis: d.identityBasis, focal: d.focal ?? { mobile: { x: 0.5, y: 0.55 }, desktop: { x: 0.5, y: 0.5 } } })
    for (const [i, o] of (d.observations ?? []).entries()) catalog.observations.push({ ...o, id: `${asset.id}-o${i}`, assetId: asset.id, assetChecksum: asset.checksumSha1 })
  }
  const conflicts = findDuplicateConflicts(catalog)
  if (conflicts.length) {
    log('Publicação interrompida: a mesma imagem está ligada a albufeiras incompatíveis', conflicts)
    process.exitCode = 1
    return
  }
  if (!DRY) writeJSON(P.catalog, catalog)
  log(`Publicados: ${catalog.assets.length} fotografias, ${catalog.links.length} ligações`)
  writeRun({ kind: 'publish', dryRun: DRY, assets: catalog.assets.length, links: catalog.links.length, finishedAt: new Date().toISOString() })
}

// ---------- auditoria ----------

function audit() {
  const catalog = readJSON<PhotoCatalog>(P.catalog, { generatedAt: null, assets: [], links: [], observations: [], adjacentPairs: [] })
  const { candidates } = readJSON<{ candidates: Candidate[] }>(P.candidates, { candidates: [] })
  const curation = readJSON<{ decisions: Record<string, Decision> }>(P.curation, { decisions: {} })
  const covers = new Set(catalog.links.filter((l) => l.role === 'capa').map((l) => l.damId))
  const withCandidates = new Set(candidates.map((c) => c.damId))
  const pendingIdentity = candidates.filter((c) => !curation.decisions[c.key] || curation.decisions[c.key].identity !== 'confirmado').length
  const pendingRights = candidates.filter((c) => !curation.decisions[c.key] || curation.decisions[c.key].rights === 'por-verificar').length
  const report = {
    auditedAt: new Date().toISOString(),
    totalDams: DAMS.length,
    byCountry: { PT: DAMS.filter((d) => d.country === 'PT').length, ES: DAMS.filter((d) => d.country === 'ES').length },
    approvedCovers: covers.size,
    damsWithCandidates: withCandidates.size,
    candidates: candidates.length,
    candidatesPendingIdentity: pendingIdentity,
    candidatesPendingRights: pendingRights,
    damsWithoutPhoto: DAMS.filter((d) => !covers.has(d.id)).map((d) => d.id),
    duplicateConflicts: findDuplicateConflicts(catalog),
  }
  writeJSON(P.coverage, report)
  log(`Barragens: ${report.totalDams} · capas aprovadas: ${report.approvedCovers} · com candidatos: ${report.damsWithCandidates} · sem fotografia: ${report.damsWithoutPhoto.length}`)
}

function writeRun(r: Record<string, unknown>) {
  const file = join(P.runs, `${new Date().toISOString().replace(/[:.]/g, '-')}-${r.kind}.json`)
  writeJSON(file, r)
}

const commands: Record<string, () => unknown> = { discover, derive, publish, audit }
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('pipeline.ts')) {
  if (!commands[cmd]) {
    console.log('Uso: npm run photos -- <discover|derive|publish|audit> [--dam id] [--limit N] [--dry-run]')
    process.exitCode = 1
  } else {
    Promise.resolve(commands[cmd]()).catch((e) => {
      console.error('[photos] erro:', (e as Error).message)
      process.exitCode = 1
    })
  }
}
