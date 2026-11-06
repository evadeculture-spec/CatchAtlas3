import type { Angler } from './types'

export const DEMO_USER_ID = 'eu'

// Perfis fictícios. Qualquer semelhança com pessoas reais é coincidência.
export const ANGLERS: Angler[] = [
  { id: DEMO_USER_ID, name: 'Pescador', region: 'centro', color: '#20BFA9', isDemoUser: true },
  { id: 'marta', name: 'Marta L.', region: 'alentejo', color: '#F2B544' },
  { id: 'tiago', name: 'Tiago S.', region: 'centro', color: '#3E7CB1' },
  { id: 'ines', name: 'Inês C.', region: 'centro', color: '#C9774A' },
  { id: 'hugo', name: 'Hugo M.', region: 'alentejo', color: '#8C6BB8' },
  { id: 'bruno', name: 'Bruno R.', region: 'lisboa', color: '#5B8C6B' },
  { id: 'javier', name: 'Javier G.', region: 'extremadura', color: '#D98E73' },
  { id: 'lucia', name: 'Lucía M.', region: 'aragao', color: '#6FA8A0' },
]

export const anglerById = Object.fromEntries(ANGLERS.map((a) => [a.id, a])) as Record<string, Angler>
