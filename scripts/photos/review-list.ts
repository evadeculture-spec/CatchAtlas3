// Gera photos/REVISAO.md: ligações de pesquisa no Wikimedia Commons por barragem, para curadoria humana.
import { writeFileSync } from 'node:fs'
import { DAMS } from '../../src/data/dams'

const media = (q: string) => `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(q)}&title=Special:MediaSearch&type=image`
const found: Record<string, string[]> = {
  orellana: [
    'https://commons.wikimedia.org/wiki/Category:Orellana_Reservoir',
    'https://commons.wikimedia.org/wiki/File:BA-Orellana_la_Vieja_13.jpg',
    'https://commons.wikimedia.org/wiki/File:Vista_a%C3%A9rea_La_Serena_y_Orellana.jpg (vista aérea; também mostra La Serena)',
  ],
}
const lines = [
  '# Revisão de fotografias de margem',
  '',
  'Para cada barragem: abrir a pesquisa, escolher uma fotografia que mostre água e margem da albufeira certa, confirmar na página do ficheiro o autor, a licença (CC0, domínio público, CC BY ou CC BY-SA) e, se existir, a localização. Depois registar a decisão em `curation.json` (ou correr `npm run photos -- discover --dam <id>` num ambiente com acesso ao Commons).',
  '',
]
for (const d of DAMS) {
  const kind = d.country === 'PT' ? 'Albufeira' : 'Embalse'
  lines.push(`## ${d.name} (${d.id})`, `- Pesquisa: ${media(`${kind} de ${d.name}`)}`, `- Pesquisa alternativa: ${media(`${d.name} ${d.river.replace(/^(Rio|Arroyo|Ribeira) /, '')}`)}`)
  for (const f of found[d.id] ?? []) lines.push(`- Candidato encontrado (por rever): ${f}`)
  if (d.id === 'sierra-brava') lines.push('- Candidato manual em `manual-candidates.json` (direitos por verificar).')
  lines.push('')
}
writeFileSync(new URL('../../photos/REVISAO.md', import.meta.url), lines.join('\n'))
console.log(`REVISAO.md: ${DAMS.length} barragens`)
