/** Distância em metros (haversine, esfera de 6 371 km). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371008.8
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: m < 10000 ? 1 : 0 }).format(m / 1000)} km`
}

export function formatCoords(lat: number, lng: number, digits = 5) {
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`
}

export const validLatLng = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)

/** Aceita "38.7, -9.1", "38,7 -9,1" ou "38.7;-9.1". */
export function parseCoords(input: string): { lat: number; lng: number } | null {
  const m = input.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1].replace(',', '.'))
  const lng = Number(m[2].replace(',', '.'))
  return validLatLng(lat, lng) ? { lat, lng } : null
}

/** Divergência entre a localização da fotografia e a do dispositivo (pede confirmação ao utilizador). */
export const DIVERGENCE_M = 500
export function locationDivergence(photo: { lat: number; lng: number } | null, device: { lat: number; lng: number } | null) {
  if (!photo || !device) return null
  const d = distanceM(photo, device)
  return d > DIVERGENCE_M ? d : null
}

/** Posição atual, só quando o utilizador pede (nunca em segundo plano). */
export function getDevicePosition(timeoutMs = 15000): Promise<{ lat: number; lng: number; accuracy: number; at: string }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Este dispositivo não disponibiliza localização.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), at: new Date(p.timestamp).toISOString() }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Acesso à localização recusado. Pode escolher o local no mapa.'
              : e.code === e.TIMEOUT
                ? 'A localização demorou demasiado. Tente de novo ou escolha no mapa.'
                : 'Não foi possível obter a localização.',
          ),
        ),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    )
  })
}
