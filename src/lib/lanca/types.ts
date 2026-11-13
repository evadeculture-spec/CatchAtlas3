/** Tipos das tabelas do Lança Lance (espelham supabase/migrations). */

export type PinCategory = 'spot' | 'captura' | 'acesso' | 'estacionamento' | 'perigo' | 'interesse' | 'outro'
export type PinStatus = 'ativo' | 'arquivado'
export type CoordSource = 'gps' | 'mapa' | 'foto' | 'manual' | 'ping'
export type WaterEnvironment = 'albufeira' | 'rio' | 'lago' | 'canal' | 'costa' | 'mar' | 'outro'
export type PingKind = 'captura' | 'tentativa' | 'observacao' | 'condicoes' | 'sem-captura' | 'evento'
export type TimeSource = 'foto-exif' | 'dispositivo' | 'manual'
export type Reliability = 'alta' | 'media' | 'baixa'
export type LocationSource = 'gps' | 'mapa' | 'foto-exif' | 'pin' | 'nenhuma'
export type Outcome = 'sucesso' | 'sem-sucesso' | 'parcial'
export type EnrichmentStatus = 'pendente' | 'em-curso' | 'concluido' | 'parcial' | 'falhou' | 'sem-localizacao'
export type DataKind = 'estimado' | 'historico' | 'previsao'
export type JourneyStatus = 'planeada' | 'em-curso' | 'concluida' | 'arquivada'
export type EquipmentKind = 'cana' | 'carreto' | 'linha' | 'amostra' | 'isco' | 'acessorio' | 'embarcacao' | 'outro'

export interface Profile {
  id: string
  display_name: string | null
  avatar_path: string | null
  country: string | null
  language: 'pt-PT' | 'es-ES' | 'en'
  unit_temperature: 'c' | 'f'
  unit_length: 'cm' | 'in'
  unit_weight: 'kg' | 'lb'
  unit_wind: 'kmh' | 'ms' | 'kn'
  modalities: string[]
  favorite_species: string[]
  techniques: string[]
  home_areas: string | null
  profile_visibility: 'private'
  privacy_notice_version: string | null
  privacy_notice_accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface Pin {
  id: string
  /** Setor do catálogo «Carpa» ligado (opcional). */
  carp_sector_key?: string | null
  owner_id: string
  name: string
  category: PinCategory
  description: string | null
  tags: string[]
  status: PinStatus
  is_favorite: boolean
  lat: number
  lng: number
  accuracy_m: number | null
  coord_source: CoordSource
  altitude_m: number | null
  water_body_ref: string | null
  water_body_name: string | null
  environment: WaterEnvironment | null
  access_notes: string | null
  target_species: string[]
  modalities: string[]
  techniques: string[]
  baits: string[]
  depth_m: number | null
  bottom_type: string | null
  private_notes: string | null
  created_at: string
  updated_at: string
}
export type PinInput = Omit<Pin, 'id' | 'owner_id' | 'created_at' | 'updated_at'>

export interface Ping {
  id: string
  /** Setor do catálogo «Carpa» ligado (opcional). */
  carp_sector_key?: string | null
  owner_id: string
  pin_id: string | null
  journey_id: string | null
  kind: PingKind
  occurred_at: string
  occurred_tz: string
  time_source: TimeSource
  time_reliability: Reliability
  client_created_at: string | null
  server_received_at: string
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  location_source: LocationSource
  location_measured_at: string | null
  modality: string | null
  technique: string | null
  bait: string | null
  equipment: string | null
  depth_m: number | null
  bottom_type: string | null
  fishing_minutes: number | null
  catch_count: number | null
  outcome: Outcome | null
  notes: string | null
  enrichment_status: EnrichmentStatus
  enrichment_attempts: number
  enrichment_error: string | null
  enriched_at: string | null
  created_at: string
  updated_at: string
  water_body_ref?: string | null
  water_body_name?: string | null
}
/** Campos que o cliente pode escrever (os de enriquecimento são só do servidor). */
export type PingInput = Pick<Ping, 'kind' | 'occurred_at' | 'occurred_tz' | 'time_source' | 'time_reliability'> &
  Partial<Pick<Ping, 'pin_id' | 'journey_id' | 'client_created_at' | 'lat' | 'lng' | 'accuracy_m' | 'location_source' | 'location_measured_at' | 'modality' | 'technique' | 'bait' | 'equipment' | 'depth_m' | 'bottom_type' | 'fishing_minutes' | 'catch_count' | 'outcome' | 'notes'>>

export interface Catch {
  id: string
  owner_id: string
  ping_id: string
  species: string
  weight_g: number | null
  length_cm: number | null
  released: boolean | null
  notes: string | null
  created_at: string
}

export interface PingMedia {
  id: string
  owner_id: string
  ping_id: string
  storage_path: string
  display_path: string | null
  thumb_path: string | null
  mime: string
  width: number | null
  height: number | null
  bytes: number
  exif_taken_at: string | null
  exif_offset: string | null
  exif_has_gps: boolean | null
  exif_lat: number | null
  exif_lng: number | null
  position: number
  created_at: string
}

export interface SourceRef {
  group: string
  source: string
  dataset?: string
  data_kind: DataKind | 'calculado' | 'indisponivel'
  cached?: boolean
  cell_deg?: number
}

export interface PingEnvironment {
  ping_id: string
  owner_id: string
  provider: string
  dataset: string
  data_kind: DataKind
  reference_time: string | null
  time_offset_min: number | null
  grid_lat: number | null
  grid_lng: number | null
  grid_elevation_m: number | null
  air_temp_c: number | null
  apparent_temp_c: number | null
  humidity_pct: number | null
  pressure_hpa: number | null
  pressure_trend_3h_hpa: number | null
  wind_kmh: number | null
  wind_dir_deg: number | null
  gust_kmh: number | null
  precip_mm: number | null
  precip_24h_mm: number | null
  cloud_cover_pct: number | null
  visibility_m: number | null
  uv_index: number | null
  weather_code: number | null
  is_day: boolean | null
  sunrise: string | null
  sunset: string | null
  day_length_min: number | null
  sun_altitude_deg: number | null
  sun_azimuth_deg: number | null
  moon_phase: number | null
  moon_illumination: number | null
  moonrise: string | null
  moonset: string | null
  wave_height_m: number | null
  wave_period_s: number | null
  wave_dir_deg: number | null
  sea_temp_c: number | null
  water_temp_c: number | null
  water_level_m: number | null
  river_flow_m3s: number | null
  sources: SourceRef[]
  quality: { grid_resolution?: string; time_offset_min?: number | null; coords_rounded_deg?: number; errors?: string[] }
  created_at: string
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
  kind?: 'licenca' | 'seguranca' | 'equipamento' | 'outro'
}

export interface Journey {
  id: string
  owner_id: string
  title: string
  journey_date: string
  start_time: string | null
  end_time: string | null
  timezone: string
  modality: string | null
  target_species: string[]
  status: JourneyStatus
  notes: string | null
  checklist: ChecklistItem[]
  created_at: string
  updated_at: string
}

export interface JourneyPin {
  journey_id: string
  pin_id: string
  owner_id: string
  position: number
}

export interface Equipment {
  id: string
  owner_id: string
  name: string
  kind: EquipmentKind
  notes: string | null
  created_at: string
}

export interface DataSource {
  key: string
  name: string
  url: string | null
  license: string | null
  attribution: string | null
  coverage_geo: string | null
  coverage_time: string | null
  data_kind: string | null
  update_frequency: string | null
  limits: string | null
  cost: string | null
  fallback: string | null
  notes: string | null
}

export interface AnglerSummary {
  pins: number
  pins_archived: number
  pings: number
  journeys: number
  journeys_done: number
  catches: number
  species: number
  photos: number
  first_activity: string | null
  last_activity: string | null
}

export interface TimelineRow {
  kind: 'ping' | 'pin' | 'journey' | 'catch'
  id: string
  owner_id: string
  at: string
  subtype: string | null
  pin_id: string | null
  journey_id: string | null
  ping_id: string | null
  title: string | null
}

/** Ping com as relações usadas nos ecrãs. */
export interface PingFull extends Ping {
  catches: Catch[]
  ping_media: PingMedia[]
  ping_environment: PingEnvironment | null
  pin: Pick<Pin, 'id' | 'name' | 'category' | 'environment'> | null
}
