# Atlas Ibérico 3D

Experiência principal de exploração de **Prepara a tua jornada**:
Península Ibérica (peça com volume) → região/bacia → massa de água → ficha → preparar jornada ou registar captura.

## Onde abrir

| Entrada | Destino |
|---|---|
| Início → *Prepara a tua jornada* → cartão **Atlas Ibérico 3D** | `/atlas` |
| *Prepara a tua jornada* → Ferramentas → **Mapa** | `/atlas` (vista da Península) |
| *Prepara a tua jornada* → Ferramentas → **Explorar barragens** | `/atlas?painel=lista` (lista, pesquisa e filtros abertos) |
| Ficha de barragem → **Ver no Atlas Ibérico** · captura → **Ver no Atlas** | `/atlas?ficha=<id da ficha>` |
| Concessões e zonas → **Ver no Atlas** | `/atlas?agua=<id da albufeira>` |
| Explorar → **Abrir no Atlas Ibérico 3D** · menu → *Atlas Ibérico 3D* | `/atlas` (com o filtro país/favoritas do Explorar) |

O estado vive no URL e sobrevive ao "voltar" depois de abrir uma ficha, preparar jornada ou registar captura:
`sel` (ID do registo), `troco` (troço de rio), `pais=PT|ES`, `tipo=albufeira,rio,barragem`, `fav=1`, `modo=2d`,
`v=lng,lat,zoom,inclinação,rotação`, `painel=lista`.

O Explorar (`/explorar`, lista com fotografias e mapa plano) mantém-se sem alterações de comportamento.

## Decisões técnicas

**Uma só cena MapLibre GL JS 6.16** (já usado na app). Não foi preciso Three.js nem duas renderizações:

1. **Terreno real** — relevo de um DEM (Terrain Tiles/Terrarium por omissão): `color-relief` (tons minerais por
   altitude) e `hillshade` em todas as escalas; **terreno 3D** (`setTerrain`) só à escala local e no modo 3D.
   As massas de água são camadas `fill` do próprio mapa: ficam drapeadas no terreno (sem flutuar nem z-fighting).
2. **Base extrudida** — a espessura gráfica da peça é uma *custom layer* WebGL2 (`src/lib/atlas/slabLayer.ts`)
   com a matriz da câmara do MapLibre (`defaultProjectionData.mainMatrix`: Mercator 0–1, z conforme). As paredes
   ficam **abaixo** do nível do mapa (z de 0 a −espessura), por isso o topo coincide com a linha de costa
   desenhada pelo mapa.
   - Camada `2d` desenhada por cima do mar e do contexto e por baixo da água, das linhas e dos rótulos.
   - **Pré-passo de profundidade** com o topo da laje triangulado (earcut): uma parede que no ecrã se sobreponha à
     superfície da laje está sempre atrás dela (paredes abaixo de 0, câmara acima), por isso as paredes de trás
     (rias, reentrâncias) ficam ocultas sem esconder as que pendem sobre o mar. O pré-passo usa o sub-nível de
     profundidade seguinte ao da camada (2⁻¹⁶, o mesmo esquema do MapLibre): as camadas seguintes não são afetadas.
   - Só as paredes voltadas para a câmara são desenhadas, da mais distante para a mais próxima (ordenadas no CPU
     quando a câmara muda; ~1 500 arestas). Sombra de contacto discreta no "fundo".
   - Espessura de 36 km com a Península enquadrada; ao aproximar encolhe na proporção do zoom (altura constante no
     ecrã) e desaparece entre `fit+0,9` e `fit+2,2`. O terreno 3D liga-se a partir de `fit+2,35` (com histerese),
     com exagero em rampa até 1,45: a peça dá lugar ao relevo local sem paredes gigantes a atravessar o mapa.
   - Sem rotação automática; o MapLibre só desenha quando algo muda (medido: 0 frames em repouso).
3. **Relevo sem batimetria** — os Terrain Tiles trazem a profundidade do mar. Um protocolo `atlasdem://`
   (`src/lib/atlas/dem.ts`) descarrega cada tile, põe a 0 m as cotas negativas e entrega a imagem ao MapLibre;
   pedidos cancelados abortam o `fetch`. Assim o relevo terrestre não se confunde com batimetria e o mar não
   "afunda" com o terreno 3D. Não há profundidades de albufeiras (não existem dados).

**Recorte**: laje = terra do Natural Earth 10 m intersetada com `[-10,5; 35,0; 4,0; 44,25]` (`SLAB_BOX`),
polígono único contínuo através da fronteira Portugal–Espanha, com Andorra e Gibraltar. O norte (44,25° N) e o
este (4,0° E) cortam a terra francesa **de propósito**: os Pirenéus não ficam como costa e a peça termina num corte
reto (linha tracejada). A parte francesa dentro do recorte é atenuada. Na vista geral, uma máscara (mar) esconde o
relevo fora da peça; Marrocos e as ilhas ficam como contexto discreto. Ao aproximar, a máscara desaparece e o
mapa torna-se contínuo.

**Câmara**: inclinação 44° (38° em ecrãs estreitos) e rotação 10°. Em vez de um ajuste empírico, o enquadramento
projeta os cabos extremos da peça com a câmara candidata e corrige zoom e centro até caberem na área livre
(o *padding* do mapa reserva painel lateral, cabeçalho e painel inferior).

**Níveis de detalhe** (`src/lib/atlas/zoomPolicy.ts`, limiares relativos ao `fit` de cada ecrã, com fades):

| Escala | Conteúdo |
|---|---|
| Península (`fit`…`fit+1`) | peça com volume, países, rios principais (Tejo, Douro, Guadiana, Ebro, Guadalquivir, Minho), albufeiras ≥ 40 km² |
| Região (`fit+1`…`fit+2,4`) | rios regionais, albufeiras ≥ 15 e ≥ 3 km², limites regionais, fichas agrupadas, zonas de pesca |
| Local (`fit+2,4`…`fit+4,2`) | terreno 3D, albufeiras pequenas (blocos de 1° pela área visível), rios e localidades do mapa base, barragens |
| Detalhe (> `fit+4,2`) | todas as albufeiras ≥ 5 ha, açudes, água e nomes locais do mapa base, forma real das estruturas |

Simplificação por zoom do próprio MapLibre (geojson-vt) sobre a visão geral simplificada e os blocos de detalhe;
colisão de rótulos com prioridade às maiores albufeiras; marcadores das fichas **agrupados** e independentes da
geometria (os polígonos nunca são substituídos por clusters); área de toque alargada de forma invisível (5 px rato,
14 px toque) e **seletor** quando há vários elementos no mesmo ponto.

## Dados: duas coberturas

- **A. Cartografia** (o que se vê): albufeiras e estruturas OSM, rios do atlas, mapa base.
- **B. Catálogo CatchAtlas** (fichas de demonstração em `src/data/dams.ts`).

Um elemento pode existir na cartografia sem ficha: o atlas mostra "Informação deste local ainda não disponível"
e não oferece jornada/captura (os fluxos existentes exigem uma ficha). As fichas ligam-se à cartografia pela
tabela explícita **`src/data/atlas/catalogLinks.json`** (método, distância, estado `automatica`/`revista`/`sem-contorno`,
estruturas físicas associadas). Correções humanas: `src/data/atlas/catalogLinks.manual.json`
(`[{ "catalogId", "atlasId", "reviewedAt", "note" }]`), aplicadas pelo pipeline.

**Modelo tipado** (`src/lib/atlas/model.ts`): `id`, `sourceRefs`, `name`, `altNames`, `type`
(albufeira · lagoa · rio · barragem · açude · bacia · zona), `countries`, `region` (distrito em PT; província e
comunidade em ES), `basin`, `geometryRef`, `bbox`, `point`, `catalogId?`, `source` (com licença) e datas: a fonte
indica `observedAt` (data dos dados, ex.: extração OSM de 2026-11-02) e `processedAt` (atualização do registo).

**IDs**: reutilizam os IDs existentes (`osm-relation-…`, `osm-way-…`); rios `ne-rio-<id>`, troços `ne-rio-<id>-tN`;
fichas sem contorno `ficha-<id>`. Quando o mesmo objeto OSM é albufeira e estrutura (acontece na fonte), a estrutura
recebe o sufixo `-estrutura`. Nunca se juntam registos só pelo nome ou proximidade: a albufeira, a barragem física e
o troço de rio são elementos diferentes, relacionados por `related`.

**Nomes**: tabela explícita de rios em `src/data/atlas/riverNames.ts` (Tejo/Tajo, Douro/Duero, Minho/Miño…,
correções de nomes corrompidos na fonte como "Mio" e "Zncara"); as albufeiras guardam os nomes OSM em PT/ES e o
nome da ficha. A pesquisa ignora acentos e termos genéricos ("barragem", "embalse", "rio"), que só indicam o tipo.

### Pipeline (reprodutível, versões fixadas)

```bash
npm run map:build     # albufeiras e estruturas OSM (bquelhas/barragens@2ddc0bd) → public/map/water, structures
npm run atlas:build   # laje, contexto, rios, registo, tabela ficha↔cartografia, auditoria (Natural Earth @ca96624)
npm run atlas:tiles   # opcional: tiles vetoriais MVT estáticos → dist-tiles/atlas (não versionado)
```

As fontes descarregadas ficam em `.cache/map-src` (não versionado). Saídas versionadas: `public/map/atlas/`
(laje 195 KB, rios 59 KB, registo 862 KB / 224 KB gzip — descarregado só ao pesquisar, abrir a lista ou uma ficha),
`src/data/atlas/*.json`, `docs/atlas/COBERTURA.md`. Licenças em `public/map/atlas/LICENSE.txt`.

### Cobertura efetiva

Ver **`docs/atlas/COBERTURA.md`** (gerado). Em resumo: 3 137 albufeiras OSM ≥ 5 ha (3 109 peninsulares),
1 104 barragens e 588 açudes com nome (todas as 10 084 estruturas aparecem no mapa à escala local), 36 rios em
110 troços, 105 das 108 fichas ligadas a um contorno. **Não** há "todas as massas de água": lagos e lagoas naturais
só aparecem como água do mapa base à escala local (sem ID estável nem ficha); bacias só como atributo.

**Âmbito**: o enquadramento inicial é Portugal continental e Espanha peninsular. Os registos das Baleares, Canárias,
Açores, Madeira, Ceuta e Melilla que já existiam mantêm-se pesquisáveis (marcados `peninsular: false`) e mostram-se
como contexto plano, fora da peça.

### Fontes avaliadas

| Fonte | Uso | Estado |
|---|---|---|
| OpenStreetMap (via bquelhas/barragens) | albufeiras, barragens, açudes | **em uso** · ODbL · extração 2026-11-02 |
| OpenFreeMap (OpenMapTiles, OSM) | mapa base vetorial | **em uso** · gratuito, sem chave e **sem SLA**; recurso Natural Earth se falhar |
| Natural Earth 10 m | laje, contexto, fronteiras, regiões, rios gerais | **em uso** · domínio público · 5.2.0-pre |
| Terrain Tiles (AWS Open Data, Tilezen) | relevo (Terrarium) | **em uso** · sem chave, **sem SLA** · atribuição EU-DEM/USGS/NOAA no mapa |
| APA/SNIRH (PT) — rede hidrográfica, regiões hidrográficas | bacias PT, rios detalhados | **pendente**: inacessível a partir deste ambiente; verificar licença/condições |
| IGN/CNIG e MITECO (ES) — demarcaciones, red hidrográfica | bacias ES, rios detalhados | **pendente**: inacessível a partir deste ambiente; CC BY 4.0 indicado pelo IGN (confirmar) |
| Copernicus EU-Hydro | rios e lagos (complementar) | **pendente**: requer conta; dados de referência ~2012, resolução média |
| OSM lagos (`natural=water` sem `reservoir`) | lagoas naturais com ID estável | **pendente**: extração por Overpass/Geofabrik em build (nunca por utilizador); Overpass inacessível aqui |

Para acrescentar uma fonte: produzir um GeoJSON em EPSG:4326 com ID de origem, validar tipos (Polygon/MultiPolygon,
LineString/MultiLineString, anéis interiores), integrar em `scripts/map/build-atlas.ts` como nova `AtlasSource`
(licença, datas) e gerar a geometria por blocos (ou MVT).

## Configuração e alojamento

`.env.example` documenta as variáveis (todas **públicas**: vão no bundle; sem segredos):
`VITE_ATLAS_BASEMAP_TILEJSON`, `VITE_ATLAS_DEM_TILES` (`off` desliga o relevo), `VITE_ATLAS_DEM_ENCODING`,
`VITE_ATLAS_DEM_MAXZOOM`, `VITE_ATLAS_DEM_ATTRIBUTION`. As omissões (OpenFreeMap e Terrain Tiles) são gratuitas e
sem chave, mas **não têm garantia de serviço**: para produção, considerar alojar o DEM próprio (p. ex. PMTiles de
relevo) ou um fornecedor com contrato. Nada foi publicado nem configurado em serviços externos.

Netlify/Vercel: sem alterações ao build; `/atlas` é servido pelo rewrite de SPA. Os dados do atlas são ficheiros
estáticos em `public/map/atlas` (os existentes `/map/*` em falta continuam a dar 404).

**Produção (crescer a cobertura)**: `npm run atlas:tiles` gera 6 553 tiles MVT estáticos (z4–12, 7,4 MB, validados
por descodificação) a partir dos mesmos dados. Um diretório de tiles estáticos não precisa de HTTP Range. Para um
único `.pmtiles` (go-pmtiles/tippecanoe), validar **no alojamento real** com
`npm run atlas:check-host -- <url> <origem>` (Range 206 + Content-Range, CORS, MIME, cache, ETag); não assumir que a
pasta pública do Netlify serve Range corretamente para ficheiros grandes. A ligação do mapa a esses tiles (fonte
`vector` no lugar dos blocos GeoJSON) fica para quando estiverem alojados.

## Interação, acessibilidade e gestos

- O atlas é um ecrã próprio do percurso *Prepara a tua jornada*: **arrastar move o mapa, pinch faz zoom** e nada
  disso muda de percurso. A mudança de percurso está em controlos explícitos no cabeçalho, fora do mapa
  (*Prepara a tua jornada* | *Gera a tua história*). Nenhum gesto é capturado no documento inteiro; o mapa só
  trata os gestos do seu canvas. No painel das histórias, o atlas entra como um cartão-ligação (SVG estático).
- Painel lateral (≥ 900 px) ou **bottom sheet** com três estados (recolhido, intermédio, expandido; arrastar ou
  tocar na pega). Rolar o painel não move o mapa (`overscroll-contain`). Com o painel a meio, o centro do mapa sobe
  para a seleção não ficar tapada; a atribuição fica sempre acima do painel.
- Controlos de ~44 px com nome acessível e foco visível: zoom, Norte, rodar, inclinar, 2D/3D, Ver Península,
  A minha localização (só pede permissão ao tocar), lista e Fontes. Teclado: o mapa aceita setas e +/−, Escape
  fecha a ficha ou o seletor, Enter na pesquisa abre o 1.º resultado.
- **Lista sincronizada** (alternativa ao canvas): mostra o que está desenhado na vista atual, com os mesmos filtros;
  selecionar na lista seleciona no mapa. `prefers-reduced-motion` desliga as animações de câmara.
- Sem WebGL: o atlas abre em modo lista (pesquisa, filtros, fichas e fluxos). Perda do contexto WebGL: aviso com
  "Recarregar mapa". DEM indisponível: aviso e passagem automática a 2D. Falha de dados ou do registo: aviso com
  nova tentativa. Mapa base indisponível: base Natural Earth.

## Integridade da informação

- A presença de água nunca indica autorização de pesca: sem zona documentada, a ficha diz "Consultar regras
  aplicáveis" com ligações a Licenças e lei e a Concessões e zonas. As zonas vêm de `src/data/zones.ts` (com fonte).
- Espécies, condições e características do catálogo são **dados de demonstração** e ficam isolados num bloco
  identificado; o atlas não mostra espécies, meteorologia, profundidade nem acessos sem fonte.
- Fotografia no cabeçalho só quando mostra o próprio local (identidade confirmada pelo pipeline ou Unsplash com
  `depicts: esta-albufeira`); caso contrário, cabeçalho cartográfico com a silhueta real à escala.
- Em Portugal indica-se o distrito e não a região NUTS II (os distritos não encaixam nas regiões).
- Não há capturas no mapa: nenhuma coordenada de captura privada é publicada.

## Verificações

```bash
npm run lint && npm run typecheck && npm test   # inclui src/lib/atlas/atlas.test.ts
npm run build && npx vite preview --port 4173 &
npm run e2e:atlas -- http://localhost:4173 screenshots/atlas
```

O e2e (Playwright, Chromium) cobre: vista inicial com volume e inclinação, níveis de detalhe e terreno local,
seleção no mapa com o ID correto e realce, fluxos de jornada e captura com o local pré-preenchido, regresso com a
seleção, lista sincronizada, pesquisa por nome alternativo/sem acentos/sem resultados, filtros, favoritas de locais
sem ficha, arrastar sem mudar de percurso, rotação/inclinação/Norte/2D/Península, telemóvel (bottom sheet, toque,
atribuição), tablet retrato e paisagem, e recuperação de erros (DEM, dados, registo, sem WebGL, localização recusada).

Capturas da última execução (Chromium headless, WebGL por software): `docs/atlas/capturas/` — vista inicial,
escala local, seleção, rio por troço, 2D, tablet, telemóvel, DEM indisponível e modo sem WebGL.

## Limitações e próximos passos

- Desempenho só medido em Chromium headless com SwiftShader (WebGL por CPU): ~4 frames/s durante animações, sem
  significado para dispositivos reais. Os objetivos de 30 fps (móvel intermédio) e 60 fps não foram verificados.
  O pixel ratio é limitado a 2 (1,5 em dispositivos com ≤ 4 núcleos ou ≤ 4 GB).
- Não testado em Safari/iOS real (barras do Safari tratadas com `dvh`/`visualViewport` e safe areas).
- Lagoas naturais, bacias (polígonos) e rios detalhados com ID estável dependem das fontes pendentes acima.
- `npm run build:artifact` (HTML único) já falhava antes do atlas: `scripts/inline-build.mjs` lê `public/icons/icon.svg`,
  que não existe no repositório.
- Os rios do atlas usam o traçado generalizado do Natural Earth; à escala local valem os rios do mapa base.
- Fichas e cartografia ligam-se por correspondência automática (nome + distância); nenhuma ligação foi revista
  por humano ainda.
