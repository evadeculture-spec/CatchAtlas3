-- Revisão das edições do utilizador (deteção de conflitos entre dispositivos). O enriquecimento no
-- servidor altera updated_at mas não rev, por isso não gera falsos conflitos.
alter table public.pings add column if not exists rev integer not null default 0 check (rev >= 0);
alter table public.pins add column if not exists rev integer not null default 0 check (rev >= 0);
grant insert (rev), update (rev) on public.pings to authenticated;
grant insert (rev), update (rev) on public.pins to authenticated;
