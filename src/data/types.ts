export type SpeciesId = 'achiga' | 'carpa' | 'lucio' | 'lucioperca' | 'barbo' | 'siluro'
export type ModalityId = 'margem' | 'caiaque' | 'embarcacao'
export type CountryId = 'PT' | 'ES'
export type RegionId =
  | 'norte'
  | 'centro'
  | 'lisboa'
  | 'alentejo'
  | 'algarve'
  | 'galiza'
  | 'castela-leao'
  | 'castela-mancha'
  | 'extremadura'
  | 'andaluzia'
  | 'aragao'
  | 'catalunha'

export interface Species {
  id: SpeciesId
  name: string
  short: string
  /** Cor de identificação nos gráficos. */
  color: string
  kind: 'predador' | 'ciprinideo'
}

export interface Dam {
  id: string
  name: string
  country: CountryId
  region: RegionId
  /** Localidade/concelho de referência (informação geral). */
  place: string
  river: string
  /** Posição aproximada usada APENAS no mapa esquemático. */
  approx: { lat: number; lon: number }
  /** Espécies de exemplo — não verificadas. */
  species: SpeciesId[]
  modalities: ModalityId[]
  summary: string
  traits: { label: string; value: string }[]
  art: ArtPalette
  /** 'completa': ficha de demonstração com exemplos; 'basica': só dados gerais (nome, rio, local). */
  detail?: 'completa' | 'basica'
}

export type ZoneKind = 'concessao' | 'zpl' | 'zpr' | 'coto'

/** Concessão ou zona de pesca. Por omissão tem documento oficial identificado (ver `evidence`). */
export interface FishingZone {
  id: string
  name: string
  country: CountryId
  kind: ZoneKind
  /** Barragem da app a que a zona se refere, quando existe. */
  damId?: string
  river?: string
  place: string
  manager?: string
  notes: string[]
  source: { label: string; url: string }
  /** Ano do documento consultado, ou null quando não datado. */
  docYear: number | null
  /**
   * Albufeira(s) do OpenStreetMap a que a zona se refere (ex.: 'relation/5366185'), associadas
   * por nome e, quando existe, pelo operador da barragem. Usado para a mostrar no mapa.
   */
  osmWater?: string[]
  /** Tipo de prova: documento oficial (omisso) ou apenas referência noutra fonte (ex.: notícia). */
  evidence?: 'oficial' | 'noticia'
}

export interface River {
  id: string
  name: string
  countries: CountryId[]
  basin: string
  mouth: string
  notes?: string
  /** Texto usado para associar barragens da app a este rio (campo river da barragem). */
  match: string[]
}

export interface ArtPalette {
  seed: number
  sky: [string, string]
  hills: string[]
  water: [string, string]
  sun?: 'low' | 'high' | 'none'
  mist?: boolean
  trees?: boolean
}

export interface Angler {
  id: string
  name: string
  region: RegionId
  color: string
  isDemoUser?: boolean
}

export interface Catch {
  id: string
  anglerId: string
  damId: string
  speciesId: SpeciesId
  weightG: number
  lengthCm?: number
  /** Data local AAAA-MM-DD. */
  date: string
  technique: string
  lure: string
  notes: string
  released: boolean
  visibility: 'publica' | 'privada'
  ranking: boolean
  hasPhoto: boolean
  createdAt: number
  /** Captura inicial da demonstração (datas acompanham a data de referência). */
  seeded?: boolean
}

export interface DemoEvent {
  id: string
  title: string
  damId: string
  modality: ModalityId
  /** Desvio em dias face à data de referência da demonstração. */
  dayOffset: number
  startTime: string
  organizer: string
  format: string
  description: string
  schedule: { time: string; label: string }[]
  results?: { name: string; weightG: number; catches: number; biggestG: number }[]
  speciesFocus: SpeciesId[]
}

export interface Trip {
  id: string
  damId: string
  date: string
  speciesId: SpeciesId
  modality: ModalityId
  createdAt: number
  checked: string[]
}

export interface Profile {
  name: string
  region: RegionId
  species: SpeciesId[]
  modalities: ModalityId[]
  avatarColor: string
}

export type Activity = 'forte' | 'moderada' | 'fraca' | 'nula'
export type DayPeriod = 'madrugada' | 'manha' | 'tarde' | 'noite'

/** Report rápido de atividade, que gera um ping (localização aproximada) no mapa. */
export interface Report {
  id: string
  anglerId: string
  damId: string
  speciesId: SpeciesId
  activity: Activity
  period: DayPeriod
  date: string
  technique: string
  lure: string
  note: string
  catches: number
  createdAt: number
  seeded?: boolean
}

export type ListingCategory = 'canas' | 'carretos' | 'amostras' | 'embarcacoes' | 'eletronica' | 'acessorios'

export interface Listing {
  id: string
  sellerId: string
  title: string
  category: ListingCategory
  priceEur: number
  condition: 'novo' | 'como-novo' | 'usado'
  region: RegionId
  date: string
  description: string
  hasPhoto: boolean
  sold: boolean
  createdAt: number
}

export interface ChatMessage {
  id: string
  anglerId: string
  text: string
  /** Data/hora ISO local. */
  at: string
}
