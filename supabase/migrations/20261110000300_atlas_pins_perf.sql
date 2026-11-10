-- Desempenho dos pins por área visível (medido: Península 518 ms → objetivo < 100 ms).
--  1. A agregação por células já não calcula espécie/miniatura de cada linha (só coordenadas).
--  2. No detalhe, o limite aplica-se antes das subconsultas (só as linhas devolvidas são completadas).
--  3. Índice espacial composto (dono + localização): numa albufeira popular, o índice só com a
--     localização encontraria as linhas de todos os utilizadores antes de as filtrar pelo dono.
create extension if not exists btree_gist with schema extensions;
create index if not exists pings_owner_location_gist on public.pings using gist (owner_id, location);
create index if not exists pins_owner_location_gist on public.pins using gist (owner_id, location);

create or replace function public.my_atlas_pins(
  p_west double precision, p_south double precision, p_east double precision, p_north double precision,
  p_cell double precision default null, p_limit integer default 1500
) returns table (
  kind text, id uuid, lat double precision, lng double precision, n integer, title text, species text,
  occurred_at timestamptz, occurred_tz text, water_body_ref text, water_body_name text, thumb_path text, updated_at timestamptz
) language plpgsql stable security invoker set search_path = '' as $$
declare
  box extensions.geography := extensions.st_makeenvelope(greatest(p_west, -180), greatest(p_south, -85), least(p_east, 180), least(p_north, 85), 4326)::extensions.geography;
  me uuid := (select auth.uid());
  lim integer := least(greatest(coalesce(p_limit, 1500), 1), 5000);
begin
  if p_cell is not null then
    return query
    select 'grupo'::text, null::uuid, avg(t.lat), avg(t.lng), count(*)::integer, null::text, null::text, max(t.at), null::text, null::text, null::text, null::text, null::timestamptz
    from (
      select g.lat, g.lng, g.occurred_at as at from public.pings g where g.owner_id = me and g.location operator(extensions.&&) box
      union all
      select p.lat, p.lng, p.created_at from public.pins p where p.owner_id = me and p.status = 'ativo' and p.location operator(extensions.&&) box
    ) t
    group by floor(t.lat / p_cell), floor(t.lng / p_cell)
    limit lim;
    return;
  end if;
  return query
  with g as (
    select g.id, g.kind, g.lat, g.lng, g.occurred_at, g.occurred_tz, g.water_body_ref, g.water_body_name, g.pin_id, g.updated_at
    from public.pings g
    where g.owner_id = me and g.location operator(extensions.&&) box
    order by g.occurred_at desc
    limit lim
  ), p as (
    select p.id, p.name, p.lat, p.lng, p.created_at, p.water_body_ref, p.water_body_name, p.updated_at
    from public.pins p
    where p.owner_id = me and p.status = 'ativo' and p.location operator(extensions.&&) box
    order by p.updated_at desc
    limit lim
  )
  select g.kind::text, g.id, g.lat, g.lng, 1,
    coalesce(c.species, pn.name), c.species, g.occurred_at, g.occurred_tz,
    coalesce(g.water_body_ref, pn.water_body_ref), coalesce(g.water_body_name, pn.water_body_name),
    (select coalesce(m.thumb_path, m.display_path) from public.ping_media m where m.ping_id = g.id order by m.position limit 1),
    g.updated_at
  from g
  left join public.pins pn on pn.id = g.pin_id
  left join lateral (select c.species from public.catches c where c.ping_id = g.id order by c.created_at limit 1) c on true
  union all
  select 'local', p.id, p.lat, p.lng, 1, p.name, null, p.created_at, null, p.water_body_ref, p.water_body_name, null, p.updated_at from p
  limit lim;
end $$;
revoke all on function public.my_atlas_pins(double precision, double precision, double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.my_atlas_pins(double precision, double precision, double precision, double precision, double precision, integer) to authenticated;
