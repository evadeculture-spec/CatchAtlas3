# Modo imersivo do Atlas (barras flutuantes adaptativas)

O mapa é o produto. Quando o utilizador começa a explorar o mapa com zoom, rotação ou inclinação, a interface recolhe-se para duas barras de vidro. Volta a expandir-se apenas por ação explícita ou quando se abre uma ficha.

## Componentes encontrados

- **Motor:** MapLibre GL 6, em `src/components/atlas/AtlasMap.tsx`. O 2D e o 3D (com terreno DEM) usam a mesma instância. A interface nunca recria o mapa.
- **Ecrã:** `src/screens/Atlas.tsx`. O estado fica no URL (filtros, país, favoritas, modo 2D/3D, camadas, seleção) e em React local (painel, compositor, menus).
- **Cabeçalho:** menu, Jornada/História, pesquisa e filtros (`AtlasFilters`). Ocupa cerca de 190 px no telemóvel.
- **Coluna direita:** `AtlasControls`, com 2D/3D, camadas, posição, zoom, orientação, Península, lista e fontes.
- **Painel inferior:** `BottomSheet` («Explorar águas», fichas e lista) e o botão «Marcar pin». No computador, é um painel lateral.

## O que mudou

| Ficheiro | Alteração |
|---|---|
| `src/components/atlas/AtlasMap.tsx` | Novo `onUserCamera(kind)`. É disparado só em gestos reais: `zoomstart`, `dragstart`, `rotatestart` e `pitchstart` com `originalEvent`, mais o evento `wheel`. Os movimentos programáticos (`flyTo`, ajustes, dados) não disparam. |
| `src/components/atlas/FloatingBars.tsx` (novo) | `FloatingTopBar` (menu, pesquisa, filtros com contador, «Mais»), `MoreMenu` (Jornada/História, 2D/3D, camadas, posição, norte, Península, lista, fontes, «Mostrar todos os controlos») e `FloatingBottomBar` (Explorar águas ou título da ficha, Pins, Marcar pin). |
| `src/screens/Atlas.tsx` | Estado `compact` e controlador de interação, descritos abaixo. |
| `src/index.css` | Animações de entrada (`pop`, `float-in-top`, `float-in-bottom`). |
| `e2e/imersivo.e2e.cjs` (novo) | Cenários A–I com gestos de toque reais. |

## Regras de transição (controlador)

- **Passa a compacto** com:
  - pinça, roda do rato, duplo toque e teclado (`+`/`-`, Shift+setas);
  - rotação e inclinação;
  - os botões «Aproximar» e «Afastar».
- **Arrastar não muda o estado.** Num mapa já compacto, a interface continua compacta.
- **Não recolhe** em três casos:
  - quando o foco está num campo de texto: a pesquisa, o foco e o teclado mantêm-se;
  - durante a marcação de um pin, porque o compositor tem os seus próprios passos;
  - com o pedido de entrada aberto.
- **Volta a expandido** quando:
  - se toca na lupa (expande e foca o campo no mesmo toque, para o teclado abrir no iOS);
  - se toca em «Explorar águas» (abre a lista da vista);
  - se escolhe «Mostrar todos os controlos»;
  - se abre uma ficha (água, pin, carpa, report, seletor).
- **Sem renderizações extra durante o gesto.** `setCompact(true)` com o mesmo valor não volta a renderizar.
- **Câmara intacta.** O padding do mapa só serve para enquadramentos futuros, por isso a câmara não salta ao mudar de modo.
- **Escape ou toque fora** fecha os menus flutuantes. Não há camada por cima do mapa, por isso os gestos passam sempre.

## Desenho

- **Vidro:** `bg-[#0a2230]/60`, `backdrop-blur-xl`, `backdrop-saturate-150`, contorno `white/15` e sombra suave.
  - A transparência é só do fundo; o texto e os ícones são opacos.
  - Sem `backdrop-filter`, o fundo fica a 92 %.
- **Medidas:** barra superior com 52 px de altura; barra inferior com 56 px. Todos os alvos têm pelo menos 44 × 44 px, incluindo a 320 px de largura. As barras respeitam as safe areas.
- **Animações:** 160–200 ms. Desligadas com `prefers-reduced-motion`. Não há animação durante o movimento da câmara: só a interface entra e sai.
- **Ecrãs estreitos:** abaixo de 360 px, «Filtros» e «Explorar águas» ficam só com ícone. Os nomes acessíveis mantêm-se.

## Testes executados

Build de produção servida localmente, Chromium do Playwright, WebGL por software. Toque real via CDP (`Input.dispatchTouchEvent`).

`e2e/imersivo.e2e.cjs`: **32/32**.

- A: estado inicial expandido.
- B: pinça recolhe.
- C: arrastos e pinças mantêm compacto. A área útil do mapa é 85 % da altura a 390 px.
- D: pesquisa pela barra; a pinça durante a escrita mantém o foco.
- E: pin marcado a partir da barra inferior, a 0,000 m da mira, sincronizado; a sessão de teste foi apagada no fim.
- F: 3D com pinça, rotação e inclinação.
- G: três ciclos sem perda de filtros nem nova instância do mapa.
- H: 320, 375, 390 e 430 px, tablet 820 px e computador 1440 px.
- I: camadas, 2D/3D, Pins e bússola.

**Não verificado:** Safari iOS e Chrome Android em aparelhos reais. Não há dispositivos nesta sessão.
