// Ecossistema cartográfico unificado: todos os mapas usam o motor do Atlas (MapLibre GL + terreno DEM real).
// Browser real (Chromium do Playwright, WebGL por software). Uma sessão de teste real (sem email), apagada no fim.
// Uso: npm run build && npx vite preview --port 4173 &  NODE_USE_ENV_PROXY=1 node e2e/mapas.e2e.cjs http://localhost:4173 screenshots/mapas
const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

const base = process.argv[2] || 'http://localhost:4173'
const shots = process.argv[3] || 'screenshots/mapas'
mkdirSync(shots, { recursive: true })
const URL_ = process.env.VITE_SUPABASE_URL || 'https://xachgvjmhmnwaguayrcv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PjJKSFp2h6WwQy8i1XJX4A_5qlsSHhS'
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
const IGNORED = /Failed to load resource|ERR_|AJAXError|Failed to fetch|net::|NetworkError|status of 4\d\d|AbortError/
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' }

async function prep(page) {
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && page.errors.push(m.text()))
  page.setDefaultTimeout(60000)
  await page.goto(base + '/privacidade', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.setItem('atlascatch-demo-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('atlascatch-demo-v1') || '{}'), onboarded: true }))
    localStorage.setItem('catchatlas-atlas-hint', 'false')
  })
}
/** Avalia no mapa MapLibre de um contentor do motor (o primeiro, ou dentro de `scope`). */
const mapEval = (page, fn, scope = '') => page.evaluate(({ src, scope }) => new Function('map', src)(document.querySelector(`${scope} [data-atlas-map] > div`).__map), { src: fn, scope })
const waitReady = (page, scope = '') => page.waitForFunction((s) => !!document.querySelector(`${s} [data-atlas-map] > div`)?.__map?.loaded?.(), scope, { timeout: 150000 })
const terrainOn = async (page, scope = '') => {
  for (let i = 0; i < 40; i++) {
    if (await mapEval(page, 'return !!map.getTerrain()', scope)) return true
    await page.waitForTimeout(500)
  }
  return false
}
const waters = (page) => mapEval(page, 'return map.queryRenderedFeatures().filter((f) => f.properties && f.properties.area_km2 != null).length')
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

;(async () => {
  const browser = await chromium.launch()
  let ctx
  try {
    // ======================================================= Atlas (mapa principal) no telemóvel
    ctx = await browser.newContext(PHONE)
    const p = await ctx.newPage()
    await prep(p)
    await p.goto(base + '/?v=-8.2484,39.6005,11,50,0', { waitUntil: 'domcontentloaded' })
    await waitReady(p)
    const mode0 = await p.locator('[data-atlas-map]').first().getAttribute('data-mode')
    ok('T01 mapa principal abre em 3D com terreno DEM real (ecrã de iPhone, Chromium)', mode0 === '3d' && (await terrainOn(p)))
    await p.waitForTimeout(2500)
    const ptW = await waters(p)
    await mapEval(p, 'map.jumpTo({ center: [-6.4628, 39.7186], zoom: 11 })')
    await p.waitForTimeout(4000)
    const esW = await waters(p)
    ok('T02 Portugal → Espanha: albufeiras desenhadas nos dois lados', ptW > 0 && esW > 0, `PT ${ptW} · ES ${esW} polígonos`)
    await p.screenshot({ path: join(shots, 'tel-atlas-3d.png') })
    // 2D ↔ 3D preserva câmara e seleção.
    await p.goto(base + '/?v=-8.2484,39.6005,11,50,20&sel=osm-relation-12244426', { waitUntil: 'domcontentloaded' })
    await waitReady(p)
    await p.waitForTimeout(1500)
    const cam = () => mapEval(p, 'const c = map.getCenter(); return [c.lng, c.lat, map.getZoom()]')
    const m = (a, b) => Math.round(Math.hypot((a[0] - b[0]) * 85000, (a[1] - b[1]) * 111000))
    const c0 = await cam()
    await p.getByRole('button', { name: '2D', exact: true }).first().click()
    await p.waitForFunction(() => document.querySelector('[data-atlas-map]')?.getAttribute('data-mode') === '2d')
    await p.waitForTimeout(800)
    const c2 = await cam()
    await p.getByRole('button', { name: '3D', exact: true }).first().click()
    await p.waitForFunction(() => document.querySelector('[data-atlas-map]')?.getAttribute('data-mode') === '3d')
    await p.waitForTimeout(800)
    const c3 = await cam()
    // O centro pode deslocar-se ligeiramente (altitude do terreno no centro); aceita-se < 1 km e regista-se o valor medido.
    ok('T09 3D → 2D → 3D mantém região, zoom e seleção', m(c0, c2) < 1000 && m(c0, c3) < 1000 && Math.abs(c0[2] - c3[2]) < 0.05 && new URL(p.url()).searchParams.get('sel') === 'osm-relation-12244426', `desvio do centro: 2D ${m(c0, c2)} m · 3D ${m(c0, c3)} m; zoom ${c0[2].toFixed(2)} → ${c3[2].toFixed(2)}`)
    ok('T14 Atlas sem scroll horizontal (390×844)', await noHScroll(p))

    // ======================================================= relevo indisponível (T11)
    const ctxDem = await browser.newContext(PHONE)
    await ctxDem.route('**/elevation-tiles-prod/**', (r) => r.abort())
    const d = await ctxDem.newPage()
    await prep(d)
    await d.goto(base + '/?v=-8.2484,39.6005,11,50,0', { waitUntil: 'domcontentloaded' })
    await waitReady(d)
    let demMode = null
    for (let i = 0; i < 60 && demMode !== '2d'; i++) {
      demMode = await d.locator('[data-atlas-map]').first().getAttribute('data-mode')
      await d.waitForTimeout(500)
    }
    ok('T11 DEM indisponível: o mapa continua utilizável em 2D, sem bloquear', demMode === '2d' && (await d.locator('[data-action="marcar-pin"]').count()) === 1)
    await ctxDem.close()

    // ======================================================= sessão de teste → mapas da área privada
    await p.goto(base + '/entrar', { waitUntil: 'domcontentloaded' })
    await p.click('[data-action="sessao-teste"]')
    await p.waitForURL(/\/conta$/, { timeout: 60000 })
    const s = await p.evaluate(() => JSON.parse(localStorage.getItem('lancalance-auth')))
    const H = { apikey: KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }

    // Mapa (área privada): mesmo motor, 2D/3D e memória da câmara partilhada.
    await p.goto(base + '/conta/mapa', { waitUntil: 'domcontentloaded' })
    await waitReady(p, '[data-private-map]')
    ok('Mapa da área privada usa o motor do Atlas com terreno', (await p.locator('[data-private-map] [data-atlas-map]').count()) === 1 && (await terrainOn(p, '[data-private-map]')))
    await p.locator('[data-private-map] [data-mode="2d"]').click()
    await p.waitForFunction(() => document.querySelector('[data-private-map] [data-atlas-map]')?.getAttribute('data-mode') === '2d')
    await p.locator('[data-private-map] [data-mode="3d"]').click()
    await p.waitForFunction(() => document.querySelector('[data-private-map] [data-atlas-map]')?.getAttribute('data-mode') === '3d')
    ok('Mapa da área privada: alternância 2D/3D', true)
    await mapEval(p, 'map.jumpTo({ center: [-6.4628, 39.7186], zoom: 10.5 })', '[data-private-map]')
    await p.waitForTimeout(900)
    await p.goto(base + '/', { waitUntil: 'domcontentloaded' })
    await waitReady(p)
    const back = await mapEval(p, 'const c = map.getCenter(); return [c.lng, c.lat, map.getZoom()]')
    ok('Mudar de módulo mantém a região: Atlas reabre onde ficou o Mapa', Math.abs(back[0] + 6.4628) < 0.05 && Math.abs(back[1] - 39.7186) < 0.05 && Math.abs(back[2] - 10.5) < 0.6, back.map((x) => x.toFixed(3)).join(','))

    // Os meus pins: mesmo motor, 3D por omissão e alternância.
    await p.goto(base + '/conta/meus-pins', { waitUntil: 'domcontentloaded' })
    await waitReady(p, '[data-meus-pins]')
    ok('T07 Os meus pins no mapa 3D (mesmo motor) com alternância 2D/3D', (await p.locator('[data-meus-pins] [data-atlas-map]').getAttribute('data-mode')) === '3d' && (await p.locator('[data-meus-pins] [data-map-controls]').count()) === 1)

    // Planeamento: jornada com um pin → «Mapa da jornada» no mesmo motor.
    const pin = await (await fetch(`${URL_}/rest/v1/pins`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Pesqueiro de teste (mapas)', lat: 39.6, lng: -8.25 }) })).json()
    const jr = await (await fetch(`${URL_}/rest/v1/journeys`, { method: 'POST', headers: H, body: JSON.stringify({ title: 'Jornada de teste (mapas)', journey_date: new Date().toISOString().slice(0, 10) }) })).json()
    await fetch(`${URL_}/rest/v1/journey_pins`, { method: 'POST', headers: H, body: JSON.stringify({ journey_id: jr[0].id, pin_id: pin[0].id, position: 0 }) })
    await p.goto(`${base}/conta/jornadas/${jr[0].id}`, { waitUntil: 'domcontentloaded' })
    await waitReady(p, '[data-private-map]')
    await p.waitForTimeout(1500)
    const jPins = await mapEval(p, 'return map.getSource("pm-pins") ? map.querySourceFeatures("pm-pins").length : -1', '[data-private-map]')
    ok('T10 Planeamento de jornadas: mesmo sistema cartográfico, com o local da jornada', jPins >= 1, `${jPins} pin(s)`)

    // Explorar barragens: mesmo motor, fichas do catálogo.
    await p.goto(base + '/explorar?vista=mapa', { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('[data-explore-map]', { state: 'attached', timeout: 60000 }).catch(() => undefined)
    const hasExplore = (await p.locator('[data-explore-map] [data-atlas-map]').count()) === 1
    if (hasExplore) await waitReady(p, '[data-explore-map]')
    const cat = hasExplore ? await mapEval(p, 'return map.getSource("catalog") ? 1 : 0', '[data-explore-map]') : 0
    ok('Explorar barragens usa o mesmo motor (catálogo e águas do Atlas)', hasExplore && cat === 1)

    // Ecrãs de vários tamanhos: sem scroll horizontal e controlos dentro do ecrã.
    for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
      await p.setViewportSize(vp)
      await p.goto(base + '/conta/mapa', { waitUntil: 'domcontentloaded' })
      await waitReady(p, '[data-private-map]')
      const box = await p.locator('[data-private-map] [data-map-controls]').boundingBox()
      ok(`T14 ${vp.width}×${vp.height}: Mapa sem scroll horizontal e controlos visíveis`, (await noHScroll(p)) && !!box && box.x + box.width <= vp.width && box.y >= 0)
    }
    await p.screenshot({ path: join(shots, 'tel-mapa-privado.png') })
    ok('sem erros na consola', p.errors.length === 0, p.errors.slice(0, 2).join(' | '))

    // Limpeza: apaga a sessão de teste (e os dados criados).
    await p.setViewportSize({ width: 390, height: 844 })
    await p.goto(`${base}/conta/definicoes`, { waitUntil: 'domcontentloaded' })
    await p.getByRole('button', { name: 'Terminar sessão de teste' }).click()
    await p.getByRole('button', { name: 'Apagar dados e sair' }).click()
    await p.waitForFunction(() => !localStorage.getItem('lancalance-auth'), null, { timeout: 30000 })
  } catch (e) {
    ok('execução sem exceções', false, e.message.split('\n')[0])
  } finally {
    await browser.close()
    console.log(results.join('\n'))
    console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} PASS · ${results.filter((r) => r.startsWith('FAIL')).length} FAIL`)
  }
})()
