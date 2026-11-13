// Importação do Atlas da Carpa sobre a folha SINTÉTICA de testes (e2e/fixtures/carpa-sintetico.xlsx).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classify } from '../../src/lib/carpa/model'
import { buildCatalog, diffCatalogs, num, point, type Mapping } from './importer'
import { readXlsx } from './xlsx'

const FIX = 'e2e/fixtures/carpa-sintetico.xlsx'
const mapping = JSON.parse(readFileSync('scripts/carpa/mapeamento.json', 'utf8')) as Mapping
const sheets = readXlsx(new Uint8Array(readFileSync(FIX)))
const run = (corrections = []) => buildCatalog(sheets, mapping, { file: 'f.xlsx', sha256: 'x', importedAt: '2026-11-13', corrections })

describe('importação (folha sintética)', () => {
  const { catalog, report } = run()
  it('lê as dez folhas e dá a cada uma um papel', () => {
    expect(report.sheets.map((s) => s.role)).toEqual(['leia_me', 'inventario', 'candidatos', 'concessoes', 'exclusoes', 'cobertura', 'sintese', 'novidades', 'fontes_gis', 'auditoria'])
  })
  it('cada linha tem destino explícito ou motivo de exclusão', () => {
    const total = report.sheets.reduce((a, s) => a + s.rows, 0)
    expect(report.rows.length).toBe(total)
    expect(report.rows.every((r) => r.destination && (r.destination !== 'excluida' || r.reason))).toBe(true)
  })
  it('totais do inventário por país', () => {
    expect([report.totals.linhas_inventario, report.totals.linhas_inventario_pt, report.totals.linhas_inventario_es]).toEqual([11, 6, 5])
  })
  it('repetir a mesma importação dá o mesmo catálogo e zero alterações', () => {
    const again = run().catalog
    expect(JSON.stringify(again)).toBe(JSON.stringify(catalog))
    expect(Object.values(diffCatalogs(catalog, again)).every((d) => d.novos + d.alterados + d.removidos === 0)).toBe(true)
  })
  it('evidências independentes sobre o mesmo setor juntam-se sem duplicar', () => {
    const s = catalog.sectors.filter((x) => x.name.startsWith('Margem norte'))
    expect(s).toHaveLength(1)
    expect(s[0].provenance.map((p) => p.row).sort()).toEqual([7, 8])
    expect(catalog.evidence.filter((e) => e.sectorKey === s[0].key)).toHaveLength(2)
  })
  it('homónimos ficam separados e vão para revisão', () => {
    expect(catalog.waters.filter((w) => w.name === 'Embalse de San Juan')).toHaveLength(2)
    expect(report.review.some((r) => r.kind === 'homonimo')).toBe(true)
  })
  it('eixos trocados: revisão e sem coordenadas (nada inventado)', () => {
    expect(report.review.some((r) => r.kind === 'eixos-trocados')).toBe(true)
    const w = catalog.waters.find((x) => x.name.startsWith('Açude de Coimbra'))!
    expect(w.point).toBeNull()
    expect(catalog.sectors.find((s) => s.waterKey === w.key)!.precision).toBe('sem-coordenadas')
  })
  it('vírgula decimal, extremos A/B e precisão da localização', () => {
    expect(catalog.waters.find((w) => w.name === 'Albufeira de Castelo do Bode')!.point).toEqual([-8.247, 39.601])
    const s1 = catalog.sectors.find((s) => s.name === 'Setor S1 (sintético)')!
    expect(s1.precision).toBe('extremos-ab')
    expect(s1.a).toEqual([-8.2102, 40.3401])
    expect(catalog.sectors.find((s) => s.name === 'Tramo urbano (sintético)')!.precision).toBe('sem-coordenadas')
  })
  it('síntese a referir registo inexistente vai para revisão; exclusões e candidatos têm destino', () => {
    expect(report.review.some((r) => r.kind === 'sintese-sem-registo' && r.keys[0] === 'T-999')).toBe(true)
    expect(report.exclusions[0].reason).toContain('Açores')
    expect(report.candidates).toHaveLength(2)
    expect(report.lacunas.some((l) => l.includes('Embalse de Alcántara') && l.includes('sobreposição'))).toBe(true)
  })
  it('concessão extinta reconhecida', () => {
    expect(catalog.concessions.find((c) => c.name.includes('Castelo do Bode'))!.status).toBe('extinta')
  })
  it('regressões sobre o catálogo importado: Aguieira, Extremadura e termo de dezembro de 2026', () => {
    const sec = (n: string) => catalog.sectors.find((s) => s.name === n)!
    const s1 = sec('Setor S1 (sintético)'), s2 = sec('Setor S2 (sintético)')
    expect(classify(catalog, s1.waterKey, s1, '2026-11-20', 'carpfishing-noturno').permission.state).toBe('permitida')
    expect(classify(catalog, s1.waterKey, s1, '2026-11-20', 'pesca-individual').permission.state).toBe('por-confirmar')
    expect(classify(catalog, s2.waterKey, s2, '2026-11-20', 'provas').permission.state).toBe('permitida')
    const alc = catalog.sectors.find((s) => s.waterKey.includes('alcantara'))!
    const c = classify(catalog, alc.waterKey, alc, '2026-07-01', 'pesca-individual')
    expect(c.permission.state).toBe('por-confirmar')
    expect(c.permission.reasons.map((r) => r.code)).toContain('outra-especie')
    const cb = sec('Margem norte (sintético)')
    expect(classify(catalog, cb.waterKey, cb, '2026-12-31', 'pesca-individual').permission.state).toBe('permitida')
    expect(classify(catalog, cb.waterKey, cb, '2027-01-15', 'pesca-individual').permission.reasons[0].code).toBe('fora-de-vigencia')
    const val = catalog.sectors.find((s) => s.name === 'Zona de baño (sintético)')!
    expect(classify(catalog, val.waterKey, val, '2026-11-20', 'pesca-individual').permission.state).toBe('proibida')
  })
  it('correções humanas aplicam-se por chave estável e sobrevivem à reimportação', () => {
    const key = catalog.sectors.find((s) => s.name === 'Setor S1 (sintético)')!.key
    const fixed = run([{ key, set: { name: 'Setor S1 — nome revisto (sintético)' } }] as never)
    expect(fixed.catalog.sectors.find((s) => s.key === key)!.name).toBe('Setor S1 — nome revisto (sintético)')
    expect(fixed.catalog.sectors.find((s) => s.key === key)!.key).toBe(key)
  })
})

describe('entradas', () => {
  it('números com vírgula e DMS', () => {
    expect(num('39,601')).toBe(39.601)
    expect(num('39°36\'0"N')).toBeCloseTo(39.6, 5)
    expect(num('8°15\'W')).toBeCloseTo(-8.25, 5)
  })
  it('ordem dos eixos e âmbito', () => {
    expect(point(39.6, -8.25).p).toEqual([-8.25, 39.6])
    expect(point(-8.25, 39.6).issue).toBe('eixos-trocados')
    expect(point(37.7, -25.4).issue).toBe('fora-do-ambito')
  })
})

describe('comando de importação', () => {
  it('pré-visualização não escreve; --aplicar escreve; repetir não altera nada', () => {
    const dir = mkdtempSync(join(tmpdir(), 'carpa-'))
    const out = join(dir, 'catalogo.json')
    execFileSync('npx', ['tsx', 'scripts/carpa/import.ts', FIX, '--saida', out, '--relatorio', dir], { stdio: 'pipe' })
    expect(existsSync(out)).toBe(false)
    execFileSync('npx', ['tsx', 'scripts/carpa/import.ts', FIX, '--saida', out, '--relatorio', dir, '--aplicar'], { stdio: 'pipe' })
    const first = readFileSync(out, 'utf8')
    const log = execFileSync('npx', ['tsx', 'scripts/carpa/import.ts', FIX, '--saida', out, '--relatorio', dir, '--aplicar'], { encoding: 'utf8' })
    expect(readFileSync(out, 'utf8')).toBe(first)
    expect(log).toContain('waters: +0 ~0 -0')
    expect(existsSync(join(dir, 'RELATORIO_IMPORTACAO.md'))).toBe(true)
  }, 60000)
})
