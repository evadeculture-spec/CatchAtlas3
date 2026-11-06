import type { River } from './types'

// Rios principais com barragens na app. Dados gerais (bacia, países, foz).
export const RIVERS: River[] = [
  { id: 'minho', name: 'Minho / Miño', countries: ['ES', 'PT'], basin: 'Minho', mouth: 'Oceano Atlântico (Caminha · A Guarda)', notes: 'Troço final internacional entre Portugal e Galiza.', match: ['Rio Minho'] },
  { id: 'lima', name: 'Lima / Limia', countries: ['ES', 'PT'], basin: 'Lima', mouth: 'Oceano Atlântico (Viana do Castelo)', match: ['Rio Lima', 'Rio Cabril'] },
  { id: 'cavado', name: 'Cávado', countries: ['PT'], basin: 'Cávado', mouth: 'Oceano Atlântico (Esposende)', notes: 'Afluentes com zonas de pesca lúdica: Homem e Gerês.', match: ['Rio Cávado', 'Rio Rabagão', 'Rio Homem'] },
  { id: 'douro', name: 'Douro / Duero', countries: ['ES', 'PT'], basin: 'Douro', mouth: 'Oceano Atlântico (Porto)', notes: 'Troço internacional com as barragens de Miranda, Picote, Bemposta e Aldeadávila.', match: ['Rio Douro', 'Rio Tâmega', 'Rio Sabor', 'Rio Távora', 'Rio Varosa', 'Rio Côa', 'Rio Azibo', 'Rio Tormes', 'Rio Esla', 'Rio Luna'] },
  { id: 'mondego', name: 'Mondego', countries: ['PT'], basin: 'Mondego', mouth: 'Oceano Atlântico (Figueira da Foz)', match: ['Rio Mondego', 'Rio Alva', 'Rio Caldeirão'] },
  { id: 'tejo', name: 'Tejo / Tajo', countries: ['ES', 'PT'], basin: 'Tejo', mouth: 'Oceano Atlântico (Lisboa)', notes: 'Inclui o Zêzere e o Ocreza do lado português.', match: ['Rio Tejo', 'Rio Zêzere', 'Rio Ocreza', 'Rio Ponsul', 'Rio Unhais', 'Ribeira de Sor', 'Ribeira de Seda', 'Ribeira de Nisa', 'Ribeira de Magos', 'Ribeira da Meimoa', 'Rio Alagón', 'Rio Árrago', 'Rio Alberche', 'Rio Lozoya', 'Rio Aulencia', 'Rio Guadiela'] },
  { id: 'sado', name: 'Sado', countries: ['PT'], basin: 'Sado', mouth: 'Oceano Atlântico (Setúbal)', match: ['Rio Sado', 'Rio Xarrama', 'Ribeira de Campilhas', 'Ribeira de Odivelas', 'Ribeira do Roxo', 'Ribeira de Santa Catarina de Sítimos'] },
  { id: 'mira', name: 'Mira', countries: ['PT'], basin: 'Mira', mouth: 'Oceano Atlântico (Vila Nova de Milfontes)', match: ['Rio Mira'] },
  { id: 'guadiana', name: 'Guadiana', countries: ['ES', 'PT'], basin: 'Guadiana', mouth: 'Oceano Atlântico (Vila Real de Santo António · Ayamonte)', notes: 'Alqueva é a maior albufeira da bacia do lado português.', match: ['Rio Guadiana', 'Rio Caia', 'Rio Degebe', 'Ribeira de Lucefécit', 'Ribeira de Enxoé', 'Rio Chança', 'Ribeira de Odeleite', 'Ribeira de Beliche', 'Rio Zújar', 'Rio Matachel', 'Arroyo Pizarroso', 'Ribeira do Vale de Vasco'] },
  { id: 'arade', name: 'Arade', countries: ['PT'], basin: 'Ribeiras do Algarve', mouth: 'Oceano Atlântico (Portimão)', match: ['Rio Arade', 'Ribeira de Odelouca', 'Ribeira de Odiáxere'] },
  { id: 'ebro', name: 'Ebro', countries: ['ES'], basin: 'Ebro', mouth: 'Mar Mediterrâneo (delta do Ebro)', notes: 'Mequinenza e Riba-roja são referências para siluro e carpa.', match: ['Rio Ebro', 'Rio Cinca', 'Rio Aragón', 'Rio Noguera Ribagorzana'] },
  { id: 'jucar', name: 'Júcar', countries: ['ES'], basin: 'Júcar', mouth: 'Mar Mediterrâneo (Cullera)', match: ['Rio Júcar', 'Rio Cabriel'] },
  { id: 'guadalquivir', name: 'Guadalquivir', countries: ['ES'], basin: 'Guadalquivir', mouth: 'Oceano Atlântico (Sanlúcar de Barrameda)', match: ['Rio Guadalquivir', 'Rio Genil', 'Rio Guadiana Menor', 'Rio Guadiato'] },
  { id: 'ter', name: 'Ter', countries: ['ES'], basin: 'Bacias internas da Catalunha', mouth: 'Mar Mediterrâneo', match: ['Rio Ter'] },
]

export const riverById = Object.fromEntries(RIVERS.map((r) => [r.id, r])) as Record<string, River>
export const riverForDam = (damRiver: string) => RIVERS.find((r) => r.match.includes(damRiver))
