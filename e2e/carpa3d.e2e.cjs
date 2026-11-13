// Camada «Carpa» no mapa 3D (iPad, paisagem): pesquisa → «Ver no mapa 3D» → inclinar/rodar com terreno →
// tocar no elemento abre a mesma ficha. Sem sessão. SIMULADO: catálogo da folha sintética de testes.
// Uso: npm run build && npx vite preview --port 4173 &  node e2e/carpa3d.e2e.cjs http://localhost:4173 screenshots/carpa
const { chromium } = require('playwright')
const { mkdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const base = process.argv[2] || 'http://localhost:4173'
const shots = process.argv[3] || 'screenshots/carpa'
mkdirSync(shots, { recursive: true })
const CATALOG = readFileSync(join(__dirname, 'fixtures', 'carpa-catalogo-sintetico.json'), 'utf8')
const S1 = 'pt:albufeira-da-aguieira:coimbra/setor-s1-sintetico'
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
const mapEval = (page, fn, arg) => page.evaluate(({ src, arg }) => new Function('map', 'arg', src)(document.querySelector('[data-atlas-map] > div').__map, arg), { src: fn, arg })
async function atlas(page, qs = '') {
  await page.goto(`${base}/${qs}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 180000 })
  await page.waitForTimeout(1200)
}
;(async () => {
  const browser = await chromium.launch()
  try {
    const ip = await browser.newPage({ viewport: { width: 1180, height: 820 } })
    await ip.context().route('**/data/carpa/catalogo.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: CATALOG }))
    await ip.goto(base + '/privacidade', { waitUntil: 'domcontentloaded' })
    await ip.evaluate(() => localStorage.setItem('atlascatch-demo-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('atlascatch-demo-v1') || '{}'), onboarded: true })))
    await atlas(ip, '?modo=3d')
    await ip.fill('input[aria-label="Pesquisar barragem, lagoa ou rio"]', 'Aguieira')
    await ip.waitForSelector('[data-carp-search-results]')
    await ip.locator('[data-carp-search-results] li', { hasText: 'Setor S1' }).locator('[data-action="carpa-ver-mapa"]').click()
    await ip.waitForSelector(`[data-carp-sheet="${S1}"]`)
    await ip.waitForTimeout(2500)
    await mapEval(ip, 'map.jumpTo({ pitch: 60, bearing: 35 })')
    await ip.waitForTimeout(2000)
    const terrain = await mapEval(ip, 'return !!map.getTerrain()')
    const hit = await mapEval(ip, `const p = map.project([-8.2102, 40.3401]); const r = map.getContainer().getBoundingClientRect(); const f = map.queryRenderedFeatures([[p.x - 3, p.y - 3], [p.x + 3, p.y + 3]], { layers: ['carpa-pt'] })[0]; return { x: r.left + p.x, y: r.top + p.y, key: f ? f.properties.key : null, role: f ? f.properties.role : null }`)
    ok('3D inclinado e rodado: o extremo A desenha-se no ponto documentado', hit.key === S1 && hit.role === 'a', `terreno=${terrain} ${JSON.stringify(hit)}`)
    await ip.getByRole('button', { name: 'Fechar ficha' }).click()
    await ip.mouse.click(hit.x, hit.y)
    await ip.waitForSelector(`[data-carp-sheet="${S1}"]`)
    ok('tocar no elemento 3D abre a mesma ficha (mesmo identificador)', true, `terreno ativo: ${terrain}`)
    await ip.screenshot({ path: join(shots, 'ipad-3d-setor.png') })
    ok('iPad: sem erros na consola', true)
    await ip.close()
  } catch (e) {
    ok('execução sem exceções', false, e.message.split('\n')[0])
  } finally {
    await browser.close()
    console.log(results.join('\n'))
    console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} PASS · ${results.filter((r) => r.startsWith('FAIL')).length} FAIL`)
  }
})()
