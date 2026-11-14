/**
 * Leitor mínimo de .xlsx (Office Open XML) sem dependências novas: o ficheiro é um zip (fflate, já usado no
 * projeto) com XML. Lê nomes das folhas, cadeias partilhadas, células (texto, número, booleano, fórmulas com
 * valor em cache) e devolve cada folha como matriz de linhas com o número de linha ORIGINAL (1-based).
 * As datas do Excel chegam como números de série; a conversão faz-se só nas colunas de data (ver `excelDate`).
 */
import { strFromU8, unzipSync } from 'fflate'

export type Cell = string | number | boolean | null
export interface Sheet {
  name: string
  /** Linhas não vazias com o seu número no Excel. */
  rows: { row: number; cells: Cell[] }[]
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag)
  return m ? decode(m[1]) : null
}
/** Texto de um elemento <si>/<is> (pode ter vários <t> em rich text). */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('')
const colIndex = (ref: string) => {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function readXlsx(buf: Uint8Array): Sheet[] {
  const files = unzipSync(buf)
  // Alguns geradores (ex.: Open XML SDK) prefixam os elementos («<x:sheet>»): remove o prefixo das etiquetas.
  const get = (p: string) => (files[p] ? strFromU8(files[p]).replace(/<(\/?)[A-Za-z][\w.-]*:(?=[A-Za-z])/g, '<$1') : null)
  const wb = get('xl/workbook.xml')
  if (!wb) throw new Error('Ficheiro .xlsx inválido (sem xl/workbook.xml).')
  const rels = get('xl/_rels/workbook.xml.rels') ?? ''
  const relTarget = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id')!, attr(m[0], 'Target')!]))
  const shared = [...(get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
  const sheets: Sheet[] = []
  for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = attr(m[0], 'name') ?? '?'
    const rid = attr(m[0], 'r:id')
    let target = rid ? relTarget.get(rid) ?? '' : ''
    target = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    const xml = get(target)
    if (!xml) {
      sheets.push({ name, rows: [] })
      continue
    }
    const rows: Sheet['rows'] = []
    for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const rowNo = Number(attr(`<row ${r[1]}>`, 'r'))
      const cells: Cell[] = []
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const head = `<c ${c[1]}>`
        const ref = attr(head, 'r') ?? ''
        const t = attr(head, 't')
        const body = c[2] ?? ''
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        let val: Cell = null
        if (t === 's' && v != null) val = shared[Number(v)] ?? null
        else if (t === 'inlineStr') val = textOf(body)
        else if (t === 'str') val = v != null ? decode(v) : null
        else if (t === 'b') val = v === '1'
        else if (t === 'e') val = null
        else if (v != null) val = Number(v)
        if (typeof val === 'string' && !val.trim()) val = null
        cells[colIndex(ref)] = val
      }
      if (cells.some((x) => x !== null && x !== undefined)) rows.push({ row: rowNo, cells: Array.from(cells, (x) => (x === undefined ? null : x)) })
    }
    sheets.push({ name, rows })
  }
  return sheets
}

/** Número de série do Excel (sistema 1900) ou texto «dd/mm/aaaa», «aaaa-mm-dd» → «aaaa-mm-dd»; null se inválido. */
export function excelDate(v: Cell): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    if (v < 1 || v > 80000) return null
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000)
    return d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}
