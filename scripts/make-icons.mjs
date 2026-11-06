// Gera os ícones PNG do PWA a partir do SVG da marca (usa o Chromium do Playwright).
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
const out = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, true],
  ['icon-maskable-512.png', 512, true],
]
for (const [name, size, full] of out) {
  await page.setViewportSize({ width: size, height: size })
  const inner = full ? svg.replace('rx="13"', 'rx="0"') : svg
  const pad = name.includes('maskable') ? size * 0.12 : 0
  await page.setContent(
    `<html><body style="margin:0;background:${full ? '#102B3A' : 'transparent'}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">${inner.replace('<svg ', `<svg width="${size - pad * 2}" height="${size - pad * 2}" `)}</div></body></html>`,
  )
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname, omitBackground: !full })
}
await browser.close()
console.log('ícones gerados')
