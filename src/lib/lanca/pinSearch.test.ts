import { describe, expect, it } from 'vitest'
import { activeChips, EMPTY_FILTER, matches, mergeLocal, minutesOf, parseKg, removeChip, sortReports, type PinFilter, type PinRow } from './pinSearch'

const LX = 'Europe/Lisbon'
const MD = 'Europe/Madrid'
const row = (id: string, o: Partial<PinRow>): PinRow => ({
  source: 'mine', id, kind: 'captura', lat: 39.6, lng: -8.25, precision: 'exato', visibility: 'privado', species: null, weight_g: null,
  occurred_at: null, occurred_tz: LX, zone_id: null, water_body_ref: 'cb', water_body_name: 'Castelo do Bode', photo_path: null, photo_bucket: null, label: null, ...o,
})
const F = (o: Partial<PinFilter>): PinFilter => ({ ...EMPTY_FILTER, ...o })
const count = (rows: PinRow[], f: PinFilter) => rows.filter((r) => matches(r, f)).length

// Inverno em Lisboa = UTC (sem horário de verão em fevereiro).
const carpas = [
  row('c1', { species: 'Carpa', weight_g: 1900, occurred_at: '2025-02-10T07:00:00Z' }),
  row('c2', { species: 'Carpa', weight_g: 2000, occurred_at: '2025-02-10T09:00:00Z' }),
  row('c3', { species: 'Carpa', weight_g: 2100, occurred_at: '2025-02-10T11:00:00Z' }),
  row('a1', { species: 'Achigã', weight_g: 3000, occurred_at: '2025-02-10T14:00:00Z' }),
]

describe('pesquisa: espécie, peso e horas (critérios do Prompt Master)', () => {
  it('só carpa = 3; só > 2 kg = 2; só 07h–12h = 3; os três juntos = 1', () => {
    expect(count(carpas, F({ species: ['Carpa'] }))).toBe(3)
    expect(count(carpas, F({ weight: { op: 'gt', grams: 2000 } }))).toBe(2)
    expect(count(carpas, F({ timeFrom: '07:00', timeTo: '12:00' }))).toBe(3)
    expect(count(carpas, F({ species: ['carpa'], weight: { op: 'gt', grams: 2000 }, timeFrom: '07:00', timeTo: '12:00' }))).toBe(1)
  })
  it('menos de 2 kg = 1 e exatamente 2 kg = 1 (o valor exato não é «mais de» nem «menos de»)', () => {
    expect(count(carpas, F({ weight: { op: 'lt', grams: 2000 } }))).toBe(1)
    expect(count(carpas, F({ weight: { op: 'eq', grams: 2000 } }))).toBe(1)
  })
  it('peso desconhecido: elegível sem filtro de peso, excluído com filtro de peso', () => {
    const rows = [...carpas, row('u', { species: 'Carpa', weight_g: null, occurred_at: '2025-02-10T08:00:00Z' })]
    expect(count(rows, F({ species: ['Carpa'] }))).toBe(4)
    expect(count(rows, F({ weight: { op: 'lt', grams: 99999 } }))).toBe(4)
  })
  it('pesqueiro isolado (sem captura): conta sem filtros, sai quando a pesquisa exige espécie ou peso', () => {
    const rows = [...carpas, row('p', { kind: 'local', species: null })]
    expect(count(rows, EMPTY_FILTER)).toBe(5)
    expect(count(rows, F({ species: ['Carpa'] }))).toBe(3)
  })
  it('retirar um filtro repõe o resultado; filtros sem correspondência dão zero', () => {
    const f = F({ species: ['Carpa'], weight: { op: 'gt', grams: 2000 } })
    expect(count(carpas, f)).toBe(1)
    expect(count(carpas, removeChip(f, 'weight'))).toBe(3)
    expect(count(carpas, F({ species: ['Lúcio'] }))).toBe(0)
  })
  it('fim às 12h00 inclui 12h00 e exclui 12h01', () => {
    const rows = [row('x', { occurred_at: '2025-02-10T12:00:00Z' }), row('y', { occurred_at: '2025-02-10T12:01:00Z' })]
    expect(rows.filter((r) => matches(r, F({ timeFrom: '07:00', timeTo: '12:00' }))).map((r) => r.id)).toEqual(['x'])
  })
})

describe('pesquisa: janela noturna 22h–02h', () => {
  const rows = [
    row('d13-23h', { occurred_at: '2025-02-13T23:00:00Z' }),
    row('d14-01h', { occurred_at: '2025-02-14T01:00:00Z' }),
    row('d13-01h', { occurred_at: '2025-02-13T01:00:00Z' }),
    row('d14-23h', { occurred_at: '2025-02-14T23:00:00Z' }),
  ]
  it('selecionar só o dia 13 inclui 23h do dia 13 e 01h do dia 14; exclui a madrugada do dia 13', () => {
    const f = F({ dateFrom: '2025-02-13', dateTo: '2025-02-13', timeFrom: '22:00', timeTo: '02:00' })
    expect(rows.filter((r) => matches(r, f)).map((r) => r.id)).toEqual(['d13-23h', 'd14-01h'])
  })
})

describe('pesquisa: datas', () => {
  // 12/13 fev e 20/21 mar em 2024 e 2025 (março em Lisboa: UTC+0 até 30/31 mar).
  const days = ['02-12', '02-13', '03-20', '03-21']
  const rows = ['2024', '2025'].flatMap((y) => days.map((d) => row(`${y}-${d}`, { occurred_at: `${y}-${d}T10:00:00Z` })))
  it('13 fev–20 mar inclui os dois limites e só esse ano', () => {
    const f = F({ dateFrom: '2025-02-13', dateTo: '2025-03-20' })
    expect(rows.filter((r) => matches(r, f)).map((r) => r.id)).toEqual(['2025-02-13', '2025-03-20'])
  })
  it('«Repetir em todos os anos» compara mês e dia', () => {
    const f = F({ dateFrom: '2025-02-13', dateTo: '2025-03-20', yearly: true })
    expect(rows.filter((r) => matches(r, f)).map((r) => r.id)).toEqual(['2024-02-13', '2024-03-20', '2025-02-13', '2025-03-20'])
  })
  it('a data é a LOCAL do sítio da captura: Portugal e Espanha', () => {
    // 12 fev 23h30 UTC: em Lisboa ainda é dia 12; em Madrid já é dia 13 (00h30).
    const pt = row('pt', { occurred_at: '2025-02-12T23:30:00Z', occurred_tz: LX })
    const es = row('es', { occurred_at: '2025-02-12T23:30:00Z', occurred_tz: MD })
    const f = F({ dateFrom: '2025-02-13', dateTo: '2025-03-20' })
    expect([pt, es].filter((r) => matches(r, f)).map((r) => r.id)).toEqual(['es'])
    expect(matches(es, F({ timeFrom: '00:00', timeTo: '01:00' }))).toBe(true)
    expect(matches(pt, F({ timeFrom: '00:00', timeTo: '01:00' }))).toBe(false)
  })
  it('um registo introduzido horas depois usa sempre o instante da captura', () => {
    // O registo só guarda occurred_at (hora da captura); a hora de criação nunca entra no filtro.
    const late = row('late', { occurred_at: '2025-02-13T08:00:00Z' })
    expect(matches(late, F({ dateFrom: '2025-02-13', dateTo: '2025-02-13', timeFrom: '07:00', timeTo: '09:00' }))).toBe(true)
  })
  it('anual de dezembro a janeiro dá a volta ao ano', () => {
    const f = F({ dateFrom: '2024-12-20', dateTo: '2025-01-10', yearly: true })
    const r = (id: string, at: string) => row(id, { occurred_at: at })
    expect([r('dez', '2022-12-28T10:00:00Z'), r('jan', '2023-01-05T10:00:00Z'), r('fev', '2023-02-05T10:00:00Z')].filter((x) => matches(x, f)).map((x) => x.id)).toEqual(['dez', 'jan'])
  })
  it('29 de fevereiro escolhido sozinho só existe em anos bissextos', () => {
    const f = F({ dateFrom: '2024-02-29', dateTo: '2024-02-29', yearly: true })
    const r = (id: string, at: string) => row(id, { occurred_at: at })
    expect([r('29', '2028-02-29T10:00:00Z'), r('28', '2025-02-28T10:00:00Z'), r('01', '2025-03-01T10:00:00Z')].filter((x) => matches(x, f)).map((x) => x.id)).toEqual(['29'])
  })
  it('sem data conhecida: fica no histórico, sai quando a pesquisa exige data ou hora', () => {
    const r = row('sem', { occurred_at: null })
    expect(matches(r, EMPTY_FILTER)).toBe(true)
    expect(matches(r, F({ dateFrom: '2020-01-01' }))).toBe(false)
    expect(matches(r, F({ timeFrom: '07:00' }))).toBe(false)
  })
})

describe('ordenação, contagens e entradas', () => {
  it('mais recente primeiro; mesmo minuto desempata pelo ID; datas desconhecidas no fim', () => {
    const s = sortReports([
      { id: 'b', occurred_at: '2025-02-10T07:00:00Z' },
      { id: 'z', occurred_at: null },
      { id: 'a', occurred_at: '2025-02-10T07:00:00Z' },
      { id: 'c', occurred_at: '2025-02-11T07:00:00Z' },
    ])
    expect(s.map((x) => x.id)).toEqual(['c', 'a', 'b', 'z'])
  })
  it('totais: pesquisa = 10, nesta área = 7; cada registo conta uma vez pelo ID', () => {
    const inside = Array.from({ length: 7 }, (_, i) => row(`in${i}`, { lng: -8.2, lat: 39.6 }))
    const outside = Array.from({ length: 3 }, (_, i) => row(`out${i}`, { lng: -6.5, lat: 39.7 }))
    const server = { rows: [...inside, ...outside.slice(0, 2)], total: 9, inView: 7 }
    // O pin out2 ainda só está no dispositivo; out0 está nos dois (não pode contar duas vezes).
    const merged = mergeLocal(server, [outside[2], { ...outside[0], source: 'local' }], EMPTY_FILTER, [-8.4, 39.5, -8.1, 39.8])
    expect([merged.total, merged.inView]).toEqual([10, 7])
    // Mover o mapa muda só o valor da área.
    const moved = mergeLocal(server, [outside[2]], EMPTY_FILTER, [-7, 39.5, -6, 39.9])
    expect(moved.total).toBe(10)
  })
  it('peso aceita vírgula decimal e normaliza para gramas; horas validadas', () => {
    expect(parseKg('2,1')).toBe(2100)
    expect(parseKg('2.1 kg')).toBe(2100)
    expect(parseKg('abc')).toBeNull()
    expect(minutesOf('22:30')).toBe(1350)
    expect(minutesOf('24:00')).toBeNull()
  })
  it('filtros ativos: um chip por critério, cada um removível', () => {
    const f = F({ species: ['Carpa'], weight: { op: 'gt', grams: 2000 }, timeFrom: '07:00', timeTo: '12:00' })
    expect(activeChips(f).map((c) => c.key)).toEqual(['species', 'weight', 'hours'])
    expect(activeChips(removeChip(f, 'species')).map((c) => c.key)).toEqual(['weight', 'hours'])
  })
})
