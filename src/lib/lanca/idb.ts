/**
 * IndexedDB mínimo (sem dependências) para o armazenamento local durável dos pins de campo.
 * Uma base por conta (`lancalance-<uid>`): filas e caches privadas nunca se misturam entre contas.
 * As escritas resolvem só quando a transação termina (`complete`), com durabilidade estrita quando
 * o navegador a suporta: só então a interface pode dizer "Guardado no dispositivo".
 */
export type StoreName = 'pins' | 'blobs' | 'drafts'
const STORES: StoreName[] = ['pins', 'blobs', 'drafts']
const VERSION = 1

export class StorageQuotaError extends Error {
  constructor() {
    super('Sem espaço de armazenamento no dispositivo. Liberte espaço ou retire fotografias e tente de novo.')
  }
}

const cache = new Map<string, Promise<IDBDatabase>>()

export function openDb(name: string): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Este navegador não permite guardar dados no dispositivo.'))
  let p = cache.get(name)
  if (!p) {
    p = new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(name, VERSION)
      r.onupgradeneeded = () => {
        for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s)
      }
      r.onsuccess = () => {
        const db = r.result
        db.onversionchange = () => {
          db.close()
          cache.delete(name)
        }
        resolve(db)
      }
      r.onerror = () => reject(r.error ?? new Error('IndexedDB indisponível'))
      r.onblocked = () => reject(new Error('Armazenamento local bloqueado por outro separador. Feche-o e tente de novo.'))
    })
    p.catch(() => cache.delete(name))
    cache.set(name, p)
  }
  return p
}

/**
 * Apaga a base local de uma conta (pins, fotografias e rascunho), depois de a conta ser eliminada no servidor.
 * Fecha primeiro a ligação deste separador; noutros separadores o `versionchange` fecha-a e o navegador conclui a remoção.
 */
export async function deleteDb(name: string): Promise<void> {
  const p = cache.get(name)
  cache.delete(name)
  if (p) {
    try {
      ;(await p).close()
    } catch {
      /* nunca chegou a abrir */
    }
  }
  if (!('indexedDB' in globalThis)) return
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(name)
    r.onsuccess = () => resolve()
    r.onerror = () => resolve()
    r.onblocked = () => resolve()
  })
}

export interface Write {
  store: StoreName
  key: string
  value?: unknown
  delete?: boolean
}

const isQuota = (e: unknown) => {
  const n = (e as DOMException | null)?.name ?? ''
  return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(String((e as Error | null)?.message ?? ''))
}

/** Várias escritas numa única transação; resolve quando a transação é confirmada. */
export async function writeAll(db: IDBDatabase, writes: Write[]): Promise<void> {
  const stores = [...new Set(writes.map((w) => w.store))]
  await new Promise<void>((resolve, reject) => {
    let t: IDBTransaction
    try {
      t = (db.transaction as (s: string[], m: IDBTransactionMode, o?: { durability: string }) => IDBTransaction)(stores, 'readwrite', { durability: 'strict' })
    } catch (e) {
      return reject(isQuota(e) ? new StorageQuotaError() : e)
    }
    t.oncomplete = () => resolve()
    t.onerror = () => reject(isQuota(t.error) ? new StorageQuotaError() : t.error)
    t.onabort = () => reject(isQuota(t.error) ? new StorageQuotaError() : (t.error ?? new Error('Escrita local cancelada')))
    try {
      for (const w of writes) {
        const s = t.objectStore(w.store)
        if (w.delete) s.delete(w.key)
        else s.put(w.value, w.key)
      }
    } catch (e) {
      t.abort()
      reject(isQuota(e) ? new StorageQuotaError() : e)
    }
  })
}

export function getOne<T>(db: IDBDatabase, store: StoreName, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const r = db.transaction(store, 'readonly').objectStore(store).get(key)
    r.onsuccess = () => resolve(r.result as T | undefined)
    r.onerror = () => reject(r.error)
  })
}

export function getAll<T>(db: IDBDatabase, store: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const r = db.transaction(store, 'readonly').objectStore(store).getAll()
    r.onsuccess = () => resolve(r.result as T[])
    r.onerror = () => reject(r.error)
  })
}

/** Pede ao navegador para não apagar o armazenamento local sob pressão (melhor esforço). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist?.()
  } catch {
    /* sem suporte */
  }
}
