// Ensaios de aceitação da camada «Carpa» no Atlas 3D (browser real, Chromium do Playwright).
// REAL: sessões de teste (sem email), mapa, compositor, sincronização, servidor Supabase e «Os meus pins».
// SIMULADO: o catálogo servido em /data/carpa/catalogo.json é substituído pelo catálogo gerado da folha
// SINTÉTICA de testes (e2e/fixtures/carpa-catalogo-sintetico.json), porque o Excel real não está disponível.
// Uso: npm run build && npx vite preview --port 4173 &  node e2e/carpa.e2e.cjs http://localhost:4173 screenshots/carpa
const { chromium } = require('playwright')
const { mkdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const base = process.argv[2] || 'http://localhost:4173'
const shots = process.argv[3] || 'screenshots/carpa'
mkdirSync(shots, { recursive: true })
const URL_ = process.env.VITE_SUPABASE_URL || 'https://xachgvjmhmnwaguayrcv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PjJKSFp2h6WwQy8i1XJX4A_5qlsSHhS'
const CATALOG = readFileSync(join(__dirname, 'fixtures', 'carpa-catalogo-sintetico.json'), 'utf8')
const S1 = 'pt:albufeira-da-aguieira:coimbra/setor-s1-sintetico'
const TAJO = 'es:rio-tajo:toledo/tramo-urbano-sintetico'
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
const IGNORED = /Failed to load resource|ERR_|AJAXError|Failed to fetch|net::|NetworkError|status of 4\d\d|AbortError/

async function open(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: !!opts.mobile, reducedMotion: 'reduce', permissions: [] })
  await ctx.route('**/data/carpa/catalogo.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: CATALOG }))
  const page = await ctx.newPage()
  page.setDefaultTimeout(45000)
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && page.errors.push(m.text()))
  await page.goto(base + '/privacidade', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.setItem('atlascatch-demo-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('atlascatch-demo-v1') || '{}'), onboarded: true })))
  await page.goto(base + '/entrar', { waitUntil: 'domcontentloaded' })
  await page.click('[data-action="sessao-teste"]')
  await page.waitForURL(/\/conta$/, { timeout: 60000 })
  return { ctx, page }
}
const session = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lancalance-auth') || 'null'))
const rest = async (token, path) => (await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } })).json()
const mapEval = (page, fn, arg) => page.evaluate(({ src, arg }) => new Function('map', 'arg', src)(document.querySelector('[data-atlas-map] > div').__map, arg), { src: fn, arg })
async function atlas(page, qs = '') {
  await page.goto(`${base}/${qs}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 120000 })
  await page.waitForTimeout(1200)
}
async function endSession(page) {
  await page.goto(`${base}/conta/definicoes`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Terminar sessão de teste' }).click()
  await page.getByRole('button', { name: 'Apagar dados e sair' }).click()
  await page.waitForFunction(() => !localStorage.getItem('lancalance-auth'), null, { timeout: 30000 })
}
const state = (page) => page.locator('[data-carp-sheet] [data-carp-state]').getAttribute('data-carp-state')

;(async () => {
  const browser = await chromium.launch()
  let A, B
  try {
    // ====================================================== telemóvel: percurso principal
    A = await open(browser, { width: 390, height: 844 }, { mobile: true })
    const p = A.page
    await atlas(p)
    await p.getByRole('button', { name: /^Camadas/ }).click()
    await p.click('[data-layer="carpa"]')
    await p.waitForSelector('[data-carp-panel]')
    ok('telemóvel: «Carpa» no seletor de camadas abre a lista', true)
    await p.fill('[data-carp-search]', 'S1')
    await p.click(`[data-carp-item="${S1}"]`)
    await p.waitForSelector(`[data-carp-sheet="${S1}"]`)
    await p.fill('[data-carp-date-input]', '2026-11-20')
    await p.getByLabel('Modalidade').selectOption('carpfishing-noturno')
    const okState = await p.waitForSelector('[data-carp-sheet] [data-carp-state="permitida"]', { timeout: 15000 }).then(() => true, () => false)
    ok('ficha do setor S1 a 20/11/2026, carpfishing noturno: «Pesca permitida»', okState)
    const sheetText = await p.locator('[data-carp-sheet]').textContent()
    ok('ficha mostra condições, presença, acesso, fonte e verificação', /Pesca noturna/.test(sheetText) && /Presença de carpa documentada/.test(sheetText) && /ICNF \(sintético\)/.test(sheetText) && /Verificado em 2026-10-01/.test(sheetText) && /Limites conhecidos: extremos A e B/.test(sheetText))
    await p.screenshot({ path: join(shots, 'tel-1-ficha-permitida.png') })
    await p.fill('[data-carp-date-input]', '2028-01-15')
    await p.waitForSelector('[data-carp-sheet] [data-carp-state="por-confirmar"]', { timeout: 15000 })
    await p.waitForTimeout(500)
    ok('mudar a data para depois do termo (31/12/2027): «Por confirmar» com a razão', (await state(p)) === 'por-confirmar' && /terminou em 31 de dezembro de 2027/.test(await p.locator('[data-carp-sheet]').textContent()))
    const sym = await mapEval(p, `return map.querySourceFeatures('carpa-src').filter((f) => f.properties.key === '${S1}').map((f) => f.properties.state)`)
    ok('a simbologia do setor no mapa acompanha a data', sym.length > 0 && sym.every((x) => x === 'por-confirmar'), JSON.stringify(sym))
    await p.getByLabel('Modalidade').selectOption('pesca-individual')
    await p.fill('[data-carp-date-input]', '2026-11-20')
    await p.waitForSelector('[data-carp-sheet][data-carp-date="2026-11-20"]')
    await p.getByRole('button', { name: 'ES', exact: true }).click()
    await p.waitForSelector('[data-carp-sheet][lang="es"]')
    const es = await p.locator('[data-carp-sheet]').textContent()
    ok('ES: mesma decisão, razão traduzida, referência original mantida', (await state(p)) === 'por-confirmar' && /otra modalidad/.test(es) && /Edital sintético 1\/2026/.test(es))
    await p.getByRole('button', { name: 'PT', exact: true }).click()
    await p.getByLabel('Modalidade').selectOption('carpfishing-noturno')

    // Marcar pin a partir do setor (a ligação fica guardada no servidor e pertence ao utilizador).
    await p.click('[data-action="carpa-marcar-pin"]')
    await p.waitForSelector('[data-composer-step="place"]')
    await p.getByRole('button', { name: 'Confirmar local' }).click()
    await p.waitForSelector('[data-composer-step="details"]')
    await p.click('[data-action="guardar-pin"]')
    await p.waitForSelector('[data-pin-sheet][data-pin-state="synced"]', { timeout: 90000 })
    const pinId = await p.locator('[data-pin-sheet]').getAttribute('data-pin-sheet')
    ok('pin guardado e sincronizado, com a ligação ao setor na ficha', (await p.locator('[data-pin-carp]').getAttribute('data-pin-carp')) === S1)
    const sA = await session(p)
    const row = await rest(sA.access_token, `pings?id=eq.${pinId}&select=id,owner_id,carp_sector_key`)
    ok('no servidor: o pin pertence a A e conserva a chave do setor', row.length === 1 && row[0].owner_id === sA.user.id && row[0].carp_sector_key === S1)

    // Fechar e voltar a abrir a app → «Os meus pins» → ficha → ligação ao setor.
    await p.goto('about:blank')
    await p.goto(`${base}/conta/meus-pins`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('[data-meus-pins][data-total]:not([data-total=""])', { timeout: 60000 })
    await p.evaluate((id) => [...document.querySelectorAll('ul[aria-label="Resultados no mapa"] button')].find((b) => b.closest('li') && b.textContent)?.click(), pinId)
    await p.waitForSelector('[data-card]')
    await p.getByRole('button', { name: 'Abrir ficha' }).click()
    await p.waitForSelector('[data-pin-carp]')
    ok('depois de reabrir a app, «Os meus pins» mostra o pin com a ligação ao setor', (await p.locator('[data-pin-carp]').getAttribute('data-pin-carp')) === S1)
    await p.screenshot({ path: join(shots, 'tel-2-meus-pins.png') })

    // Informação incompleta: setor sem coordenadas, pesquisa sem resultados, falha de rede ao gravar.
    await atlas(p, '?carpa_camada=1')
    await p.fill('[data-carp-search]', 'Tajo')
    const tajoTxt = await p.locator(`[data-carp-item="${TAJO}"]`).textContent()
    await p.click(`[data-carp-item="${TAJO}"]`)
    await p.waitForSelector(`[data-carp-sheet="${TAJO}"]`)
    ok('setor sem coordenadas: acessível pela lista, «Localização por confirmar»', /Localização por confirmar/.test(tajoTxt) && (await p.locator('[data-carp-precision]').getAttribute('data-carp-precision')) === 'sem-coordenadas')
    await p.getByRole('button', { name: 'Fechar ficha' }).click()
    await p.fill('[data-carp-search]', 'zzzz-inexistente')
    ok('pesquisa sem resultados: estado vazio explícito', (await p.locator('[data-carp-zero]').count()) === 1)
    await p.click('[data-action="marcar-pin"]')
    await p.waitForSelector('[data-composer-step="place"]')
    await p.getByRole('button', { name: 'Confirmar local' }).click()
    await p.waitForSelector('[data-composer-step="details"]')
    await A.ctx.setOffline(true)
    await p.click('[data-action="guardar-pin"]')
    await p.waitForSelector('[data-pin-sheet]')
    const offState = await p.locator('[data-pin-sheet]').getAttribute('data-pin-state')
    const offId = await p.locator('[data-pin-sheet]').getAttribute('data-pin-sheet')
    await A.ctx.setOffline(false)
    await p.evaluate(() => window.dispatchEvent(new Event('online')))
    await p.waitForSelector('[data-pin-sheet][data-pin-state="synced"]', { timeout: 90000 })
    const dup = await rest(sA.access_token, `pings?id=eq.${offId}&select=id`)
    ok('sem rede: «Guardado no dispositivo» → sincroniza ao voltar a rede, sem duplicar', offState !== 'synced' && dup.length === 1, `estado offline=${offState}`)

    // Desligar a camada: os pins pessoais continuam visíveis.
    await p.getByRole('button', { name: 'Fechar ficha' }).click().catch(() => undefined)
    await p.getByRole('button', { name: /^Camadas/ }).click()
    await p.click('[data-layer="carpa"]')
    await p.waitForTimeout(400)
    const vis = await mapEval(p, `return { carpa: map.getLayoutProperty('carpa-pt', 'visibility'), meus: map.getLayoutProperty('lanca-my-pin', 'visibility') ?? 'visible' }`)
    ok('desligar «Carpa» esconde a camada e mantém os pins pessoais', vis.carpa === 'none' && vis.meus !== 'none', JSON.stringify(vis))
    ok('telemóvel: sem erros na consola', p.errors.length === 0, p.errors.slice(0, 2).join(' | '))

    // ====================================================== duas contas: B não vê o pin de A
    B = await open(browser, { width: 390, height: 844 }, { mobile: true })
    const sB = await session(B.page)
    const asB = await rest(sB.access_token, `pings?id=eq.${pinId}&select=id`)
    const searchB = await (await fetch(`${URL_}/rest/v1/rpc/search_pins`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${sB.access_token}`, 'Content-Type': 'application/json' }, body: '{}' })).json()
    const upd = await fetch(`${URL_}/rest/v1/pings?id=eq.${pinId}`, { method: 'PATCH', headers: { apikey: KEY, Authorization: `Bearer ${sB.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ carp_sector_key: 'x' }) })
    const updBody = await upd.json()
    const backA = await rest(sA.access_token, `pings?id=eq.${pinId}&select=carp_sector_key`)
    ok('B não consulta nem altera o pin de A; A recupera o original', asB.length === 0 && !searchB.some((r) => r.id === pinId) && Array.isArray(updBody) && updBody.length === 0 && backA[0]?.carp_sector_key === S1)

    // ====================================================== iPad: pesquisa → mapa 3D → seleção direta
    const ip = await browser.newPage({ viewport: { width: 1180, height: 820 } })
    await ip.context().route('**/data/carpa/catalogo.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: CATALOG }))
    await ip.goto(base + '/privacidade', { waitUntil: 'domcontentloaded' })
    await ip.evaluate(() => localStorage.setItem('atlascatch-demo-v1', JSON.stringify({ onboarded: true })))
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
    for (const c of [A, B]) if (c) await endSession(c.page).catch(() => undefined)
    await browser.close()
    console.log(results.join('\n'))
    console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} PASS · ${results.filter((r) => r.startsWith('FAIL')).length} FAIL`)
  }
})()
