// Verificações de integração do Atlas Ibérico 3D (browser real, Chromium do Playwright).
// Uso: npm run build && npx vite preview --port 4173 &  node e2e/atlas.e2e.cjs http://localhost:4173 <pasta-screenshots>
// Cobre: vista inicial com volume, níveis de detalhe, seleção e persistência do ID, fluxos de jornada e
// captura, sincronização mapa/lista, pesquisa por nomes alternativos, filtros, favoritas, gestos e
// recuperação de erros (DEM, dados, registo, WebGL, geolocalização), em 390, 768, 1024 e 1440 px.
const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

const base = process.argv[2] || 'http://localhost:4173'
const shots = process.argv[3] || 'screenshots/atlas'
mkdirSync(shots, { recursive: true })
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
const IGNORED = /Failed to load resource|ERR_|AJAXError|Failed to fetch|net::|DEM \d|registo: HTTP/

async function open(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!opts.touch, isMobile: !!opts.touch, reducedMotion: 'reduce' })
  if (opts.blockDem) await ctx.route('**/elevation-tiles-prod/**', (r) => r.abort())
  if (opts.blockOverview) await ctx.route('**/map/water/overview.geojson', (r) => r.abort())
  if (opts.blockRegistry) await ctx.route('**/map/atlas/registry.json', (r) => r.abort())
  if (opts.noWebgl)
    await ctx.addInitScript(() => {
      const g = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (t, ...a) {
        return /webgl/i.test(String(t)) ? null : g.call(this, t, ...a)
      }
    })
  const page = await ctx.newPage()
  // WebGL por software (SwiftShader) em CI é lento: limites generosos de navegação.
  page.setDefaultNavigationTimeout(90000)
  page.setDefaultTimeout(45000)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && errors.push(m.text()))
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('atlascatch-demo-v1') || 'null')
    if (s) {
      s.onboarded = true
      s.favorites = ['castelo-de-bode', 'alqueva']
      s.favoriteWaters = []
      localStorage.setItem('atlascatch-demo-v1', JSON.stringify(s))
    }
    localStorage.setItem('catchatlas-atlas-hint', 'false')
  })
  return { ctx, page, errors }
}
const ready = async (page) => {
  await page.waitForFunction(() => document.querySelector('[data-atlas-status="ready"] [data-atlas-map][data-zoom]'), null, { timeout: 90000 })
  await page.waitForTimeout(1800)
}
const ds = (page) => page.evaluate(() => ({ ...document.querySelector('[data-atlas-map]')?.dataset }))
/** Espera até o estado observável do mapa (atualizado no evento "idle") cumprir a condição. */
const waitDs = (page, fnSrc, timeout = 20000) => page.waitForFunction(`(() => { const d = { ...document.querySelector('[data-atlas-map]')?.dataset }; return ${fnSrc} })()`, null, { timeout }).catch(() => {})
const sp = (page) => new URL(page.url()).searchParams
const search = async (page, q) => {
  await page.fill('input[aria-label="Pesquisar barragem, lagoa ou rio"]', q)
  if (q.trim().length >= 2) await page.waitForSelector('[data-atlas-row], [data-atlas-empty]', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(500)
}
/** Cada secção corre isolada: uma falha regista FAIL e as seguintes continuam. */
const section = async (name, fn) => {
  try {
    await fn()
  } catch (e) {
    ok(`${name} (exceção)`, false, String(e.message).split('\n')[0])
  }
}
const rows = (page) => page.evaluate(() => [...document.querySelectorAll('[data-atlas-row]')].map((e) => ({ id: e.getAttribute('data-atlas-row'), text: e.textContent })))
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
const attributionVisible = (page) =>
  page.evaluate(() => {
    const a = document.querySelector('.maplibregl-ctrl-attrib')
    if (!a) return false
    const r = a.getBoundingClientRect()
    if (r.bottom > innerHeight || r.right > innerWidth || r.width === 0) return false
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !!hit && (a === hit || a.contains(hit))
  })

;(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

  // ---------------- Desktop 1440 ----------------
  await section('desktop', async () => {
    const { ctx, page, errors } = await open(browser, { width: 1440, height: 900 })
    await page.goto(base + '/atlas', { waitUntil: 'domcontentloaded' })
    await ready(page)
    let d = await ds(page)
    ok('vista inicial: laje com volume visível', d.slab === 'true' && d.walls === '1.00' && Number(d.depth) > 20000, `walls=${d.walls} depth=${d.depth}`)
    ok('vista inicial: inclinação oblíqua 35–50°', Number(d.pitch) >= 35 && Number(d.pitch) <= 50, `pitch=${d.pitch}`)
    ok('vista inicial: só as maiores albufeiras', Number(d.waterCount) >= 8 && Number(d.waterCount) <= 20, `n=${d.waterCount}`)
    ok('atribuição visível (1440)', await attributionVisible(page))
    ok('sem scroll horizontal (1440)', await noOverflow(page))
    await page.screenshot({ path: join(shots, '1440-peninsula.png') })

    // Pesquisa por nome alternativo, sem acentos, vazia.
    await search(page, 'Tajo')
    let r = await rows(page)
    ok('pesquisa "Tajo" → Tejo / Tajo primeiro', r[0]?.id === 'ne-rio-tejo' && /Também conhecido como Tajo/.test(r[0]?.text ?? ''), r[0]?.text?.slice(0, 60))
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1600)
    ok('Enter seleciona o 1.º resultado e enquadra um troço útil', sp(page).get('sel') === 'ne-rio-tejo' && !!sp(page).get('troco'), page.url())
    ok('ficha do rio', (await page.textContent('#atlas-detail-title', { timeout: 10000 }).catch(() => ''))?.includes('Tejo / Tajo'))
    await page.screenshot({ path: join(shots, '1440-rio-tejo.png') })
    await page.keyboard.press('Escape')
    await search(page, 'alcantara')
    r = await rows(page)
    ok('pesquisa sem acentos ("alcantara")', r.some((x) => /Alcántara/.test(x.text)))
    await search(page, 'zzqqxx')
    ok('pesquisa sem resultados tem resposta clara', await page.isVisible('[data-atlas-empty]'))
    await search(page, '')

    // Escala local: terreno 3D, paredes desaparecidas, mais albufeiras.
    await page.goto(base + '/atlas?v=-8.20,39.60,9.6,50,10', { waitUntil: 'domcontentloaded' })
    await ready(page)
    d = await ds(page)
    ok('escala local: paredes desaparecidas e terreno local ativo', d.walls === '0.00' && Number(d.terrain) > 0, `walls=${d.walls} terrain=${d.terrain}`)
    ok('escala local: geometria detalhada carregada por blocos', Number(d.chunks) >= 1 && Number(d.waterCount) > 8, `chunks=${d.chunks} n=${d.waterCount}`)
    await page.screenshot({ path: join(shots, '1440-local.png') })

    // Seleção no mapa → ficha com o mesmo ID → fluxos.
    const probes = JSON.parse(d.probes || '[]')
    const p = probes.find((x) => x.catalog === 'castelo-de-bode') || probes.find((x) => x.catalog && x.x > 440 && x.y > 100 && x.y < 860)
    ok('há albufeiras com ficha tocáveis no ecrã', !!p)
    if (p) {
      await page.mouse.click(p.x, p.y)
      await page.waitForTimeout(1500)
      const chooser = await page.$('[data-atlas-chooser]')
      if (chooser) await page.click(`[data-atlas-chooser] button:has-text("${p.name}")`).catch(() => {})
      await page.waitForTimeout(1200)
      const det = await page.$('[data-atlas-detail]')
      const catalog = await det?.getAttribute('data-catalog')
      const damName = await det?.getAttribute('data-catalog-name')
      ok('tocar numa albufeira abre a ficha com o ID correto', sp(page).get('sel') === p.id && catalog === p.catalog, `${sp(page).get('sel')} / ${catalog}`)
      d = await ds(page)
      ok('mapa realça a mesma seleção', d.sel === p.id, d.sel)
      const hrefs = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-flow]')].map((a) => [a.getAttribute('data-flow'), a.getAttribute('href')])))
      ok('fluxos recebem o ID da ficha', hrefs.jornada === `/jornada/nova?barragem=${catalog}` && hrefs.captura === `/capturas/nova?barragem=${catalog}` && hrefs.ficha === `/barragens/${catalog}`, JSON.stringify(hrefs))
      await page.screenshot({ path: join(shots, '1440-selecao-local.png') })
      const atlasUrl = page.url()
      await page.click('[data-flow="jornada"]')
      await page.waitForTimeout(1500)
      ok('Preparar jornada abre o fluxo existente com o local pré-selecionado', page.url().includes(`/jornada/nova?barragem=${catalog}`) && (await page.textContent('body')).includes(damName))
      await page.goBack()
      await ready(page)
      ok('voltar mantém a seleção e a vista do atlas', sp(page).get('sel') === p.id && !!sp(page).get('v') && (await page.isVisible('[data-atlas-detail]')), page.url() === atlasUrl ? 'mesmo URL' : page.url())
      await page.click('[data-flow="captura"]')
      await page.waitForTimeout(1500)
      ok('Registar captura abre o formulário com o local pré-preenchido', (await page.inputValue('#f-dam').catch(() => '')) === catalog)
      await page.goBack()
      await ready(page)
    }

    // Lista sincronizada (alternativa ao canvas) e filtros.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    await page.click('button[aria-label="Lista de águas nesta vista"]')
    await page.waitForTimeout(1500)
    r = await rows(page)
    ok('lista desta vista', r.length > 5, `n=${r.length}`)
    const row = r.find((x) => !/Ficha/.test(x.text)) ?? r[1]
    await page.click(`[data-atlas-row="${row.id}"]`)
    await page.waitForTimeout(2200)
    d = await ds(page)
    ok('selecionar na lista seleciona no mapa (mesmo estado)', sp(page).get('sel') === row.id && (await page.getAttribute('[data-atlas-detail]', 'data-atlas-detail')) === row.id, `${row.id} / map ${d.sel}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await page.click('button[aria-pressed]:has-text("Espanha")')
    await page.waitForTimeout(1200)
    r = await rows(page)
    ok('filtro Espanha no URL e na lista', sp(page).get('pais') === 'ES' && r.length > 0 && r.every((x) => /Espanha/.test(x.text)), `n=${r.length}`)
    await page.click('button[aria-pressed]:has-text("Espanha")')
    await page.click('button[aria-pressed]:has-text("Rios")')
    await page.waitForTimeout(800)
    r = await rows(page)
    ok('filtro por tipo (rios)', r.length > 0 && r.every((x) => /Curso de água/.test(x.text)), `n=${r.length}`)
    await page.click('button[aria-pressed]:has-text("Rios")')

    // Favorita de um local sem ficha (estado partilhado com o filtro Favoritas).
    await search(page, 'Lagoa Comprida')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)
    const selId = sp(page).get('sel')
    ok('local sem ficha mostra o estado explícito', await page.isVisible('[data-no-catalog]'))
    await page.click('button[aria-pressed]:has-text("Favoritar")')
    await page.waitForTimeout(400)
    const favs = await page.evaluate(() => JSON.parse(localStorage.getItem('atlascatch-demo-v1')).favoriteWaters)
    ok('favoritar local sem ficha fica guardado', favs.includes(selId), favs.join(','))
    await page.keyboard.press('Escape')
    await search(page, '')
    await page.click('button[aria-pressed]:has-text("Favoritas")')
    await page.waitForTimeout(1200)
    await page.click('button[aria-label="Ver Península"]')
    await page.waitForTimeout(2500)
    r = await rows(page)
    ok('filtro Favoritas inclui fichas e locais sem ficha', r.some((x) => x.id === selId) && r.some((x) => /Ficha/.test(x.text)), r.map((x) => x.id).join(','))
    await page.click('button[aria-pressed]:has-text("Favoritas")')

    // Gestos: arrastar move o mapa e não muda de percurso.
    await page.goto(base + '/atlas', { waitUntil: 'domcontentloaded' })
    await ready(page)
    const before = await ds(page)
    await page.mouse.move(900, 450)
    await page.mouse.down()
    await page.mouse.move(760, 430, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(1500)
    const after = await ds(page)
    ok('arrastar no mapa move o mapa e não muda de percurso', new URL(page.url()).pathname === '/atlas' && before.probes !== after.probes && (await page.textContent('nav[aria-label="Percursos"] [aria-current="page"]')).includes('Prepara'))
    // Controlos visíveis de rotação, inclinação, norte, 2D/3D e Península.
    await page.click('button[aria-label="Rodar para a direita"]')
    await waitDs(page, `Math.abs(Number(d.bearing) - ${Number(after.bearing)}) >= 15`)
    ok('rodar', Math.abs(Number((await ds(page)).bearing) - Number(after.bearing)) >= 15, `${after.bearing} → ${(await ds(page)).bearing}`)
    await page.click('button[aria-label="Inclinar menos"]')
    await waitDs(page, `Number(d.pitch) < ${Number(after.pitch) - 5}`)
    ok('inclinar', Number((await ds(page)).pitch) < Number(after.pitch) - 5)
    await page.click('button[aria-label^="Norte para cima"]')
    await waitDs(page, 'Math.abs(Number(d.bearing)) < 0.5')
    ok('norte', Math.abs(Number((await ds(page)).bearing)) < 0.5)
    await page.click('button[aria-pressed]:has-text("2D")')
    await waitDs(page, "Number(d.pitch) < 1 && d.walls === '0.00'")
    d = await ds(page)
    ok('2D: sem inclinação nem paredes', Number(d.pitch) < 1 && d.walls === '0.00' && sp(page).get('modo') === '2d')
    await page.screenshot({ path: join(shots, '1440-2d.png') })
    await page.click('button[aria-pressed]:has-text("3D")')
    await page.click('button[aria-label="Aproximar"]')
    await page.waitForTimeout(1200)
    await page.click('button[aria-label="Ver Península"]')
    await waitDs(page, "Number(d.pitch) > 35 && d.walls === '1.00'")
    d = await ds(page)
    ok('Ver Península repõe a vista com volume', Number(d.pitch) > 35 && d.walls === '1.00')
    ok('sem erros de página (desktop)', errors.length === 0, errors.slice(0, 3).join(' | '))
    await ctx.close()
  })

  // ---------------- Desempenho (animações reais, sem movimento reduzido) ----------------
  await section('desempenho', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' })
    const page = await ctx.newPage()
    page.setDefaultNavigationTimeout(90000)
    await page.goto(base + '/atlas?v=-8.2,39.6,9.4,50,10', { waitUntil: 'domcontentloaded' })
    await ready(page)
    // "Ver Península" é um voo de ~1,1 s: o mapa regista os frames desenhados durante o movimento.
    await page.click('button[aria-label="Ver Península"]')
    await waitDs(page, "Number(d.pitch) > 35 && d.walls === '1.00' && !!d.fps", 30000)
    const fly = (await ds(page)).fps
    await page.click('button[aria-label="Aproximar"]')
    await page.waitForTimeout(2500)
    const zoom = (await ds(page)).fps
    results.push(`INFO frames/s medidos neste ambiente (Chromium headless com SwiftShader: WebGL por CPU, sem GPU; não representa um telemóvel real): voo para a Península ${fly ?? 'n/d'}, zoom animado ${zoom ?? 'n/d'}`)
    await ctx.close()
  })

  // ---------------- Telemóvel 390 (toque) ----------------
  await section('telemóvel', async () => {
    const { ctx, page, errors } = await open(browser, { width: 390, height: 844 }, { touch: true })
    await page.goto(base + '/atlas', { waitUntil: 'domcontentloaded' })
    await ready(page)
    ok('telemóvel: bottom sheet recolhido e sem painel lateral', (await page.getAttribute('[data-sheet]', 'data-sheet')) === 'peek' && !(await page.$('aside[aria-label="Painel do Atlas"]')))
    ok('telemóvel: atribuição visível acima do painel', await attributionVisible(page))
    ok('telemóvel: sem scroll horizontal', await noOverflow(page))
    await page.screenshot({ path: join(shots, '390-peninsula.png') })
    await page.goto(base + '/atlas?v=-8.20,39.55,9.6,45,10', { waitUntil: 'domcontentloaded' })
    await ready(page)
    const probes = JSON.parse((await ds(page)).probes || '[]').filter((x) => x.x > 20 && x.x < 320 && x.y > 220 && x.y < 700)
    const p = probes.find((x) => x.catalog) || probes[0]
    if (p) {
      await page.touchscreen.tap(p.x, p.y)
      await page.waitForTimeout(1600)
      if (await page.$('[data-atlas-chooser]')) await page.click('[data-atlas-chooser] li button').catch(() => {})
      await page.waitForTimeout(1200)
      ok('telemóvel: toque abre a ficha no painel a meio', (await page.getAttribute('[data-sheet]', 'data-sheet')) === 'half' && (await page.isVisible('[data-atlas-detail]')))
      ok('telemóvel: atribuição continua visível com o painel aberto', await attributionVisible(page))
      await page.screenshot({ path: join(shots, '390-selecao.png') })
      await page.click('[data-sheet-handle]')
      await page.waitForTimeout(600)
      ok('telemóvel: painel expandido', (await page.getAttribute('[data-sheet]', 'data-sheet')) === 'full')
      await page.screenshot({ path: join(shots, '390-ficha-expandida.png') })
    } else ok('telemóvel: há albufeiras tocáveis', false)
    // Geolocalização só a pedido; recusa com resposta clara.
    await page.click('[data-sheet-handle]')
    await page.click('button[aria-label="A minha localização"]')
    await page.waitForTimeout(1500)
    ok('localização recusada tem resposta clara', /Localização recusada|Não foi possível obter/.test(await page.textContent('body')))
    ok('sem erros de página (telemóvel)', errors.length === 0, errors.slice(0, 3).join(' | '))
    await ctx.close()
  })

  // ---------------- Tablet retrato 768 e paisagem 1024 ----------------
  for (const [w, h, sheet] of [[768, 1024, true], [1024, 768, false]]) await section(`tablet ${w}`, async () => {
    const { ctx, page, errors } = await open(browser, { width: w, height: h }, { touch: true })
    await page.goto(base + '/atlas', { waitUntil: 'domcontentloaded' })
    await ready(page)
    ok(`tablet ${w}×${h}: ${sheet ? 'bottom sheet' : 'painel lateral'}`, sheet ? !!(await page.$('[data-sheet]')) : !!(await page.$('aside[aria-label="Painel do Atlas"]')))
    ok(`tablet ${w}×${h}: atribuição visível e sem scroll horizontal`, (await attributionVisible(page)) && (await noOverflow(page)))
    await page.screenshot({ path: join(shots, `${w}x${h}-peninsula.png`) })
    await page.goto(base + '/atlas?v=-7.35,38.25,8.4,48,10', { waitUntil: 'domcontentloaded' })
    await ready(page)
    await page.screenshot({ path: join(shots, `${w}x${h}-regional.png`) })
    await search(page, 'Alqueva')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2500)
    ok(`tablet ${w}×${h}: seleção visível`, await page.isVisible('[data-atlas-detail]'))
    await page.screenshot({ path: join(shots, `${w}x${h}-selecao.png`) })
    ok(`sem erros de página (tablet ${w})`, errors.length === 0, errors.slice(0, 3).join(' | '))
    await ctx.close()
  })

  // ---------------- Recuperação de erros ----------------
  await section('erro DEM', async () => {
    const { ctx, page } = await open(browser, { width: 1440, height: 900 }, { blockDem: true })
    await page.goto(base + '/atlas', { waitUntil: 'domcontentloaded' })
    await ready(page)
    await page.waitForTimeout(2500)
    ok('DEM indisponível: aviso e continua em 2D', /Relevo indisponível/.test(await page.textContent('body')) && sp(page).get('modo') === '2d' && (await ds(page)).terrain === '0')
    await page.screenshot({ path: join(shots, 'erro-dem.png') })
    await ctx.close()
  })
  await section('erro dados', async () => {
    const { ctx, page } = await open(browser, { width: 1440, height: 900 }, { blockOverview: true })
    await page.goto(base + '/atlas', { waitUntil: 'domcontentloaded' })
    await ready(page)
    ok('dados das albufeiras indisponíveis: aviso, mapa utilizável', /Não foi possível carregar parte das albufeiras/.test(await page.textContent('body')) && (await ds(page)).slab === 'true')
    await ctx.close()
  })
  await section('erro registo', async () => {
    const { ctx, page } = await open(browser, { width: 1440, height: 900 }, { blockRegistry: true })
    await page.goto(base + '/atlas?painel=lista', { waitUntil: 'domcontentloaded' })
    await ready(page)
    await page.waitForTimeout(1000)
    ok('registo indisponível: aviso com nova tentativa', /Não foi possível carregar a lista/.test(await page.textContent('body')) && (await page.isVisible('button:has-text("Tentar de novo")')))
    await ctx.close()
  })
  await section('sem WebGL', async () => {
    const { ctx, page, errors } = await open(browser, { width: 390, height: 844 }, { noWebgl: true, touch: true })
    await page.goto(base + '/atlas', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-atlas-status="webgl-error"]', { timeout: 30000 })
    await page.waitForFunction(() => document.querySelectorAll('[data-atlas-row]').length > 5, null, { timeout: 30000 })
    ok('sem WebGL: alternativa utilizável com lista e pesquisa', /precisa de WebGL/.test(await page.textContent('body')))
    await search(page, 'Alqueva')
    await page.click('[data-atlas-row]')
    await page.waitForTimeout(1200)
    ok('sem WebGL: abrir ficha e fluxos pela lista', (await page.isVisible('[data-atlas-detail]')) && (await page.$('[data-flow="jornada"]')) !== null)
    await page.screenshot({ path: join(shots, 'erro-sem-webgl-390.png') })
    ok('sem WebGL: sem erros de página', errors.length === 0, errors.slice(0, 3).join(' | '))
    await ctx.close()
  })

  // ---------------- Entradas a partir de outras páginas ----------------
  await section('entradas', async () => {
    const { ctx, page } = await open(browser, { width: 1440, height: 900 })
    await page.goto(base + '/atlas?ficha=castelo-de-bode', { waitUntil: 'domcontentloaded' })
    await ready(page)
    await page.waitForTimeout(1500)
    ok('?ficha= seleciona e enquadra a albufeira da ficha', (await page.getAttribute('[data-atlas-detail]', 'data-catalog')) === 'castelo-de-bode' && !sp(page).get('ficha'))
    await page.goto(base + '/?ver=jornada', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const links = await page.evaluate(() => [...document.querySelectorAll('[data-story-panel="jornada"] a')].map((a) => a.getAttribute('href')))
    ok('Prepara a tua jornada: "Mapa" e "Explorar barragens" abrem o Atlas', links.includes('/atlas') && links.includes('/atlas?painel=lista'))
    await ctx.close()
  })

  await browser.close()
  console.log(results.join('\n'))
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} PASS · ${results.filter((r) => r.startsWith('FAIL')).length} FAIL`)
})()
