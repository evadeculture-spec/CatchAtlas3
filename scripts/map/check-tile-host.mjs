#!/usr/bin/env node
/**
 * Verifica se um alojamento serve corretamente ficheiros de mapa (PMTiles, tiles MVT ou DEM) para o browser:
 * HTTP Range (206 + Content-Range, obrigatório para PMTiles), CORS (com Origin), MIME, cache e ETag.
 * Uso: node scripts/map/check-tile-host.mjs <url> [origem]
 *   ex.: node scripts/map/check-tile-host.mjs https://exemplo.netlify.app/tiles/atlas.pmtiles https://catchatlas.netlify.app
 * Não altera nada no alojamento.
 */
const [, , url, origin = 'https://catchatlas.netlify.app'] = process.argv
if (!url) {
  console.error('Uso: node scripts/map/check-tile-host.mjs <url> [origem]')
  process.exit(2)
}
const rows = []
const check = (name, okv, detail) => rows.push(`${okv === null ? 'INFO' : okv ? 'OK  ' : 'FALHA'} ${name}${detail ? ` — ${detail}` : ''}`)
const isPm = /\.pmtiles(\?|$)/.test(url)

const full = await fetch(url, { headers: { Origin: origin } })
check('resposta', full.ok, `HTTP ${full.status}`)
const type = full.headers.get('content-type') ?? ''
check('MIME', isPm ? /application\/(octet-stream|vnd\.pmtiles)/.test(type) : /protobuf|mvt|png|json|octet/.test(type), type || 'sem Content-Type')
const acao = full.headers.get('access-control-allow-origin')
check('CORS (Access-Control-Allow-Origin)', acao === '*' || acao === origin, acao ?? 'ausente (só funciona no mesmo domínio)')
check('Cache-Control', null, full.headers.get('cache-control') ?? 'ausente')
check('ETag / Last-Modified', !!(full.headers.get('etag') || full.headers.get('last-modified')), full.headers.get('etag') ?? full.headers.get('last-modified') ?? 'ausente')
check('Content-Encoding', null, full.headers.get('content-encoding') ?? 'nenhuma')
await full.body?.cancel()

const ranged = await fetch(url, { headers: { Range: 'bytes=0-15', Origin: origin } })
const cr = ranged.headers.get('content-range')
check('HTTP Range (bytes=0-15)', ranged.status === 206 && !!cr, `HTTP ${ranged.status}${cr ? ` · ${cr}` : ''}`)
const body = new Uint8Array(await ranged.arrayBuffer())
check('Range devolve só o pedido', body.length === 16, `${body.length} bytes`)
if (isPm) check('cabeçalho PMTiles v3', new TextDecoder().decode(body.slice(0, 7)) === 'PMTiles' && body[7] === 3, new TextDecoder().decode(body.slice(0, 7)))
const expose = ranged.headers.get('access-control-expose-headers') ?? ''
if (isPm) check('CORS expõe ETag/Content-Range (recomendado)', /etag|content-range|\*/i.test(expose), expose || 'ausente')

console.log(rows.join('\n'))
if (rows.some((r) => r.startsWith('FALHA'))) process.exitCode = 1
