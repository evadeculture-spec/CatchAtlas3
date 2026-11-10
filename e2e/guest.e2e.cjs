// Sessões de teste sem email (início de sessão anónimo do Supabase), contra o backend real.
// Exige «Allow anonymous sign-ins» ativo no projeto Supabase (Authentication → Sign In / Providers).
// Uso:
//   npm run build && npx vite preview --port 4173 &
//   node e2e/guest.e2e.cjs http://localhost:4173 screenshots/sessao-teste
// Cria duas sessões de teste e termina-as no fim pelo próprio fluxo da app (que apaga os dados).
const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')
const { createClient } = require('@supabase/supabase-js')

const base = process.argv[2] || 'http://localhost:4173'
const shots = process.argv[3] || 'screenshots/sessao-teste'
mkdirSync(shots, { recursive: true })
const URL_ = process.env.VITE_SUPABASE_URL || 'https://xachgvjmhmnwaguayrcv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PjJKSFp2h6WwQy8i1XJX4A_5qlsSHhS'
const PHOTO = join(__dirname, 'fixtures', 'exif-photo.jpg')
const CB = '-8.24839,39.60045' // Albufeira de Castelo do Bode
const SPECIES = `Achigã ${Date.now().toString(36)}`
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
const IGNORED = /Failed to load resource|ERR_|AJAXError|Failed to fetch|net::|NetworkError|status of 4\d\d/
const metres = (a, b) => {
  const r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h))
}

async function open(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.setDefaultNavigationTimeout(90000)
  page.setDefaultTimeout(45000)
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && page.errors.push(m.text()))
  return { ctx, page }
}
/** Sessão guardada pelo cliente Supabase da app (para verificar o lado do servidor com o mesmo token). */
const session = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lancalance-auth') || 'null'))
const asUser = (token) => createClient(URL_, KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
const mapEval = (page, fn, arg) =>
  page.evaluate(
    ({ src, arg }) => {
      const map = document.querySelector('[data-atlas-map] > div').__map
      return new Function('map', 'arg', src)(map, arg)
    },
    { src: fn, arg },
  )
async function atlas(page, cam) {
  await page.goto(`${base}/?v=${cam}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 120000 })
  await page.waitForTimeout(1500)
}
async function endTestSession(page) {
  await page.goto(`${base}/conta/definicoes`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-guest-session]')
  await page.getByRole('button', { name: 'Terminar sessão de teste' }).click()
  await page.getByRole('button', { name: 'Apagar dados e sair' }).click()
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 60000 })
  await page.waitForFunction(() => !localStorage.getItem('lancalance-auth'), null, { timeout: 30000 })
}

;(async () => {
  const browser = await chromium.launch()
  try {
    // ============================================================ sessão 1: boas-vindas → Atlas → pin com foto → diário
    const { ctx, page } = await open(browser)
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' })
    await page.click('[data-action="sessao-teste"]')
    await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 120000 })
    const s1 = await session(page)
    ok('boas-vindas: «Experimentar sem email» abre o Atlas com uma sessão de teste', !!s1?.user?.is_anonymous && !s1.user.email)
    const uid1 = s1.user.id
    await atlas(page, `${CB},14.8,45,0`)
    await page.click('[data-action="marcar-pin"]')
    ok('«Marcar pin» abre o compositor (sem pedir conta)', (await page.locator('[data-composer-step="place"]').count()) === 1)
    await page.waitForSelector('[data-crosshair]')
    await page.waitForTimeout(500)
    const box = await page.locator('[data-crosshair]').boundingBox()
    const expected = await mapEval(page, 'const ll = map.unproject([arg.x, arg.y]); return { lng: ll.lng, lat: ll.lat }', { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    await page.getByRole('button', { name: 'Confirmar local' }).click()
    await page.waitForSelector('[data-composer-step="details"]')
    await page.locator('[data-composer-step] input[type=file]:not([capture])').setInputFiles(PHOTO)
    await page.waitForSelector('[data-composer-step] img[alt="Fotografia do pin"]')
    const keep = page.getByRole('button', { name: 'Manter' })
    if (await keep.count()) await keep.click()
    await page.fill('#pc-species', SPECIES)
    await page.click('[data-action="guardar-pin"]')
    await page.waitForSelector('[data-pin-sheet]')
    const el = page.locator('[data-pin-sheet]')
    const pinId = await el.getAttribute('data-pin-sheet')
    const pin = { lat: Number(await el.getAttribute('data-lat')), lng: Number(await el.getAttribute('data-lng')) }
    ok('pin guardado no ponto da mira', metres(pin, expected) < 0.5, `${metres(pin, expected).toFixed(3)} m`)
    await page.waitForSelector('[data-pin-sheet][data-pin-state="synced"]', { timeout: 90000 })
    await page.waitForSelector('[data-photo="synced"]', { timeout: 90000 })
    ok('pin e fotografia sincronizados no servidor', true)
    await page.screenshot({ path: join(shots, '1-pin-sincronizado.png') })
    const db1 = asUser(s1.access_token)
    const { data: row } = await db1.from('pings').select('id, lat, lng').eq('id', pinId).single()
    const { data: media } = await db1.from('ping_media').select('storage_path').eq('ping_id', pinId)
    ok('o registo e a fotografia existem no servidor com o mesmo ID', row?.id === pinId && (media ?? []).length >= 1)
    // Diário ↔ mapa
    await page.goto(`${base}/conta/pings/${pinId}`, { waitUntil: 'domcontentloaded' })
    await page.getByText(SPECIES).first().waitFor()
    await page.getByRole('link', { name: 'Ver no mapa' }).click()
    await page.waitForSelector(`[data-pin-sheet="${pinId}"]`, { timeout: 60000 })
    ok('diário → «Ver no mapa» abre a mesma ficha', true)
    // Partilha aproximada
    await page.getByRole('button', { name: 'Partilhar' }).click()
    await page.getByRole('button', { name: 'Publicar versão aproximada' }).click()
    await page.getByText('Partilhado (aproximado)').waitFor({ timeout: 30000 })
    ok('partilha aproximada publicada a partir da sessão de teste', true)
    // Definições
    await page.goto(`${base}/conta/definicoes`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Sessão de teste (sem email)').waitFor()
    ok('Definições: mostra «Sessão de teste (sem email)» e não pede palavra-passe', (await page.locator('#npw').count()) === 0)

    // ============================================================ sessão 2 (outro navegador): vê só a versão aproximada
    const { ctx: ctx2, page: page2 } = await open(browser)
    await page2.goto(`${base}/entrar`, { waitUntil: 'domcontentloaded' })
    await page2.click('[data-action="sessao-teste"]')
    await page2.waitForURL(/\/conta$/, { timeout: 60000 })
    const s2 = await session(page2)
    ok('«Entrar» → «Experimentar sem email» abre outra sessão de teste, separada', !!s2?.user?.is_anonymous && s2.user.id !== uid1)
    const db2 = asUser(s2.access_token)
    const { data: shared } = await db2.from('shared_reports').select('id, kind, species, approx_lat, approx_lng, approx_label, precision_km, occurred_on, day_period, photo_path, created_at').eq('species', SPECIES)
    const mine = (shared ?? [])[0]
    ok('a outra sessão vê só a versão aproximada', !!mine && metres({ lat: mine.approx_lat, lng: mine.approx_lng }, row) > 100 && !('owner_id' in mine) && !('ping_id' in mine), mine ? `${metres({ lat: mine.approx_lat, lng: mine.approx_lng }, row).toFixed(0)} m do ponto exato` : 'sem partilha')
    const { data: direct } = await db2.from('pings').select('id').eq('id', pinId)
    ok('a outra sessão não lê o registo privado', (direct ?? []).length === 0)
    const { error: dl } = await db2.storage.from('ping-media').download(media[0].storage_path)
    ok('a outra sessão não descarrega a fotografia original', !!dl)

    // ============================================================ terminar a sessão 1: apaga servidor e dispositivo
    ok('sessão 1: sem erros na consola', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
    await endTestSession(page)
    const dbs = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : null))
    ok('terminar a sessão de teste apaga a cópia local (IndexedDB)', Array.isArray(dbs) && !dbs.includes(`lancalance-${uid1}`), JSON.stringify(dbs))
    const { data: left } = await db1.from('pings').select('id').eq('id', pinId)
    const { data: gone } = await db2.from('shared_reports').select('id').eq('species', SPECIES)
    const { data: files } = await db1.storage.from('ping-media').list(uid1)
    ok('terminar a sessão de teste apaga registo, partilha e fotografias no servidor', (left ?? []).length === 0 && (gone ?? []).length === 0 && (files ?? []).length === 0)
    await page.screenshot({ path: join(shots, '2-sessao-terminada.png') })
    await ctx.close()

    await endTestSession(page2)
    ok('sessão 2 terminada e apagada', !(await session(page2)))
    await ctx2.close()
  } catch (e) {
    ok('execução sem exceções', false, e.message.split('\n')[0])
  } finally {
    await browser.close()
    console.log(results.join('\n'))
    console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} PASS · ${results.filter((r) => r.startsWith('FAIL')).length} FAIL`)
  }
})()
