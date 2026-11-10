# Atlas como ecrã principal · «Marcar pin»

O Atlas Ibérico 3D é o ecrã que abre depois da entrada na app (`/`). A ação principal é **Marcar pin**:
marcar o local de uma captura, observação ou local para voltar, guardar no dispositivo, ver o marcador
no terreno e, mais tarde, voltar a ele a partir do diário com um toque.

## Testar uma captura em menos de um minuto

1. Abra a app e inicie sessão (conta própria; os pins são privados) ou toque em **Experimentar sem email**
   (sessão de teste, ver abaixo).
2. No Atlas, aproxime até à margem (por exemplo, pesquise «Castelo do Bode» e toque na albufeira).
3. Toque em **Marcar pin** → **Usar a minha posição** (ou mova o mapa até a mira estar na margem) → **Confirmar local**.
4. Deixe **Captura**, toque em **Tirar fotografia** (ou **Escolher fotografia**), escreva a espécie se quiser.
5. **Guardar pin privado**. O marcador aparece logo e a ficha mostra «Guardado no dispositivo» → «A sincronizar» → «Sincronizado» (a fotografia tem estado próprio).
6. Abra **Abrir no diário** e, no diário, **Ver no mapa**: regressa à mesma margem com a mesma ficha.

## Sessões de teste sem email

«Experimentar sem email» (boas-vindas, «Entrar», «Criar conta» e o pedido de sessão do Atlas) abre uma sessão
de teste com o início de sessão anónimo do Supabase (`signInAnonymously`). Não pede email nem palavra-passe.

- **Dados reais, mesmas regras**: o utilizador anónimo usa o papel `authenticated`; todas as políticas RLS e
  de Storage filtram por `auth.uid()`, por isso os pins, fotografias, jornadas e partilhas funcionam e ficam
  privados exatamente como numa conta com email. Duas sessões de teste (dois navegadores) são duas contas
  distintas: serve para verificar a partilha aproximada sem criar emails.
- **Ligada a este navegador**: sem email nem palavra-passe não há forma de voltar a entrar. Por isso, nas
  Definições, «Terminar sessão de teste» apaga os dados no servidor (função `delete-account`) e a cópia local
  (IndexedDB), depois de confirmação. Eliminar uma conta normal também passou a apagar a cópia local.
- **Ativar no Supabase** (necessário uma vez): *Authentication → Sign In / Providers → Allow anonymous
  sign-ins*. Enquanto estiver desligado, o botão mostra «As sessões de teste sem email não estão ativas neste
  servidor.» e nada é criado.
- **Abuso e custos**: qualquer visitante pode abrir sessões de teste. O Supabase limita a 30 por hora por IP
  (ajustável em *Authentication → Rate Limits*) e recomenda CAPTCHA (Turnstile/hCaptcha) se a app for
  divulgada publicamente. As sessões abandonadas (navegador limpo sem terminar a sessão) ficam no servidor; o
  Supabase não as limpa sozinho. A limpeza periódica (por exemplo, sessões de teste com mais de 30 dias) não
  foi ativada: apaga dados e precisa da sua decisão, e tem de passar pela função `delete-account` para remover
  também as fotografias.
- **Teste**: `npm run e2e:sessao-teste` (duas sessões de teste: pin com fotografia sincronizado, diário ↔ mapa,
  partilha vista só como aproximada pela outra sessão, e terminar a sessão apaga servidor e dispositivo).

## Decisões

- **Motor**: o Atlas já era MapLibre GL com terreno DEM numa única instância. `map.unproject`/`map.project`
  têm em conta o relevo, por isso não foi preciso trocar de motor. Ida e volta verificada no teste: com o mapa
  inclinado (55–60°), rodado, aproximado e ao alternar 2D/3D, o pin fica no mesmo ponto geográfico (0,000 m)
  e desenhado exatamente sob a mira (0,0 px).
- **Um registo, um ID**: o pin tem um ID gerado no dispositivo. No servidor reutiliza o modelo existente:
  Captura/Observação → `pings` (+ `catches`, `ping_media`, condições do momento); Local para voltar → `pins`.
  Mapa, diário e jornadas referenciam o mesmo registo. «Adicionar à jornada» cria só a ligação
  (`journey_pins` ou `journey_pings`), nunca outra captura.
- **Terminologia**: nos novos controlos tudo é «pin». No diário (área de conta), «Pins» continua a designar
  os locais guardados e «Pings» os registos de experiências; a ficha do pin no Atlas abre o registo certo.
- **Unificação**: «Reports e pings» passou a ser a camada **Comunidade** do Atlas (links antigos
  `/reports?janela=&especie=&atividade=` abrem a camada com os mesmos filtros; `/reports/novo` abre o
  compositor). «Gera a tua história» abre o diário privado. O antigo ecrã dividido ficou em `/inicio`.
- **Câmara**: nunca se move sozinha ao atualizar dados. Só se move por ação explícita («Ver no mapa»,
  «Marcar aqui», toque num grupo); um enquadramento pendente é cancelado assim que o utilizador interage.

## Ecrã

- **Telemóvel**: pesquisa compacta no topo; **Marcar pin** ao alcance do polegar; camadas e recentrar sempre
  visíveis; zoom, rotação, inclinação, Península, lista e fontes num único menu (⚙). A ficha inferior recolhida
  mostra a seleção e expande por toque ou arrasto. Ao marcar, o painel do compositor é compacto e o mapa
  reserva a sua altura (a mira e o ponto ficam sempre visíveis acima do painel e do teclado).
- **iPad em paisagem**: coluna lateral recolhível (pesquisa, resultados ou ficha); o mapa continua utilizável.
  Abaixo de 900 px de largura útil (Split View, retrato) passa à ficha inferior.
- **Escala**: Península e região → grupos agregados no servidor (células); albufeira → grupos do motor;
  margem → pins individuais. Tocar num grupo aproxima; pins coincidentes abrem uma lista.
- **Formas**: captura = círculo com peixe; observação = losango; local para voltar = marcador quadrado com
  bandeira. Preenchimento claro com contorno petróleo; anel de seleção turquesa com contorno escuro;
  ponto âmbar = por sincronizar. Sem pulsações permanentes.
- **Acessibilidade**: controlos com 44 × 44 px; nomes acessíveis em todos os botões; listas equivalentes ao mapa
  (resultados, «Os meus pins» de uma água, pins coincidentes, comunidade); movimento reduzido respeitado.
- **Aparelhos lentos**: medem-se os frames enquanto o mapa se move; primeiro reduz-se a resolução do canvas,
  depois sugere-se o 2D (nunca muda sozinho). Sem WebGL, o registo continua possível por GPS.

## Fluxo «Marcar pin»

1. **Colocação**: «Usar a minha posição» (GPS só por iniciativa do utilizador; mostra precisão e idade da
   leitura; sinal fraco → corrigir com a mira) ou «Escolher no mapa» (mira no centro da área útil; tocar centra).
   Toque prolongado/botão direito é atalho opcional. Arrastar nunca cria um pin. A posição do telemóvel (ponto
   azul) é distinta da posição da captura.
2. **Ficha compacta**: tipo (Captura / Observação / Local para voltar), data e hora pré-preenchidas e editáveis
   (fuso do local: hora de Portugal / hora de Espanha), fotografia (câmara ou galeria), espécie e campos
   progressivos (quantidade, peso, comprimento, técnica, amostra, profundidade, notas). Fotografia antiga:
   propõe a data e o local dos metadados para confirmar antes de pedir dados históricos.
3. **Guardar pin privado**: só depois da escrita local durável (IndexedDB, transação confirmada) aparece o pin.
   Estados reais: «Guardado no dispositivo», «A sincronizar», «Sincronizado» (e fotografia à parte).
4. **Ficha**: editar, mover (proteção: novo ponto confirmado à parte), eliminar (confirmação explícita),
   adicionar à jornada, partilhar, abrir no diário.
5. **Rascunho**: guardado a cada alteração (com as fotografias). Ao reabrir: «Retomar» ou «Descartar».

## Massa de água

Ao selecionar uma água: **Marcar aqui** (compositor com a água pré-associada, sem deslocar o ponto para o
centro), **Ver os meus pins** (lista dos pins nessa água) e **Preparar jornada** (planeador com as capturas e os
locais do utilizador nessa água, previsão, histórico e semelhança; «guardar este ponto para sábado»).

## Rede fraca e sincronização

- Base IndexedDB por conta (`lancalance-<uid>`): pins, fotografias (blobs), rascunho. Filas nunca se misturam
  entre contas. Pede-se armazenamento persistente ao navegador.
- IDs gerados no cliente; escrita idempotente (repetir uma criação devolve o registo existente; fotografias com
  o ID do ficheiro e da linha). Retoma ao abrir, ao voltar a rede e ao regressar à app; um envio de cada vez
  (Web Locks entre separadores).
- Erros com ação: sem rede (fica no dispositivo), sessão expirada («Iniciar sessão»), quota/limite («Guardar sem
  esta fotografia» / «Tentar de novo»), conflito de edição entre dispositivos («Manter a minha versão» /
  «Usar a do servidor»; deteção por revisão das edições, não pelo enriquecimento do servidor).
- Nunca se mostra «Guardado» se a escrita falhar. Cartografia offline não é prometida (depende de dados e
  licenças); sem mapa, o registo por GPS continua possível.

## Privacidade e partilha

- Coordenada exata e fotografia original só no perfil privado (RLS em tabelas e armazenamento).
- Partilhar cria uma **versão separada** (`shared_reports`) por decisão explícita, com pré-visualização: célula
  fixa de 0,05° (~5,6 km), dia e período (sem hora), tipo, espécie, técnica e a fotografia reduzida sem EXIF.
  Sem notas, nome nem identificadores. Outras contas leem só essas colunas.
- Revogar apaga a versão comunitária e a fotografia derivada (o diário mantém-se). As imagens comunitárias são
  servidas com URLs assinados de 5 min e sem cache; medido: um URL já emitido deixou de servir a imagem ao fim
  de ~59 s (cache intermédia do Storage); a publicação desaparece de imediato.
- Os reports de demonstração continuam aproximados e identificados como demonstração.

## Base de dados (migrações)

- `20261108000500_atlas_pins_community.sql`: `pings.water_body_ref/name`; `journey_pings`; `my_atlas_pins`;
  `shared_reports`, `my_shares()`, bucket `community-media`; auditoria de partilhas.
- `20261110000100_edit_revisions.sql`: `rev` em `pings` e `pins` (conflitos de edição).
- `20261110000200_rate_limit_indexes.sql`: índices `(owner_id, created_at)` para o limite por minuto.
- `20261110000300_atlas_pins_perf.sql`: `btree_gist` e índices `(owner_id, location)`; `my_atlas_pins` sem
  subconsultas na agregação e com limite antes das subconsultas.
- Edge Functions: `community-share` (nova); `delete-account` (apaga também as fotografias partilhadas).

## Medições efetivas

Ambiente: Chromium 153 headless (Playwright), **WebGL por software (SwiftShader, sem GPU)**, 4 vCPU Xeon 2,1 GHz,
16 GB, build de produção em `vite preview` local, backend Supabase eu-west-3 através de proxy. Ficheiros:
`docs/lanca/medicoes.json` e `docs/lanca/carga.json`. Scripts: `e2e/perf.cjs`, `e2e/perf-breakdown.cjs`, `e2e/load.mjs`.

| Objetivo | Medido neste ambiente | Leitura |
|---|---|---|
| Feedback a «Marcar pin» ≤ 100 ms p95 | 16 ms (sem limites), 76 ms (CPU 4×) | Cumprido |
| Seleção de pin ≤ 100 ms p95 | p50 261 ms, p95 2 077 ms (CPU 4×: p50 3,8 s) | Dominado pelo frame do mapa (1–2 s em WebGL por software). Medir em aparelho físico |
| Confirmação local durável | p50 16 ms, p95 545 ms (sem limites); p95 42 ms (CPU 4×) | Medido separadamente, como pedido |
| Envio da fotografia / confirmação remota | p50 8,5 s / 8,2 s (sem limites) | A thread principal está ocupada pelos frames do mapa; medir em aparelho |
| Primeiro mapa manipulável ≤ 2,5 s p75 (4G, cache fria) | 41,0 s (4G lento + CPU 4×); 20,8 s (sem limites) | Não cumprido aqui; dominado pelo WebGL por software. Medir em aparelho de referência |
| 60 fps à escala da margem | 3D: 0,4–0,9 fps; 2D: 10,8 fps (p50 83 ms) | Custo dominante identificado: terreno 3D (12× mais lento que 2D); a camada de pins não tem custo mensurável |

Carga (dados sintéticos com densidade desigual: 40 000 Pings e 3 000 Pins de uma conta de teste; 16 000 em Castelo do Bode):

| Concorrência (1 cliente) | Antes da otimização | Depois |
|---|---|---|
| 10 | 15,2 pedidos/s · p95 1 471 ms | 25,9 pedidos/s · p95 618 ms |
| 30 | 17,6 pedidos/s · p95 3 812 ms (1 erro) | 30,1 pedidos/s · p95 1 751 ms |
| 60 | 17,9 pedidos/s · p95 10 149 ms (1 erro) | 30,6 pedidos/s · p95 4 746 ms · 0 erros |

Tempo na base de dados por consulta (com RLS, aquecido): Península 518 → 29 ms; região 164 → 24 ms; albufeira 34 ms;
margem 20 ms. Escritas: 40 em simultâneo com p95 de 500 ms, 0 erros; as 40 repetições com o mesmo ID foram
rejeitadas como duplicado; **0 duplicados**. Envios: 10 fotografias de 60 KB em simultâneo, p95 de 904 ms, 0 erros.

**Conclusões e limites**: depois da otimização, a consulta deixou de ser o custo dominante; o patamar de ~30
pedidos/s vem de um só cliente através de proxy e do plano gratuito. A hipótese de 300 sessões simultâneas
(6 000 subscritores) **não foi ensaiada diretamente**: a ~0,2–0,5 pedidos/s por sessão ativa a explorar o mapa,
seriam 60–150 pedidos/s. Validar com geradores de carga distribuídos, plano pago com pool de ligações e
medições em telemóvel e iPad físicos.

## Testes

| Conjunto | Comando | Resultado |
|---|---|---|
| Percurso mapa → pin → diário → mapa, iPad/telemóvel, sem rede, privacidade, links antigos | `npm run e2e:marcar -- <url> <pasta>` | 42/42 |
| Unitários | `npm test` | 98/98 |
| Atlas (regressão) | `npm run e2e:atlas -- <url> <pasta>` | 58/58 |
| Área privada (regressão) | `npm run e2e:lanca -- <url> <pasta>` | 33/33 |
| Backend real (regressão) | `npm run e2e:backend` | 61/61 |

Precisa de aparelho físico: tempos de frame e de arranque, câmara real (o teste usa ficheiros), GPS real
(o teste emula posição e recusa), Safari/iPadOS (barras móveis, Split View real, teclado), armazenamento sob
pressão de memória.

## Integrações que precisam de credenciais ou configuração

- Supabase Auth: URLs de redirecionamento (Site URL e Redirect URLs) e SMTP próprio para produção.
- Open-Meteo: uso comercial exige plano pago (chave como segredo da Edge Function).
- Marés oficiais e hidrologia (SNIRH/SAIH): não integradas; aparecem como «Indisponível».
- Teste de carga representativo: plano Supabase pago (compute e pool) e geradores distribuídos.
