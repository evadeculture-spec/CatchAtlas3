-- Ligação opcional de um pin pessoal (pins ou pings) a um setor do catálogo «Carpa».
-- Só a chave estável do setor (texto); o catálogo é público e versionado à parte, por isso a ligação sobrevive
-- a reimportações (a chave não depende do número da linha do Excel). A criação de um pin pessoal nunca altera
-- a classificação pública da água. Alteração apenas aditiva.
alter table public.pings add column if not exists carp_sector_key text check (char_length(carp_sector_key) <= 240);
alter table public.pins add column if not exists carp_sector_key text check (char_length(carp_sector_key) <= 240);
grant select (carp_sector_key), insert (carp_sector_key), update (carp_sector_key) on public.pings to authenticated;
grant select (carp_sector_key), insert (carp_sector_key), update (carp_sector_key) on public.pins to authenticated;
create index if not exists pings_owner_carp_idx on public.pings (owner_id, carp_sector_key) where carp_sector_key is not null;
create index if not exists pins_owner_carp_idx on public.pins (owner_id, carp_sector_key) where carp_sector_key is not null;
