// Teste de comportamento das fotografias contra o build "e2e" (catálogo de TESTE).
// Uso: node e2e/photos.e2e.cjs http://localhost:4174 <pasta-screenshots>
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const base = process.argv[2] || 'http://localhost:4174'
const shots = process.argv[3] || '.'
const img = readFileSync(join(__dirname, 'fixtures', 'test-image.jpg'))
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

async function setup(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 })
  // Fotos de teste: todas servidas pela imagem de teste, exceto Alqueva (simula falha → 404).
  await ctx.route('**/photos/**', (route) =>
    route.request().url().includes('/photos/alqueva/') ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ status: 200, contentType: 'image/jpeg', body: img }),
  )
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/404|Failed to load resource/.test(m.text()) && errors.push(m.text()))
  await page.goto(base + '/')
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('atlascatch-demo-v1') || 'null')
    if (s) { s.onboarded = true; s.favorites = ['orellana', 'castelo-de-bode']; localStorage.setItem('atlascatch-demo-v1', JSON.stringify(s)) }
  })
  return { ctx, page, errors }
}

;(async () => {
  const browser = await chromium.launch()
  const { ctx, page, errors } = await setup(browser, { width: 390, height: 844 })
  const settle = () => page.waitForTimeout(400)

  // 1. Ficha com fotografia aprovada
  await page.goto(base + '/barragens/orellana')
  await settle()
  ok('ficha: fotografia aprovada', (await page.locator('[data-photo-state="foto"]').count()) >= 1)
  ok('ficha: sem "Imagem ilustrativa"', (await page.getByText('Imagem ilustrativa').count()) === 0)
  ok('ficha: dados simulados continuam rotulados', await page.getByText('Dados de demonstração · temperatura simulada').isVisible())
  ok('ficha: observação da foto exata', await page.getByText('Observação de teste aprovada').isVisible())
  ok('ficha: observação de outra foto não aparece', (await page.getByText('OBSERVACAO DE OUTRA FOTO').count()) === 0)
  await page.screenshot({ path: `${shots}/photo-orellana-mobile.png` })
  await page.getByRole('button', { name: /Créditos da fotografia/ }).click()
  ok('créditos abrem', await page.getByRole('dialog', { name: 'Sobre esta fotografia' }).isVisible())
  ok('créditos: data desconhecida não é inventada', await page.getByText('Data de captação não documentada na fonte').isVisible())
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /fotografias|Ver fotografia/ }).first().click()
  ok('galeria abre', await page.getByRole('dialog', { name: /Fotografias de Orellana/ }).isVisible())
  ok('galeria: 2 fotografias', await page.getByText('(1/2)').isVisible())
  await page.keyboard.press('ArrowRight')
  ok('galeria: teclado muda de foto', await page.getByText('(2/2)').isVisible())
  await page.getByRole('button', { name: 'Ampliar' }).click()
  ok('galeria: zoom', (await page.getByRole('button', { name: 'Reduzir zoom' }).count()) === 1)
  await page.screenshot({ path: `${shots}/photo-gallery.png` })
  await page.keyboard.press('Escape')
  ok('galeria fecha com Esc', (await page.getByRole('dialog').count()) === 0)

  // 2. Identidade pendente não publica (Castelo de Bode no catálogo de teste)
  await page.goto(base + '/barragens/castelo-de-bode')
  await settle()
  ok('identidade pendente → sem fotografia', (await page.locator('[data-photo-state="foto"]').count()) === 0 && (await page.locator('[data-photo-state="sem-foto"]').count()) >= 1)

  // 3. Falha da imagem → fallback, sem ciclo
  await page.goto(base + '/barragens/alqueva')
  await page.waitForTimeout(800)
  ok('ficheiro em falta → fallback de erro', (await page.locator('[data-photo-state="erro"]').count()) >= 1)
  await page.screenshot({ path: `${shots}/photo-alqueva-erro.png` })

  // 4. Sem fotografia
  await page.goto(base + '/barragens/torrao')
  await settle()
  ok('sem fotografia → superfície neutra', await page.getByText('Fotografia ainda não disponível').first().isVisible())
  await page.screenshot({ path: `${shots}/photo-torrao-sem-foto.png` })

  // 5. Lista e favoritas usam a mesma foto aprovada
  await page.goto(base + '/explorar?favoritas=1')
  await settle()
  const orellanaRow = page.locator('a[href="/barragens/orellana"]').first()
  ok('favoritas: Orellana com foto', (await orellanaRow.locator('[data-photo-state="foto"][data-asset-id="teste-1"]').count()) === 1)
  const bodeRow = page.locator('a[href="/barragens/castelo-de-bode"]').first()
  ok('favoritas: pendente sem foto', (await bodeRow.locator('[data-photo-state="sem-foto"]').count()) === 1)
  await page.screenshot({ path: `${shots}/photo-favoritas.png` })
  ok('sem erros de consola', errors.length === 0, JSON.stringify(errors))
  await ctx.close()

  // 6. Nome longo em vários formatos
  for (const [label, viewport] of [['mobile', { width: 360, height: 780 }], ['tablet', { width: 820, height: 1180 }], ['paisagem', { width: 844, height: 390 }], ['desktop', { width: 1440, height: 900 }]]) {
    const s = await setup(browser, viewport)
    await s.page.goto(base + '/barragens/marateca')
    await s.page.waitForTimeout(400)
    const sw = await s.page.evaluate(() => document.documentElement.scrollWidth)
    const h1 = await s.page.locator('h1').first().boundingBox()
    ok(`nome longo ${label}: sem scroll horizontal`, sw <= viewport.width, `sw=${sw}`)
    ok(`nome longo ${label}: título dentro do ecrã`, !!h1 && h1.x >= 0 && h1.x + h1.width <= viewport.width + 1)
    await s.page.screenshot({ path: `${shots}/photo-marateca-${label}.png` })
    ok(`nome longo ${label}: sem erros`, s.errors.length === 0, JSON.stringify(s.errors))
    await s.ctx.close()
  }
  console.log(results.join('\n'))
  await browser.close()
})().catch((e) => {
  console.log(results.join('\n'))
  console.error(e)
  process.exit(1)
})
