# Ecossistema cartográfico 3D unificado

Todos os mapas da app usam o mesmo motor: `AtlasMap`, sobre MapLibre GL JS 6, com terreno DEM real, massas de água, rios e estruturas do Atlas Ibérico. Cada módulo muda só os dados e o objetivo do ecrã; nenhum tem um segundo motor ou estilo próprio.

## Auditoria (estado encontrado)

- **Stack:** React 19, Vite 8 (rolldown), TypeScript, Tailwind 4, react-router 8. Backend Supabase (Postgres + PostGIS, RLS, Storage privado, Edge Functions). Publicação na Netlify (e Vercel).
- **Motor:** MapLibre GL 6 já instalado. Não existe Mapbox, Cesium nem Leaflet, por isso não houve migração de motor.
- **Implementações de mapa encontradas:** três.
  - **AtlasMap**: 3D com DEM real, laje peninsular, hillshade e camadas do Atlas.
  - **PrivateMap**: plano, com estilo claro próprio.
  - **IberiaMap**: plano, antigo.

## Matriz de mapas

| Mapa / componente | Motor antes | Dados | Depois |
|---|---|---|---|
| Atlas (`/`, ecrã principal) | AtlasMap 3D | Atlas, pins, comunidade, carpa | AtlasMap 3D + memória de câmara partilhada |
| Os meus pins (`/conta/meus-pins`) | AtlasMap, **fixo em 2D** | `search_pins`, comunidade opcional | AtlasMap **3D por omissão** + 2D/3D + memória de câmara |
| Mapa (`/conta/mapa`) | PrivateMap **plano** | Pins e pings próprios | AtlasMap 3D (PrivateMap passa a adaptador) + 2D/3D |
| Painel (`/conta`, mapa resumido) | PrivateMap plano | Pins ativos | AtlasMap 3D (via PrivateMap) |
| Ficha do Pin (`/conta/pins/:id`) | PrivateMap plano | Pin + pings ligados | AtlasMap 3D |
| Ficha do Ping (`/conta/pings/:id`) | PrivateMap plano | Ping | AtlasMap 3D |
| Escolha de localização (novo Pin / Ping) | PrivateMap plano | Marcador arrastável | AtlasMap 3D, marcador e toque mantidos |
| Explorar barragens (`/explorar`) | IberiaMap **plano** | Catálogo filtrado | AtlasMap 3D (`ExploreMap`); IberiaMap removido |
| Jornada (`/conta/jornadas/:id`) | **Sem mapa** | — | «Mapa da jornada» (AtlasMap 3D com os locais e capturas) |
| Comunidade, carpa | Camadas do Atlas | — | Já no motor; sem alteração |

Ficheiros: `src/components/lanca/PrivateMap.tsx` (reescrito como adaptador), `src/components/map/ExploreMap.tsx` (novo), `src/components/atlas/MapQuickControls.tsx` (novo), `src/lib/atlas/cameraMemory.ts` (novo), `src/screens/conta/MeusPins.tsx`, `src/screens/Atlas.tsx`, `src/screens/Explore.tsx`, `src/screens/conta/JourneyDetail.tsx`, `src/screens/conta/MapScreen.tsx`. Removido: `src/components/map/IberiaMap.tsx`.

## Decisões

- **Sem motor novo nem dependências novas.** O AtlasMap já tinha terreno real, DEM, hillshade, LOD por escala, agrupamento, seleção e degradação em aparelhos lentos.
- **PrivateMap mantém a interface pública anterior.** Os seis ecrãs que o usam não mudaram, e só o motor por baixo foi trocado.
- **Memória de câmara** (`sessionStorage`, por separador). Ao mudar de módulo, o mapa reabre na mesma região, zoom, inclinação, orientação e modo. No Atlas, a câmara do URL tem prioridade.
- **Relevo indisponível:** o mapa passa a 2D com toda a cartografia, e o botão 3D fica desativado com a explicação.
- **Profundidade:** o DEM é terrestre. Não há batimetria nem profundidades em lado nenhum.

## Dados hidrográficos (o que o motor carrega hoje)

Contagens medidas em `public/map/atlas/registry.json`:

| Tipo | Entidades | PT | ES | Com geometria |
|---|---|---|---|---|
| Albufeiras (polígonos OSM, ≥ 5 ha) | 3 140 | 1 282 | 1 887 | 3 137 (3 só pesquisáveis) |
| Barragens (estruturas OSM) | 1 104 | 321 | 783 | 1 104 |
| Açudes (estruturas OSM) | 588 | 160 | 428 | 588 |
| Grandes rios (Natural Earth) | 36 | 7 | 32 | 36 |

- **Total:** 4 868 entidades, 99 delas fora da Península (ilhas, Ceuta e Melilla).
- **Dupla contagem:** as albufeiras transfronteiriças contam nos dois países.
- **Rede fina:** ribeiras, linhas de água menores, lagos e lagoas vêm do mapa de base vetorial OpenFreeMap (OSM). São desenhados à escala local mas não são entidades pesquisáveis do registo.
- **Licenças:** OSM (ODbL 1.0), Natural Earth (domínio público), relevo Terrain Tiles (Tilezen/AWS Open Data).

**Lacunas (pendentes):**
- **Fontes oficiais:** as massas de água da APA (SNIAmb) e do MITECO/CNIG não estão integradas. É preciso verificar licença e redistribuição, descarregar, normalizar e cruzar identificadores, e isso não foi feito.
- **Entidades em falta no registo:** lagoas, canais, ribeiras e afluentes.
- **Locais de pesca:** concessões, carpódromos e pistas só entram pelo catálogo «Carpa», quando o Excel for importado.

Não declaro cobertura completa.

## Testes

Ver a tabela final da entrega.

- `e2e/mapas.e2e.cjs`: T01, T02, T07, T09, T10, T11, T14 e mapas da área privada, Explorar e Jornada.
- As suítes anteriores cobrem T03 (seleção de albufeira no Atlas), T05/T06 (pins, pings e fichas «3 de N») e T08 (comunidade desligada, servidor).

**Pendentes por falta de dispositivo:** iPhone real (Safari iOS) e Chrome em Android. Os testes correram no Chromium do Playwright, com WebGL por software.

## Custos (recorrentes)

| Serviço | Uso | Custo |
|---|---|---|
| OpenFreeMap (mapa de base) | Tiles vetoriais | Gratuito, sem SLA (serviço comunitário) |
| Terrain Tiles AWS (DEM) | PNG terrarium | Gratuito (AWS Open Data), sem SLA |
| Ficheiros do Atlas (`/map/*`, servidos pela Netlify) | Contornos, rios, estruturas, registo | Tráfego conta para a quota da Netlify (o plano atual tem créditos) |
| Supabase | Base de dados, Storage, funções | Plano gratuito atual; o crescimento para milhares de utilizadores exige plano pago (estimativa, a confirmar com o uso real) |
| Open-Meteo | Previsão e condições | Gratuito só para uso não comercial; uso comercial exige plano pago |
