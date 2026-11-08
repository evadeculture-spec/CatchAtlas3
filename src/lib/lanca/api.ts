/**
 * Acesso a dados do Lança Lance. Todas as leituras e escritas passam pelas políticas RLS do
 * utilizador com sessão iniciada; nenhuma função aqui consegue ler dados de outro utilizador.
 */
import { FunctionsHttpError, type PostgrestError } from '@supabase/supabase-js'
import { AVATAR_BUCKET, PING_BUCKET, SIGNED_URL_TTL_S, sb } from './supabase'
import { extFor, fitWithin, type PreparedImage } from './image'
import type { PhotoMeta } from './exif'
import type {
  AnglerSummary, Catch, DataSource, Equipment, Journey, Pin, PinInput, Ping, PingEnvironment, PingFull, PingInput, PingMedia, Profile, TimelineRow,
} from './types'

// ------------------------------------------------------------------ erros
export class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
  }
}

export function friendly(e: unknown): string {
  if (!e) return 'Erro desconhecido.'
  const pe = e as Partial<PostgrestError> & { message?: string; status?: number }
  const msg = pe.message ?? String(e)
  if (pe.code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Sem permissão para esta operação.'
  if (pe.code === '54000') return 'Demasiados registos num minuto. Aguarde um pouco e tente de novo.'
  if (pe.code === '23514') return 'Há dados inválidos (verifique datas, coordenadas e valores).'
  if (pe.code === '23505') return 'Este registo já existe.'
  // Mesma mensagem exista ou não o registo (não revela identificadores de outros utilizadores).
  if (pe.code === 'PGRST116' || pe.code === '22P02') return 'Registo não encontrado.'
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return 'Sem ligação ao servidor. Verifique a internet e tente de novo.'
  return msg
}

function check<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new ApiError(friendly(res.error), res.error.code)
  return res.data as T
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke(fn, { body })
  if (error) {
    let msg = error.message
    if (error instanceof FunctionsHttpError) {
      const j = await error.context.json().catch(() => null)
      if (j?.error) msg = j.error
    }
    throw new ApiError(friendly({ message: msg }))
  }
  return data as T
}

async function uid(): Promise<string> {
  const { data } = await sb().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ApiError('Sessão expirada. Inicie sessão de novo.')
  return id
}

// ------------------------------------------------------------------ colunas (sem a geografia gerada)
const PIN_COLS = 'id, owner_id, name, category, description, tags, status, is_favorite, lat, lng, accuracy_m, coord_source, altitude_m, water_body_ref, water_body_name, environment, access_notes, target_species, modalities, techniques, baits, depth_m, bottom_type, private_notes, created_at, updated_at'
const PING_COLS = 'id, owner_id, pin_id, journey_id, kind, occurred_at, occurred_tz, time_source, time_reliability, client_created_at, server_received_at, lat, lng, accuracy_m, location_source, location_measured_at, modality, technique, bait, equipment, depth_m, bottom_type, fishing_minutes, catch_count, outcome, notes, enrichment_status, enrichment_attempts, enrichment_error, enriched_at, created_at, updated_at'
const PING_FULL = `${PING_COLS}, catches(*), ping_media(*), ping_environment(*), pin:pins(id, name, category, environment)`

function normalizePing(row: Record<string, unknown>): PingFull {
  const env = row.ping_environment as PingEnvironment | PingEnvironment[] | null
  const media = ((row.ping_media as PingMedia[]) ?? []).slice().sort((a, b) => a.position - b.position)
  return { ...(row as unknown as PingFull), ping_environment: Array.isArray(env) ? env[0] ?? null : env, ping_media: media, catches: (row.catches as Catch[]) ?? [] }
}

// ------------------------------------------------------------------ perfil
export async function getProfile(): Promise<Profile> {
  const id = await uid()
  return check(await sb().from('profiles').select('*').eq('id', id).single())
}
export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const id = await uid()
  const allowed: (keyof Profile)[] = ['display_name', 'avatar_path', 'country', 'language', 'unit_temperature', 'unit_length', 'unit_weight', 'unit_wind', 'modalities', 'favorite_species', 'techniques', 'home_areas', 'privacy_notice_version', 'privacy_notice_accepted_at']
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k as keyof Profile)))
  return check(await sb().from('profiles').update(clean).eq('id', id).select('*').single())
}

async function resizeTo(file: Blob, max: number): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const [w, h] = fitWithin(bmp.width, bmp.height, max)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.85))
  if (out && out.type === 'image/webp') return out
  return (await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85)))!
}

/** Avatar privado (reduzido no dispositivo, sem EXIF). */
export async function uploadAvatar(file: File, previous: string | null): Promise<Profile> {
  const id = await uid()
  const blob = await resizeTo(file, 512)
  const path = `${id}/avatar-${Date.now()}.${extFor(blob.type)}`
  const up = await sb().storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false })
  if (up.error) throw new ApiError(friendly(up.error))
  const p = await updateProfile({ avatar_path: path })
  if (previous) await sb().storage.from(AVATAR_BUCKET).remove([previous])
  return p
}

// ------------------------------------------------------------------ URLs assinados (cache em memória)
const signedCache = new Map<string, { url: string; exp: number }>()
export async function signedUrls(paths: string[], bucket = PING_BUCKET): Promise<Record<string, string>> {
  const now = Date.now()
  const out: Record<string, string> = {}
  const missing: string[] = []
  for (const p of paths) {
    const hit = signedCache.get(`${bucket}/${p}`)
    if (hit && hit.exp > now + 60000) out[p] = hit.url
    else missing.push(p)
  }
  if (missing.length) {
    const { data, error } = await sb().storage.from(bucket).createSignedUrls(missing, SIGNED_URL_TTL_S)
    if (error) throw new ApiError(friendly(error))
    for (const d of data ?? []) {
      if (d.signedUrl && d.path) {
        out[d.path] = d.signedUrl
        signedCache.set(`${bucket}/${d.path}`, { url: d.signedUrl, exp: now + SIGNED_URL_TTL_S * 1000 })
      }
    }
  }
  return out
}
export const clearSignedCache = () => signedCache.clear()

// ------------------------------------------------------------------ pins
export async function listPins(): Promise<Pin[]> {
  return check(await sb().from('pins').select(PIN_COLS).order('updated_at', { ascending: false }).limit(1000)) as Pin[]
}
export async function getPin(id: string): Promise<Pin> {
  return check(await sb().from('pins').select(PIN_COLS).eq('id', id).single()) as Pin
}
export async function createPin(input: Partial<PinInput> & Pick<PinInput, 'name' | 'lat' | 'lng'>): Promise<Pin> {
  return check(await sb().from('pins').insert(input).select(PIN_COLS).single()) as Pin
}
export async function updatePin(id: string, patch: Partial<PinInput>): Promise<Pin> {
  return check(await sb().from('pins').update(patch).eq('id', id).select(PIN_COLS).single()) as Pin
}
/** Apagar um pin não apaga os pings: ficam sem pin associado. */
export async function deletePin(id: string): Promise<void> {
  check(await sb().from('pins').delete().eq('id', id))
}
export async function nearbyPins(lat: number, lng: number, radiusM = 150): Promise<{ id: string; name: string; category: string; status: string; lat: number; lng: number; distance_m: number }[]> {
  return check(await sb().rpc('nearby_pins', { p_lat: lat, p_lng: lng, p_radius_m: radiusM })) ?? []
}

// ------------------------------------------------------------------ pings
export async function listPings(opts: { pinId?: string; journeyId?: string; limit?: number; since?: string } = {}): Promise<PingFull[]> {
  let q = sb().from('pings').select(PING_FULL).order('occurred_at', { ascending: false }).limit(opts.limit ?? 500)
  if (opts.pinId) q = q.eq('pin_id', opts.pinId)
  if (opts.journeyId) q = q.eq('journey_id', opts.journeyId)
  if (opts.since) q = q.gte('occurred_at', opts.since)
  return (check(await q) as Record<string, unknown>[]).map(normalizePing)
}
export async function getPing(id: string): Promise<PingFull> {
  return normalizePing(check(await sb().from('pings').select(PING_FULL).eq('id', id).single()) as Record<string, unknown>)
}
export async function getPingStatus(id: string): Promise<Pick<Ping, 'enrichment_status' | 'enrichment_error'>> {
  return check(await sb().from('pings').select('enrichment_status, enrichment_error').eq('id', id).single())
}
/** Criação idempotente: o id é gerado no dispositivo, por isso repetir após uma falha de rede não duplica. */
export async function createPing(input: PingInput & { id: string }): Promise<Ping> {
  const res = await sb().from('pings').insert(input).select(PING_COLS).single()
  if (res.error?.code === '23505') return check(await sb().from('pings').select(PING_COLS).eq('id', input.id).single()) as Ping
  return check(res) as Ping
}
export async function updatePing(id: string, patch: Partial<PingInput>): Promise<Ping> {
  return check(await sb().from('pings').update(patch).eq('id', id).select(PING_COLS).single()) as Ping
}
/** Apaga o ping, as fotografias (ficheiros privados) e os dados associados. */
export async function deletePing(id: string): Promise<void> {
  const media = check(await sb().from('ping_media').select('storage_path, display_path, thumb_path').eq('ping_id', id)) as Pick<PingMedia, 'storage_path' | 'display_path' | 'thumb_path'>[]
  const paths = media.flatMap((m) => [m.storage_path, m.display_path, m.thumb_path]).filter((p): p is string => !!p)
  if (paths.length) {
    const rm = await sb().storage.from(PING_BUCKET).remove(paths)
    if (rm.error) throw new ApiError(friendly(rm.error))
  }
  check(await sb().from('pings').delete().eq('id', id))
}

export async function addCatch(row: Pick<Catch, 'ping_id' | 'species'> & Partial<Pick<Catch, 'weight_g' | 'length_cm' | 'released' | 'notes'>>): Promise<Catch> {
  return check(await sb().from('catches').insert(row).select('*').single())
}
export async function updateCatch(id: string, patch: Partial<Pick<Catch, 'species' | 'weight_g' | 'length_cm' | 'released' | 'notes'>>): Promise<Catch> {
  return check(await sb().from('catches').update(patch).eq('id', id).select('*').single())
}
export async function deleteCatch(id: string) {
  check(await sb().from('catches').delete().eq('id', id))
}

async function uploadWithRetry(path: string, blob: Blob, contentType: string, tries = 3) {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    const { error } = await sb().storage.from(PING_BUCKET).upload(path, blob, { contentType, upsert: true, cacheControl: '3600' })
    if (!error) return
    last = error
    if (/mime|size|exceed|policy|security/i.test(error.message)) break
    await new Promise((r) => setTimeout(r, 800 * 2 ** i))
  }
  throw new ApiError(`Falha ao enviar a fotografia: ${friendly(last)}`)
}

/** Envia original + versões otimizadas para a pasta privada do utilizador e regista os metadados. */
export async function uploadPingPhoto(pingId: string, img: PreparedImage, meta: PhotoMeta | null, position: number, mediaId: string): Promise<PingMedia> {
  const id = await uid()
  const base = `${id}/${mediaId}`
  const storage_path = `${base}-orig.${extFor(img.originalMime)}`
  await uploadWithRetry(storage_path, img.original, img.originalMime)
  let display_path: string | null = null
  let thumb_path: string | null = null
  if (img.display) {
    display_path = `${base}-display.${extFor(img.display.type)}`
    await uploadWithRetry(display_path, img.display, img.display.type)
  }
  if (img.thumb) {
    thumb_path = `${base}-thumb.${extFor(img.thumb.type)}`
    await uploadWithRetry(thumb_path, img.thumb, img.thumb.type)
  }
  const exifTaken = meta?.takenLocal ? `${meta.takenLocal.slice(0, 10).replace(/:/g, '-')}T${meta.takenLocal.slice(11)}${meta.offset ?? 'Z'}` : null
  const row = {
    id: mediaId,
    ping_id: pingId,
    storage_path,
    display_path,
    thumb_path,
    mime: img.originalMime,
    width: img.width,
    height: img.height,
    bytes: img.original.size,
    // Sem fuso na câmara, a hora fica registada tal como gravada (marcada sem offset).
    exif_taken_at: exifTaken && !Number.isNaN(Date.parse(exifTaken)) ? new Date(exifTaken).toISOString() : null,
    exif_offset: meta?.offset ?? null,
    exif_has_gps: !!meta?.gps,
    exif_lat: meta?.gps?.lat ?? null,
    exif_lng: meta?.gps?.lng ?? null,
    position,
  }
  const res = await sb().from('ping_media').insert(row).select('*').single()
  if (res.error?.code === '23505') return check(await sb().from('ping_media').select('*').eq('id', mediaId).single())
  return check(res)
}

export async function deletePhoto(m: PingMedia) {
  const paths = [m.storage_path, m.display_path, m.thumb_path].filter((p): p is string => !!p)
  const rm = await sb().storage.from(PING_BUCKET).remove(paths)
  if (rm.error) throw new ApiError(friendly(rm.error))
  check(await sb().from('ping_media').delete().eq('id', m.id))
}

export interface EnrichResult {
  results: { id: string; status: string; skipped?: string }[]
}
export const enrichPing = (pingId: string) => invoke<EnrichResult>('enrich-ping', { pingId })
export const enrichSweep = () => invoke<EnrichResult>('enrich-ping', { sweep: true })

// ------------------------------------------------------------------ jornadas
export interface JourneyFull extends Journey {
  journey_pins: { pin_id: string; position: number; pin: Pin | null }[]
}
export async function listJourneys(): Promise<JourneyFull[]> {
  const rows = check(await sb().from('journeys').select(`*, journey_pins(pin_id, position, pin:pins(${PIN_COLS}))`).order('journey_date', { ascending: false }).limit(300)) as JourneyFull[]
  return rows.map((j) => ({ ...j, journey_pins: [...(j.journey_pins ?? [])].sort((a, b) => a.position - b.position) }))
}
export async function getJourney(id: string): Promise<JourneyFull> {
  const j = check(await sb().from('journeys').select(`*, journey_pins(pin_id, position, pin:pins(${PIN_COLS}))`).eq('id', id).single()) as JourneyFull
  return { ...j, journey_pins: [...(j.journey_pins ?? [])].sort((a, b) => a.position - b.position) }
}
export type JourneyInput = Partial<Omit<Journey, 'id' | 'owner_id' | 'created_at' | 'updated_at'>> & Pick<Journey, 'title' | 'journey_date'>
export async function createJourney(input: JourneyInput): Promise<Journey> {
  return check(await sb().from('journeys').insert(input).select('*').single())
}
export async function updateJourney(id: string, patch: Partial<JourneyInput>): Promise<Journey> {
  return check(await sb().from('journeys').update(patch).eq('id', id).select('*').single())
}
export async function deleteJourney(id: string) {
  check(await sb().from('journeys').delete().eq('id', id))
}
/** Define os pins (ordenados) de uma jornada. */
export async function setJourneyPins(journeyId: string, pinIds: string[]) {
  check(await sb().from('journey_pins').delete().eq('journey_id', journeyId))
  if (pinIds.length) check(await sb().from('journey_pins').insert(pinIds.map((pin_id, position) => ({ journey_id: journeyId, pin_id, position }))))
}

export interface ConditionsResponse {
  available: boolean
  stale?: boolean
  reason?: string
  kind?: 'previsao' | 'estimado' | 'historico'
  dataset?: string
  source?: string
  fetchedAt?: string | null
  cellDeg?: number
  data?: {
    hourly?: Record<string, (number | string | null)[] | undefined>
    daily?: Record<string, (number | string | null)[] | undefined>
    hourly_units?: Record<string, string>
  }
  astronomy?: { sunrise: string | null; sunset: string | null; day_length_min: number | null; moon_phase: number; moon_illumination: number; moonrise: string | null; moonset: string | null }
}
export const conditions = (q: { lat: number; lng: number; date: string; timezone: string }) => invoke<ConditionsResponse>('conditions', q)

// ------------------------------------------------------------------ equipamento
export async function listEquipment(): Promise<Equipment[]> {
  return check(await sb().from('equipment').select('*').order('kind').order('name'))
}
export async function createEquipment(row: Pick<Equipment, 'name' | 'kind'> & { notes?: string | null }): Promise<Equipment> {
  return check(await sb().from('equipment').insert(row).select('*').single())
}
export async function updateEquipment(id: string, patch: Partial<Pick<Equipment, 'name' | 'kind' | 'notes'>>): Promise<Equipment> {
  return check(await sb().from('equipment').update(patch).eq('id', id).select('*').single())
}
export async function deleteEquipment(id: string) {
  check(await sb().from('equipment').delete().eq('id', id))
}

// ------------------------------------------------------------------ painel, cronologia, fontes
export async function anglerSummary(): Promise<AnglerSummary> {
  const d = check(await sb().rpc('angler_summary'))
  return (Array.isArray(d) ? d[0] : d) as AnglerSummary
}
export async function timeline(limit = 30): Promise<TimelineRow[]> {
  return check(await sb().from('activity_timeline').select('*').order('at', { ascending: false }).limit(limit))
}
export async function listDataSources(): Promise<DataSource[]> {
  return check(await sb().from('data_sources').select('*').order('key'))
}

// ------------------------------------------------------------------ RGPD: exportação e eliminação
export async function exportAll() {
  const id = await uid()
  const [profile, pins, pings, catches, media, env, journeys, journeyPins, equipment, audit] = await Promise.all([
    sb().from('profiles').select('*').eq('id', id).single(),
    sb().from('pins').select(PIN_COLS),
    sb().from('pings').select(PING_COLS),
    sb().from('catches').select('*'),
    sb().from('ping_media').select('*'),
    sb().from('ping_environment').select('*'),
    sb().from('journeys').select('*'),
    sb().from('journey_pins').select('*'),
    sb().from('equipment').select('*'),
    sb().from('audit_log').select('*').order('at', { ascending: false }).limit(1000),
  ])
  const all = { profile, pins, pings, catches, media, env, journeys, journeyPins, equipment, audit }
  for (const [k, v] of Object.entries(all)) if (v.error) throw new ApiError(`Exportação (${k}): ${friendly(v.error)}`)
  await sb().from('audit_log').insert({ action: 'export', entity: 'account', entity_id: id })
  return {
    format: 'lanca-lance-export',
    version: 1,
    exported_at: new Date().toISOString(),
    notes: 'Dados pessoais da conta (RGPD, art. 20.º). Horas em UTC (ISO 8601); fuso do acontecimento em occurred_tz. Condições ambientais com a fonte e a natureza do dado (estimado/histórico/previsão).',
    profile: profile.data,
    pins: pins.data,
    pings: pings.data,
    catches: catches.data,
    photos: media.data,
    conditions: env.data,
    journeys: journeys.data,
    journey_pins: journeyPins.data,
    equipment: equipment.data,
    audit_log: audit.data,
  }
}

export async function downloadOriginal(path: string): Promise<Blob> {
  const { data, error } = await sb().storage.from(PING_BUCKET).download(path)
  if (error || !data) throw new ApiError(friendly(error))
  return data
}

export async function deleteAccount() {
  const id = await uid()
  await sb().from('audit_log').insert({ action: 'account-delete-request', entity: 'account', entity_id: id })
  await invoke<{ ok: boolean }>('delete-account', { confirm: 'ELIMINAR' })
  clearSignedCache()
  await sb().auth.signOut({ scope: 'local' })
}
