-- Sessões de teste sem email (função guest-session).
-- Registo mínimo para limitar abusos: só um HMAC do IP (nunca o IP em claro), a conta criada e a hora.
-- Sem políticas RLS: apenas a função (service role) lê e escreve. Linhas com mais de 2 dias são apagadas pela função.
create table if not exists public.guest_sessions (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists guest_sessions_ip_created on public.guest_sessions (ip_hash, created_at desc);
create index if not exists guest_sessions_created on public.guest_sessions (created_at desc);
create index if not exists guest_sessions_user on public.guest_sessions (user_id);
alter table public.guest_sessions enable row level security;
revoke all on public.guest_sessions from anon, authenticated;
comment on table public.guest_sessions is 'Limites das sessões de teste sem email (HMAC do IP, sem IP em claro). Só service role.';
