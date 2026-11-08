-- Lança Lance — núcleo de dados: perfis privados, Pins (locais), Pings (experiências), media,
-- snapshots ambientais, capturas, jornadas, equipamento, auditoria e metadados das fontes.
-- Princípios: tudo privado por defeito; isolamento por dono via RLS; colunas usadas em filtros
-- e análises são colunas tipadas (não JSON); coordenadas em lat/lng + geografia PostGIS gerada.

create extension if not exists postgis with schema extensions;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  avatar_path text,
  country text check (country ~ '^[A-Z]{2}$'),
  language text not null default 'pt-PT' check (language in ('pt-PT', 'es-ES', 'en')),
  unit_temperature text not null default 'c' check (unit_temperature in ('c', 'f')),
  unit_length text not null default 'cm' check (unit_length in ('cm', 'in')),
  unit_weight text not null default 'kg' check (unit_weight in ('kg', 'lb')),
  unit_wind text not null default 'kmh' check (unit_wind in ('kmh', 'ms', 'kn')),
  modalities text[] not null default '{}',
  favorite_species text[] not null default '{}',
  techniques text[] not null default '{}',
  home_areas text check (char_length(home_areas) <= 500),
  -- Perfil sempre privado nesta fase; o valor fica preparado para partilha controlada no futuro.
  profile_visibility text not null default 'private' check (profile_visibility in ('private')),
  privacy_notice_version text,
  privacy_notice_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Perfil criado com a conta (nome vindo do registo).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, privacy_notice_version, privacy_notice_accepted_at)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60), ''),
    nullif(new.raw_user_meta_data ->> 'privacy_notice_version', ''),
    case when new.raw_user_meta_data ? 'privacy_notice_version' then now() end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- pins (locais)
create table public.pins (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'spot' check (category in ('spot', 'captura', 'acesso', 'estacionamento', 'perigo', 'interesse', 'outro')),
  description text check (char_length(description) <= 2000),
  tags text[] not null default '{}',
  status text not null default 'ativo' check (status in ('ativo', 'arquivado')),
  is_favorite boolean not null default false,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography (Point, 4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  accuracy_m real check (accuracy_m >= 0),
  coord_source text not null default 'mapa' check (coord_source in ('gps', 'mapa', 'foto', 'manual', 'ping')),
  altitude_m real,
  water_body_ref text check (char_length(water_body_ref) <= 120),
  water_body_name text check (char_length(water_body_name) <= 120),
  environment text check (environment in ('albufeira', 'rio', 'lago', 'canal', 'costa', 'mar', 'outro')),
  access_notes text check (char_length(access_notes) <= 1000),
  target_species text[] not null default '{}',
  modalities text[] not null default '{}',
  techniques text[] not null default '{}',
  baits text[] not null default '{}',
  depth_m real check (depth_m >= 0),
  bottom_type text check (char_length(bottom_type) <= 80),
  private_notes text check (char_length(private_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pins_owner_status_idx on public.pins (owner_id, status, updated_at desc);
create index pins_location_idx on public.pins using gist (location);
create trigger pins_updated before update on public.pins for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- jornadas
create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  journey_date date not null,
  start_time time,
  end_time time,
  timezone text not null default 'Europe/Lisbon' check (char_length(timezone) <= 64),
  modality text check (char_length(modality) <= 40),
  target_species text[] not null default '{}',
  status text not null default 'planeada' check (status in ('planeada', 'em-curso', 'concluida', 'arquivada')),
  notes text check (char_length(notes) <= 4000),
  -- Lista de verificação: apenas apresentação (não é usada em filtros nem análises).
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array' and pg_column_size(checklist) < 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journeys_owner_date_idx on public.journeys (owner_id, journey_date desc);
create trigger journeys_updated before update on public.journeys for each row execute function public.set_updated_at();

create table public.journey_pins (
  journey_id uuid not null references public.journeys (id) on delete cascade,
  pin_id uuid not null references public.pins (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position smallint not null default 0,
  primary key (journey_id, pin_id)
);
create index journey_pins_pin_idx on public.journey_pins (pin_id);
create index journey_pins_owner_idx on public.journey_pins (owner_id);

-- ---------------------------------------------------------------- pings (experiências)
create table public.pings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pin_id uuid references public.pins (id) on delete set null,
  journey_id uuid references public.journeys (id) on delete set null,
  kind text not null check (kind in ('captura', 'tentativa', 'observacao', 'condicoes', 'sem-captura', 'evento')),
  -- Tempo: acontecimento em UTC + fuso do local; origem e fiabilidade explícitas.
  occurred_at timestamptz not null check (occurred_at >= '1990-01-01'),
  occurred_tz text not null default 'Europe/Lisbon' check (char_length(occurred_tz) <= 64),
  time_source text not null check (time_source in ('foto-exif', 'dispositivo', 'manual')),
  time_reliability text not null check (time_reliability in ('alta', 'media', 'baixa')),
  client_created_at timestamptz,
  server_received_at timestamptz not null default now(),
  -- Localização (opcional): a do acontecimento, não necessariamente a atual do dispositivo.
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  location extensions.geography (Point, 4326) generated always as (
    case when lat is null or lng is null then null
    else extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography end
  ) stored,
  accuracy_m real check (accuracy_m >= 0),
  location_source text not null default 'nenhuma' check (location_source in ('gps', 'mapa', 'foto-exif', 'pin', 'nenhuma')),
  location_measured_at timestamptz,
  -- Dados opcionais do pescador.
  modality text check (char_length(modality) <= 40),
  technique text check (char_length(technique) <= 80),
  bait text check (char_length(bait) <= 80),
  equipment text check (char_length(equipment) <= 160),
  depth_m real check (depth_m >= 0 and depth_m <= 2000),
  bottom_type text check (char_length(bottom_type) <= 80),
  fishing_minutes integer check (fishing_minutes between 0 and 1440),
  catch_count integer check (catch_count between 0 and 500),
  outcome text check (outcome in ('sucesso', 'sem-sucesso', 'parcial')),
  notes text check (char_length(notes) <= 4000),
  -- Enriquecimento (gerido pelo servidor).
  enrichment_status text not null default 'pendente' check (enrichment_status in ('pendente', 'em-curso', 'concluido', 'parcial', 'falhou', 'sem-localizacao')),
  enrichment_attempts smallint not null default 0,
  enrichment_error text,
  enrichment_started_at timestamptz,
  enriched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pings_latlng_pair check ((lat is null) = (lng is null)),
  constraint pings_not_future check (occurred_at <= server_received_at + interval '2 days')
);
create index pings_owner_time_idx on public.pings (owner_id, occurred_at desc);
create index pings_pin_idx on public.pings (pin_id, occurred_at desc);
create index pings_journey_idx on public.pings (journey_id);
create index pings_location_idx on public.pings using gist (location);
create index pings_enrichment_idx on public.pings (owner_id, enrichment_status) where enrichment_status in ('pendente', 'falhou', 'em-curso');
create trigger pings_updated before update on public.pings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- capturas
create table public.catches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ping_id uuid not null references public.pings (id) on delete cascade,
  species text not null check (char_length(species) between 1 and 80),
  weight_g integer check (weight_g between 0 and 300000),
  length_cm real check (length_cm between 0 and 500),
  released boolean,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index catches_owner_species_idx on public.catches (owner_id, species);
create index catches_ping_idx on public.catches (ping_id);
create trigger catches_updated before update on public.catches for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- media dos pings
create table public.ping_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ping_id uuid not null references public.pings (id) on delete cascade,
  storage_path text not null unique,
  display_path text,
  thumb_path text,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  width integer check (width > 0 and width <= 20000),
  height integer check (height > 0 and height <= 20000),
  bytes integer check (bytes > 0 and bytes <= 15728640),
  exif_taken_at timestamptz,
  exif_offset text check (char_length(exif_offset) <= 10),
  exif_has_gps boolean not null default false,
  exif_lat double precision check (exif_lat between -90 and 90),
  exif_lng double precision check (exif_lng between -180 and 180),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  -- O ficheiro tem de estar na pasta do próprio dono (as políticas do storage exigem o mesmo).
  constraint ping_media_owner_path check (split_part(storage_path, '/', 1) = owner_id::text),
  constraint ping_media_display_path check (display_path is null or split_part(display_path, '/', 1) = owner_id::text),
  constraint ping_media_thumb_path check (thumb_path is null or split_part(thumb_path, '/', 1) = owner_id::text)
);
create index ping_media_ping_idx on public.ping_media (ping_id, position);
create index ping_media_owner_idx on public.ping_media (owner_id);

-- ---------------------------------------------------------------- snapshot ambiental (1 por ping)
create table public.ping_environment (
  ping_id uuid primary key references public.pings (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  dataset text not null,
  -- 'estimado': modelo para a hora do acontecimento; 'historico': reanálise; 'previsao' nunca é usado em pings passados.
  data_kind text not null check (data_kind in ('estimado', 'historico', 'previsao')),
  reference_time timestamptz,
  time_offset_min integer,
  grid_lat double precision,
  grid_lng double precision,
  grid_elevation_m real,
  air_temp_c real,
  apparent_temp_c real,
  humidity_pct real,
  pressure_hpa real,
  pressure_trend_3h_hpa real,
  wind_kmh real,
  wind_dir_deg real,
  gust_kmh real,
  precip_mm real,
  precip_24h_mm real,
  cloud_cover_pct real,
  visibility_m real,
  uv_index real,
  weather_code smallint,
  is_day boolean,
  sunrise timestamptz,
  sunset timestamptz,
  day_length_min integer,
  sun_altitude_deg real,
  sun_azimuth_deg real,
  moon_phase real check (moon_phase between 0 and 1),
  moon_illumination real check (moon_illumination between 0 and 1),
  moonrise timestamptz,
  moonset timestamptz,
  wave_height_m real,
  wave_period_s real,
  wave_dir_deg real,
  sea_temp_c real,
  -- Águas interiores: sem fonte integrada ainda (ficam nulas; nunca valores genéricos).
  water_temp_c real,
  water_level_m real,
  river_flow_m3s real,
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  quality jsonb not null default '{}' check (jsonb_typeof(quality) = 'object'),
  created_at timestamptz not null default now()
);
create index ping_environment_owner_idx on public.ping_environment (owner_id);

-- ---------------------------------------------------------------- equipamento
create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'outro' check (kind in ('cana', 'carreto', 'linha', 'amostra', 'isco', 'acessorio', 'embarcacao', 'outro')),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipment_owner_idx on public.equipment (owner_id, kind);
create trigger equipment_updated before update on public.equipment for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- auditoria
create table public.audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users (id) on delete cascade,
  action text not null check (action in ('delete', 'export', 'archive', 'account-delete-request')),
  entity text not null check (char_length(entity) <= 40),
  entity_id uuid,
  at timestamptz not null default now()
);
create index audit_log_owner_idx on public.audit_log (owner_id, at desc);

-- ---------------------------------------------------------------- fontes de dados
create table public.data_sources (
  key text primary key,
  name text not null,
  url text not null,
  license text not null,
  attribution text not null,
  coverage_geo text not null,
  coverage_time text not null,
  data_kind text not null,
  update_frequency text,
  limits text,
  cost text,
  fallback text,
  notes text
);

-- ---------------------------------------------------------------- cache de respostas externas (só servidor)
create table public.env_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz
);
create index env_cache_expires_idx on public.env_cache (expires_at);
