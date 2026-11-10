-- O limite de inserções por minuto conta as linhas recentes do utilizador a cada inserção.
-- Sem estes índices, essa contagem percorre todas as linhas do utilizador (custo cresce com o histórico).
create index if not exists pings_owner_created_idx on public.pings (owner_id, created_at desc);
create index if not exists pins_owner_created_idx on public.pins (owner_id, created_at desc);
create index if not exists ping_media_owner_created_idx on public.ping_media (owner_id, created_at desc);
create index if not exists journeys_owner_created_idx on public.journeys (owner_id, created_at desc);
create index if not exists journey_pings_owner_created_idx on public.journey_pings (owner_id, created_at desc);
