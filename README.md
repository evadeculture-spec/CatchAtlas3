# CatchAtlas — demonstração

Protótipo navegável de uma aplicação de pesca desportiva em barragens de Portugal e Espanha: descobrir barragens, preparar jornadas, registar capturas, rankings, provas e comunidade (reports com mapa de pings, chat global de subscritores, marketplace e giveaway).

> Demonstração — dados ilustrativos. Perfis, capturas de terceiros, provas, rankings e condições meteorológicas são fictícios. Todas as barragens têm capa: fotografias do Unsplash (`src/data/photos/unsplash.json`), sempre com crédito ao autor e com a indicação do que mostram ("Segundo o autor", "Mesma zona" ou "Imagem ilustrativa"). Quando uma fotografia verificada do pipeline (ver `photos/README.md`) for aprovada para uma barragem, substitui automaticamente a do Unsplash.

## Executar localmente

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run typecheck
npm run build      # gera dist/
npm run preview    # serve dist/ em http://localhost:4173
```

Requer Node 20 ou superior (testado com Node 22).

## Publicar na Vercel

O `vercel.json` define o build (`npm run build`), a pasta `dist` e o rewrite de SPA. Ligando o repositório a um projeto Vercel, cada push para `master` publica uma nova versão.

## Publicar na Netlify

O `netlify.toml` já define o build (`npm run build`), a pasta `dist` e o rewrite de SPA (`/* → /index.html`), para que as rotas internas abram diretamente.

```bash
npx netlify-cli login
npx netlify-cli deploy            # preview
npx netlify-cli deploy --prod     # produção
```

Em alternativa, pode ligar o repositório em app.netlify.com: as definições são lidas do `netlify.toml`.

## Versão num único ficheiro

`npm run build:artifact` gera `dist-artifact/atlascatch.html`, um ficheiro com tudo incluído, router em hash e sem service worker. Abre em qualquer navegador sem servidor.

## Estrutura

- `src/config/brand.ts` — nome, assinatura, etiqueta de demonstração, giveaway (mensal/semanal) e subscrição (substituir aqui).
- `src/data/` — barragens (`dams.ts`, `moreDams.ts`), rios (`rivers.ts`), concessões e zonas com documento oficial (`zones.ts`), licenças e legislação com fontes (`legal.ts`), e dados de demonstração.
- `src/lib/` — datas, formatação, meteorologia simulada, regras de sugestão, rankings e fotografias (IndexedDB).
- `src/state/` — estado global persistido em `localStorage` e toasts.
- `src/components/` — componentes reutilizáveis (navegação, cartões, gráficos, mapa esquemático, ilustrações).
- `src/screens/` — ecrãs.
- `public/` — manifesto PWA, ícones e service worker (cache básico do shell).

## Mapa real das albufeiras

O separador **Mapa** do Explorar usa **MapLibre GL JS** (Mercator, plano, norte para cima, sem rotação nem inclinação).

- **Albufeiras**: contornos reais do **OpenStreetMap** (© contribuidores do OSM, **ODbL**), 3 137 albufeiras ≥ 5 ha de Portugal e Espanha, extraídas por [bquelhas/barragens](https://github.com/bquelhas/barragens) (extração de 2 nov. 2026). `npm run map:build` gera `public/map/water/` (visão geral + 88 blocos de 1°, carregados pela área visível), o índice de pesquisa e as correspondências com as fichas (`src/data/map/catalogWater.json`, relatório em `photos/MAPA-CORRESPONDENCIAS.txt`).
- **Área**: geodésica no elipsoide WGS84 (GeographicLib), sobre o contorno completo. Os escalões (≥ 40, 15–40, 3–15, 0,5–3 e < 0,5 km²) e os limiares de zoom, relativos ao enquadramento da Península em cada ecrã, estão documentados em `src/lib/map/waterConfig.ts`.
- **Mapa base**: tiles vetoriais do **OpenFreeMap** (OpenMapTiles, dados OSM; gratuito, sem chave). A água do mapa base só aparece à escala local. Se não carregar, o mapa usa a base **Natural Earth** (domínio público) e mostra um aviso.
- **Nomes**: albufeiras sem nome próprio no OSM usam o nome da barragem associada, quando é inequívoco (64 casos). À escala local aparecem também os nomes de lagos e lagoas do mapa base, sem repetir os das albufeiras.
- **Açudes e barragens**: 6 484 açudes e 3 600 estruturas de barragem do OSM (`public/map/structures/`, blocos carregados só à escala local): primeiro como ponto, depois com a forma real e o nome.
- **Concessões e zonas de pesca**: as zonas com albufeira conhecida (`osmWater` ou ficha em `src/data/zones.ts`) aparecem com marca dourada e contorno tracejado; o painel liga ao documento. A lista é parcial (ver página Concessões e zonas).
- **Rótulos**: fontes Noto Sans (OFL) servidas pelo próprio site (`public/map/fonts`).
- Os contornos são de referência: não indicam o nível atual da água.

## Notas

- As datas são relativas ao dia em que a demonstração é aberta. Numa nova sessão do navegador avançam para o dia corrente.
- As fotografias são comprimidas (até 1400 px, JPEG) e guardadas em IndexedDB. Os restantes dados ficam em `localStorage`.
- O mapa é esquemático (Portugal e Península Ibérica), com posições aproximadas, e não serve para navegação. Os pings dos reports usam uma posição aproximada dentro da barragem.
- A subscrição é simulada: não há pagamentos. O chat, os anúncios e os reports de terceiros são fictícios; os do utilizador ficam apenas no navegador.
- Os ícones PNG foram gerados com `scripts/make-icons.mjs` (Playwright).

## Dados legais

A informação de licenças e legislação foi compilada a 31/10/2026 a partir das fontes ligadas em cada ficha (`src/data/legal.ts`). As concessões e zonas de pesca são uma lista parcial com documento identificado; a lista completa portuguesa está no geocatálogo do ICNF. As barragens de `moreDams.ts` têm apenas dados gerais e coordenadas aproximadas.

## Fotografias e testes

- Pipeline de fotografias: `photos/README.md` (`npm run photos -- discover|derive|publish|audit`).
- Capas do Unsplash: `src/data/photos/unsplash.json`, num ficheiro à parte para o `publish` do pipeline não as apagar. As imagens são servidas diretamente por `images.unsplash.com` (como pedem as regras da API do Unsplash) e cada uma foi registada como "download" no Unsplash.
- Testes unitários: `npm test` (regras de publicação, duplicados, observações, licenças, identidade).
- Testes de comportamento das fotografias: `npx vite build --mode e2e`, servir `dist-e2e` e correr `node e2e/photos.e2e.cjs <url>`. O modo e2e usa um catálogo e uma imagem de TESTE que nunca entram no build de produção.
