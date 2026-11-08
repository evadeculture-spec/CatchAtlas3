# Lança Lance — plataforma privada do pescador

Pins (locais), Pings (experiências), capturas, jornadas e Fishing Intelligence, com conta privada,
condições ambientais do momento de cada Ping e planeamento a partir do histórico real.

> Este documento descreve a implementação real (código, base de dados e serviços) e as decisões
> tomadas. As secções de demonstração herdadas do CatchAtlas (barragens, rankings, comunidade,
> marketplace…) continuam a funcionar com dados ilustrativos e estão separadas da área privada.

## 1. Diagnóstico da arquitetura (auditoria)

| Área | Estado encontrado | Decisão |
|---|---|---|
| Stack | React 19, Vite 8, Tailwind 4, react-router 8, TypeScript estrito, vitest, Playwright | Mantida |
| Alojamento | Netlify (site estático, `netlify.toml`, deploy automático de `master`) | Mantido |
| Autenticação | **Inexistente** (onboarding local) | Supabase Auth (email + palavra-passe, verificação de email) |
| Base de dados | **Inexistente** (estado em `localStorage`, fotografias em IndexedDB) | Supabase Postgres + PostGIS, região UE (Paris) |
| Mapas | MapLibre GL 6 + OpenFreeMap (Atlas 3D e mapa 2D) | Reutilizado (novo `PrivateMap` com camadas e clustering) |
| Meteorologia | Simulada (`src/lib/weather.ts`, só na demonstração) | Open-Meteo real, só no servidor (Edge Functions) |
| Fotografias | Demonstração em IndexedDB | Storage privado com URLs assinados temporários |
| Design system | `ui.tsx`, `Dialog.tsx` (bottom sheets), tokens Tailwind | Reutilizado e estendido (`components/lanca/`) |
| Jornadas / capturas / histórico | Fluxos de demonstração locais | Mantidos; versão real nova em `/conta/*` |

Nenhuma funcionalidade existente foi removida: a demonstração continua acessível; a navegação ganhou
"Conta" (área privada) e o botão principal passa a "Novo Ping" quando há sessão iniciada.

## 2. Arquitetura

```
Browser (React SPA, Netlify)                     Supabase (UE · eu-west-3)
┌──────────────────────────────┐   HTTPS/JWT   ┌───────────────────────────────────────────┐
│ AuthProvider (sessão)        │──────────────▶│ Auth (email, verificação, recuperação)     │
│ /conta/* (rotas protegidas)  │               │ Postgres + PostGIS, RLS por utilizador     │
│  api.ts ─ PostgREST (RLS)    │──────────────▶│  pins · pings · catches · ping_media       │
│  Storage (upload/assinados)  │──────────────▶│  ping_environment · journeys · …           │
│  functions.invoke            │──┐            │ Storage privado: ping-media, avatars       │
│ EXIF + redimensionamento     │  │            │ Edge Functions (Deno, verify_jwt):         │
│  no dispositivo (exifr)      │  └──────────▶ │  enrich-ping · conditions · delete-account │
└──────────────────────────────┘               └───────────────┬───────────────────────────┘
                                                                │ coordenadas arredondadas 0,01°
                                                                ▼
                                            Open-Meteo (forecast · historical-forecast ·
                                            archive ERA5 · marine) + SunCalc (local)
```

- A chave publicável (`sb_publishable_…`) é pública e só acede ao que o RLS permite. A chave de
  serviço só existe nas Edge Functions.
- Todas as chamadas a fornecedores externos de dados são feitas no servidor, com cache, limites e
  registo de proveniência. O browser nunca fala com o Open-Meteo.

### Estrutura do código

```
src/lib/lanca/        supabase.ts (cliente) · api.ts (acesso a dados) · types.ts
                      exif.ts (hora/GPS da fotografia) · image.ts (original/display/thumb)
                      time.ts (UTC ↔ fuso do acontecimento) · geo.ts · units.ts · labels.ts
                      intelligence.ts (estatística descritiva + índice de semelhança)
                      planner.ts (checklist, avisos, leitura da previsão) · moon.ts
src/state/Auth.tsx    sessão, perfil, registo, login, recuperação, unidades
src/components/lanca/ PrivateMap · LocationPicker · ConditionsPanel · SignedImage · cards · TagInput · primitives
src/screens/auth/     SignIn · SignUp · ForgotPassword · ResetPassword
src/screens/conta/    Layout (RequireAuth) · Dashboard · MapScreen · Pins · PinForm · PinDetail
                      Pings · PingNew · PingDetail · Journeys · JourneyForm · JourneyDetail
                      History · Intelligence · Settings
src/screens/Privacy.tsx  aviso de privacidade (RGPD)
supabase/migrations/  esquema, RLS, storage, fontes de dados, reenriquecimento
supabase/functions/   enrich-ping · conditions · delete-account · _shared (lógica pura testada)
```

A área privada é carregada à parte (code splitting por ecrã): a demonstração não descarrega o
código das contas além do cliente de autenticação.

## 3. Pin vs Ping

- **Pin** = local geográfico permanente (spot, captura, acesso, estacionamento, perigo, interesse,
  outro). Pode estar em várias jornadas e ter muitos Pings. Arquivar não apaga; apagar um Pin mantém
  os Pings (ficam sem Pin) e retira-o das jornadas.
- **Ping** = report de uma experiência: captura, tentativa, sem captura, observação, condições ou
  evento. Não tem de ser captura (os dias sem captura entram nas estatísticas e reduzem o enviesamento).
- Relações: `USER → PINS → PINGS`, `USER → JOURNEYS → (journey_pins) → PINS`,
  `JOURNEYS → PINGS (pings.journey_id)`, `PINGS → CATCHES`, `PINGS → PING_MEDIA`, `PINGS → PING_ENVIRONMENT`.
- Deduplicação: ao criar um Pin ou um Ping, `nearby_pins` (PostGIS, 150 m) sugere o Pin existente.
  A associação é sempre decisão do utilizador ("Associar" / "É outro local"); nunca automática.

## 4. Base de dados (alterações)

Migrações em `supabase/migrations/` (aplicadas no projeto `lanca-lance`):

| Tabela | Conteúdo | Notas |
|---|---|---|
| `profiles` | nome, avatar, país, idioma, unidades, modalidades, espécies, técnicas, áreas, versão do aviso de privacidade | criado por trigger no registo; `profile_visibility` só `private` |
| `pins` | identificação, geografia (lat/lng + `geography` gerada, precisão, origem), ambiente, acesso, informação de pesca, notas privadas | índice GiST |
| `pings` | tipo, `occurred_at` (UTC) + `occurred_tz`, origem/fiabilidade da hora, `client_created_at`, `server_received_at`, local + origem + precisão + hora da medição, detalhes de pesca, estado do enriquecimento | id gerado no dispositivo (criação idempotente); colunas de enriquecimento só escritas pelo servidor |
| `catches` | espécie, peso (g), comprimento (cm), devolvido | |
| `ping_media` | caminhos privados (original/display/thumb), dimensões, bytes, metadados EXIF úteis | caminho começa obrigatoriamente pelo id do dono |
| `ping_environment` | snapshot das condições: meteorologia, astronomia, mar, água interior (vazia), `dataset`, `data_kind`, `reference_time`, `time_offset_min`, `sources`, `quality` | só leitura para o cliente |
| `journeys`, `journey_pins` | data, horário, fuso, modalidade, espécies, estado, checklist (JSON pequeno), Pins ordenados | |
| `equipment` | equipamento do pescador | |
| `audit_log` | eliminações, arquivos, exportações, pedidos de eliminação | escrito por triggers; o cliente só regista exportações |
| `data_sources` | fornecedores: cobertura, licença, atribuição, limites, custo, fallback | apresentado nos Pings |
| `env_cache` | cache das respostas dos fornecedores por célula e janela | inacessível ao cliente |

Segurança na base de dados: RLS em todas as tabelas (`owner_id = auth.uid()`), privilégios por
coluna (o cliente não escreve o estado do enriquecimento), triggers de mesmo dono nas relações,
limites de inserção por minuto (pins 60, pings 60, fotografias 120, jornadas 30), validações
(coordenadas, datas ≥ 1990 e ≤ receção + 2 dias, tamanhos), auditoria, vista `activity_timeline`
(`security_invoker`) e RPCs `nearby_pins` e `angler_summary`.

Convenção EXIF: `ping_media.exif_taken_at` guarda a hora da câmara; quando `exif_offset` é nulo, é a
hora de parede da câmara codificada como UTC (a câmara não gravou o fuso).

## 5. Ping Engine e pipeline de enriquecimento

1. **Captura** (`/conta/pings/novo`): fotografia (câmara ou galeria, até 6), tipo, local, hora, detalhes opcionais.
2. **No dispositivo**: `exifr` lê a hora (`DateTimeOriginal` + `OffsetTimeOriginal`) e o GPS. O fuso do
   acontecimento fica coerente com o offset da câmara. Sem fuso: hora interpretada no fuso escolhido
   (fiabilidade média). Sem EXIF: data do ficheiro (fiabilidade baixa, com aviso). As versões display
   (2048 px) e thumb (480 px) são reencodadas no canvas, **sem metadados**.
3. **GPS** só quando o utilizador carrega em "Posição atual". Se o GPS da fotografia estiver a mais de
   500 m da posição atual, o utilizador escolhe. Também há mapa, coordenadas escritas ou "sem localização".
4. **Persistência imediata**: o Ping é guardado com `enrichment_status = pendente`, depois as
   fotografias (com repetição), depois a captura. Uma falha a meio pode ser retomada sem duplicar.
5. **Enriquecimento** (`enrich-ping`): reclamação atómica (sem processamento duplicado), conjunto de
   dados conforme a idade do acontecimento, cache por célula de 0,01° e janela, até 5 tentativas,
   recuo de 5 min no `sweep`, erros guardados sem coordenadas.
6. **Normalização**: unidades métricas, hora de referência e distância à hora do acontecimento,
   proveniência por grupo (`sources`) e qualidade (`quality`).
7. **Atualização visual**: o ecrã do Ping acompanha o estado e mostra as condições sem recarregar.
8. **Reutilização**: o snapshot fica guardado (histórico, inteligência, planeador); nada é recalculado
   ao abrir páginas. Alterar a hora ou o local volta a pôr o Ping em `pendente` (trigger).

Integridade dos dados ambientais:
- A meteorologia é sempre a da hora do acontecimento: `forecast` (< 3 dias), `historical-forecast`
  (desde 2022), `archive` ERA5 (antes de 2022 ou como fallback). **Nunca** o tempo atual para uma
  fotografia antiga.
- `data_kind`: `estimado` (modelo), `historico` (reanálise) ou `previsao`. Nunca `observado`, porque
  são valores de modelo para a célula, não medições de estação.
- Campos sem fonte (água interior, marés) ficam vazios e aparecem como "indisponível".
- A indisponibilidade do fornecedor não apaga nem bloqueia o Ping (estado `falhou`, com repetição).

## 6. Mapa, histórico, inteligência e planeador

- **Mapa privado** (`/conta/mapa`): camadas Pins e Pings independentes, clustering, filtros (tipo,
  espécie, modalidade, período, arquivados), pesquisa nos Pins e por coordenadas, painel de seleção
  com resumo, toque longo ou botão direito para criar Pin ou Ping, navegação externa (Google Maps, por
  iniciativa do utilizador).
- **Histórico** (`/conta/historico`): cronologia (Pings, capturas, Pins, jornadas), por local e por
  espécie (meses, técnicas, condições, locais). Só dados reais.
- **Inteligência** (`/conta/inteligencia`): estatística descritiva por período do dia, estação, tendência
  da pressão, temperatura, vento, lua, local, técnica e isco. Cada grupo mostra n. Abaixo de 5 sessões,
  sem percentagem. Destaques só com amostra suficiente e diferença ≥ 15 pontos face à média. Avisos
  de correlação ≠ causalidade. Sem probabilidades nem aprendizagem automática.
- **Índice de semelhança** (0–100): compara as condições previstas com as de cada sessão passada (mês,
  hora, temperatura, tendência da pressão, vento, fase da lua; pesos iguais), usa só os fatores
  disponíveis nos dois lados, exige ≥ 3 fatores e mostra cada fator. É semelhança, não probabilidade.
- **Planeador** (`/conta/jornadas`): data, horário, fuso, modalidade, espécies, Pins ordenados. Por
  local: previsão diária e horária na janela (função `conditions`, até 15 dias; dias passados
  aparecem como estimativa ou histórico), sol e lua, histórico pessoal, sessões semelhantes, avisos de
  segurança (trovoada, rajadas, calor, frio, nevoeiro, costa) e checklist (licenças PT/ES, segurança,
  colete em embarcação, marés na costa, equipamento do utilizador). Estados: planeada, em curso,
  concluída, arquivada.

## 7. Integrações externas

| Integração | Uso | Cobertura | Tipo de dado | Limites / custo | Atribuição | Fallback |
|---|---|---|---|---|---|---|
| Supabase (Auth, Postgres, Storage, Edge Functions) | backend | UE (Paris) | — | Plano gratuito: pausa após 7 dias sem atividade, SMTP limitado | — | — |
| Open-Meteo Forecast | Pings recentes, planeador | Global, 1–11 km | estimado / previsão | Gratuito **só para uso não comercial**, ≤ 10 000 pedidos/dia | Weather data by Open-Meteo.com (CC BY 4.0) | historical-forecast → archive; cópia antiga da cache no planeador |
| Open-Meteo Historical Forecast | Pings desde 2022 | Global | estimado | Idem | Idem | archive |
| Open-Meteo Archive (ERA5/ERA5-Land) | Pings antigos | Global, desde 1940 | histórico (reanálise) | Idem | + Copernicus Climate Change Service | estado `falhou`, repetição |
| Open-Meteo Marine | Pins de costa/mar | Oceanos, fraca junto à costa | estimado | Idem | Idem | campos vazios |
| SunCalc 1.9 | astronomia | Global | calculado | Sem limites | BSD-2 | — (local) |
| OpenFreeMap | cartografia | Global | — | Gratuito, sem SLA | © OpenMapTiles, © OSM | aviso "cartografia parcialmente indisponível" |
| Hidrologia (SNIRH/APA, SAIH) | água interior | estações | observado | **Não integrado** | — | campos vazios |
| Marés oficiais (IH, Puertos del Estado) | costa | portos | previsão | **Não integrado** | — | aviso no planeador |

A tabela `data_sources` guarda esta informação e é mostrada em cada Ping ("Fontes e qualidade dos
dados"). A camada `_shared/enrichment.ts` isola cada fornecedor (URL, variáveis, cache, extração):
para trocar de fornecedor muda-se essa camada, não a app.

## 8. Privacidade, segurança e RGPD

- Perfis, Pins, Pings e fotografias privados por defeito. Não há funcionalidades sociais. O modelo
  (`owner_id` + RLS) permite acrescentar partilha explícita no futuro sem mudar as tabelas atuais.
- Fotografias em buckets privados (tipos e tamanho limitados), pastas por utilizador e URLs assinados
  de 30 minutos. Sem URLs públicos permanentes (verificado: HTTP 400).
- Identificadores UUID. "Registo não encontrado" é a mesma resposta para um id inexistente e para um
  id de outro utilizador (sem enumeração).
- Coordenadas arredondadas a 0,01° antes de saírem para o fornecedor meteorológico. Os erros
  guardados não incluem coordenadas. Não há ferramentas de análise de terceiros.
- Registo com aceitação explícita do aviso de privacidade (versão guardada no perfil). A localização
  só é pedida por ação do utilizador, com explicação junto ao botão. As definições mostram o estado da
  autorização e como a revogar.
- Direitos: exportação JSON ou ZIP com as fotografias originais (registada na auditoria), retificação
  e apagamento por registo, e eliminação da conta (Edge Function: apaga os ficheiros e depois a conta,
  com cascata nas tabelas).
- Os dados privados não são usados para treinar modelos nem para estatísticas públicas.

Avisos do *security advisor* do Supabase: `env_cache` sem políticas é intencional (só o servidor
acede). A proteção contra palavras-passe expostas (HaveIBeenPwned) exige plano pago e não foi ativada
(ver próximos passos).

## 9. Configuração e passos manuais

1. Variáveis públicas (`.env.local` para desenvolvimento; definições de ambiente da Netlify para produção):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (ver `.env.example`). Sem elas, `/conta` mostra
   "Contas indisponíveis" e a demonstração continua a funcionar.
2. **Supabase → Authentication → URL Configuration** (obrigatório antes de abrir registos):
   Site URL `https://atlascatch.netlify.app`; Redirect URLs `https://atlascatch.netlify.app/**`,
   `https://*--atlascatch.netlify.app/**`, `http://localhost:5173/**`, `http://localhost:4173/**`.
   Sem isto, os emails de confirmação e recuperação apontam para `localhost:3000`.
3. **SMTP próprio** (Authentication → SMTP) para produção: o SMTP incluído só envia para membros da
   equipa e tem limites baixos.
4. **Open-Meteo**: uso comercial exige plano API pago (chave guardada como segredo da Edge Function,
   nunca no frontend).
5. Preencher o responsável pelo tratamento no aviso de privacidade (`src/screens/Privacy.tsx`).
6. Edge Functions: `supabase functions deploy enrich-ping conditions delete-account` (publicadas).
   As versões publicadas são funcionalmente iguais às do repositório (a última alteração no
   repositório foi só a declaração de variáveis, sem efeito em execução).

## 10. Testes

| Conjunto | Comando | Resultado |
|---|---|---|
| Unitários (lógica de enriquecimento, previsão, EXIF, fusos, unidades, inteligência, planeador + existentes) | `npm test` | 93/93 |
| Backend real (2 utilizadores, RLS, Storage, Edge Functions, Open-Meteo) | `npm run e2e:backend` | 61/61 |
| Browser real (Chromium, 390 e 1440 px) contra o backend real | `npm run e2e:lanca -- <url> <pasta>` | 33/33 |
| Typecheck, lint, build | `npm run typecheck`, `npm run lint`, `npm run build` | sem erros |

Os testes e2e usam dois utilizadores de **teste** confirmados (variáveis `E2E_A_*` e `E2E_B_*`) e apagam
os dados que criam. Para os recriar, ver o SQL em `e2e/README-lanca.md`.

Capturas (dados de teste): `docs/lanca/capturas/`.

## 11. Limitações conhecidas

- Sem modo offline: sem rede, o Ping não pode ser guardado (a página avisa e mantém o formulário).
- Interface só em português (o idioma escolhido fica guardado para a internacionalização).
- Água interior (temperatura, nível, caudal) e marés não integradas: aparecem como indisponíveis.
- Pesquisa de lugares limitada aos Pins próprios e a coordenadas (sem geocodificação externa).
- HEIC só tem pré-visualização nos browsers que o descodificam (Safari); noutros, guarda-se o original.
- A exportação ZIP é montada no dispositivo (bibliotecas muito grandes podem exigir muita memória).
- Não há gestão de dispositivos individuais: há "terminar em todos os dispositivos".
- Plano gratuito do Supabase: projeto pausa após 7 dias sem atividade.

## 12. Próximas prioridades técnicas

1. Configurar Auth (URLs, SMTP próprio) e variáveis na Netlify; publicar.
2. Fila offline (IndexedDB + Background Sync) para Pings sem rede.
3. Integração hidrológica oficial (SNIRH/APA em Portugal, SAIH/MITECO em Espanha) e marés oficiais.
4. Agendamento do `sweep` de enriquecimento (cron no Supabase) e observabilidade (métricas de
   tentativas, falhas e cache por fornecedor).
5. Internacionalização (es-ES, en) e geocodificação de lugares.
6. Proteção contra palavras-passe expostas e MFA (plano Pro), login Apple/Google.
7. Exportação GPX, partilha controlada de Pings/Pins com localização aproximada (fase social).
8. Identificação assistida de espécies por fotografia (só com consentimento explícito e base legal).
