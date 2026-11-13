# «Os meus pins» · Mapa de pins

Separador novo em «Gera a tua história» (barra da área privada → **Os meus pins**, `/conta/meus-pins`).
O título do mapa é «Mapa de pins».

## Para o Rúben experimentar

1. Abrir a app → **Entrar** → **Experimentar sem email** (ou uma conta própria).
2. Na barra de «Gera a tua história», tocar em **Os meus pins**. O mapa abre na vista pessoal.
3. Conta vazia: tocar em **Marcar pin**. Abre o compositor do Atlas na mesma vista; guardar o pin e voltar ao separador.
4. Ligar **Incluir pins da comunidade** no topo: aparecem os reports públicos de outros pescadores. Desligar repõe a vista pessoal.
5. **Filtros** abre o painel completo: espécie, peso, datas e horas. Os filtros ativos aparecem como etiquetas, cada uma removível, com **Limpar todos**.
6. Tocar num número (grupo) para percorrer as fichas («3 de 10») com as setas, com gesto ou com o teclado.

## Ficheiros

| Ficheiro | O quê |
|---|---|
| `supabase/migrations/20261113000100_my_pins_search.sql` | Modo de partilha, zona estável, gatilhos de coerência e a função de pesquisa `search_pins` |
| `supabase/functions/community-share/index.ts` | Publicar com `mode` (`zona`, por omissão, ou `exato`), mudar de modo e retirar |
| `src/lib/lanca/pinSearch.ts` (+ `.test.ts`) | Regras de pesquisa (as mesmas do servidor), ordenação, contagens, etiquetas e chamada ao servidor |
| `src/screens/conta/MeusPins.tsx` | O ecrã: mapa, interruptor, pesquisa, filtros, contagens, fichas e lista acessível |
| `src/components/meuspins/layers.ts` | Símbolos, agrupamento, realce da zona e anel de seleção |
| `src/components/atlas/PinSheet.tsx` | Partilha com «Partilhar zona» / «Partilhar ponto exato» e pré-visualização |
| `src/screens/conta/Layout.tsx`, `src/App.tsx` | Entrada na navegação e rota |
| `e2e/meuspins.e2e.cjs` | Percurso no browser (iPad e telemóvel), com as respostas da pesquisa simuladas |
| `e2e/meuspins.backend.mjs` | Servidor real com duas sessões de teste |

## Decisões que afetam a precisão pública e as contagens

- **Fonte de verdade no servidor.** `search_pins` (security definer) devolve:
  - os registos do próprio pescador com o ponto exato;
  - com a comunidade ligada, os reports públicos de terceiros **na precisão que cada autor escolheu**.

  As colunas do ponto exato em `shared_reports` não são legíveis diretamente.
- **Zona pública.** É uma quadrícula estável de 0,05° (~5,6 km), com identificador `i:j`. O ponto representativo é o centro da quadrícula e depende só da zona: é o mesmo ao recarregar, ao aproximar ou com vários reports na mesma zona. O zoom nunca acrescenta precisão. Filtros, agrupamentos e contagens públicas usam este ponto.
- **Coerência.** Editar, mover ou mudar a captura de um report partilhado atualiza a versão pública através de gatilhos. Mudar de exato para zona apaga o ponto exato da versão pública. Retirar a partilha (tornar privado) remove a versão pública e a fotografia partilhada, e o diário fica intacto.
- **Sem consentimento, só a zona.** As partilhas antigas ficam com o modo «zona». Os reports novos começam privados.
- **Contagens.**
  - «N resultados» conta toda a pesquisa autorizada, mesmo fora do enquadramento.
  - «N nesta área» conta os pontos de apresentação autorizados dentro da área visível.
  - Os dois valores são calculados sobre o conjunto completo, antes de limitar linhas ou agrupar.
  - Mover o mapa muda só o segundo.
  - Cada registo conta uma vez pelo identificador: um report próprio que também é público vem só como próprio.
- **Datas e horas.**
  - A data e a hora usadas são as locais do sítio da captura (fuso do registo); a hora de criação nunca entra.
  - O fim da janela horária inclui todo o minuto final.
  - Uma janela 22h–02h atribui a madrugada ao dia em que começou.
  - A repetição anual compara só mês e dia e dá a volta de dezembro para janeiro; 29 de fevereiro só existe em anos bissextos.
- **Dados em falta.** Um critério que exige um dado (espécie, peso, data, hora, local) exclui os registos que não o têm. Sem esse critério, não exclui nada.
- **Peso.** «Mais de» e «menos de» excluem o valor exato. O peso aceita vírgula decimal e é comparado em gramas.

## Testes

| Cenário | Esperado | Observado | Evidência | Tipo | Estado |
|---|---|---|---|---|---|
| «Os meus pins» uma vez na navegação (iPad e telemóvel); abre em vista pessoal | 1 entrada; comunidade desligada | Como esperado | `e2e/meuspins.e2e.cjs` | Browser (simulação da pesquisa) | ✅ |
| Conta vazia mostra mapa e «Marcar pin» | Visível | Visível | idem | Browser (simulação) | ✅ |
| 2 → 10 → 2 ao alternar a comunidade | 2, 10, 2 | 2, 10, 2 | idem | Browser (simulação) | ✅ |
| Rede lenta: desligar antes da resposta | Sem resultados tardios | total 2, 0 pontos de terceiros | idem | Browser (simulação) | ✅ |
| Centro e zoom sobrevivem à mudança de vista | Iguais | Iguais | idem | Browser (simulação) | ✅ |
| 8 coincidentes → pin «8»; «3 de 8»; ordem por data; zona realçada | Como pedido | Como pedido | idem | Browser (simulação) | ✅ |
| Desligar a comunidade com ficha de terceiro aberta | Ficha e realce desaparecem | Desaparecem | idem | Browser (simulação) | ✅ |
| Filtros chegam ao servidor; chips; remover um; limpar todos | Como pedido | Como pedido | idem | Browser (simulação) | ✅ |
| Mover o mapa muda só «nesta área» | Total igual | 2→2; área 2→0 | idem | Browser (simulação) | ✅ |
| Carpas 1,9/2/2,1 kg e achigã 3 kg (espécie 3, >2 kg 2, 07–12 h 3, juntos 1, <2 kg 1) | 3/2/3/1/1 | 3/2/3/1/1 | `pinSearch.test.ts` | Unitário (regras do cliente) | ✅ |
| Peso desconhecido, pesqueiro isolado, remover filtro, zero | Como pedido | Como pedido | idem | Unitário | ✅ |
| 12h00 incluído / 12h01 excluído; 22h–02h no dia 13 | Inclui / exclui | Como pedido | idem | Unitário | ✅ |
| 13 fev–20 mar (limites, anual), Portugal/Espanha, registo tardio, 29 fev, dez→jan | Como pedido | Como pedido | idem | Unitário | ✅ |
| Mesmo minuto ordena pelo ID; total 10 / área 7 sem duplicados | Como pedido | Como pedido | idem | Unitário | ✅ |
| Os mesmos cenários **no servidor real** (2→10→2, carpas, pesos, horas, 22h–02h, datas, anual, PT/ES, 29 fev, dez→jan, ordem); conteúdo entregue à 2.ª conta; colunas exatas ilegíveis; exato → zona → privado; mover report partilhado | Ver script | 30/30 | `e2e/meuspins.backend.mjs` | Servidor real (2 sessões de teste) | ✅ |
| Castelo do Bode / margem espanhola, rodar, 2D/3D, GPS recusado, editar, eliminar, rede, rascunho | Já cobertos no fluxo «Marcar pin» | — | `e2e/marcar.e2e.cjs` (versão anterior) | Browser | Reutilizado; não repetido neste ecrã |
| Tempo até mapa manipulável e latência ao tocar com muitos pins | p75 ≤ 2,5 s; p95 ≤ 100 ms | — | — | Medição | ⏳ pendente: precisa de um aparelho real |

Para reproduzir:

- **Servidor:** `NODE_USE_ENV_PROXY=1 node e2e/meuspins.backend.mjs` (migração e função já publicadas).
- **Browser:** `npm run build && npx vite preview --port 4173 &`, depois `node e2e/meuspins.e2e.cjs`.

## Limitações conhecidas

- **Realce da zona.** É a quadrícula pública em turquesa suave, mas **não está recortada pela margem nem pelas ilhas**: no servidor não existe geometria da água para fazer o recorte. O realce também cobre terra dentro da quadrícula, e o ponto representativo pode ficar em terra em albufeiras estreitas. Recortar com a cartografia do Atlas e pôr o ponto dentro da água fica por fazer.
- **«Marcar pin».** Usa o compositor do Atlas (o mesmo fluxo, rascunhos e sincronização), em vez de um compositor dentro deste ecrã.
- **Idioma.** A interface está em português de Portugal. A app ainda não tem sistema de idiomas para Espanha, por isso não há tradução.
