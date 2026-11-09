-- Lança Lance — Atlas como ecrã principal ("Marcar pin"), jornadas a partir de capturas e partilha
-- comunitária aproximada. Migração compatível: só acrescenta colunas, tabelas e funções.

-- 1. Massa de água associada a cada Ping (como já existe nos Pins).
alter table public.pings
  add column if not exists water_body_ref text check (char_length(water_body_ref) <= 120),
  add column if not exists water_body_name text check (char_length(water_body_name) <= 120);
grant insert (water_body_ref, water_body_name), update (water_body_ref, water_body_name) on public.pings to authenticated;
create index if not exists pings_water_idx on public.pings (owner_id, water_body_ref) where water_body_ref is not null;
create index if not exists pins_water_idx on public.pins (owner_id, water_body_ref) where water_body_ref is not null;

-- 2. Pings como pontos de referência de uma jornada ("guardar este ponto para sábado"),
--    sem criar outra captura nem mudar a jornada em que o Ping foi registado (pings.journey_id).
create table if not exists public.journey_pings (
  journey_id uuid not null references public.journeys (id) on delete cascade,
  ping_id uuid not null references public.pings (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null default 0 check (position between 0 and 500),
  created_at timestamptz not null default now(),
  primary key (journey_id, ping_id)
);
create index if not exists journey_pings_ping_idx on public.journey_pings (ping_id);
alter table public.journey_pings enable row level security;
revoke all on public.journey_pings from anon;
grant select, insert, update (position), delete on public.journey_pings to authenticated;
create policy journey_pings_select_own on public.journey_pings for select to authenticated using (owner_id = (select auth.uid()));
create policy journey_pings_insert_own on public.journey_pings for insert to authenticated with check (owner_id = (select auth.uid()));
create policy journey_pings_update_own on public.journey_pings for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy journey_pings_delete_own on public.journey_pings for delete to authenticated using (owner_id = (select auth.uid()));

create or replace function public.check_same_owner() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'pings' then
    if new.pin_id is not null and not exists (select 1 from public.pins p where p.id = new.pin_id and p.owner_id = new.owner_id) then
      raise exception 'Pin inexistente ou de outro utilizador' using errcode = '42501';
    end if;
    if new.journey_id is not null and not exists (select 1 from public.journeys j where j.id = new.journey_id and j.owner_id = new.owner_id) then
      raise exception 'Jornada inexistente ou de outro utilizador' using errcode = '42501';
    end if;
  elsif tg_table_name = 'journey_pins' then
    if not exists (select 1 from public.pins p where p.id = new.pin_id and p.owner_id = new.owner_id)
       or not exists (select 1 from public.journeys j where j.id = new.journey_id and j.owner_id = new.owner_id) then
      raise exception 'Pin ou jornada de outro utilizador' using errcode = '42501';
    end if;
  elsif tg_table_name = 'journey_pings' then
    if not exists (select 1 from public.pings g where g.id = new.ping_id and g.owner_id = new.owner_id)
       or not exists (select 1 from public.journeys j where j.id = new.journey_id and j.owner_id = new.owner_id) then
      raise exception 'Ping ou jornada de outro utilizador' using errcode = '42501';
    end if;
  elsif tg_table_name in ('catches', 'ping_media') then
    if not exists (select 1 from public.pings g where g.id = new.ping_id and g.owner_id = new.owner_id) then
      raise exception 'Ping inexistente ou de outro utilizador' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger journey_pings_same_owner before insert or update on public.journey_pings for each row execute function public.check_same_owner();
create trigger journey_pings_rate_limit before insert on public.journey_pings for each row execute function public.rate_limit_inserts(120);

-- 3. Os meus pins na área visível do Atlas (índices GiST; RLS do utilizador, security invoker).
--    p_cell não nulo: agregação no servidor por células (escala da Península/região).
create or replace function public.my_atlas_pins(
  p_west double precision, p_south double precision, p_east double precision, p_north double precision,
  p_cell double precision default null, p_limit integer default 1500
) returns table (
  kind text, id uuid, lat double precision, lng double precision, n integer, title text, species text,
  occurred_at timestamptz, occurred_tz text, water_body_ref text, water_body_name text, thumb_path text, updated_at timestamptz
) language sql stable security invoker set search_path = '' as $$
  with box as (
    select extensions.st_makeenvelope(greatest(p_west, -180), greatest(p_south, -85), least(p_east, 180), least(p_north, 85), 4326)::extensions.geography as g
  ),
  rows as (
    select g.kind::text as kind, g.id, g.lat, g.lng,
      coalesce((select c.species from public.catches c where c.ping_id = g.id order by c.created_at limit 1), p.name) as title,
      (select c.species from public.catches c where c.ping_id = g.id order by c.created_at limit 1) as species,
      g.occurred_at, g.occurred_tz, coalesce(g.water_body_ref, p.water_body_ref) as water_body_ref,
      coalesce(g.water_body_name, p.water_body_name) as water_body_name,
      (select coalesce(m.thumb_path, m.display_path) from public.ping_media m where m.ping_id = g.id order by m.position limit 1) as thumb_path,
      g.updated_at
    from public.pings g left join public.pins p on p.id = g.pin_id, box
    where g.location is not null and g.location operator(extensions.&&) box.g
    union all
    select 'local', p.id, p.lat, p.lng, p.name, null, p.created_at, null, p.water_body_ref, p.water_body_name, null, p.updated_at
    from public.pins p, box
    where p.status = 'ativo' and p.location operator(extensions.&&) box.g
  )
  select r.kind, r.id, r.lat, r.lng, 1, r.title, r.species, r.occurred_at, r.occurred_tz, r.water_body_ref, r.water_body_name, r.thumb_path, r.updated_at
  from rows r where p_cell is null
  union all
  select 'grupo', null, avg(r.lat), avg(r.lng), count(*)::integer, null, null, max(r.occurred_at), null, null, null, null, null
  from rows r where p_cell is not null
  group by floor(r.lat / p_cell), floor(r.lng / p_cell)
  limit least(greatest(p_limit, 1), 5000);
$$;
revoke all on function public.my_atlas_pins(double precision, double precision, double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.my_atlas_pins(double precision, double precision, double precision, double precision, double precision, integer) to authenticated;

-- 4. Partilha comunitária: versão SEPARADA, aproximada e só com campos públicos.
--    Escrita apenas pela Edge Function community-share (chave de serviço). Leitura por utilizadores
--    com sessão, só das colunas públicas (sem owner_id nem ping_id).
create table if not exists public.shared_reports (
  id uuid primary key default gen_random_uuid(),
  ping_id uuid not null unique references public.pings (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('captura', 'observacao', 'tentativa', 'sem-captura', 'condicoes', 'evento')),
  species text check (char_length(species) <= 80),
  technique text check (char_length(technique) <= 80),
  water_body_name text check (char_length(water_body_name) <= 120),
  approx_lat double precision not null check (approx_lat between -90 and 90),
  approx_lng double precision not null check (approx_lng between -180 and 180),
  approx_label text not null check (char_length(approx_label) <= 160),
  precision_km numeric(5, 1) not null,
  occurred_on date not null,
  day_period text check (day_period in ('madrugada', 'manha', 'tarde', 'noite')),
  photo_path text,
  created_at timestamptz not null default now()
);
create index if not exists shared_reports_geo_idx on public.shared_reports (approx_lat, approx_lng);
create index if not exists shared_reports_day_idx on public.shared_reports (occurred_on desc);
alter table public.shared_reports enable row level security;
revoke all on public.shared_reports from anon, authenticated;
grant select (id, kind, species, technique, water_body_name, approx_lat, approx_lng, approx_label, precision_km, occurred_on, day_period, photo_path, created_at)
  on public.shared_reports to authenticated;
create policy shared_reports_read on public.shared_reports for select to authenticated using (true);

/** Partilhas do próprio utilizador (para saber se um Ping está publicado), sem expor ping_id a terceiros. */
create or replace function public.my_shares() returns table (share_id uuid, ping_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.ping_id, s.created_at from public.shared_reports s where s.owner_id = (select auth.uid())
$$;
revoke all on function public.my_shares() from public, anon;
grant execute on function public.my_shares() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;
create policy community_media_read on storage.objects for select to authenticated using (bucket_id = 'community-media');

-- Auditoria das publicações e revogações.
alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in ('delete', 'export', 'archive', 'account-delete-request', 'share', 'unshare'));
