# Auditoria de cobertura do Atlas Ibérico

Gerado por `npm run atlas:build` em 2026-11-06. Não editar à mão.

## Cartografia (cobertura A)

| Tipo | Elementos | Notas |
|---|---|---|
| Albufeiras (OSM, ≥ 5 ha) | 3137 | com nome: 1539; peninsulares: 3109; por país: ES: 1858 · PT+ES: 29 · PT: 1250 |
| Barragens com nome (estrutura, OSM) | 1104 | todas as estruturas (com e sem nome) aparecem no mapa à escala local |
| Açudes com nome (OSM) | 588 | idem |
| Rios principais (Natural Earth 10 m) | 36 | 8843 km em 110 troços |
| Lagos e lagoas naturais | 0 no registo | só como água do mapa base (OpenFreeMap/OSM) à escala local, sem ID estável |
| Bacias hidrográficas | 0 polígonos | bacia indicada como atributo (tabela de rios e fichas); limites oficiais pendentes |

Albufeiras por escalão de área: escalão 1: 11 · escalão 2: 33 · escalão 3: 171 · escalão 4: 307 · escalão 5: 2615.
Albufeiras peninsulares por distrito (PT) ou comunidade autónoma (ES): Andaluzia: 366 · Aragão: 158 · Astúrias: 27 · Aveiro: 33 · Beja: 215 · Braga: 31 · Bragança: 35 · Cantábria: 9 · Castela e Leão: 232 · Castela-Mancha: 203 · Castelo Branco: 76 · Catalunha: 187 · Coimbra: 12 · Comunidade Valenciana: 68 · Comunidade de Madrid: 57 · Estremadura: 325 · Faro: 110 · Galiza: 95 · Guarda: 41 · La Rioja: 19 · Leiria: 4 · Lisboa: 9 · Navarra: 38 · País Basco: 50 · Portalegre: 140 · Porto: 20 · Região de Múrcia: 39 · Santarém: 74 · Setúbal: 97 · Viana do Castelo: 13 · Vila Real: 30 · Viseu: 34 · Évora: 262.

## Catálogo CatchAtlas (cobertura B)

- Fichas: 108; ligadas a um contorno: 105; sem contorno (posição aproximada): 3; revistas por humano: 0.
- Fichas com estrutura física associada: 98.
- Tabela completa: `src/data/atlas/catalogLinks.json` (método e distância de cada ligação).

## Limitações conhecidas

- O registo não contém "todas as massas de água": contém as albufeiras ≥ 5 ha marcadas como tal no OSM em 2026-11-02, as estruturas de barragem/açude do OSM e os rios do Natural Earth.
- Lagos e lagoas naturais, troços de rio de escala local, bacias e concessões completas exigem fontes ainda não ingeridas (ver docs/ATLAS.md, "Expansão da cobertura").
- Os contornos são de referência: não indicam o nível atual da água.
