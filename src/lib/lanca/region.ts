/**
 * Fuso horário do local do acontecimento (Portugal continental vs Espanha peninsular, ilhas).
 * Polígono simplificado de Portugal continental: perto da raia pode errar alguns quilómetros; o fuso
 * fica sempre visível e editável no registo.
 */
const PT: [number, number][] = [
  [-8.9, 42.16], [-8.2, 42.15], [-6.8, 41.98], [-6.2, 41.6], [-6.9, 41.0], [-6.93, 40.25], [-7.03, 39.66], [-7.33, 39.45],
  [-6.98, 38.9], [-7.32, 38.42], [-6.95, 38.0], [-7.5, 37.55], [-7.41, 37.17], [-8.99, 36.95], [-9.6, 38.7], [-9.05, 40.0],
]

function inside(lng: number, lat: number, poly: [number, number][]) {
  let ok = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ok = !ok
  }
  return ok
}

export function tzForPoint(lat: number, lng: number, fallback = 'Europe/Lisbon'): string {
  if (lat > 32.3 && lat < 33.2 && lng > -17.4 && lng < -16.2) return 'Atlantic/Madeira'
  if (lat > 36.8 && lat < 39.8 && lng > -31.4 && lng < -24.9) return 'Atlantic/Azores'
  if (lat > 27.5 && lat < 29.5 && lng > -18.3 && lng < -13.3) return 'Atlantic/Canary'
  if (inside(lng, lat, PT)) return 'Europe/Lisbon'
  if (lat > 35.8 && lat < 43.9 && lng > -9.4 && lng < 4.4) return 'Europe/Madrid'
  return fallback
}

export function tzLabel(tz: string): string {
  return (
    {
      'Europe/Lisbon': 'hora de Portugal',
      'Europe/Madrid': 'hora de Espanha',
      'Atlantic/Madeira': 'hora da Madeira',
      'Atlantic/Azores': 'hora dos Açores',
      'Atlantic/Canary': 'hora das Canárias',
      'Africa/Ceuta': 'hora de Ceuta',
    } as Record<string, string>
  )[tz] ?? tz
}

export const countryOf = (lat: number, lng: number): 'PT' | 'ES' | null => {
  const tz = tzForPoint(lat, lng, '')
  return tz === 'Europe/Lisbon' || tz === 'Atlantic/Madeira' || tz === 'Atlantic/Azores' ? 'PT' : tz === 'Europe/Madrid' || tz === 'Atlantic/Canary' ? 'ES' : null
}
