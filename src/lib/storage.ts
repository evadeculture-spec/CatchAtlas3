// Acesso seguro ao localStorage: pode falhar em modo privado ou com quota esgotada.
export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown): 'ok' | 'quota' | 'unavailable' {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return 'ok'
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) return 'quota'
    return 'unavailable'
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignorar */
  }
}
