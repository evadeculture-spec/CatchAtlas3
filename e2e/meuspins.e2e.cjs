// «Os meus pins»: percurso no browser real (Chromium do Playwright) com uma sessão de teste real (sem email).
// SIMULAÇÃO: as respostas de `search_pins` são intercetadas e geradas aqui (dados fictícios); tudo o resto
// (autenticação, navegação, mapa, agrupamento, fichas, filtros) é a app real.
// Uso: npm run build && npx vite preview --port 4173 &  node e2e/meuspins.e2e.cjs http://localhost:4173 screenshots/meus-pins
const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

const base = process.argv[2] || 'http://localhost:4173'
const shots = process.argv[3] || 'screenshots/meus-pins'
mkdirSync(shots, { recursive: true })
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
const IGNORED = /Failed to load resource|ERR_|AJAXError|Failed to fetch|net::|NetworkError|status of 4\d\d|AbortError/

// ------------------------------------------------------------------ dados fictícios
const ZA = { lat: 39.625, lng: -8.225, id: '792:-165' } // centro da zona A (célula 0,05°)
const ZB = { lat: 39.675, lng: -8.275, id: '793:-166' }
const at = (d, h) => `2025-02-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`
const row = (id, o) => ({ source: 'mine', id, kind: 'captura', lat: 39.601, lng: -8.247, precision: 'exato', visibility: 'privado', species: 'Carpa', weight_g: 2000, occurred_at: at(10, 9), occurred_tz: 'Europe/Lisbon', zone_id: null, water_body_ref: 'cb', water_body_name: 'Castelo do Bode', photo_path: null, photo_bucket: null, label: 'Carpa', ...o })
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const MINE = [row(uuid(1), { visibility: 'privado' }), row(uuid(2), { visibility: 'zona', lat: 39.603, lng: -8.249, weight_g: 2100 })]
// 8 públicos de terceiros na mesma zona (coincidentes no centro da zona A), datas distintas e dois no mesmo minuto.
const COMM = Array.from({ length: 8 }, (_, i) => row(uuid(100 + i), { source: 'comm', precision: 'zona', visibility: 'zona', lat: ZA.lat, lng: ZA.lng, zone_id: ZA.id, occurred_at: i === 7 ? at(3, 7) : at(20 - i, 8), photo_bucket: 'community-media', species: i % 2 ? 'Achigã' : 'Carpa' }))
let dataset = 'normal'
let delayCommunity = 0
const requests = []

function respond(p) {
  let rows = dataset === 'empty' ? [] : [...MINE, ...(p.p_community ? COMM : [])]
  if (dataset === 'normal' && !p.p_community) rows = MINE
  if (p.p_species) rows = rows.filter((r) => p.p_species.map((s) => s.toLowerCase()).includes((r.species || '').toLowerCase()))
  if (p.p_weight_op) rows = rows.filter((r) => r.weight_g != null && (p.p_weight_op === 'gt' ? r.weight_g > p.p_weight_g : p.p_weight_op === 'lt' ? r.weight_g < p.p_weight_g : r.weight_g === p.p_weight_g))
  const inView = rows.filter((r) => r.lat >= p.p_south && r.lat <= p.p_north && r.lng >= p.p_west && r.lng <= p.p_east).length
  return rows.map((r) => ({ ...r, total: rows.length, in_view: inView }))
}

async function open(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!opts.touch, isMobile: !!opts.mobile, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(45000)
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && page.errors.push(m.text()))
  await page.route('**/rest/v1/rpc/search_pins', async (route) => {
    const p = JSON.parse(route.request().postData() || '{}')
    requests.push(p)
    if (p.p_community && delayCommunity) await new Promise((r) => setTimeout(r, delayCommunity))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respond(p)) }).catch(() => undefined)
  })
  // Sessão de teste real (sem email) e preferências locais já preenchidas.
  await page.goto(base + '/privacidade', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.setItem('atlascatch-demo-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('atlascatch-demo-v1') || '{}'), onboarded: true })))
  await page.goto(base + '/entrar', { waitUntil: 'domcontentloaded' })
  await page.click('[data-action="sessao-teste"]')
  await page.waitForURL(/\/conta$/, { timeout: 60000 })
  return { ctx, page }
}
const mapEval = (page, fn, arg) => page.evaluate(({ src, arg }) => new Function('map', 'arg', src)(document.querySelector('[data-atlas-map] > div').__map, arg), { src: fn, arg })
const total = (page) => page.locator('[data-meus-pins]').getAttribute('data-total')
const inView = (page) => page.locator('[data-in-view]').getAttribute('data-in-view')
const settle = async (page, expect) => {
  for (let i = 0; i < 60; i++) {
    if ((await total(page)) === String(expect)) return true
    await page.waitForTimeout(250)
  }
  return false
}
async function endSession(page) {
  await page.goto(`${base}/conta/definicoes`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Terminar sessão de teste' }).click()
  await page.getByRole('button', { name: 'Apagar dados e sair' }).click()
  await page.waitForFunction(() => !localStorage.getItem('lancalance-auth'), null, { timeout: 30000 })
}

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const [name, vp, opts] of [['iPad', { width: 1180, height: 820 }, { touch: true }], ['telemóvel', { width: 390, height: 844 }, { touch: true, mobile: true }]]) {
      dataset = 'empty'
      const { ctx, page } = await open(browser, vp, opts)
      // ------------------------------------------------ entrada pela navegação de «Gera a tua história»
      const entries = page.getByRole('link', { name: 'Os meus pins', exact: true })
      await entries.first().waitFor()
      ok(`${name}: «Os meus pins» aparece uma única vez na navegação`, (await entries.count()) === 1)
      await entries.click()
      await page.waitForURL(/\/conta\/meus-pins$/)
      await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 120000 })
      ok(`${name}: abre o «Mapa de pins» no estado pessoal (comunidade desligada)`, (await page.getByRole('heading', { name: 'Mapa de pins' }).count()) === 1 && (await page.locator('[data-meus-pins]').getAttribute('data-community')) === '0' && (await page.getByRole('switch', { name: 'Incluir pins da comunidade' }).getAttribute('aria-checked')) === 'false')
      await settle(page, 0)
      if (name === 'telemóvel') await page.click('[data-action="abrir-filtros-tel"]')
      ok(`${name}: conta vazia mostra o mapa e «Marcar pin» para o primeiro`, (await page.locator('[data-first-use]').first().isVisible()) && (await page.locator('[data-action="marcar-pin"]').count()) === 1)
      await page.screenshot({ path: join(shots, `${name}-1-vazio.png`) })
      if (name === 'telemóvel') await page.keyboard.press('Escape')

      // ------------------------------------------------ 2 → 10 → 2 ao alternar a comunidade
      dataset = 'normal'
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 120000 })
      await mapEval(page, 'map.jumpTo({ center: [-8.24, 39.63], zoom: 11.5 })')
      ok(`${name}: vista pessoal = 2`, await settle(page, 2))
      await page.getByRole('switch', { name: 'Incluir pins da comunidade' }).click()
      ok(`${name}: com a comunidade = 10 (o meu público conta uma vez)`, await settle(page, 10), `total=${await total(page)}`)
      await page.screenshot({ path: join(shots, `${name}-2-comunidade.png`) })
      await page.getByRole('switch', { name: 'Incluir pins da comunidade' }).click()
      ok(`${name}: desligar repõe 2`, await settle(page, 2))
      const camA = await mapEval(page, 'const c = map.getCenter(); return [c.lng.toFixed(5), c.lat.toFixed(5), map.getZoom().toFixed(2)].join(",")')

      // ------------------------------------------------ resposta atrasada não reaparece
      delayCommunity = 2500
      await page.getByRole('switch', { name: 'Incluir pins da comunidade' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('switch', { name: 'Incluir pins da comunidade' }).click()
      await page.waitForTimeout(3500)
      const feats = await mapEval(page, 'return map.querySourceFeatures("mp-pins").filter((f) => !f.properties.cluster).length')
      ok(`${name}: rede lenta — desligar a comunidade antes da resposta impede resultados tardios`, (await total(page)) === '2' && feats <= 2, `total=${await total(page)} pontos=${feats}`)
      delayCommunity = 0
      const camB = await mapEval(page, 'const c = map.getCenter(); return [c.lng.toFixed(5), c.lat.toFixed(5), map.getZoom().toFixed(2)].join(",")')
      ok(`${name}: centro e zoom sobrevivem à mudança de vista`, camA === camB, `${camA} → ${camB}`)

      // ------------------------------------------------ 8 coincidentes → pin com «8»; percorrer fichas
      await page.getByRole('switch', { name: 'Incluir pins da comunidade' }).click()
      await settle(page, 10)
      await mapEval(page, `map.jumpTo({ center: [${ZA.lng}, ${ZA.lat}], zoom: 15.5 })`)
      await page.waitForTimeout(1500)
      const pt = await mapEval(page, `const p = map.project([${ZA.lng}, ${ZA.lat}]); const r = map.getContainer().getBoundingClientRect(); const f = map.queryRenderedFeatures([[p.x - 4, p.y - 4], [p.x + 4, p.y + 4]], { layers: ['mp-cluster'] })[0]; return { x: r.left + p.x, y: r.top + p.y, n: f ? f.properties.point_count : null }`)
      ok(`${name}: reports coincidentes mostram um pin com o número de reports`, pt.n === 8, `n=${pt.n}`)
      await page.mouse.click(pt.x, pt.y)
      await page.waitForSelector('[data-card]')
      const order = []
      for (let i = 0; i < 8; i++) {
        order.push(await page.locator('[data-card]').getAttribute('data-card'))
        if (i === 2) ok(`${name}: «3 de 8» depois de avançar duas vezes`, (await page.locator('[data-pos]').textContent()) === '3 de 8')
        if (i < 7) await page.getByRole('button', { name: 'Ficha seguinte' }).click()
      }
      const expected = [...COMM.slice(0, 8)].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at) || (a.id < b.id ? -1 : 1)).map((r) => r.id)
      ok(`${name}: ordem da mais recente para a mais antiga, todas as 8 fichas distintas`, JSON.stringify(order) === JSON.stringify(expected), order.length + ' fichas')
      const zone = await mapEval(page, 'return map.querySourceFeatures("mp-zone").length')
      ok(`${name}: realce só da zona da ficha selecionada`, zone >= 1)
      ok(`${name}: ficha de terceiro mostra «Localização aproximada»`, (await page.locator('[data-card]').textContent()).includes('Localização aproximada'))
      await page.screenshot({ path: join(shots, `${name}-3-fichas.png`) })
      // Desligar a comunidade com a ficha de terceiro aberta: fecha ficha, foto e realce.
      await page.getByRole('switch', { name: 'Incluir pins da comunidade' }).click()
      await page.waitForTimeout(400)
      const zoneOff = await mapEval(page, 'return map.querySourceFeatures("mp-zone").length')
      ok(`${name}: desligar a comunidade com ficha de terceiro aberta remove ficha e realce`, (await page.locator('[data-card]').count()) === 0 && zoneOff === 0)

      // ------------------------------------------------ filtros: aplicar, chips, remover um, limpar
      if (name === 'telemóvel') await page.click('[data-action="abrir-filtros-tel"]')
      await page.click('[data-action="abrir-filtros"]')
      await page.getByRole('button', { name: 'Carpa', exact: true }).last().click()
      await page.getByLabel('Comparação de peso').selectOption('gt')
      await page.getByLabel('Peso em kg').fill('2')
      await page.click('[data-action="aplicar-filtros"]')
      await page.waitForTimeout(800)
      const last = requests[requests.length - 1]
      ok(`${name}: filtros chegam ao servidor (espécie + mais de 2 kg em gramas)`, JSON.stringify(last.p_species) === '["Carpa"]' && last.p_weight_op === 'gt' && last.p_weight_g === 2000)
      ok(`${name}: só a carpa de 2,1 kg passa (2 kg exatos não é «mais de»)`, await settle(page, 1))
      if (name === 'telemóvel') await page.click('[data-action="abrir-filtros-tel"]')
      const chipsN = await page.locator('[data-active-filters] button[aria-label^="Retirar filtro"]').count()
      await page.getByRole('button', { name: /Retirar filtro: Mais de/ }).first().click()
      ok(`${name}: filtros ativos visíveis e removíveis um a um (${chipsN} chips)`, chipsN === 2 && (await settle(page, 2)))
      await page.getByRole('button', { name: 'Limpar todos' }).first().click()
      ok(`${name}: limpar todos repõe a pesquisa`, await settle(page, 2))
      if (name === 'telemóvel') await page.keyboard.press('Escape')

      // ------------------------------------------------ total vs nesta área
      await mapEval(page, 'map.jumpTo({ center: [-8.248, 39.602], zoom: 14 })')
      await page.waitForTimeout(1200)
      const t1 = await total(page), v1 = await inView(page)
      await mapEval(page, 'map.jumpTo({ center: [-7.5, 39.0], zoom: 14 })')
      await page.waitForTimeout(1200)
      const t2 = await total(page), v2 = await inView(page)
      ok(`${name}: mover o mapa muda só «nesta área»`, t1 === t2 && v1 !== v2, `total ${t1}→${t2}, área ${v1}→${v2}`)

      ok(`${name}: sem erros na consola`, page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
      await endSession(page)
      await ctx.close()
    }
  } catch (e) {
    ok('execução sem exceções', false, e.message.split('\n')[0])
  } finally {
    await browser.close()
    console.log(results.join('\n'))
    console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} PASS · ${results.filter((r) => r.startsWith('FAIL')).length} FAIL`)
  }
})()
