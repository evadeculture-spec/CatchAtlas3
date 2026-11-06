import type { CountryId, ListingCategory, ModalityId, RegionId, Species, SpeciesId } from './types'

export const SPECIES: Species[] = [
  { id: 'achiga', name: 'Achigã', short: 'Achigã', color: '#20BFA9', kind: 'predador' },
  { id: 'carpa', name: 'Carpa', short: 'Carpa', color: '#F2B544', kind: 'ciprinideo' },
  { id: 'lucio', name: 'Lúcio', short: 'Lúcio', color: '#3E7CB1', kind: 'predador' },
  { id: 'lucioperca', name: 'Lucioperca', short: 'Lucioperca', color: '#8C6BB8', kind: 'predador' },
  { id: 'barbo', name: 'Barbo', short: 'Barbo', color: '#C9774A', kind: 'ciprinideo' },
  { id: 'siluro', name: 'Siluro', short: 'Siluro', color: '#5B6B73', kind: 'predador' },
]

export const speciesById = Object.fromEntries(SPECIES.map((s) => [s.id, s])) as Record<SpeciesId, Species>

export const MODALITIES: { id: ModalityId; name: string; hint: string }[] = [
  { id: 'margem', name: 'Margem', hint: 'A pé, a partir da orla' },
  { id: 'caiaque', name: 'Caiaque / pato', hint: 'Embarcação ligeira ou float tube' },
  { id: 'embarcacao', name: 'Embarcação', hint: 'Barco a motor ou elétrico' },
]

export const modalityName = (id: ModalityId) => MODALITIES.find((m) => m.id === id)?.name ?? id

export const COUNTRIES: { id: CountryId; name: string }[] = [
  { id: 'PT', name: 'Portugal' },
  { id: 'ES', name: 'Espanha' },
]
export const countryName = (id: CountryId) => COUNTRIES.find((c) => c.id === id)?.name ?? id

export const REGIONS: { id: RegionId; name: string; country: CountryId }[] = [
  { id: 'norte', name: 'Norte', country: 'PT' },
  { id: 'centro', name: 'Centro', country: 'PT' },
  { id: 'lisboa', name: 'Lisboa e Vale do Tejo', country: 'PT' },
  { id: 'alentejo', name: 'Alentejo', country: 'PT' },
  { id: 'algarve', name: 'Algarve', country: 'PT' },
  { id: 'galiza', name: 'Galiza', country: 'ES' },
  { id: 'castela-leao', name: 'Castela e Leão', country: 'ES' },
  { id: 'castela-mancha', name: 'Castela-La Mancha', country: 'ES' },
  { id: 'extremadura', name: 'Estremadura', country: 'ES' },
  { id: 'andaluzia', name: 'Andaluzia', country: 'ES' },
  { id: 'aragao', name: 'Aragão', country: 'ES' },
  { id: 'catalunha', name: 'Catalunha', country: 'ES' },
]

export const WARM_REGIONS: RegionId[] = ['alentejo', 'algarve', 'extremadura', 'andaluzia']

export const regionName = (id: RegionId) => REGIONS.find((r) => r.id === id)?.name ?? id

export const TECHNIQUES = [
  'Spinning',
  'Vinil texano',
  'Drop shot',
  'Jig',
  'Superfície (topwater)',
  'Crankbait',
  'Fundo / feeder',
  'Carpfishing',
  'Boia',
  'Vertical',
]

export const LISTING_CATEGORIES: { id: ListingCategory; name: string }[] = [
  { id: 'canas', name: 'Canas' },
  { id: 'carretos', name: 'Carretos' },
  { id: 'amostras', name: 'Amostras' },
  { id: 'embarcacoes', name: 'Pato / caiaque' },
  { id: 'eletronica', name: 'Sondas e eletrónica' },
  { id: 'acessorios', name: 'Acessórios' },
]
export const categoryName = (id: ListingCategory) => LISTING_CATEGORIES.find((c) => c.id === id)?.name ?? id

export const CONDITIONS = { novo: 'Novo', 'como-novo': 'Como novo', usado: 'Usado' } as const

export const ACTIVITY: Record<import('./types').Activity, { name: string; color: string }> = {
  forte: { name: 'Atividade forte', color: '#E4572E' },
  moderada: { name: 'Atividade moderada', color: '#F2B544' },
  fraca: { name: 'Atividade fraca', color: '#3E7CB1' },
  nula: { name: 'Sem atividade', color: '#8A9BA2' },
}

export const PERIODS_OF_DAY: { id: import('./types').DayPeriod; name: string }[] = [
  { id: 'madrugada', name: 'Madrugada' },
  { id: 'manha', name: 'Manhã' },
  { id: 'tarde', name: 'Tarde' },
  { id: 'noite', name: 'Noite' },
]
export const periodName = (id: import('./types').DayPeriod) => PERIODS_OF_DAY.find((p) => p.id === id)?.name ?? id

export const damRegion = (d: { region: RegionId; country: CountryId }): string =>
  d.country === 'ES' ? `${regionName(d.region)}, Espanha` : regionName(d.region)
