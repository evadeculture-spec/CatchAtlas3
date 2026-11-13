-- «Os meus pins»: modo de partilha (zona ou ponto exato), dados públicos controlados no servidor e uma
-- única pesquisa (search_pins) que aplica permissões, filtros e contagens sobre o conjunto completo.

-- ---------------------------------------------------------------- shared_reports: modo e campos de pesquisa
alter table public.shared_reports
  add column if not exists share_mode text not null default 'zona' check (share_mode in ('zona', 'exato')),
  add column if not exists exact_lat double precision check (exact_lat between -90 and 90),
  add column if not exists exact_lng double precision check (exact_lng between -180 and 180),
  add column if not exists zone_id text,
  add column if not exists water_body_ref text,
  add column if not exists weight_g integer check (weight_g between 0 and 300000),
  add column if not exists occurred_at timestamptz,
  add column if not exists occurred_tz text;
-- O ponto exato só existe quando o autor escolheu «Partilhar ponto exato» (sem consentimento, fica resguardado).
alter table public.shared_reports drop constraint if exists shared_reports_exact_consistency;
alter table public.shared_reports add constraint shared_reports_exact_consistency
  check ((share_mode = 'exato') = (exact_lat is not null and exact_lng is not null));
-- As colunas novas NÃO são legíveis diretamente: terceiros só recebem o que search_pins decidir.
-- (A concessão de select existente cobre apenas as colunas aproximadas.)

-- ---------------------------------------------------------------- zona pública estável
-- Célula fixa de 0,05° (~5,6 km). O identificador e o centro dependem só da célula (estáveis ao recarregar,
-- aproximar ou repetir reports na mesma zona).
create or replace function public.zone_cell(p_lat double precision, p_lng double precision)
returns table (approx_lat double precision, approx_lng double precision, zone_id text)
language sql immutable set search_path = '' as $$
  select round(((floor(p_lat / 0.05) + 0.5) * 0.05)::numeric, 4)::double precision,
         round(((floor(p_lng / 0.05) + 0.5) * 0.05)::numeric, 4)::double precision,
         floor(p_lat / 0.05)::bigint::text || ':' || floor(p_lng / 0.05)::bigint::text
$$;

/** Hora local do acontecimento; um fuso inválido nunca rebenta a pesquisa (cai para UTC). */
create or replace function public.local_ts(p_at timestamptz, p_tz text)
returns timestamp language plpgsql stable set search_path = '' as $$
begin
  return p_at at time zone coalesce(nullif(p_tz, ''), 'Europe/Lisbon');
exception when others then
  return p_at at time zone 'UTC';
end $$;

-- ---------------------------------------------------------------- partilha coerente com o registo privado
-- Depois de uma edição/movimento/alteração de captura, a versão pública acompanha o registo (no modo escolhido).
create or replace function public.refresh_share(p_ping uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g record;
  c record;
  z record;
  l timestamp;
  s record;
begin
  select * into s from public.shared_reports where ping_id = p_ping;
  if not found then return; end if;
  select pg.id, pg.kind, pg.occurred_at, pg.occurred_tz, pg.lat, pg.lng, pg.technique, pg.water_body_name, pg.water_body_ref
    into g from public.pings pg where pg.id = p_ping;
  if not found or g.lat is null or g.lng is null then return; end if;
  select ca.species, ca.weight_g into c from public.catches ca where ca.ping_id = p_ping order by ca.created_at limit 1;
  select * into z from public.zone_cell(g.lat, g.lng);
  l := public.local_ts(g.occurred_at, g.occurred_tz);
  update public.shared_reports set
    kind = g.kind, species = c.species, weight_g = c.weight_g, technique = g.technique,
    water_body_name = g.water_body_name, water_body_ref = g.water_body_ref,
    approx_lat = z.approx_lat, approx_lng = z.approx_lng, zone_id = z.zone_id,
    approx_label = case when g.water_body_name is not null then g.water_body_name || ' · zona aproximada (~6 km)' else 'Zona aproximada (~6 km)' end,
    exact_lat = case when s.share_mode = 'exato' then g.lat else null end,
    exact_lng = case when s.share_mode = 'exato' then g.lng else null end,
    occurred_at = g.occurred_at, occurred_tz = g.occurred_tz,
    occurred_on = l::date,
    day_period = case when extract(hour from l) < 6 then 'madrugada' when extract(hour from l) < 12 then 'manha' when extract(hour from l) < 18 then 'tarde' else 'noite' end
  where ping_id = p_ping;
end $$;
revoke all on function public.refresh_share(uuid) from public, anon, authenticated;

create or replace function public.pings_refresh_share() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_share(new.id);
  return new;
end $$;
revoke all on function public.pings_refresh_share() from public, anon, authenticated;
drop trigger if exists pings_refresh_share on public.pings;
create trigger pings_refresh_share after update of lat, lng, occurred_at, occurred_tz, kind, technique, water_body_ref, water_body_name
  on public.pings for each row execute function public.pings_refresh_share();

create or replace function public.catches_refresh_share() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_share(coalesce(new.ping_id, old.ping_id));
  return null;
end $$;
revoke all on function public.catches_refresh_share() from public, anon, authenticated;
drop trigger if exists catches_refresh_share on public.catches;
create trigger catches_refresh_share after insert or update or delete on public.catches
  for each row execute function public.catches_refresh_share();

-- Partilhas já existentes (só zona): preenche os campos de pesquisa.
update public.shared_reports s set
  zone_id = (select z.zone_id from public.zone_cell(s.approx_lat, s.approx_lng) z),
  water_body_ref = g.water_body_ref, occurred_at = g.occurred_at, occurred_tz = g.occurred_tz,
  weight_g = (select ca.weight_g from public.catches ca where ca.ping_id = g.id order by ca.created_at limit 1)
from public.pings g where g.id = s.ping_id and s.zone_id is null;

create index if not exists shared_reports_owner_idx on public.shared_reports (owner_id);
create index if not exists shared_reports_water_idx on public.shared_reports (water_body_ref);

-- ---------------------------------------------------------------- pesquisa única
-- Devolve os pins do próprio utilizador (exatos) e, se pedido, os reports públicos de terceiros na precisão
-- que cada autor escolheu (zona ou ponto exato). Os totais são calculados sobre o conjunto completo autorizado,
-- antes de limitar linhas:
--   total   = resultados em toda a pesquisa autorizada (mesmo fora do enquadramento);
--   in_view = resultados cujo ponto de apresentação autorizado está na área visível.
-- Regras:
--   · peso: p_weight_op 'gt' (mais de) | 'lt' (menos de) | 'eq'; peso desconhecido só é elegível sem filtro de peso;
--   · datas: início e fim inclusivos sobre a data LOCAL da captura; p_yearly compara só mês e dia (dezembro liga a janeiro);
--   · horas: minutos do dia LOCAL, fim inclusivo (todo o minuto final); janela que atravessa a meia-noite (ex.: 22h–02h)
--     atribui a madrugada ao dia em que a jornada de pesquisa começou;
--   · um critério que exige um dado (espécie, peso, data, hora) exclui os registos sem esse dado;
--   · o próprio utilizador conta uma vez por registo (os seus reports públicos vêm como «mine»).
create or replace function public.search_pins(
  p_community boolean default false,
  p_west double precision default -180, p_south double precision default -90,
  p_east double precision default 180, p_north double precision default 90,
  p_species text[] default null,
  p_water text default null,
  p_weight_op text default null, p_weight_g integer default null,
  p_date_from date default null, p_date_to date default null, p_yearly boolean default false,
  p_min_from integer default null, p_min_to integer default null,
  p_limit integer default 2000
) returns table (
  source text, id uuid, kind text, lat double precision, lng double precision, precision text, visibility text,
  species text, weight_g integer, occurred_at timestamptz, occurred_tz text, zone_id text,
  water_body_ref text, water_body_name text, photo_path text, photo_bucket text, label text,
  total integer, in_view integer
) language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  lim integer := least(greatest(coalesce(p_limit, 2000), 1), 5000);
  t_from integer := coalesce(p_min_from, 0);
  t_to integer := coalesce(p_min_to, 1439);
  time_active boolean := p_min_from is not null or p_min_to is not null;
  date_active boolean := p_date_from is not null or p_date_to is not null;
  overnight boolean;
  w_active boolean := p_weight_op is not null and p_weight_g is not null;
  sp text[];
begin
  if me is null then return; end if;
  if p_weight_op is not null and p_weight_op not in ('gt', 'lt', 'eq') then raise exception 'operador de peso inválido'; end if;
  overnight := time_active and t_from > t_to;
  sp := case when p_species is null or cardinality(p_species) = 0 then null else (select array_agg(lower(btrim(x))) from unnest(p_species) x) end;
  return query
  with base as (
    -- os meus pings (ponto exato)
    select 'mine'::text as source, g.id, g.kind::text as kind, g.lat, g.lng, 'exato'::text as precision,
      coalesce(s.share_mode, 'privado')::text as visibility, c.species, c.weight_g, g.occurred_at, g.occurred_tz,
      null::text as zone_id, g.water_body_ref, g.water_body_name,
      (select coalesce(m.thumb_path, m.display_path) from public.ping_media m where m.ping_id = g.id order by m.position limit 1) as photo_path,
      'ping-media'::text as photo_bucket, coalesce(c.species, g.kind::text) as label
    from public.pings g
    left join public.shared_reports s on s.ping_id = g.id
    left join lateral (select ca.species, ca.weight_g from public.catches ca where ca.ping_id = g.id order by ca.created_at limit 1) c on true
    where g.owner_id = me and g.lat is not null and g.lng is not null
    union all
    -- os meus pesqueiros (pins sem captura)
    select 'mine', p.id, 'local', p.lat, p.lng, 'exato', 'privado', null, null, null::timestamptz, null::text,
      null::text, p.water_body_ref, p.water_body_name, null::text, null::text, p.name
    from public.pins p where p.owner_id = me and p.status = 'ativo'
    union all
    -- reports públicos de terceiros, na precisão escolhida pelo autor
    select 'comm', s.id, s.kind, case when s.share_mode = 'exato' then s.exact_lat else s.approx_lat end,
      case when s.share_mode = 'exato' then s.exact_lng else s.approx_lng end, s.share_mode, s.share_mode,
      s.species, s.weight_g, s.occurred_at, s.occurred_tz, s.zone_id, s.water_body_ref, s.water_body_name,
      s.photo_path, 'community-media', coalesce(s.species, s.kind)
    from public.shared_reports s where p_community and s.owner_id <> me
  ), enriched as (
    select b.*, public.local_ts(b.occurred_at, b.occurred_tz) as lts from base b
  ), keyed as (
    select e.*, (extract(hour from e.lts)::int * 60 + extract(minute from e.lts)::int) as mod,
      case when overnight and (extract(hour from e.lts)::int * 60 + extract(minute from e.lts)::int) <= t_to then e.lts::date - 1 else e.lts::date end as sday
    from enriched e
  ), filtered as (
    select k.* from keyed k
    where (sp is null or lower(k.species) = any (sp))
      and (p_water is null or k.water_body_ref = p_water)
      and (not w_active or (k.weight_g is not null and case p_weight_op when 'gt' then k.weight_g > p_weight_g when 'lt' then k.weight_g < p_weight_g else k.weight_g = p_weight_g end))
      and (not time_active or (k.lts is not null and case when overnight then (k.mod >= t_from or k.mod <= t_to) else (k.mod between t_from and t_to) end))
      and (not date_active or (k.lts is not null and case
        when p_yearly then (
          case when coalesce(extract(month from p_date_from)::int * 100 + extract(day from p_date_from)::int, 101)
                    <= coalesce(extract(month from p_date_to)::int * 100 + extract(day from p_date_to)::int, 1231)
               then (extract(month from k.sday)::int * 100 + extract(day from k.sday)::int)
                    between coalesce(extract(month from p_date_from)::int * 100 + extract(day from p_date_from)::int, 101)
                        and coalesce(extract(month from p_date_to)::int * 100 + extract(day from p_date_to)::int, 1231)
               else (extract(month from k.sday)::int * 100 + extract(day from k.sday)::int) >= extract(month from p_date_from)::int * 100 + extract(day from p_date_from)::int
                 or (extract(month from k.sday)::int * 100 + extract(day from k.sday)::int) <= extract(month from p_date_to)::int * 100 + extract(day from p_date_to)::int
          end)
        else (k.sday >= coalesce(p_date_from, date '0001-01-01') and k.sday <= coalesce(p_date_to, date '9999-12-31'))
      end))
  )
  select f.source, f.id, f.kind, f.lat, f.lng, f.precision, f.visibility, f.species, f.weight_g, f.occurred_at, f.occurred_tz,
    f.zone_id, f.water_body_ref, f.water_body_name, f.photo_path, f.photo_bucket, f.label,
    (count(*) over ())::integer,
    (count(*) filter (where f.lat between p_south and p_north and f.lng between p_west and p_east) over ())::integer
  from filtered f
  order by (f.lat between p_south and p_north and f.lng between p_west and p_east) desc, f.occurred_at desc nulls last, f.id
  limit lim;
end $$;
revoke all on function public.search_pins(boolean, double precision, double precision, double precision, double precision, text[], text, text, integer, date, date, boolean, integer, integer, integer) from public, anon;
grant execute on function public.search_pins(boolean, double precision, double precision, double precision, double precision, text[], text, text, integer, date, date, boolean, integer, integer, integer) to authenticated;
