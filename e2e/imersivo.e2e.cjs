// Modo imersivo do Atlas: interface expandida ↔ compacta (duas barras flutuantes) com gestos reais de câmara.
// Browser real (Chromium do Playwright, WebGL por software). Pinça e arrasto com eventos de toque reais (CDP).
// O teste E cria uma sessão de teste real (sem email), marca um pin a partir da barra inferior e apaga a sessão no fim.
// Uso: npm run build && npx vite preview --port 4173 &  NODE_USE_ENV_PROXY=1 node e2e/imersivo.e2e.cjs http://localhost:4173 screenshots/imersivo
const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

const base = process.argv[2] || 'http://localhost:4173'
const shots = process.argv[3] || 'screenshots/imersivo'
mkdirSync(shots, { recursive: true })
const CB = '-8.24839,39.60045' // Albufeira de Castelo do Bode
const results = []
let step = ''
const ok = (name, cond, extra = '') => {
  step = `depois de: ${name}`
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
const IGNORED = /Failed to load resource|ERR_|AJAXError|Failed to fetch|net::|NetworkError|status of 4\d\d|AbortError/
const phone = (width, height = 844) => ({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' })
const metres = (a, b) => {
  const r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h))
}

async function open(browser, opts) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  page.setDefaultTimeout(60000)
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && page.errors.push(m.text()))
  await page.goto(base + '/privacidade', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.setItem('atlascatch-demo-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('atlascatch-demo-v1') || '{}'), onboarded: true }))
    localStorage.setItem('catchatlas-atlas-hint', 'true')
  })
  page.cdp = await ctx.newCDPSession(page)
  return { ctx, page }
}
const mapEval = (page, fn, arg) => page.evaluate(({ src, arg }) => new Function('map', 'arg', src)(document.querySelector('[data-atlas-map] > div').__map, arg), { src: fn, arg })
async function atlas(page, cam, extra = '') {
  await page.goto(`${base}/?v=${cam}${extra}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 150000 })
  await page.waitForTimeout(1200)
  // Marca a instância do mapa: se a interface recriar o mapa, a marca desaparece.
  await mapEval(page, 'map.__probe = 1')
}
const ui = (page) => page.locator('[data-ui]').getAttribute('data-ui')
const sameMap = (page) => mapEval(page, 'return map.__probe === 1')
const cam = (page) => mapEval(page, 'const c = map.getCenter(); return { lng: c.lng, lat: c.lat, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }')
const idle = (page) => mapEval(page, 'return new Promise((r) => (map.isMoving() ? map.once("moveend", () => r(1)) : r(1)))')

/** Pinça real com dois dedos (Input.dispatchTouchEvent): `factor` > 1 aproxima. */
async function pinch(page, factor = 1.8, cx, cy) {
  const vp = page.viewportSize()
  cx ??= vp.width / 2
  cy ??= vp.height * 0.42
  const d0 = 40
  const d1 = d0 * factor
  const pts = (d) => [
    { x: cx - d, y: cy, id: 1 },
    { x: cx + d, y: cy, id: 2 },
  ]
  await page.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) })
  for (let i = 1; i <= 10; i++) {
    await page.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + ((d1 - d0) * i) / 10) })
    await page.waitForTimeout(16)
  }
  await page.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
  await idle(page)
}
/** Arrasto real com um dedo. */
async function drag(page, dx, dy) {
  const vp = page.viewportSize()
  const x = vp.width / 2
  const y = vp.height * 0.45
  await page.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  for (let i = 1; i <= 10; i++) {
    await page.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 10, y: y + (dy * i) / 10, id: 1 }] })
    await page.waitForTimeout(16)
  }
  await page.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
  await idle(page)
}
const box = (page, sel) => page.locator(sel).first().boundingBox()
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

;(async () => {
  const browser = await chromium.launch()
  try {
    // ================================================================ A–D, G: telemóvel 390 × 844
    const { ctx, page } = await open(browser, phone(390))
    await atlas(page, `${CB},11,0,0`, '&modo=2d')
    ok(
      'A estado inicial: interface expandida com cabeçalho, pesquisa, filtros, painel e «Marcar pin»',
      (await ui(page)) === 'expanded' &&
        (await page.getByRole('heading', { name: 'Atlas Ibérico' }).isVisible()) &&
        (await page.getByRole('searchbox', { name: /Pesquisar barragem/ }).isVisible()) &&
        (await page.getByRole('group', { name: 'Filtros' }).first().isVisible()) &&
        (await page.locator('[data-action="marcar-pin"]').count()) === 1 &&
        (await page.locator('[data-floating-top], [data-floating-bottom]').count()) === 0,
    )
    await page.screenshot({ path: join(shots, 'A-expandido.png') })

    // Movimento programático (como ao abrir uma ficha) não muda a interface.
    await mapEval(page, 'map.easeTo({ center: [-8.3, 39.62], zoom: 11.3, duration: 0 })')
    await page.waitForTimeout(400)
    ok('movimentos internos da câmara não recolhem a interface', (await ui(page)) === 'expanded')

    const z0 = (await cam(page)).zoom
    await pinch(page, 1.9)
    const z1 = (await cam(page)).zoom
    await page.waitForSelector('[data-floating-top]')
    const headerInert = await page.locator('header').first().evaluate((h) => h.inert)
    ok('B pinça → interface compacta com as duas barras flutuantes', (await ui(page)) === 'compact' && z1 > z0 + 0.05 && (await page.locator('[data-floating-bottom]').count()) === 1 && headerInert, `zoom ${z0.toFixed(2)} → ${z1.toFixed(2)}`)
    await page.screenshot({ path: join(shots, 'B-compacto.png') })

    const c0 = await cam(page)
    for (const [dx, dy] of [
      [120, 0],
      [-60, 90],
      [0, -140],
    ])
      await drag(page, dx, dy)
    await pinch(page, 0.7)
    const c1 = await cam(page)
    ok('C exploração (arrastos e nova pinça): continua compacta e o mapa responde', (await ui(page)) === 'compact' && metres(c0, c1) > 50 && (await sameMap(page)), `${metres(c0, c1).toFixed(0)} m deslocados`)
    const top = await box(page, '[data-floating-top] nav')
    const bottom = await box(page, '[data-floating-bottom] > div')
    ok('barras compactas: alturas 52/56 px, dentro do ecrã e longe do centro', top.height <= 56 && bottom.height <= 60 && top.y >= 0 && bottom.y + bottom.height <= 844 && top.y + top.height < 120 && bottom.y > 844 - 100, `topo ${Math.round(top.width)}×${Math.round(top.height)} · fundo ${Math.round(bottom.width)}×${Math.round(bottom.height)}`)
    const mapShare = ((844 - (top.y + top.height) - (844 - bottom.y)) / 844) * 100
    ok('área útil do mapa entre as barras ≥ 80 % da altura', mapShare >= 80, `${mapShare.toFixed(0)} %`)

    // D — pesquisa a partir da barra superior.
    await page.getByRole('button', { name: 'Pesquisar barragem, lagoa ou rio' }).click()
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('type') === 'search')
    ok('D lupa da barra: expande e põe o foco no campo de pesquisa', (await ui(page)) === 'expanded' && focused)
    await page.keyboard.type('Castelo do Bode')
    await page.waitForTimeout(600)
    // Gesto enquanto se escreve: a interface e o foco mantêm-se.
    await pinch(page, 1.2)
    ok('pinça enquanto escreve: mantém a pesquisa aberta e o foco', (await ui(page)) === 'expanded' && (await page.evaluate(() => document.activeElement?.getAttribute('type') === 'search')))
    const firstHit = page.locator('[data-atlas-hit], [role="listbox"] [role="option"], ul[aria-label*="esultados"] button').first()
    let selected = false
    if (await firstHit.count()) {
      await firstHit.click()
      selected = true
    } else {
      await page.keyboard.press('Enter')
      selected = true
    }
    await page.waitForFunction(() => new URL(location.href).searchParams.get('sel'), null, { timeout: 30000 }).catch(() => (selected = false))
    ok('D resultado selecionado abre a ficha, sem recriar o mapa', selected && (await ui(page)) === 'expanded' && (await sameMap(page)), new URL(page.url()).searchParams.get('sel') ?? '')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)

    // G — menus: expandir e recolher várias vezes, com estado preservado.
    let stable = true
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
      await pinch(page, i % 2 ? 0.8 : 1.25)
      stable &&= (await ui(page)) === 'compact'
      if (i === 0) {
        await page.getByRole('button', { name: /^Filtros/ }).click()
        await page.locator('[data-floating-popover="filters"]').getByRole('button', { name: 'Portugal' }).click()
        await page.locator('[data-floating-popover="filters"]').getByRole('button', { name: 'Favoritas' }).click()
        await page.keyboard.press('Escape')
      }
      await page.getByRole('button', { name: /^Mais: percursos/ }).click()
      await page.locator('[data-action="expandir-interface"]').click()
      stable &&= (await ui(page)) === 'expanded'
    }
    const params = new URL(page.url()).searchParams
    const ptOn = await page.locator('header').getByRole('button', { name: 'Portugal' }).getAttribute('aria-pressed')
    ok('G 3 ciclos compacto ↔ expandido: filtros (país, favoritas) preservados, mesma instância do mapa', stable && ptOn === 'true' && (await sameMap(page)) && [...params.keys()].length > 0, page.url().split('?')[1])
    await page.locator('header').getByRole('button', { name: 'Favoritas' }).click()
    await page.locator('header').getByRole('button', { name: 'Portugal' }).click()

    // Botões de zoom e teclado também recolhem a interface.
    // Sem ficha aberta (o painel a meio tapa a coluna da direita, como antes).
    await atlas(page, `${CB},11,0,0`, '&modo=2d')
    await page.getByRole('button', { name: 'Mais ferramentas do mapa (zoom, rotação, inclinação, Península, lista e fontes)' }).click()
    await page.getByRole('button', { name: 'Aproximar' }).click()
    ok('botão «Aproximar» → compacta', (await ui(page)) === 'compact')
    await page.getByRole('button', { name: /^Mais: percursos/ }).click()
    await page.locator('[data-action="expandir-interface"]').click()
    await page.locator('[data-atlas-map] canvas').focus()
    await page.keyboard.press('Equal')
    await page.waitForTimeout(500)
    ok('zoom pelo teclado (+) → compacta', (await ui(page)) === 'compact')

    // «Explorar águas» na barra inferior abre a lista; «Pins» alterna a camada pessoal.
    await page.locator('[data-action="explorar-aguas"]').click()
    await page.waitForTimeout(500)
    ok('«Explorar águas» abre a lista de águas desta vista', (await ui(page)) === 'expanded' && new URL(page.url()).searchParams.get('lista') !== null ? true : (await page.getByText(/nesta vista/).count()) > 0)
    await pinch(page, 1.15)
    await page.getByRole('button', { name: /Os meus pins visíveis/ }).click()
    const hidden = new URL(page.url()).searchParams.get('meus') === '0'
    await page.getByRole('button', { name: /Os meus pins escondidos/ }).click()
    ok('«Pins» esconde e volta a mostrar os pins pessoais', hidden && new URL(page.url()).searchParams.get('meus') === null)

    // I — regressões acessíveis pelo menu «Mais».
    await page.getByRole('button', { name: /^Mais: percursos/ }).click()
    await page.locator('[data-floating-popover="more"]').getByRole('button', { name: 'Camadas' }).click()
    await page.locator('[data-floating-popover="layers"]').getByRole('switch', { name: /Carpa/ }).click()
    const carp = new URL(page.url()).searchParams.get('carpa_camada') === '1'
    await page.locator('[data-floating-popover="layers"]').getByRole('switch', { name: /Carpa/ }).click()
    ok('I camadas (Carpa) a partir da barra compacta', carp && new URL(page.url()).searchParams.get('carpa_camada') === null)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^Mais: percursos/ }).click()
    await page.locator('[data-floating-popover="more"]').getByRole('button', { name: '3D' }).click()
    await page.waitForFunction(() => document.querySelector('[data-atlas-map]')?.getAttribute('data-mode') === '3d')
    ok('I 2D → 3D a partir da barra compacta mantém a interface compacta e o mapa', (await ui(page)) === 'compact' && (await sameMap(page)))
    await page.keyboard.press('Escape')

    // F — 3D: zoom, rotação e inclinação com gestos reais.
    await page.waitForTimeout(1500)
    const f0 = await cam(page)
    await pinch(page, 1.4)
    await page.locator('[data-atlas-map] canvas').focus()
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft')
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowUp')
    await page.waitForTimeout(800)
    await idle(page)
    const f1 = await cam(page)
    ok('F 3D: pinça, rotação e inclinação funcionam e a interface fica compacta', (await ui(page)) === 'compact' && f1.zoom > f0.zoom + 0.2 && Math.abs(f1.bearing - f0.bearing) > 5 && f1.pitch !== f0.pitch && (await sameMap(page)), `zoom ${f0.zoom.toFixed(2)}→${f1.zoom.toFixed(2)} · rot ${f0.bearing.toFixed(0)}→${f1.bearing.toFixed(0)}° · incl ${f0.pitch.toFixed(0)}→${f1.pitch.toFixed(0)}°`)
    await page.screenshot({ path: join(shots, 'F-3d-compacto.png') })
    await page.locator('[data-floating-north]').click()
    await page.waitForTimeout(900)
    ok('bússola flutuante põe o norte para cima', Math.abs((await cam(page)).bearing) < 1)

    // Tocar numa albufeira abre a ficha (a interface expande para a mostrar).
    await page.goto(`${base}/?v=${CB},12,0,0&modo=2d`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 150000 })
    await page.waitForTimeout(2500)
    await pinch(page, 1.2)
    const pt = await mapEval(page, 'const f = map.queryRenderedFeatures().find((x) => x.properties && x.properties.area_km2 > 5 && x.geometry.type.includes("Polygon")); if (!f) return null; const p = map.project([-8.24839, 39.60045]); return { x: p.x, y: p.y }')
    if (pt) {
      await page.touchscreen.tap(pt.x, pt.y)
      await page.waitForTimeout(1500)
    }
    ok('tocar numa água em modo compacto abre a ficha (interface expande)', !!pt && (await ui(page)) === 'expanded' && !!new URL(page.url()).searchParams.get('sel'))
    ok('telemóvel: sem erros na consola', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
    await ctx.close()

    // ================================================================ H: ecrãs pequenos e grandes
    for (const w of [320, 375, 390, 430]) {
      const { ctx: c, page: p } = await open(browser, phone(w, w === 320 ? 568 : 812))
      await atlas(p, `${CB},11,0,0`, '&modo=2d')
      await pinch(p, 1.5)
      const vp = p.viewportSize()
      const t = await box(p, '[data-floating-top] nav')
      const b = await box(p, '[data-floating-bottom] > div')
      const targets = await p.$$eval('[data-floating-top] button, [data-floating-bottom] button', (els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => Math.min(r.width, r.height)))
      ok(
        `H ${w}px: barras dentro da área útil, sem sobreposição nem scroll horizontal, alvos ≥ 44 px`,
        (await ui(p)) === 'compact' && t.x >= 8 && t.x + t.width <= vp.width - 8 && b.x >= 8 && b.x + b.width <= vp.width - 8 && b.y + b.height <= vp.height && t.y + t.height < b.y && (await noHScroll(p)) && Math.min(...targets) >= 44,
        `topo ${Math.round(t.width)} px · fundo ${Math.round(b.width)} px · alvo mínimo ${Math.min(...targets)} px`,
      )
      if (w === 320) await p.screenshot({ path: join(shots, 'H-320.png') })
      await c.close()
    }

    // Tablet e computador: roda do rato recolhe; painel lateral volta com «Explorar águas».
    for (const [label, vp] of [
      ['tablet 820×1180', { width: 820, height: 1180, isMobile: true, hasTouch: true }],
      ['computador 1440×900', { width: 1440, height: 900 }],
    ]) {
      const { ctx: c, page: p } = await open(browser, { viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1, reducedMotion: 'reduce' })
      await atlas(p, `${CB},10,0,0`, '&modo=2d')
      await p.mouse.move(vp.width * 0.6, vp.height / 2)
      await p.mouse.wheel(0, -400)
      await p.waitForTimeout(800)
      const z = (await cam(p)).zoom
      const compactNow = (await ui(p)) === 'compact'
      if (!compactNow) {
        ok(`${label}: roda do rato → compacta`, false, `ui=${await ui(p)} zoom=${z.toFixed(2)}`)
        await c.close()
        continue
      }
      await p.locator('[data-action="explorar-aguas"]').click()
      await p.waitForTimeout(500)
      ok(`${label}: roda do rato → compacta; «Explorar águas» repõe o painel`, compactNow && (await ui(p)) === 'expanded' && (await p.getByRole('searchbox', { name: /Pesquisar barragem/ }).isVisible()))
      if (label.startsWith('computador')) await p.screenshot({ path: join(shots, 'computador-expandido.png') })
      await c.close()
    }

    // ================================================================ E: marcar pin a partir da barra inferior (sessão de teste real)
    const { ctx: ce, page: pe } = await open(browser, phone(390))
    await pe.goto(base + '/entrar', { waitUntil: 'domcontentloaded' })
    await pe.click('[data-action="sessao-teste"]')
    await pe.waitForURL(/\/conta$/, { timeout: 60000 })
    await atlas(pe, `${CB},14.8,0,0`, '&modo=2d')
    await pinch(pe, 1.1)
    ok('E compacto antes de marcar', (await ui(pe)) === 'compact')
    await pe.locator('[data-floating-bottom] [data-action="marcar-pin"]').click()
    await pe.waitForSelector('[data-composer-step="place"]')
    await pe.waitForSelector('[data-crosshair]')
    await drag(pe, 30, 20)
    await pinch(pe, 1.1)
    ok('E durante a marcação o mapa continua interativo e os passos ficam visíveis (sem barras)', (await pe.locator('[data-composer-step="place"]').isVisible()) && (await pe.locator('[data-floating-top]').count()) === 0)
    await pe.waitForTimeout(500)
    const cr = await box(pe, '[data-crosshair]')
    const expected = await mapEval(pe, 'const ll = map.unproject([arg.x, arg.y]); return { lng: ll.lng, lat: ll.lat }', { x: cr.x + cr.width / 2, y: cr.y + cr.height / 2 })
    await pe.getByRole('button', { name: 'Confirmar local' }).click()
    await pe.waitForSelector('[data-composer-step="details"]')
    await pe.fill('#pc-species', `Imersivo ${Date.now().toString(36)}`)
    await pe.click('[data-action="guardar-pin"]')
    await pe.waitForSelector('[data-pin-sheet]')
    const el = pe.locator('[data-pin-sheet]')
    const pin = { lat: Number(await el.getAttribute('data-lat')), lng: Number(await el.getAttribute('data-lng')) }
    ok('E pin guardado no ponto da mira (igual ao fluxo anterior)', metres(pin, expected) < 0.5, `${metres(pin, expected).toFixed(3)} m`)
    await pe.waitForSelector('[data-pin-sheet][data-pin-state="synced"]', { timeout: 90000 })
    ok('E pin sincronizado com a conta', true)
    ok('E sem erros na consola', pe.errors.length === 0, pe.errors.slice(0, 2).join(' | '))
    // Termina a sessão de teste (apaga servidor e dispositivo).
    await pe.goto(`${base}/conta/definicoes`, { waitUntil: 'domcontentloaded' })
    await pe.waitForSelector('[data-guest-session]')
    await pe.getByRole('button', { name: 'Terminar sessão de teste' }).click()
    await pe.getByRole('button', { name: 'Apagar dados e sair' }).click()
    await pe.waitForFunction(() => !localStorage.getItem('lancalance-auth'), null, { timeout: 60000 })
    ok('sessão de teste terminada e apagada', true)
    await ce.close()
  } catch (e) {
    ok('execução sem exceções', false, `[${step}] ` + String(e?.message ?? e).split('\n')[0])
  } finally {
    await browser.close()
    console.log(results.join('\n'))
    console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} PASS · ${results.filter((r) => r.startsWith('FAIL')).length} FAIL`)
  }
})()
