# Testes ponta a ponta do Lança Lance

Os testes `e2e/backend.e2e.mjs` e `e2e/lanca.e2e.cjs` correm contra o backend **real** e precisam de
dois utilizadores de **teste**, já confirmados. Nunca usar contas reais: o teste apaga todos os dados
do utilizador A no início e no fim.

## Criar os utilizadores de teste

O registo pela app envia um email de confirmação (o SMTP incluído do Supabase só envia para membros
da equipa). Para testes, crie as contas no SQL Editor do projeto (substitua as palavras-passe):

```sql
with u as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'e2e-a@lancalance.test',
   extensions.crypt('<PALAVRA-PASSE-A>', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Teste E2E A","privacy_notice_version":"2026-11-08"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'e2e-b@lancalance.test',
   extensions.crypt('<PALAVRA-PASSE-B>', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Teste E2E B","privacy_notice_version":"2026-11-08"}', now(), now(), '', '', '', '')
  returning id, email
)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', u.id::text, now(), now(), now() from u;
```

Para os apagar no fim: `delete from auth.users where email like 'e2e-%@lancalance.test';`
(as tabelas apagam-se em cascata; as fotografias do teste já são removidas pelo próprio teste).

## Executar

```bash
npm run build && npx vite preview --port 4173 &
export E2E_A_EMAIL=e2e-a@lancalance.test E2E_A_PASSWORD=… E2E_B_EMAIL=e2e-b@lancalance.test E2E_B_PASSWORD=…
npm run e2e:backend                                   # RLS, Storage, Edge Functions, Open-Meteo
npm run e2e:lanca -- http://localhost:4173 screenshots/lanca   # browser real, 390 e 1440 px
```

`npm run e2e:fixture` regenera `e2e/fixtures/exif-photo.jpg` (imagem de teste com EXIF: 2023-06-10 07:15
+01:00 e GPS 39.46125, -8.19765).
