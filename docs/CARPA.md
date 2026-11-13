# Camada «Carpa» no Atlas Ibérico 3D

Integração da pesquisa sobre a carpa (*Cyprinus carpio*) na app existente. O mapa 3D do Atlas é a entrada. O mapa, a pesquisa do Atlas e a lista lêem o **mesmo catálogo importado** (`/data/carpa/catalogo.json`) e abrem a **mesma ficha**, pela chave estável do setor (`?carpa=<chave>`).

> Nome: o pedido chama ao produto **Lanceo**, mas o repositório e a interface usam «Lança Lance» (`src/config/brand.ts`). Preservei a identidade visual existente e não renomeei a marca: mudar o nome é uma decisão à parte.

## Estado do Excel

O ficheiro `Atlas-Iberico-Carpa-Atualizado-11-11-2026.xlsx` **não estava disponível** nesta sessão. Procurei no disco, nos anexos, em todos os ramos do repositório e no GitHub.

Tudo o que não depende dele foi implementado e testado com uma folha **sintética** com a mesma estrutura de dez folhas (`e2e/fixtures/carpa-sintetico.xlsx`, só para testes, gerada por `npm run carpa:fixture`). O catálogo da app está vazio (`public/data/carpa/catalogo.json`) até à importação real, e a camada diz «Catálogo da carpa por importar».

Para concluir com o Excel real:

```bash
# 1. Colocar o ficheiro (não é versionado: data/carpa/*.xlsx está no .gitignore)
cp ~/Downloads/Atlas-Iberico-Carpa-Atualizado-11-11-2026.xlsx data/carpa/
# 2. Pré-visualização (não escreve nada): folhas, colunas reconhecidas e não reconhecidas, totais, diferenças
npm run carpa:import -- data/carpa/Atlas-Iberico-Carpa-Atualizado-11-11-2026.xlsx
# 3. Se houver colunas não reconhecidas, acrescentar sinónimos em scripts/carpa/mapeamento.json e repetir o passo 2
# 4. Importar (escrita atómica do catálogo + relatório em data/carpa/RELATORIO_IMPORTACAO.md e importacao.json)
npm run carpa:import -- data/carpa/Atlas-Iberico-Carpa-Atualizado-11-11-2026.xlsx --aplicar
# 5. Repetir o passo 4: o resumo deve mostrar «+0 ~0 -0» em todas as entidades (zero duplicados)
```

Totais esperados da edição de 11/11: 375 registos em «Águas e setores» (100 PT, 275 ES), 39 candidatos e 91 referências de zonas de pesca lúdica PT. A pré-visualização mede os totais reais, e o relatório explica qualquer diferença linha a linha (destino ou motivo de exclusão).

## Arquitetura (o mínimo de módulos)

| Peça | Ficheiro | O quê |
|---|---|---|
| Regra de decisão | `src/lib/carpa/model.ts` | Presença, permissão e acesso calculados à parte; estado por data e modalidade; textos PT/ES |
| Importação | `scripts/carpa/xlsx.ts`, `importer.ts`, `import.ts`, `mapeamento.json` | Leitor .xlsx (fflate, sem dependências novas), mapeamento configurável, chaves estáveis, revisão, correções humanas, escrita atómica |
| Catálogo | `public/data/carpa/catalogo.json` | Ficheiro estático versionado, como o registo do Atlas: sem segunda base de dados nem fornecedor novo |
| Correções humanas | `data/carpa/correcoes.json` | `{ key, set, autor, data, motivo }`, aplicadas por chave em cada importação e nunca reescritas |
| Mapa e ficha | `src/components/carpa/data.ts`, `CarpSheet.tsx`, `src/screens/Atlas.tsx` | Camada na mesma cena 3D, ficha, lista, filtros, pesquisa |
| Pin ↔ setor | `supabase/migrations/20261113000200_carp_sector_link.sql`, `fieldPins.ts`, `PinComposer.tsx`, `PinSheet.tsx` | `carp_sector_key` opcional em `pins`/`pings`, com RLS por dono (já existente) |

Decisões:
- **Identidade.** É o identificador oficial quando existe. Senão, `país:nome-normalizado[:província]` para a água e `água/setor` para o setor. Nunca o número da linha.
- **Ambiguidades.** Homónimos, várias águas do Atlas possíveis, eixos trocados, coordenadas fora do âmbito, candidatos e referências da síntese sem registo vão para a lista de revisão do relatório. Nada é fundido nem inventado.
- **Cruzamento com a cartografia.** Pelo identificador oficial e, na falta dele, por nome + país + ponto dentro do contorno da água do Atlas. Fica guardado em `atlasId`.
- **Geometria.** Os extremos A/B são os limites conhecidos do setor; não se traça percurso de margem. Um ponto num registo sem setor localiza só a água. Sem coordenadas, o setor fica em «Localização por confirmar» e continua pesquisável na lista.
- **Decisão «Pesca permitida».** Exige uma regra de fonte competente para a espécie, o setor (ou a água inteira), a modalidade e a data, dentro da vigência.
  - Uma regra sem termo expresso só confirma com verificação independente (a data de importação não conta).
  - Uma concessão extinta invalida o título.
  - Uma proibição expressa tem estado próprio.
  - Conflito sem resolução, regra caducada, outra espécie, outra modalidade ou outro setor dão «Por confirmar», com a razão.
- **Pins pessoais.** Ficam no servidor, ligados ao setor só pela chave. Marcar um pin nunca altera o catálogo nem a classificação pública.

## Testes executados

### Antes da integração (commit `8c866a8`, build de base)

| Suíte | Resultado | Notas |
|---|---|---|
| Unitários (`npx vitest run`) | 116/116 | |
| Sessões de teste (`e2e/guest.e2e.cjs`) | 16/16 | Login, Atlas, marcar pin com foto, sincronização, diário ↔ mapa, partilha, apagar |
| «Os meus pins», browser (`e2e/meuspins.e2e.cjs`) | 40/40 | Pesquisa simulada; navegação, filtros e fichas reais |
| «Os meus pins», servidor real (`e2e/meuspins.backend.mjs`) | 30/30 | Duas sessões reais |
| Atlas (`e2e/atlas.e2e.cjs`) | 58/58 | |
| Lint (`npx eslint .`) | 1 erro preexistente | `any` em `supabase/functions/guest-session/index.ts` (corrigido no repositório) |
| `e2e/marcar`, `lanca`, `backend`, `perf`, `load` | Bloqueados | Precisam das contas `E2E_A_*`/`E2E_B_*`, que foram apagadas |

### Depois da integração (mesma configuração)

| Suíte | Resultado | Tipo |
|---|---|---|
| Unitários | 145/145 (116 anteriores + 14 regra + 15 importação) | Automatizado |
| Sessões de teste | 16/16 | Browser + servidor real |
| «Os meus pins», browser | 40/40 | Browser; pesquisa simulada |
| «Os meus pins», servidor real | 30/30 | Servidor real |
| Atlas | 58/58 | Browser |
| Carpa, telemóvel (`e2e/carpa.e2e.cjs`, em `npm run dev`) | 15/15 | Browser + servidor real; catálogo SINTÉTICO |
| Carpa 3D, iPad (`e2e/carpa3d.e2e.cjs`, em `npm run dev` e na build) | 3/3 + 3/3 | Browser; terreno ativo; catálogo SINTÉTICO |
| Lint | 0 erros | Automatizado |
| Build | OK | Automatizado |

Medição: recalcular o estado de 375 setores (1 125 regras sintéticas) ao mudar a data custa 3,1 ms de mediana e 17,4 ms no p95. Foram 20 repetições, com a máquina carregada por um teste de browser em paralelo, em Node 22 neste contentor.

Comandos:

```bash
npx vitest run                                                   # unitários (inclui regra e importação)
npm run dev -- --port 5173 &                                     # entrada habitual
NODE_USE_ENV_PROXY=1 node e2e/carpa.e2e.cjs http://localhost:5173 screenshots/carpa
```

`NODE_USE_ENV_PROXY=1` só é preciso atrás de um proxy de saída, como neste contentor.
