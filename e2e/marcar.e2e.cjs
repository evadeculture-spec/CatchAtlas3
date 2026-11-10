// Percurso real "mapa → pin → diário → mapa" no Atlas (browser real, Chromium do Playwright), contra o
// backend real. Uso:
//   npm run build && npx vite preview --port 4173 &
//   E2E_A_EMAIL=… E2E_A_PASSWORD=… E2E_B_EMAIL=… E2E_B_PASSWORD=… node e2e/marcar.e2e.cjs http://localhost:4173 screenshots/marcar
// Contas de TESTE apenas (o teste apaga todos os dados do utilizador A no início e no fim).
const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')
const { createClient } = require('@supabase/supabase-js')
const exifr = require('exifr')

const base = process.argv[2] || 'http://localhost:4173'
const shots = process.argv[3] || 'screenshots/marcar'
mkdirSync(shots, { recursive: true })
const URL_ = process.env.VITE_SUPABASE_URL || 'https://xachgvjmhmnwaguayrcv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PjJKSFp2h6WwQy8i1XJX4A_5qlsSHhS'
const A = { email: process.env.E2E_A_EMAIL, password: process.env.E2E_A_PASSWORD }
const B = { email: process.env.E2E_B_EMAIL, password: process.env.E2E_B_PASSWORD }
const PHOTO = join(__dirname, 'fixtures', 'exif-photo.jpg')
const CB = '-8.24839,39.60045' // Albufeira de Castelo do Bode (Portugal)
const AL = '-6.46283,39.71864' // Embalse de Alcántara (Espanha)
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

async function api(who) {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword(who)
  if (error) throw new Error(`login ${who.email}: ${error.message}`)
  return { sb, uid: data.user.id }
}
async function wipe(who) {
  const { sb, uid } = await api(who)
  const { data: shares } = await sb.rpc('my_shares')
  for (const s of shares ?? []) await sb.functions.invoke('community-share', { body: { action: 'revoke', pingId: s.ping_id } })
  const { data: files } = await sb.storage.from('ping-media').list(uid, { limit: 1000 })
  if (files?.length) await sb.storage.from('ping-media').remove(files.map((f) => `${uid}/${f.name}`))
  for (const t of ['pings', 'journeys', 'pins']) await sb.from(t).delete().eq('owner_id', uid)
}

async function open(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!opts.touch, isMobile: !!opts.mobile, reducedMotion: 'reduce', permissions: opts.geo === false ? [] : ['geolocation'], geolocation: { latitude: 38.7223, longitude: -9.1393, accuracy: 25 } })
  const page = await ctx.newPage()
  page.setDefaultNavigationTimeout(90000)
  page.setDefaultTimeout(45000)
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && page.errors.push(m.text()))
  await page.goto(base + '/privacidade', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.setItem('atlascatch-demo-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('atlascatch-demo-v1') || '{}'), onboarded: true })))
  return { ctx, page }
}
async function login(page, who) {
  await page.goto(base + '/entrar', { waitUntil: 'domcontentloaded' })
  await page.fill('#email', who.email)
  await page.fill('#password', who.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL(/\/conta$/, { timeout: 30000 })
}
async function atlas(page, cam) {
  await page.goto(`${base}/?v=${cam}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 120000 })
  await page.waitForTimeout(2000)
}
/** Estado do mapa: projeção de um ponto, pin desenhado nesse ponto, câmara. */
const mapEval = (page, fn, arg) => page.evaluate(({ src, arg }) => {
  const map = document.querySelector('[data-atlas-map] > div').__map
  return new Function('map', 'arg', src)(map, arg)
}, { src: fn, arg })
const pinAt = (page, ll, id) =>
  mapEval(page, `const p = map.project([arg.ll.lng, arg.ll.lat]); const back = map.unproject(p);
    const fs = map.queryRenderedFeatures([[p.x - 6, p.y - 6], [p.x + 6, p.y + 6]], { layers: ['lanca-my-pin'] });
    return { x: p.x, y: p.y, back: { lng: back.lng, lat: back.lat }, drawn: fs.some((f) => f.properties.id === arg.id), w: map.getContainer().clientWidth, h: map.getContainer().clientHeight }`, { ll, id })
const sheetPin = async (page) => {
  const el = page.locator('[data-pin-sheet]')
  return { id: await el.getAttribute('data-pin-sheet'), lat: Number(await el.getAttribute('data-lat')), lng: Number(await el.getAttribute('data-lng')), state: await el.getAttribute('data-pin-state') }
}
async function markWithCrosshair(page, { type = 'captura', species, photo } = {}) {
  await page.click('[data-action="marcar-pin"]')
  await page.waitForSelector('[data-composer-step="place"]')
  await page.waitForSelector('[data-crosshair]')
  await page.waitForTimeout(600)
  const box = await page.locator('[data-crosshair]').boundingBox()
  const cross = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const expected = await mapEval(page, 'const ll = map.unproject([arg.x, arg.y]); return { lng: ll.lng, lat: ll.lat }', cross)
  await page.getByRole('button', { name: 'Confirmar local' }).click()
  await page.waitForSelector('[data-composer-step="details"]')
  if (type !== 'captura') await page.getByRole('radio', { name: type === 'local' ? /Local para voltar/ : /Observação/ }).click()
  if (photo) {
    await page.locator('[data-composer-step] input[type=file]:not([capture])').setInputFiles(photo)
    await page.waitForSelector('[data-composer-step] img[alt="Fotografia do pin"]')
    const keep = page.getByRole('button', { name: 'Manter' })
    if (await keep.count()) await keep.click()
  }
  if (species) await page.fill('#pc-species', species)
  await page.click('[data-action="guardar-pin"]')
  await page.waitForSelector('[data-pin-sheet]')
  return { cross, expected }
}

;(async () => {
  await wipe(A)
  await wipe(B)
  const browser = await chromium.launch()
  let capId = null
  try {
    // =============================================================== iPad em paisagem: margem portuguesa e espanhola
    {
      const { ctx, page } = await open(browser, { width: 1180, height: 820 }, { touch: true })
      await login(page, A)
      await atlas(page, `${CB},14.6,55,30`)
      await page.screenshot({ path: join(shots, 'ipad-1-repouso.png') })
      await page.click('[data-action="marcar-pin"]')
      await page.waitForSelector('[data-crosshair]')
      await page.waitForTimeout(500)
      await page.screenshot({ path: join(shots, 'ipad-2-colocacao.png') })
      await page.getByRole('button', { name: 'Descartar' }).click()
      const { cross, expected } = await markWithCrosshair(page, { type: 'local' })
      const pin = await sheetPin(page)
      ok('iPad: pin guardado com o ponto da mira (mapa inclinado e rodado)', metres(pin, expected) < 0.5, `${metres(pin, expected).toFixed(3)} m`)
      await page.waitForSelector('[data-pin-sheet][data-pin-state="synced"]', { timeout: 60000 })
      await page.waitForTimeout(800)
      let at = await pinAt(page, pin, pin.id)
      ok('iPad: o pin desenhado coincide com a mira', Math.hypot(at.x - cross.x, at.y - cross.y) < 3 && at.drawn, `${Math.hypot(at.x - cross.x, at.y - cross.y).toFixed(1)} px`)
      ok('ida e volta toque ↔ coordenada (com relevo)', metres(at.back, pin) < 1, `${metres(at.back, pin).toFixed(3)} m`)
      await page.screenshot({ path: join(shots, 'ipad-3-guardado.png') })
      // Rodar, aproximar, alternar 2D/3D: o pin continua no mesmo ponto geográfico.
      const checks = []
      await mapEval(page, 'map.jumpTo({ bearing: map.getBearing() + 70, pitch: 60 })')
      await page.waitForTimeout(900)
      at = await pinAt(page, pin, pin.id)
      checks.push(['rodado', at])
      await page.getByRole('button', { name: 'Aproximar' }).click()
      await page.waitForTimeout(1200)
      at = await pinAt(page, pin, pin.id)
      checks.push(['aproximado', at])
      await page.getByRole('button', { name: '2D' }).click()
      await page.waitForTimeout(1500)
      at = await pinAt(page, pin, pin.id)
      checks.push(['2D', at])
      ok('2D mantém a seleção', (await page.locator('[data-pin-sheet]').getAttribute('data-pin-sheet')) === pin.id)
      await page.getByRole('button', { name: '3D' }).click()
      await page.waitForTimeout(1800)
      at = await pinAt(page, pin, pin.id)
      checks.push(['3D', at])
      for (const [n, a] of checks) ok(`pin no mesmo ponto geográfico (${n})`, a.drawn && metres(a.back, pin) < 1, `desenhado=${a.drawn} · ${metres(a.back, pin).toFixed(3)} m`)
      ok('iPad: ficha na coluna lateral com o mapa utilizável', await page.locator('aside [data-pin-sheet]').count() === 1)
      // Margem espanhola: fuso de Espanha.
      await atlas(page, `${AL},14.4,50,-20`)
      await markWithCrosshair(page, { type: 'observacao' })
      const es = await page.locator('[data-pin-sheet]').innerText()
      ok('margem espanhola: hora de Espanha', /hora de Espanha/.test(es))
      await page.waitForSelector('[data-pin-sheet][data-pin-state="synced"]', { timeout: 60000 })
      ok('iPad: sem erros na consola', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
      await ctx.close()
    }

    // =============================================================== telemóvel: captura com foto, GPS recusado, ponto manual
    {
      const { ctx, page } = await open(browser, { width: 390, height: 844 }, { touch: true, mobile: true, geo: false })
      await login(page, A)
      await atlas(page, `${CB},14.8,45,0`)
      await page.screenshot({ path: join(shots, 'tel-1-repouso.png') })
      await page.click('[data-action="marcar-pin"]')
      await page.getByRole('radio', { name: /Usar a minha posição/ }).click()
      await page.getByText(/Acesso à localização recusado/).waitFor()
      ok('GPS recusado: continua com a mira', await page.locator('[data-crosshair]').count() === 1)
      await page.screenshot({ path: join(shots, 'tel-2-colocacao.png') })
      // Corrige o ponto com a mira: arrasta o mapa (arrastar nunca cria um pin).
      await mapEval(page, 'map.panBy([60, -40], { duration: 0 })')
      await page.waitForTimeout(400)
      ok('arrastar o mapa não cria pins', (await page.locator('[data-pin-sheet]').count()) === 0)
      await page.getByRole('button', { name: 'Descartar' }).click()
      const { expected } = await markWithCrosshair(page, { species: 'Achigã', photo: PHOTO })
      const p0 = await sheetPin(page)
      capId = p0.id
      ok('captura com foto guardada no ponto manual', metres(p0, expected) < 0.5)
      await page.screenshot({ path: join(shots, 'tel-3-guardado.png') })
      await page.waitForSelector('[data-pin-sheet][data-pin-state="synced"]', { timeout: 90000 })
      await page.waitForSelector('[data-photo="synced"]', { timeout: 60000 })
      ok('pin e fotografia sincronizados (estados distintos)', true)
      // Recarregar: o mesmo ID no mapa e no diário.
      await page.goto(`${base}/?pin=${capId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector(`[data-pin-sheet="${capId}"]`, { timeout: 60000 })
      ok('depois de recarregar: o mesmo ID abre a mesma ficha no mapa', true)
      await page.goto(`${base}/conta/pings/${capId}`, { waitUntil: 'domcontentloaded' })
      await page.getByText('Achigã').first().waitFor()
      ok('o mesmo ID no diário', true)
      // Diário → "Ver no mapa" → mesma coordenada e mesma ficha.
      await page.getByRole('link', { name: 'Ver no mapa' }).click()
      await page.waitForSelector(`[data-pin-sheet="${capId}"]`, { timeout: 60000 })
      let back = null
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(750)
        back = await pinAt(page, p0, capId)
        if (back.drawn) break
      }
      ok('diário → Ver no mapa: regressa à coordenada e abre a ficha', back.drawn && back.x > 0 && back.x < back.w && back.y > 0 && back.y < back.h)
      // Editar espécie → diário atualizado.
      await page.getByRole('button', { name: 'Editar' }).click()
      await page.waitForSelector('[data-composer-step="details"]')
      await page.fill('#pc-species', 'Lúcio')
      await page.click('[data-action="guardar-pin"]')
      await page.waitForSelector(`[data-pin-sheet="${capId}"][data-pin-state="synced"]`, { timeout: 60000 })
      await page.goto(`${base}/conta/pings/${capId}`, { waitUntil: 'domcontentloaded' })
      await page.getByText('Lúcio').first().waitFor()
      ok('editar no mapa reflete-se no diário', true)
      // Mover no mapa → diário com a nova coordenada.
      await page.goto(`${base}/?pin=${capId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector(`[data-pin-sheet="${capId}"]`, { timeout: 60000 })
      await page.getByRole('button', { name: 'Mover' }).click()
      await page.waitForSelector('[data-crosshair]')
      await mapEval(page, 'map.panBy([40, 30], { duration: 0 })')
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'Guardar novo ponto' }).click()
      await page.waitForSelector(`[data-pin-sheet="${capId}"][data-pin-state="synced"]`, { timeout: 60000 })
      const moved = await sheetPin(page)
      ok('mover: nova coordenada', metres(moved, p0) > 20, `${metres(moved, p0).toFixed(0)} m`)
      const { sb: sbA } = await api(A)
      const { data: row } = await sbA.from('pings').select('lat, lng, enrichment_status').eq('id', capId).single()
      ok('mover reflete-se no registo (diário) e volta a pedir condições', Math.abs(row.lat - moved.lat) < 1e-9 && ['pendente', 'em-curso', 'concluido'].includes(row.enrichment_status))
      ok('telemóvel: sem erros na consola', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
      await ctx.close()
    }

    // =============================================================== privacidade: partilha aproximada com duas contas
    {
      const { ctx, page } = await open(browser, { width: 390, height: 844 }, { touch: true, mobile: true })
      await login(page, A)
      await page.goto(`${base}/?pin=${capId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector(`[data-pin-sheet="${capId}"]`, { timeout: 60000 })
      await page.getByRole('button', { name: 'Partilhar' }).click()
      await page.getByText('nunca o ponto exato').waitFor()
      await page.screenshot({ path: join(shots, 'tel-4-partilha-previa.png') })
      await page.getByRole('button', { name: 'Publicar versão aproximada' }).click()
      await page.getByText('Partilhado (aproximado)').waitFor({ timeout: 30000 })
      ok('A publica uma versão aproximada (pré-visualização mostrada)', true)
      await ctx.close()

      const { ctx: c2, page: p2 } = await open(browser, { width: 390, height: 844 }, { touch: true, mobile: true })
      await login(p2, B)
      const resp = p2.waitForResponse((r) => r.url().includes('/rest/v1/shared_reports') && r.request().method() === 'GET', { timeout: 60000 })
      await atlas(p2, `${CB},10.5,0,0&camada=comunidade&janela=30`)
      const body = await (await resp).json()
      const mine = body.find((r) => r.species === 'Lúcio')
      const { sb: sbA } = await api(A)
      const { data: exact } = await sbA.from('pings').select('lat, lng').eq('id', capId).single()
      ok('B vê só a versão aproximada', !!mine && metres({ lat: mine.approx_lat, lng: mine.approx_lng }, exact) > 100 && !('owner_id' in mine) && !('ping_id' in mine) && !JSON.stringify(body).includes(String(exact.lat)), mine ? `${metres({ lat: mine.approx_lat, lng: mine.approx_lng }, exact).toFixed(0)} m do ponto exato` : 'sem partilha')
      const { sb: sbB } = await api(B)
      const { data: direct } = await sbB.from('pings').select('id').eq('id', capId)
      ok('B não lê o registo privado pela API', (direct ?? []).length === 0)
      const { data: orig } = await sbA.from('ping_media').select('storage_path').eq('ping_id', capId).limit(1).single()
      const { error: dlErr } = await sbB.storage.from('ping-media').download(orig.storage_path)
      ok('B não descarrega a fotografia original', !!dlErr)
      const { data: signed } = await sbB.storage.from('community-media').createSignedUrl(mine.photo_path, 60)
      const img = await (await fetch(signed.signedUrl)).arrayBuffer()
      const gps = await exifr.gps(Buffer.from(img)).catch(() => null)
      const meta = await exifr.parse(Buffer.from(img)).catch(() => null)
      ok('fotografia partilhada sem GPS nem metadados EXIF', !gps && !meta?.DateTimeOriginal, `${img.byteLength} bytes`)
      // Revogar: deixa de estar disponível.
      await sbA.functions.invoke('community-share', { body: { action: 'revoke', pingId: capId } })
      const { data: after } = await sbB.from('shared_reports').select('id').eq('id', mine.id)
      const gone = await fetch(signed.signedUrl)
      ok('após revogação: a publicação e a imagem deixam de estar disponíveis', (after ?? []).length === 0 && gone.status >= 400, `HTTP ${gone.status}`)
      const { data: still } = await sbA.from('pings').select('id').eq('id', capId)
      ok('após revogação: o diário privado mantém-se', (still ?? []).length === 1)
      await c2.close()
    }

    // =============================================================== sem rede: rascunho, retomar, enviar sem duplicar, quota
    {
      const { ctx, page } = await open(browser, { width: 390, height: 844 }, { touch: true, mobile: true })
      await login(page, A)
      await atlas(page, `${CB},14.8,45,0`)
      await ctx.setOffline(true)
      // Rascunho: começa, fecha a app sem guardar.
      await page.click('[data-action="marcar-pin"]')
      await page.waitForSelector('[data-crosshair]')
      await page.getByRole('button', { name: 'Confirmar local' }).click()
      await page.locator('[data-composer-step] input[type=file]:not([capture])').setInputFiles(PHOTO)
      await page.waitForSelector('[data-composer-step] img[alt="Fotografia do pin"]')
      await page.fill('#pc-species', 'Barbo')
      await page.waitForTimeout(900)
      await page.close()
      const p2 = await ctx.newPage()
      p2.setDefaultTimeout(45000)
      await ctx.setOffline(false)
      await p2.goto(`${base}/?v=${CB},14.8,45,0`, { waitUntil: 'domcontentloaded' })
      await p2.waitForSelector('[data-atlas-status="ready"]', { timeout: 120000 })
      await ctx.setOffline(true)
      await p2.waitForSelector('[data-draft-offer]', { timeout: 30000 })
      ok('ao reabrir: oferece retomar o rascunho', true)
      await p2.getByRole('button', { name: 'Retomar' }).click()
      await p2.waitForSelector('[data-composer-step="details"]')
      ok('rascunho recuperado com a espécie e a fotografia', (await p2.inputValue('#pc-species')) === 'Barbo' && (await p2.locator('[data-composer-step] img[alt="Fotografia do pin"]').count()) === 1)
      await p2.click('[data-action="guardar-pin"]')
      await p2.waitForSelector('[data-pin-sheet]')
      const off = await sheetPin(p2)
      ok('sem rede: "Guardado no dispositivo" (não diz sincronizado)', off.state === 'local')
      await p2.screenshot({ path: join(shots, 'tel-5-sem-rede.png') })
      // Volta a rede, mas o primeiro envio da fotografia falha (corte a meio): repetir não duplica.
      let failed = 0
      await p2.route('**/storage/v1/object/ping-media/**', (r) => (failed++ === 0 ? r.abort('connectionreset') : r.continue()))
      await ctx.setOffline(false)
      await p2.evaluate(() => window.dispatchEvent(new Event('online')))
      await p2.waitForSelector(`[data-pin-sheet="${off.id}"][data-pin-state="synced"]`, { timeout: 120000 }).catch(() => null)
      if ((await p2.locator('[data-pin-sheet]').getAttribute('data-pin-state')) !== 'synced') {
        const retry = p2.getByRole('button', { name: 'Tentar de novo' })
        if (await retry.count()) await retry.click()
        await p2.waitForSelector(`[data-pin-sheet="${off.id}"][data-pin-state="synced"]`, { timeout: 120000 })
      }
      const { sb } = await api(A)
      const { data: rows } = await sb.from('pings').select('id').eq('id', off.id)
      const { data: media } = await sb.from('ping_media').select('id').eq('ping_id', off.id)
      const { data: catches } = await sb.from('catches').select('species').eq('ping_id', off.id)
      ok('reenvio após falha: uma captura, uma fotografia, sem duplicados', rows.length === 1 && media.length === 1 && catches.length === 1 && catches[0].species === 'Barbo', `falhas simuladas: ${Math.min(failed, 1)}`)
      await p2.unroute('**/storage/v1/object/ping-media/**')
      // Quota esgotada no envio da fotografia: estado de erro verificável e ação de recuperação.
      await p2.route('**/storage/v1/object/ping-media/**', (r) => r.fulfill({ status: 413, contentType: 'application/json', body: JSON.stringify({ statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' }) }))
      await markWithCrosshair(p2, { species: 'Carpa', photo: PHOTO })
      await p2.waitForSelector('[data-pin-sheet][data-pin-state="quota"]', { timeout: 60000 })
      ok('quota esgotada: estado de erro verificável', await p2.getByText(/Sem espaço|limite/).count() > 0)
      await p2.screenshot({ path: join(shots, 'tel-6-quota.png') })
      await p2.unroute('**/storage/v1/object/ping-media/**')
      await p2.getByRole('button', { name: 'Guardar sem esta fotografia' }).click()
      await p2.waitForSelector('[data-pin-sheet][data-pin-state="synced"]', { timeout: 60000 })
      ok('quota: recupera guardando sem a fotografia', true)
      await ctx.close()
    }

    // =============================================================== links antigos: Reports e pings → camada comunitária
    {
      const { ctx, page } = await open(browser, { width: 390, height: 844 }, { touch: true, mobile: true })
      await page.goto(`${base}/reports?janela=3&especie=achiga`, { waitUntil: 'domcontentloaded' })
      await page.waitForURL(/camada=comunidade/)
      await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 120000 })
      ok('link antigo abre a camada comunitária no Atlas', /janela=3/.test(page.url()) && /especie=achiga/.test(page.url()))
      await page.getByText(/Demonstração — dados ilustrativos · posições aproximadas/).waitFor()
      ok('indicação de demonstração com os dados ilustrativos', true)
      const n3 = Number((await page.getByText(/reports neste período/).innerText()).match(/\d+/)[0])
      await page.getByRole('button', { name: '30 dias' }).click()
      await page.waitForTimeout(400)
      const n30 = Number((await page.getByText(/reports neste período/).innerText()).match(/\d+/)[0])
      ok('filtros 3/7/30 dias e espécie funcionam', n30 >= n3 && /janela=30/.test(page.url()), `${n3} → ${n30}`)
      await page.getByRole('button', { name: 'forte' }).click()
      await page.waitForTimeout(300)
      ok('filtro de atividade', /atividade=forte/.test(page.url()))
      await page.screenshot({ path: join(shots, 'tel-7-comunidade.png') })
      await page.goto(`${base}/reports/novo`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[role=dialog][aria-label="Entrar para marcar pins"]', { timeout: 60000 })
      ok('"+ Report" sem sessão: pede para entrar (pins privados)', true)
      await ctx.close()
    }
  } catch (e) {
    ok('execução sem exceções', false, e.message.split('\n')[0])
  } finally {
    await browser.close()
    await wipe(A)
    console.log(results.join('\n'))
    console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} verificações passaram`)
  }
})()
