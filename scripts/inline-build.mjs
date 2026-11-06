// Junta o build "artifact" num único index.html (JS, CSS e fontes inline).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = new URL('../dist-artifact/', import.meta.url).pathname
let html = readFileSync(join(dir, 'index.html'), 'utf8')

html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/, (_, p) => {
  const js = readFileSync(join(dir, p), 'utf8').replace(/<\/script/gi, '<\\/script')
  return `<script type="module">${js}</script>`
})
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/, (_, p) => `<style>${readFileSync(join(dir, p), 'utf8')}</style>`)
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '').replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8')
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(svg)}">`)

if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('Ficaram referências a assets externos')
writeFileSync(join(dir, 'atlascatch.html'), html)
console.log('atlascatch.html', (html.length / 1024).toFixed(0), 'KB')
