-- Lança Lance — segurança: RLS por dono, privilégios por coluna, coerência de dono entre
-- entidades, limitação de pedidos, auditoria, armazenamento privado e funções de leitura.

-- Sem acesso anónimo a dados de utilizadores.
revoke all on table public.profiles, public.pins, public.journeys, public.journey_pins, public.pings, public.catches,
  public.ping_media, public.ping_environment, public.equipment, public.audit_log, public.data_sources, public.env_cache from anon;

alter table public.profiles enable row level security;
alter table public.pins enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_pins enable row level security;
alter table public.pings enable row level security;
alter table public.catches enable row level security;
alter table public.ping_media enable row level security;
alter table public.ping_environment enable row level security;
alter table public.equipment enable row level security;
alter table public.audit_log enable row level security;
alter table public.data_sources enable row level security;
alter table public.env_cache enable row level security; -- sem políticas: só o servidor (service role)

-- Perfis: o próprio, apenas leitura/edição (criado pelo trigger de registo, apagado com a conta).
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, delete, update on public.profiles from authenticated;
grant update (display_name, avatar_path, country, language, unit_temperature, unit_length, unit_weight, unit_wind,
  modalities, favorite_species, techniques, home_areas, privacy_notice_version, privacy_notice_accepted_at) on public.profiles to authenticated;

-- Tabelas do utilizador: tudo restrito ao dono.
do $$
declare t text;
begin
  foreach t in array array['pins', 'journeys', 'journey_pins', 'pings', 'catches', 'ping_media', 'equipment'] loop
    execute format('create policy %1$s_select_own on public.%1$s for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_insert_own on public.%1$s for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update_own on public.%1$s for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_delete_own on public.%1$s for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Pings: os campos de enriquecimento e de receção são do servidor (o utilizador não os escreve).
revoke insert, update on public.pings from authenticated;
grant insert (id, pin_id, journey_id, kind, occurred_at, occurred_tz, time_source, time_reliability, client_created_at,
  lat, lng, accuracy_m, location_source, location_measured_at, modality, technique, bait, equipment, depth_m,
  bottom_type, fishing_minutes, catch_count, outcome, notes) on public.pings to authenticated;
grant update (pin_id, journey_id, kind, occurred_at, occurred_tz, time_source, time_reliability,
  lat, lng, accuracy_m, location_source, location_measured_at, modality, technique, bait, equipment, depth_m,
  bottom_type, fishing_minutes, catch_count, outcome, notes) on public.pings to authenticated;
-- Media: os metadados técnicos não mudam depois do upload (só a ordem).
revoke update on public.ping_media from authenticated;
grant update (position) on public.ping_media to authenticated;

-- Snapshot ambiental: só leitura para o dono; escrito pelo servidor.
create policy ping_environment_select_own on public.ping_environment for select to authenticated using (owner_id = (select auth.uid()));
revoke insert, update, delete on public.ping_environment from authenticated;

-- Auditoria: o dono lê o seu histórico e só pode registar exportações e pedidos de eliminação.
create policy audit_select_own on public.audit_log for select to authenticated using (owner_id = (select auth.uid()));
create policy audit_insert_own on public.audit_log for insert to authenticated
  with check (owner_id = (select auth.uid()) and action in ('export', 'account-delete-request'));
revoke update, delete on public.audit_log from authenticated;

-- Fontes de dados: leitura para utilizadores autenticados.
create policy data_sources_read on public.data_sources for select to authenticated using (true);
revoke insert, update, delete on public.data_sources from authenticated;
revoke all on public.env_cache from authenticated;

-- ---------------------------------------------------------------- coerência de dono entre entidades
-- Um ping só pode apontar para Pins/jornadas do mesmo dono (sem confiar no cliente).
create or replace function public.check_same_owner() returns trigger
language plpgsql set search_path = '' as $$
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
  elsif tg_table_name in ('catches', 'ping_media') then
    if not exists (select 1 from public.pings g where g.id = new.ping_id and g.owner_id = new.owner_id) then
      raise exception 'Ping inexistente ou de outro utilizador' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger pings_same_owner before insert or update of pin_id, journey_id, owner_id on public.pings for each row execute function public.check_same_owner();
create trigger journey_pins_same_owner before insert or update on public.journey_pins for each row execute function public.check_same_owner();
create trigger catches_same_owner before insert or update of ping_id, owner_id on public.catches for each row execute function public.check_same_owner();
create trigger ping_media_same_owner before insert or update of ping_id, owner_id on public.ping_media for each row execute function public.check_same_owner();

-- ---------------------------------------------------------------- limitação de pedidos (por utilizador)
create or replace function public.rate_limit_inserts() returns trigger
language plpgsql set search_path = '' as $$
declare n integer;
begin
  execute format('select count(*) from public.%I where owner_id = $1 and created_at > now() - interval ''1 minute''', tg_table_name)
    into n using new.owner_id;
  if n >= tg_argv[0]::integer then
    raise exception 'Demasiados registos num minuto. Tente novamente dentro de instantes.' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger pins_rate before insert on public.pins for each row execute function public.rate_limit_inserts('60');
create trigger pings_rate before insert on public.pings for each row execute function public.rate_limit_inserts('60');
create trigger ping_media_rate before insert on public.ping_media for each row execute function public.rate_limit_inserts('120');
create trigger journeys_rate before insert on public.journeys for each row execute function public.rate_limit_inserts('30');

-- ---------------------------------------------------------------- auditoria de eliminações e arquivo
create or replace function public.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    -- Na eliminação da conta (cascata) o utilizador já não existe: não regista.
    if exists (select 1 from auth.users u where u.id = old.owner_id) then
      insert into public.audit_log (owner_id, action, entity, entity_id) values (old.owner_id, 'delete', tg_table_name, old.id);
    end if;
    return old;
  end if;
  if tg_table_name = 'pins' and new.status = 'arquivado' and old.status <> 'arquivado' then
    insert into public.audit_log (owner_id, action, entity, entity_id) values (new.owner_id, 'archive', 'pins', new.id);
  end if;
  return new;
end $$;
create trigger pins_audit after delete or update of status on public.pins for each row execute function public.audit_change();
create trigger pings_audit after delete on public.pings for each row execute function public.audit_change();
create trigger journeys_audit after delete on public.journeys for each row execute function public.audit_change();
revoke execute on function public.audit_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- funções de leitura (com RLS do invocador)
-- Pins próximos (para não duplicar locais): só os do próprio utilizador.
create or replace function public.nearby_pins(p_lat double precision, p_lng double precision, p_radius_m double precision default 150)
returns table (id uuid, name text, category text, status text, lat double precision, lng double precision, distance_m double precision)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.name, p.category, p.status, p.lat, p.lng,
         extensions.st_distance(p.location, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography) as distance_m
  from public.pins p
  where p.owner_id = (select auth.uid())
    and extensions.st_dwithin(p.location, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography, least(greatest(p_radius_m, 1), 5000))
  order by distance_m
  limit 10
$$;

-- Resumo do pescador (contagens reais, uma ida à base de dados).
create or replace function public.angler_summary()
returns table (pins bigint, pins_archived bigint, pings bigint, journeys bigint, journeys_done bigint, catches bigint, species bigint, photos bigint, first_activity timestamptz, last_activity timestamptz)
language sql stable security invoker set search_path = '' as $$
  select
    (select count(*) from public.pins where owner_id = (select auth.uid()) and status = 'ativo'),
    (select count(*) from public.pins where owner_id = (select auth.uid()) and status = 'arquivado'),
    (select count(*) from public.pings where owner_id = (select auth.uid())),
    (select count(*) from public.journeys where owner_id = (select auth.uid())),
    (select count(*) from public.journeys where owner_id = (select auth.uid()) and status = 'concluida'),
    (select count(*) from public.catches where owner_id = (select auth.uid())),
    (select count(distinct lower(species)) from public.catches where owner_id = (select auth.uid())),
    (select count(*) from public.ping_media where owner_id = (select auth.uid())),
    (select min(occurred_at) from public.pings where owner_id = (select auth.uid())),
    (select max(occurred_at) from public.pings where owner_id = (select auth.uid()))
$$;

-- Linha do tempo (pings, capturas, jornadas e novos Pins), paginada por data.
create or replace view public.activity_timeline with (security_invoker = true) as
  select 'ping'::text as kind, g.id, g.owner_id, g.occurred_at as at, g.kind as subtype, g.pin_id, g.journey_id, g.id as ping_id, null::text as title
    from public.pings g
  union all
  select 'pin', p.id, p.owner_id, p.created_at, p.category, p.id, null, null, p.name from public.pins p
  union all
  select 'journey', j.id, j.owner_id, (j.journey_date + coalesce(j.start_time, time '00:00'))::timestamp at time zone j.timezone, j.status, null, j.id, null, j.title from public.journeys j
  union all
  select 'catch', c.id, c.owner_id, g.occurred_at, c.species, g.pin_id, g.journey_id, c.ping_id, c.species
    from public.catches c join public.pings g on g.id = c.ping_id;
revoke all on public.activity_timeline from anon;
grant select on public.activity_timeline to authenticated;

revoke execute on function public.nearby_pins(double precision, double precision, double precision) from public, anon;
revoke execute on function public.angler_summary() from public, anon;
grant execute on function public.nearby_pins(double precision, double precision, double precision) to authenticated;
grant execute on function public.angler_summary() to authenticated;

-- ---------------------------------------------------------------- armazenamento privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ping-media', 'ping-media', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Cada utilizador só lê e escreve na sua pasta (<uid>/...). Sem URLs públicas: só URLs assinados temporários.
create policy media_select_own on storage.objects for select to authenticated
  using (bucket_id in ('ping-media', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id in ('ping-media', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_update_own on storage.objects for update to authenticated
  using (bucket_id in ('ping-media', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('ping-media', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_delete_own on storage.objects for delete to authenticated
  using (bucket_id in ('ping-media', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
