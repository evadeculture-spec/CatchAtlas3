/**
 * Pins de campo: o registo georreferenciado criado no Atlas ("Marcar pin").
 *
 * Um único registo com ID estável gerado no dispositivo, referenciado pelo mapa, pelo diário e pelas
 * jornadas. No servidor reutiliza o modelo existente:
 *   - Captura / Observação → tabela `pings` (+ `catches`, `ping_media`, condições do momento);
 *   - Local para voltar     → tabela `pins`.
 *
 * Fluxo: escrita local durável (IndexedDB, por conta) → "Guardado no dispositivo" → sincronização
 * idempotente (o mesmo ID nunca cria dois registos) → "Sincronizado". A fotografia tem estado próprio.
 */
import { enrichPing, uploadPingPhoto } from './api'
import { getAll, getOne, openDb, requestPersistence, writeAll, type Write } from './idb'
import type { PreparedImage } from './image'
import type { PhotoMeta } from './exif'
import { sb } from './supabase'
import type { Reliability, TimeSource } from './types'

export type FieldPinType = 'captura' | 'observacao' | 'local'
export type SyncState = 'local' | 'syncing' | 'synced' | 'error' | 'conflict' | 'auth' | 'quota'
export type PhotoState = 'local' | 'uploading' | 'synced' | 'error'

export interface FieldPhoto {
  id: string
  mime: string
  width: number | null
  height: number | null
  bytes: number
  hasDisplay: boolean
  hasThumb: boolean
  displayMime: string | null
  thumbMime: string | null
  exif: PhotoMeta | null
  state: PhotoState
  error: string | null
}

export interface FieldPin {
  id: string
  uid: string
  type: FieldPinType
  lat: number
  lng: number
  accuracy: number | null
  source: 'gps' | 'mapa'
  measuredAt: string | null
  occurredAt: string
  tz: string
  timeSource: TimeSource
  timeReliability: Reliability
  name: string | null
  notes: string | null
  species: string | null
  count: number | null
  weightG: number | null
  lengthCm: number | null
  technique: string | null
  bait: string | null
  depthM: number | null
  catchId: string | null
  waterRef: string | null
  waterName: string | null
  /** Setor do catálogo «Carpa» a que o pin está ligado (opcional; pins livres continuam possíveis). */
  carpSector?: string | null
  photos: FieldPhoto[]
  sync: SyncState
  error: string | null
  existsOnServer: boolean
  /** Revisão das edições no servidor quando foi lida (conflito se outro dispositivo editou entretanto). */
  serverRev: number | null
  /** Houve alterações locais desde a última sincronização. */
  dirty: boolean
  /** Precisa de pedir de novo as condições (ponto ou hora mudaram). */
  reenrich: boolean
  deleted: boolean
  attempts: number
  nextAttemptAt: number
  createdAt: string
  updatedAt: string
}

export interface Draft {
  pin: Partial<FieldPin> & { id: string }
  photos: FieldPhoto[]
  step: 'place' | 'details'
  savedAt: string
}

export const TYPE_LABEL: Record<FieldPinType, string> = { captura: 'Captura', observacao: 'Observação', local: 'Local para voltar' }
export const SYNC_LABEL: Record<SyncState, string> = {
  local: 'Guardado no dispositivo',
  syncing: 'A sincronizar',
  synced: 'Sincronizado',
  error: 'Erro na sincronização',
  conflict: 'Conflito de edição',
  auth: 'Sessão expirada',
  quota: 'Sem espaço',
}
export const PHOTO_LABEL: Record<PhotoState, string> = { local: 'Fotografia no dispositivo', uploading: 'A enviar fotografia', synced: 'Fotografia enviada', error: 'Fotografia por enviar' }

type Listener = () => void
const blobKey = (pinId: string, photoId: string, v: 'orig' | 'display' | 'thumb') => `${pinId}/${photoId}/${v}`

/** Classificação dos erros de sincronização (o que fazer a seguir). */
export function classify(e: unknown): { state: SyncState; retry: boolean; message: string } {
  const msg = String((e as { message?: string })?.message ?? e)
  const code = (e as { code?: string })?.code
  const status = (e as { status?: number })?.status
  if (/Sem ligação|Failed to fetch|NetworkError|Load failed|network|timeout|ETIMEDOUT/i.test(msg)) return { state: 'local', retry: true, message: 'Sem ligação: fica guardado no dispositivo e é enviado quando houver rede.' }
  if (status === 401 || /Sessão expirada|JWT|not authenticated|invalid claim|refresh token/i.test(msg)) return { state: 'auth', retry: false, message: 'Sessão expirada: inicie sessão para enviar o que está guardado no dispositivo.' }
  if (status === 413 || /quota|exceed|too large|Payload|maximum allowed size|Sem espaço/i.test(msg)) return { state: 'quota', retry: false, message: msg.includes('dispositivo') ? msg : 'Sem espaço para a fotografia (limite de armazenamento). Retire a fotografia ou tente mais tarde.' }
  if (code === '54000' || /Demasiados/i.test(msg)) return { state: 'local', retry: true, message: 'Muitos registos seguidos: o envio é retomado dentro de instantes.' }
  return { state: 'error', retry: true, message: msg }
}

const now = () => new Date().toISOString()

export class FieldStore {
  private db: Promise<IDBDatabase>
  private listeners = new Set<Listener>()
  private running: Promise<void> | null = null
  private pins = new Map<string, FieldPin>()
  private loaded: Promise<void>
  readonly uid: string

  constructor(uid: string) {
    this.uid = uid
    this.db = openDb(`lancalance-${uid}`)
    this.loaded = this.load()
    void requestPersistence()
  }

  private async load() {
    const db = await this.db
    const all = await getAll<FieldPin>(db, 'pins')
    const stale = Date.now() - 24 * 3600000
    const prune: Write[] = []
    for (const p of all) {
      // Registos já no servidor há mais de um dia: o mapa e o diário leem-nos do servidor.
      if (p.sync === 'synced' && !p.dirty && !p.deleted && Date.parse(p.updatedAt) < stale) prune.push({ store: 'pins', key: p.id, delete: true })
      else this.pins.set(p.id, p.sync === 'syncing' ? { ...p, sync: 'local' } : p)
    }
    if (prune.length) await writeAll(db, prune).catch(() => undefined)
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }
  private emit() {
    for (const l of this.listeners) l()
  }

  async ready() {
    await this.loaded
  }
  /** Pins locais visíveis (sem os apagados). */
  list(): FieldPin[] {
    return [...this.pins.values()].filter((p) => !p.deleted)
  }
  get(id: string) {
    return this.pins.get(id) ?? null
  }
  deletedIds() {
    return new Set([...this.pins.values()].filter((p) => p.deleted).map((p) => p.id))
  }
  pendingCount() {
    return [...this.pins.values()].filter((p) => p.dirty || p.deleted || p.photos.some((f) => f.state !== 'synced')).length
  }

  /** Escrita local durável (registo + fotografias novas). Só resolve quando a transação é confirmada. */
  async save(pin: FieldPin, photos: { photo: FieldPhoto; img: PreparedImage }[] = []) {
    await this.loaded
    const db = await this.db
    const writes: Write[] = []
    for (const { photo, img } of photos) {
      writes.push({ store: 'blobs', key: blobKey(pin.id, photo.id, 'orig'), value: img.original })
      if (img.display) writes.push({ store: 'blobs', key: blobKey(pin.id, photo.id, 'display'), value: img.display })
      if (img.thumb) writes.push({ store: 'blobs', key: blobKey(pin.id, photo.id, 'thumb'), value: img.thumb })
    }
    const next: FieldPin = { ...pin, dirty: true, sync: 'local', error: null, attempts: 0, nextAttemptAt: 0, updatedAt: now() }
    writes.push({ store: 'pins', key: pin.id, value: next })
    await writeAll(db, writes)
    this.pins.set(pin.id, next)
    this.emit()
    void this.sync()
    return next
  }

  /** Marca para apagar (no servidor também, quando houver rede). */
  async remove(id: string) {
    await this.loaded
    const p = this.pins.get(id)
    const base: FieldPin = p ?? (await this.fromServer(id))
    const next = { ...base, deleted: true, dirty: true, sync: 'local' as const, updatedAt: now() }
    await writeAll(await this.db, [{ store: 'pins', key: id, value: next }])
    this.pins.set(id, next)
    this.emit()
    void this.sync()
  }

  /** Para editar um pin que só existe no servidor: cria a cópia local a partir do servidor. */
  async fromServer(id: string): Promise<FieldPin> {
    const p = await fetchServerPin(this.uid, id)
    if (!p) throw new Error('Registo não encontrado.')
    return p
  }

  async photoUrl(pinId: string, photoId: string, v: 'display' | 'thumb' | 'orig' = 'thumb'): Promise<string | null> {
    const db = await this.db
    const b = (await getOne<Blob>(db, 'blobs', blobKey(pinId, photoId, v))) ?? (v !== 'orig' ? await getOne<Blob>(db, 'blobs', blobKey(pinId, photoId, 'orig')) : undefined)
    return b ? URL.createObjectURL(b) : null
  }

  // ------------------------------------------------------------- rascunho
  async getDraft(): Promise<Draft | null> {
    return (await getOne<Draft>(await this.db, 'drafts', 'current')) ?? null
  }
  async saveDraft(d: Draft, photos: { photo: FieldPhoto; img: PreparedImage }[] = []) {
    const writes: Write[] = [{ store: 'drafts', key: 'current', value: d }]
    for (const { photo, img } of photos) {
      writes.push({ store: 'blobs', key: blobKey(d.pin.id, photo.id, 'orig'), value: img.original })
      if (img.display) writes.push({ store: 'blobs', key: blobKey(d.pin.id, photo.id, 'display'), value: img.display })
      if (img.thumb) writes.push({ store: 'blobs', key: blobKey(d.pin.id, photo.id, 'thumb'), value: img.thumb })
    }
    await writeAll(await this.db, writes)
  }
  async clearDraft(discardPhotos?: { pinId: string; photoIds: string[] }) {
    const writes: Write[] = [{ store: 'drafts', key: 'current', delete: true }]
    for (const id of discardPhotos?.photoIds ?? []) for (const v of ['orig', 'display', 'thumb'] as const) writes.push({ store: 'blobs', key: blobKey(discardPhotos!.pinId, id, v), delete: true })
    await writeAll(await this.db, writes)
  }
  async draftBlobs(pinId: string, photoId: string) {
    const db = await this.db
    const [orig, display, thumb] = await Promise.all((['orig', 'display', 'thumb'] as const).map((v) => getOne<Blob>(db, 'blobs', blobKey(pinId, photoId, v))))
    return { orig, display, thumb }
  }

  // ------------------------------------------------------------- sincronização
  /** Uma única sincronização de cada vez (também entre separadores, com Web Locks quando existe). */
  sync(force = false): Promise<void> {
    if (this.running) return this.running
    const run = async () => {
      await this.loaded
      const locks = (navigator as Navigator & { locks?: { request: (n: string, o: object, cb: (l: unknown) => Promise<void>) => Promise<void> } }).locks
      if (locks) await locks.request(`lancalance-sync-${this.uid}`, { ifAvailable: true }, async (lock) => (lock ? this.syncAll(force) : undefined))
      else await this.syncAll(force)
    }
    this.running = run().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async put(p: FieldPin) {
    this.pins.set(p.id, p)
    await writeAll(await this.db, [{ store: 'pins', key: p.id, value: p }]).catch(() => undefined)
    this.emit()
  }

  private async syncAll(force: boolean) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const todo = [...this.pins.values()].filter((p) => (p.dirty || p.deleted || p.sync !== 'synced' || p.photos.some((f) => f.state !== 'synced')) && (force || p.nextAttemptAt <= Date.now()) && (force || (p.sync !== 'conflict' && p.sync !== 'auth' && p.sync !== 'quota')))
    for (const p of todo) {
      try {
        await this.syncOne(p)
      } catch (e) {
        const c = classify(e)
        const cur = this.pins.get(p.id) ?? p
        const attempts = cur.attempts + 1
        await this.put({ ...cur, sync: c.state, error: c.message, attempts, nextAttemptAt: c.retry ? Date.now() + Math.min(300000, 2000 * 2 ** attempts) : Number.MAX_SAFE_INTEGER, photos: cur.photos.map((f) => (f.state === 'uploading' ? { ...f, state: 'error', error: c.message } : f)) })
        if (c.state === 'local' && /Sem ligação/.test(c.message)) break
      }
    }
  }

  private async syncOne(p0: FieldPin) {
    let p: FieldPin = { ...p0, sync: 'syncing', error: null }
    await this.put(p)
    const client = sb()
    const isPing = p.type !== 'local'
    const table = isPing ? 'pings' : 'pins'
    // 1. Apagar
    if (p.deleted) {
      if (p.existsOnServer) {
        if (isPing) {
          // Retira primeiro a versão comunitária (se existir) e as fotografias privadas.
          await client.functions.invoke('community-share', { body: { action: 'revoke', pingId: p.id } }).catch(() => undefined)
          const { data: media } = await client.from('ping_media').select('storage_path, display_path, thumb_path').eq('ping_id', p.id)
          const paths = (media ?? []).flatMap((m) => [m.storage_path, m.display_path, m.thumb_path]).filter(Boolean) as string[]
          if (paths.length) {
            const rm = await client.storage.from('ping-media').remove(paths)
            if (rm.error) throw rm.error
          }
        }
        const { error } = await client.from(table).delete().eq('id', p.id)
        if (error) throw error
      }
      const writes: Write[] = [{ store: 'pins', key: p.id, delete: true }]
      for (const f of p.photos) for (const v of ['orig', 'display', 'thumb'] as const) writes.push({ store: 'blobs', key: blobKey(p.id, f.id, v), delete: true })
      await writeAll(await this.db, writes)
      this.pins.delete(p.id)
      this.emit()
      return
    }
    // 2. Criar ou atualizar (com deteção de conflito pela data da última alteração no servidor)
    if (p.dirty) {
      const row = toServerRow(p)
      if (!p.existsOnServer) {
        const res = await client.from(table).insert({ id: p.id, ...row, ...(isPing ? { client_created_at: p.createdAt } : {}) }).select('rev').single()
        let rev = res.data?.rev as number | undefined
        if (res.error) {
          // Repetição depois de uma falha de rede: o registo já existe com este ID (idempotente).
          if (res.error.code !== '23505') throw res.error
          const again = await client.from(table).select('rev').eq('id', p.id).single()
          if (again.error) throw again.error
          rev = again.data.rev
        }
        p = { ...p, existsOnServer: true, serverRev: rev ?? 0, reenrich: isPing }
      } else {
        const base = p.serverRev ?? 0
        const res = await client.from(table).update({ ...row, rev: base + 1 }).eq('id', p.id).eq('rev', base).select('rev')
        if (res.error) throw res.error
        if (!res.data?.length) {
          const cur = await client.from(table).select('rev').eq('id', p.id).maybeSingle()
          const msg = cur.data ? 'Este pin foi alterado noutro dispositivo.' : 'Este pin foi apagado noutro dispositivo.'
          await this.put({ ...p, sync: 'conflict', error: msg, nextAttemptAt: Number.MAX_SAFE_INTEGER })
          return
        }
        p = { ...p, serverRev: res.data[0].rev }
      }
      // Captura estruturada (espécie, medidas) com ID próprio também gerado no dispositivo.
      if (isPing) {
        if (p.type === 'captura' && p.species?.trim()) {
          const catchId = p.catchId ?? crypto.randomUUID()
          const { error } = await client.from('catches').upsert({ id: catchId, ping_id: p.id, species: p.species.trim().slice(0, 80), length_cm: p.lengthCm, weight_g: p.weightG })
          if (error) throw error
          p = { ...p, catchId }
        } else if (p.catchId) {
          const { error } = await client.from('catches').delete().eq('id', p.catchId)
          if (error) throw error
          p = { ...p, catchId: null }
        }
      }
      p = { ...p, dirty: false }
      await this.put(p)
    }
    // 3. Fotografias (estado próprio; repetir não duplica: o ID da fotografia é o do ficheiro e da linha)
    if (isPing) {
      const db = await this.db
      for (const f of p.photos.filter((x) => x.state !== 'synced')) {
        p = { ...p, photos: p.photos.map((x) => (x.id === f.id ? { ...x, state: 'uploading', error: null } : x)) }
        await this.put(p)
        const [orig, display, thumb] = await Promise.all((['orig', 'display', 'thumb'] as const).map((v) => getOne<Blob>(db, 'blobs', blobKey(p.id, f.id, v))))
        if (!orig) throw new Error('Fotografia em falta no dispositivo.')
        const img: PreparedImage = { original: orig, originalMime: f.mime, display: display ?? null, thumb: thumb ?? null, width: f.width, height: f.height, previewUrl: '', warning: null }
        await uploadPingPhoto(p.id, img, f.exif, p.photos.indexOf(f), f.id)
        p = { ...p, photos: p.photos.map((x) => (x.id === f.id ? { ...x, state: 'synced' } : x)) }
        await writeAll(db, (['orig', 'display', 'thumb'] as const).map((v) => ({ store: 'blobs' as const, key: blobKey(p.id, f.id, v), delete: true })))
        await this.put(p)
      }
    }
    // 4. Condições do momento: em segundo plano, nunca bloqueiam o registo.
    if (isPing && p.reenrich) void enrichPing(p.id).catch(() => undefined)
    await this.put({ ...p, reenrich: false, sync: 'synced', error: null, attempts: 0, nextAttemptAt: 0 })
  }

  /** Conflito: manter a versão local (sobrepõe) ou descartar e usar a do servidor. */
  async resolveConflict(id: string, keep: 'local' | 'server') {
    const p = this.pins.get(id)
    if (!p) return
    if (keep === 'server') {
      await writeAll(await this.db, [{ store: 'pins', key: id, delete: true }])
      this.pins.delete(id)
      this.emit()
      return
    }
    const cur = await sb().from(p.type === 'local' ? 'pins' : 'pings').select('rev').eq('id', id).maybeSingle()
    await this.put({ ...p, existsOnServer: !!cur.data, serverRev: cur.data?.rev ?? null, sync: 'local', error: null, dirty: true, nextAttemptAt: 0 })
    void this.sync(true)
  }

  /** Tentar agora (depois de iniciar sessão, libertar espaço ou retirar uma fotografia). */
  retryAll() {
    for (const p of this.pins.values()) if (p.sync !== 'synced') this.pins.set(p.id, { ...p, nextAttemptAt: 0, sync: p.sync === 'conflict' ? 'conflict' : 'local' })
    this.emit()
    return this.sync(true)
  }

  async dropPhoto(pinId: string, photoId: string) {
    const p = this.pins.get(pinId)
    if (!p) return
    const next = { ...p, photos: p.photos.filter((f) => f.id !== photoId), sync: 'local' as const, error: null, nextAttemptAt: 0 }
    await writeAll(await this.db, [{ store: 'pins', key: pinId, value: next }, ...(['orig', 'display', 'thumb'] as const).map((v) => ({ store: 'blobs' as const, key: blobKey(pinId, photoId, v), delete: true }))])
    this.pins.set(pinId, next)
    this.emit()
    void this.sync(true)
  }
}

/** Linha do servidor a partir do pin de campo (só colunas que o cliente pode escrever). */
export function toServerRow(p: FieldPin): Record<string, unknown> {
  if (p.type === 'local')
    return {
      name: (p.name?.trim() || 'Local para voltar').slice(0, 80),
      category: 'spot',
      lat: p.lat,
      lng: p.lng,
      accuracy_m: p.accuracy,
      coord_source: p.source === 'gps' ? 'gps' : 'mapa',
      water_body_ref: p.waterRef,
      water_body_name: p.waterName,
      carp_sector_key: p.carpSector ?? null,
      private_notes: p.notes?.trim() || null,
    }
  return {
    kind: p.type,
    occurred_at: p.occurredAt,
    occurred_tz: p.tz,
    time_source: p.timeSource,
    time_reliability: p.timeReliability,
    lat: p.lat,
    lng: p.lng,
    accuracy_m: p.accuracy,
    location_source: p.source,
    location_measured_at: p.measuredAt,
    notes: p.notes?.trim() || null,
    technique: p.technique?.trim() || null,
    bait: p.bait?.trim() || null,
    depth_m: p.depthM,
    catch_count: p.type === 'captura' ? (p.count ?? 1) : null,
    outcome: p.type === 'captura' ? 'sucesso' : null,
    water_body_ref: p.waterRef,
    water_body_name: p.waterName,
    carp_sector_key: p.carpSector ?? null,
  }
}

/** Pin de campo a partir do servidor (para editar, mover ou apagar um registo já sincronizado). */
export async function fetchServerPin(uid: string, id: string): Promise<FieldPin | null> {
  const client = sb()
  const base = { uid, photos: [] as FieldPhoto[], sync: 'synced' as SyncState, error: null, existsOnServer: true, dirty: false, reenrich: false, deleted: false, attempts: 0, nextAttemptAt: 0 }
  const g = await client.from('pings').select('id, kind, lat, lng, accuracy_m, location_source, location_measured_at, occurred_at, occurred_tz, time_source, time_reliability, notes, technique, bait, depth_m, catch_count, water_body_ref, water_body_name, carp_sector_key, rev, created_at, updated_at, catches(id, species, length_cm, weight_g), ping_media(id, mime, width, height, bytes, display_path, thumb_path)').eq('id', id).maybeSingle()
  if (g.data && g.data.lat != null) {
    const d = g.data as Record<string, unknown> & { catches: { id: string; species: string; length_cm: number | null; weight_g: number | null }[]; ping_media: { id: string; mime: string; width: number | null; height: number | null; bytes: number; display_path: string | null; thumb_path: string | null }[] }
    const c = d.catches?.[0]
    return {
      ...base,
      id,
      type: d.kind === 'captura' ? 'captura' : 'observacao',
      lat: d.lat as number,
      lng: d.lng as number,
      accuracy: (d.accuracy_m as number | null) ?? null,
      source: d.location_source === 'gps' ? 'gps' : 'mapa',
      measuredAt: (d.location_measured_at as string | null) ?? null,
      occurredAt: d.occurred_at as string,
      tz: d.occurred_tz as string,
      timeSource: d.time_source as TimeSource,
      timeReliability: d.time_reliability as Reliability,
      name: null,
      notes: (d.notes as string | null) ?? null,
      species: c?.species ?? null,
      count: (d.catch_count as number | null) ?? null,
      weightG: c?.weight_g ?? null,
      lengthCm: c?.length_cm ?? null,
      technique: (d.technique as string | null) ?? null,
      bait: (d.bait as string | null) ?? null,
      depthM: (d.depth_m as number | null) ?? null,
      catchId: c?.id ?? null,
      waterRef: (d.water_body_ref as string | null) ?? null,
      waterName: (d.water_body_name as string | null) ?? null,
      carpSector: (d.carp_sector_key as string | null) ?? null,
      photos: (d.ping_media ?? []).map((m) => ({ id: m.id, mime: m.mime, width: m.width, height: m.height, bytes: m.bytes, hasDisplay: !!m.display_path, hasThumb: !!m.thumb_path, displayMime: null, thumbMime: null, exif: null, state: 'synced' as const, error: null })),
      serverRev: (d.rev as number | null) ?? 0,
      createdAt: d.created_at as string,
      updatedAt: d.updated_at as string,
    }
  }
  const p = await client.from('pins').select('id, name, lat, lng, accuracy_m, coord_source, water_body_ref, water_body_name, carp_sector_key, private_notes, rev, created_at, updated_at').eq('id', id).maybeSingle()
  if (!p.data) return null
  const d = p.data
  return {
    ...base,
    id,
    type: 'local',
    lat: d.lat,
    lng: d.lng,
    accuracy: d.accuracy_m,
    source: d.coord_source === 'gps' ? 'gps' : 'mapa',
    measuredAt: null,
    occurredAt: d.created_at,
    tz: 'Europe/Lisbon',
    timeSource: 'dispositivo',
    timeReliability: 'alta',
    name: d.name,
    notes: d.private_notes,
    species: null,
    count: null,
    weightG: null,
    lengthCm: null,
    technique: null,
    bait: null,
    depthM: null,
    catchId: null,
    waterRef: d.water_body_ref,
    waterName: d.water_body_name,
    carpSector: d.carp_sector_key ?? null,
    serverRev: d.rev ?? 0,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }
}

// ------------------------------------------------------------------ leitura para o mapa
export interface AtlasPinRow {
  kind: string
  id: string | null
  lat: number
  lng: number
  n: number
  title: string | null
  species: string | null
  occurred_at: string | null
  occurred_tz: string | null
  water_body_ref: string | null
  water_body_name: string | null
  thumb_path: string | null
  updated_at: string | null
}

/** Pins do utilizador na área visível; agregados no servidor quando `cellDeg` é dado. Cancelável. */
export async function fetchAtlasPins(bounds: [number, number, number, number], cellDeg: number | null, signal?: AbortSignal): Promise<AtlasPinRow[]> {
  let q = sb().rpc('my_atlas_pins', { p_west: bounds[0], p_south: bounds[1], p_east: bounds[2], p_north: bounds[3], p_cell: cellDeg, p_limit: 1500 })
  if (signal) q = q.abortSignal(signal)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as AtlasPinRow[]
}

/** Tipo de apresentação a partir do tipo do servidor. */
export const displayType = (kind: string): FieldPinType => (kind === 'local' ? 'local' : kind === 'captura' ? 'captura' : 'observacao')

// ------------------------------------------------------------------ comunidade e jornadas
export interface SharedReport {
  id: string
  kind: string
  species: string | null
  technique: string | null
  water_body_name: string | null
  approx_lat: number
  approx_lng: number
  approx_label: string
  precision_km: number
  occurred_on: string
  day_period: 'madrugada' | 'manha' | 'tarde' | 'noite' | null
  photo_path: string | null
  created_at: string
}

export async function fetchCommunity(bounds: [number, number, number, number], sinceDate: string, signal?: AbortSignal): Promise<SharedReport[]> {
  let q = sb()
    .from('shared_reports')
    .select('id, kind, species, technique, water_body_name, approx_lat, approx_lng, approx_label, precision_km, occurred_on, day_period, photo_path, created_at')
    .gte('approx_lng', bounds[0])
    .lte('approx_lng', bounds[2])
    .gte('approx_lat', bounds[1])
    .lte('approx_lat', bounds[3])
    .gte('occurred_on', sinceDate)
    .order('occurred_on', { ascending: false })
    .limit(500)
  if (signal) q = q.abortSignal(signal)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as SharedReport[]
}

export async function myShares(): Promise<Map<string, string>> {
  const { data, error } = await sb().rpc('my_shares')
  if (error) throw error
  return new Map(((data ?? []) as { share_id: string; ping_id: string }[]).map((r) => [r.ping_id, r.share_id]))
}

export type ShareMode = 'zona' | 'exato'
async function invokeShare(action: 'publish' | 'revoke', pingId: string, mode?: ShareMode) {
  const { data, error } = await sb().functions.invoke('community-share', { body: { action, pingId, mode } })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const j = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(j?.error ?? error.message)
  }
  return data as { ok: boolean; shareId?: string }
}
/** Publica (ou muda o modo de) a versão pública: «zona» por omissão; «exato» só por escolha explícita. */
export const publishShare = (pingId: string, mode: ShareMode = 'zona') => invokeShare('publish', pingId, mode)
export const revokeShare = (pingId: string) => invokeShare('revoke', pingId)

/** Associa o pin a uma jornada (sem criar outra captura). */
export async function addToJourney(journeyId: string, pinId: string, type: FieldPinType) {
  const client = sb()
  if (type === 'local') {
    const { count } = await client.from('journey_pins').select('pin_id', { count: 'exact', head: true }).eq('journey_id', journeyId)
    const { error } = await client.from('journey_pins').upsert({ journey_id: journeyId, pin_id: pinId, position: count ?? 0 }, { onConflict: 'journey_id,pin_id', ignoreDuplicates: true })
    if (error) throw error
  } else {
    const { count } = await client.from('journey_pings').select('ping_id', { count: 'exact', head: true }).eq('journey_id', journeyId)
    const { error } = await client.from('journey_pings').upsert({ journey_id: journeyId, ping_id: pinId, position: count ?? 0 }, { onConflict: 'journey_id,ping_id', ignoreDuplicates: true })
    if (error) throw error
  }
}

// ------------------------------------------------------------------ uma instância por conta
const stores = new Map<string, FieldStore>()
export function fieldStoreFor(uid: string): FieldStore {
  let s = stores.get(uid)
  if (!s) {
    s = new FieldStore(uid)
    stores.set(uid, s)
  }
  return s
}
