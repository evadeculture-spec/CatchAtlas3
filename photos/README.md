# Fotografias das albufeiras

Pipeline em `scripts/photos/pipeline.ts`. Corre num ambiente com acesso a `commons.wikimedia.org` e `upload.wikimedia.org`.

1. `npm run photos -- discover [--dam orellana] [--limit 20] [--dry-run]`: pesquisa no Wikimedia Commons por nome, tipo (albufeira/embalse), rio e coordenadas; guarda candidatos em `candidates.json` com autor, licença, data de captação documentada, coordenadas, categorias, checksum e sugestões automáticas de identidade e direitos. Idempotente: não duplica candidatos.
2. Curadoria humana em `curation.json`: ver a imagem na página de origem, confirmar o local e a licença, escolher a função (capa, margens, estruturas, aérea) e o ponto focal. Só aqui uma fotografia passa a `confirmado` + `aprovado` + `publicado`.
3. `npm run photos -- derive`: descarrega apenas de `upload.wikimedia.org` (sem redirecionamentos, até 60 MB), confirma o checksum e o formato real, e gera variantes WebP/JPEG (640, 1280, 1920 px) sem EXIF/GPS em `public/photos/<barragem>/`.
4. `npm run photos -- publish`: gera `src/data/photos/catalog.json` só com fotografias aprovadas e com derivados. Interrompe se a mesma imagem estiver ligada a albufeiras não adjacentes.
5. `npm run photos -- audit`: escreve `coverage.json` com a cobertura e as pendências.

Cada execução fica registada em `runs/`. A cache da API e os originais não são versionados.
