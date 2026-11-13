/**
 * Importação do Excel do Atlas Ibérico da Carpa.
 *
 *   npm run carpa:import -- data/carpa/Atlas-Iberico-Carpa-Atualizado-11-11-2026.xlsx            # pré-visualização (não escreve)
 *   npm run carpa:import -- data/carpa/Atlas-Iberico-Carpa-Atualizado-11-11-2026.xlsx --aplicar  # escreve o catálogo
 *
 * Opções: --saida <catalogo.json> (omissão: public/data/carpa/catalogo.json), --relatorio <pasta> (omissão: data/carpa).
 * Escreve só com --aplicar, por ficheiro temporário + renomear (uma falha a meio deixa o catálogo anterior intacto).
 * As correções humanas ficam em data/carpa/correcoes.json e são reaplicadas em cada importação.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CarpCatalog } from '../../src/lib/carpa/model'
import { buildCatalog, diffCatalogs, type AtlasIndexItem, type Correction, type ImportReport, type Mapping } from './importer'
import { readXlsx } from './xlsx'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const apply = args.includes('--aplicar')
const opt = (name: string, def: string) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}
const out = opt('--saida', 'public/data/carpa/catalogo.json')
const reportDir = opt('--relatorio', 'data/carpa')
if (!file) {
  console.error('Uso: npm run carpa:import -- <ficheiro.xlsx> [--aplicar] [--saida public/data/carpa/catalogo.json]')
  console.error('Coloque o Excel em data/carpa/ (ex.: data/carpa/Atlas-Iberico-Carpa-Atualizado-11-11-2026.xlsx).')
  process.exit(2)
}
if (!existsSync(file)) {
  console.error(`Ficheiro não encontrado: ${file}`)
  process.exit(2)
}

const buf = readFileSync(file)
const sha256 = createHash('sha256').update(buf).digest('hex')
const mapping = JSON.parse(readFileSync(new URL('./mapeamento.json', import.meta.url), 'utf8')) as Mapping
const correctionsPath = join(reportDir, 'correcoes.json')
const corrections: Correction[] = existsSync(correctionsPath) ? JSON.parse(readFileSync(correctionsPath, 'utf8')) : []

// Índice mínimo da cartografia do Atlas (identificadores OSM e nomes) para cruzar águas.
let atlas: AtlasIndexItem[] | undefined
if (existsSync('public/map/atlas/registry.json')) {
  const reg = JSON.parse(readFileSync('public/map/atlas/registry.json', 'utf8')) as { rows: unknown[][] }
  atlas = reg.rows.map((r) => ({
    id: String(r[0]),
    name: String(r[2] ?? ''),
    alt: r[3] ? String(r[3]).split('|') : [],
    country: String(r[4] ?? ''),
    bbox: r[6] as [number, number, number, number],
    refs: r[12] ? String(r[12]).split('|').map((x) => x.split('~')[1]) : [],
  }))
}

const sheets = readXlsx(new Uint8Array(buf))
const { catalog, report } = buildCatalog(sheets, mapping, { file: file.split('/').pop()!, sha256, importedAt: new Date().toISOString().slice(0, 10), atlas, corrections })
const prev: CarpCatalog | null = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null
const diff = diffCatalogs(prev, catalog)

// ---------------------------------------------------------------- resumo no terminal
const t = report.totals
console.log(`\nEdição: ${file} (sha256 ${sha256.slice(0, 12)}…)`)
console.log('\nFolhas:')
for (const s of report.sheets) console.log(`  · ${s.name} → ${s.role} (${s.rows} linhas; cabeçalho na linha ${s.headerRow ?? '—'}${s.unmapped.length ? `; colunas não reconhecidas: ${s.unmapped.join(', ')}` : ''})`)
console.log(`\nInventário: ${t.linhas_inventario} linhas (PT ${t.linhas_inventario_pt}, ES ${t.linhas_inventario_es}) → ${t.aguas} águas (PT ${t.aguas_pt}, ES ${t.aguas_es}), ${t.setores} setores (${t.setores_extremos_ab} com extremos A/B, ${t.setores_sem_coordenadas} sem coordenadas)`)
console.log(`Regras ${t.regras} · fontes ${t.fontes} · concessões ${t.concessoes} · candidatos ${t.candidatos} · exclusões ${t.exclusoes} · revisão ${t.revisao} · ligadas ao Atlas ${t.aguas_ligadas_atlas}`)
const dest = report.rows.reduce<Record<string, number>>((a, r) => ((a[r.destination] = (a[r.destination] ?? 0) + 1), a), {})
console.log(`Destino das linhas: ${Object.entries(dest).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
console.log('\nAlterações face ao catálogo atual (por chave estável):')
for (const [k, v] of Object.entries(diff)) console.log(`  · ${k}: +${v.novos} ~${v.alterados} -${v.removidos}`)

if (!apply) {
  console.log('\nPré-visualização: nada foi escrito. Para importar, repita com --aplicar.')
  process.exit(0)
}

// ---------------------------------------------------------------- escrita atómica
const writeAtomic = (path: string, data: string) => {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, data)
  renameSync(tmp, path)
}
writeAtomic(out, JSON.stringify(catalog))
writeAtomic(join(reportDir, 'importacao.json'), JSON.stringify({ ...report, diff, sha256, file }, null, 2))
writeAtomic(join(reportDir, 'RELATORIO_IMPORTACAO.md'), markdown(report, diff))
console.log(`\nCatálogo escrito em ${out}; relatório em ${join(reportDir, 'RELATORIO_IMPORTACAO.md')}.`)

function markdown(r: ImportReport, d: ReturnType<typeof diffCatalogs>) {
  const lines = [`# Relatório de importação — ${file}`, '', `sha256 \`${sha256}\``, '', '## Folhas', '', '| Folha | Papel | Linhas | Cabeçalho | Não reconhecidas |', '|---|---|---|---|---|']
  for (const s of r.sheets) lines.push(`| ${s.name} | ${s.role} | ${s.rows} | ${s.headerRow ?? '—'} | ${s.unmapped.join(', ') || '—'} |`)
  lines.push('', '## Totais', '', '| Medida | Valor |', '|---|---|', ...Object.entries(r.totals).map(([k, v]) => `| ${k} | ${v} |`))
  lines.push('', '## Destino das linhas', '', ...Object.entries(r.rows.reduce<Record<string, number>>((a, x) => ((a[x.destination] = (a[x.destination] ?? 0) + 1), a), {})).map(([k, v]) => `- ${k}: ${v}`))
  lines.push('', '## Alterações (chave estável)', '', ...Object.entries(d).map(([k, v]) => `- ${k}: +${v.novos} ~${v.alterados} -${v.removidos}`))
  lines.push('', `## Revisão (${r.review.length})`, '', ...r.review.map((x) => `- **${x.kind}** — ${x.detail} (${x.rows.map((p) => `${p.sheet}:${p.row}`).join(', ')})`))
  lines.push('', `## Exclusões (${r.exclusions.length})`, '', ...r.exclusions.map((x) => `- ${x.sheet}:${x.row} — ${x.reason}`))
  lines.push('', `## Lacunas (${r.lacunas.length})`, '', ...r.lacunas.map((x) => `- ${x}`))
  return lines.join('\n') + '\n'
}
