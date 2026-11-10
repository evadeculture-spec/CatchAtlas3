// Medições de desempenho do Atlas / Marcar pin em build de produção (browser real, Chromium do
// Playwright). Uso:
//   npm run build && npx vite preview --port 4173 &
//   E2E_A_EMAIL=… E2E_A_PASSWORD=… node e2e/perf.cjs http://localhost:4173 docs/lanca/medicoes.json
// ATENÇÃO: corre num contentor sem GPU (WebGL por software, SwiftShader). Os tempos de frame NÃO
// representam um telemóvel ou iPad físico; servem para comparar versões no mesmo ambiente.
const { chromium } = require('playwright')
const os = require('node:os')
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { createClient } = require('@supabase/supabase-js')

const base = process.argv[2] || 'http://localhost:4173'
const out = process.argv[3] || 'docs/lanca/medicoes.json'
const URL_ = process.env.VITE_SUPABASE_URL || 'https://xachgvjmhmnwaguayrcv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PjJKSFp2h6WwQy8i1XJX4A_5qlsSHhS'
const A = { email: process.env.E2E_A_EMAIL, password: process.env.E2E_A_PASSWORD }
const CB = '-8.24839,39.60045'
// Perfil de rede "4G lento" (o mesmo do Lighthouse para telemóvel): 150 ms RTT, 1,6 Mbit/s ↓, 750 kbit/s ↑.
const NET_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }

const q = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b)
  if (!s.length) return null
  return Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] * 10) / 10
}
const stats = (xs) => ({ n: xs.length, p50: q(xs, 50), p75: q(xs, 75), p95: q(xs, 95), max: xs.length ? Math.round(Math.max(...xs) * 10) / 10 : null })

async function wipe() {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } })
  const { data } = await sb.auth.signInWithPassword(A)
  const uid = data.user.id
  const { data: files } = await sb.storage.from('ping-media').list(uid, { limit: 1000 })
  if (files?.length) await sb.storage.from('ping-media').remove(files.map((f) => `${uid}/${f.name}`))
  for (const t of ['pings', 'journeys', 'pins']) await sb.from(t).delete().eq('owner_id', uid)
}

async function session(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  await p.goto(base + '/privacidade')
  await p.evaluate(() => localStorage.setItem('atlascatch-demo-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('atlascatch-demo-v1') || '{}'), onboarded: true })))
  await p.goto(base + '/entrar')
  await p.fill('#email', A.email)
  await p.fill('#password', A.password)
  await p.getByRole('button', { name: 'Entrar', exact: true }).click()
  await p.waitForURL(/\/conta$/)
  const state = await ctx.storageState()
  await ctx.close()
  return state
}

const mapEval = (page, src, arg) => page.evaluate(({ src, arg }) => new Function('map', 'arg', src)(document.querySelector('[data-atlas-map] > div').__map, arg), { src, arg })

;(async () => {
  await wipe()
  const browser = await chromium.launch()
  const state = await session(browser)
  const result = { date: new Date().toISOString(), base, environment: {}, results: {} }

  // ------------------------------------------------------------ ambiente
  {
    const ctx = await browser.newContext()
    const p = await ctx.newPage()
    await p.goto(base + '/privacidade')
    result.environment = {
      browser: `Chromium ${browser.version()} (headless, Playwright)`,
      webgl: await p.evaluate(() => {
        const g = document.createElement('canvas').getContext('webgl2')
        const ext = g?.getExtension('WEBGL_debug_renderer_info')
        return g ? (ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'WebGL2') : 'sem WebGL2'
      }),
      host: `${os.cpus().length} vCPU (${os.cpus()[0]?.model ?? '?'}), ${Math.round(os.totalmem() / 2 ** 30)} GB, contentor Linux sem GPU`,
      server: 'vite preview (build de produção) em localhost; backend Supabase eu-west-3 através de proxy de saída',
      note: 'WebGL por software (SwiftShader): os tempos de frame não representam dispositivos físicos.',
    }
    await ctx.close()
  }

  // ------------------------------------------------------------ 1. primeiro mapa manipulável (cache fria)
  for (const [label, cpu, net] of [['telemovel-4g-lento-cpu4x', 4, NET_4G], ['telemovel-sem-limites', 1, null]]) {
    const runs = []
    const ready = []
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storageState: state })
      const page = await ctx.newPage()
      const cdp = await ctx.newCDPSession(page)
      if (net) await cdp.send('Network.emulateNetworkConditions', net)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
      await page.goto(`${base}/?v=${CB},14.6,45,0`, { waitUntil: 'commit', timeout: 180000 })
      await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 240000 })
      const tReady = await page.evaluate(() => performance.now())
      // "Manipulável": o mapa responde a um arrasto (o centro muda) e o botão Marcar pin está ativo.
      const c0 = await mapEval(page, 'return map.getCenter().lng')
      const box = await page.locator('[data-atlas-map]').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 3 + 10, { steps: 4 })
      await page.mouse.up()
      await page.waitForFunction((c) => Math.abs(document.querySelector('[data-atlas-map] > div').__map.getCenter().lng - c) > 1e-6, c0, { timeout: 60000 })
      await page.waitForSelector('[data-action="marcar-pin"]')
      runs.push(await page.evaluate(() => performance.now()))
      ready.push(tReady)
      await ctx.close()
    }
    result.results[`primeiro-mapa-manipulavel:${label}`] = { unit: 'ms desde o início da navegação, cache fria', ...stats(runs), estado_pronto: stats(ready) }
    console.log(label, stats(runs))
  }

  // ------------------------------------------------------------ 2. resposta às ações (cache quente)
  for (const [label, cpu] of [['sem-limites', 1], ['cpu4x', 4]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: state, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    await page.goto(`${base}/?v=${CB},14.8,45,0`)
    await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 180000 })
    await page.waitForTimeout(1500)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    const durable = []
    const uploadMs = []
    const remoteMs = []
    for (let i = 0; i < 6; i++) {
      // Marcar pin → painel visível; guardar → escrita local durável (medidas internas da app).
      await page.click('[data-action="marcar-pin"]')
      await page.waitForSelector('[data-composer-step="place"]')
      await mapEval(page, 'map.panBy([arg, arg / 2], { duration: 0 })', 25 * (i + 1))
      await page.getByRole('button', { name: 'Confirmar local' }).click()
      await page.waitForSelector('[data-composer-step="details"]')
      const withPhoto = i % 2 === 0
      if (withPhoto) {
        await page.locator('[data-composer-step] input[type=file]:not([capture])').setInputFiles(join(__dirname, 'fixtures', 'exif-photo.jpg'))
        await page.waitForSelector('[data-composer-step] img[alt="Fotografia do pin"]')
        const keep = page.getByRole('button', { name: 'Manter' })
        if (await keep.count()) await keep.click()
      } else await page.getByRole('radio', { name: /Observação/ }).click()
      const t0 = Date.now()
      await page.click('[data-action="guardar-pin"]')
      await page.waitForSelector('[data-pin-sheet]')
      if (withPhoto) {
        await page.waitForSelector('[data-photo="synced"]', { timeout: 120000 })
        uploadMs.push(Date.now() - t0)
      }
      await page.waitForSelector('[data-pin-sheet][data-pin-state="synced"]', { timeout: 120000 })
      remoteMs.push(Date.now() - t0)
      await page.getByRole('button', { name: 'Fechar ficha do pin' }).click()
      await page.waitForTimeout(300)
    }
    // Seleção: tocar num pin desenhado → ficha visível.
    await page.waitForTimeout(2500)
    for (let i = 0; i < 6; i++) {
      const pt = await mapEval(page, `const f = map.queryRenderedFeatures({ layers: ['lanca-my-pin'] })[arg % Math.max(1, map.queryRenderedFeatures({ layers: ['lanca-my-pin'] }).length)]; if (!f) return null; const p = map.project(f.geometry.coordinates); return { x: p.x, y: p.y }`, i)
      if (!pt) break
      const box = await page.locator('[data-atlas-map]').boundingBox()
      await page.mouse.click(box.x + pt.x, box.y + pt.y)
      await page.waitForSelector('[data-pin-sheet]')
      await page.getByRole('button', { name: 'Fechar ficha do pin' }).click()
      await page.waitForTimeout(250)
    }
    const perf = await page.evaluate(() => window.__lancaPerf ?? [])
    const by = (n) => perf.filter((x) => x.name === n).map((x) => x.ms)
    durable.push(...by('pin:local-durable'))
    result.results[`resposta:${label}`] = {
      unit: 'ms',
      'marcar-pin → painel visível': stats(by('marcar-pin:feedback')),
      'toque no pin → ficha visível': stats(by('pin-select:feedback')),
      'guardar → escrita local durável (IndexedDB)': stats(durable),
      'guardar → fotografia enviada (inclui escrita local e criação no servidor)': stats(uploadMs),
      'guardar → confirmação remota (Sincronizado)': stats(remoteMs),
    }
    console.log(label, JSON.stringify(result.results[`resposta:${label}`]))
    await ctx.close()
  }

  // ------------------------------------------------------------ 3. frames: percurso repetível de 30 s à escala da margem
  for (const [label, vp, mobile] of [['ipad-1180x820', { width: 1180, height: 820 }, false], ['telemovel-390x844', { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: true, storageState: state })
    const page = await ctx.newPage()
    await page.goto(`${base}/?v=${CB},14.2,55,20`)
    await page.waitForSelector('[data-atlas-status="ready"]', { timeout: 180000 })
    await page.waitForTimeout(4000)
    const frames = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const map = document.querySelector('[data-atlas-map] > div').__map
          const deltas = []
          let last = performance.now()
          const t0 = last
          const tick = (t) => {
            deltas.push(t - last)
            last = t
            if (t - t0 < 30000) requestAnimationFrame(tick)
            else resolve(deltas)
          }
          requestAnimationFrame(tick)
          // Percurso fixo: aproximar, rodar, inclinar e deslocar ao longo da margem (6 × 5 s).
          const c = map.getCenter()
          const steps = [
            { center: [c.lng + 0.01, c.lat + 0.004], zoom: 15, bearing: 40 },
            { center: [c.lng + 0.02, c.lat + 0.01], zoom: 15.5, bearing: 80, pitch: 60 },
            { center: [c.lng + 0.005, c.lat + 0.015], zoom: 14.5, bearing: 120, pitch: 45 },
            { center: [c.lng - 0.01, c.lat + 0.005], zoom: 15, bearing: 60 },
            { center: [c.lng - 0.005, c.lat - 0.005], zoom: 14, bearing: 0, pitch: 55 },
            { center: [c.lng, c.lat], zoom: 14.2, bearing: 20 },
          ]
          steps.forEach((s, i) => setTimeout(() => map.easeTo({ ...s, duration: 4800 }), i * 5000))
        }),
    )
    const d = frames.slice(1)
    const total = d.reduce((a, b) => a + b, 0)
    result.results[`frames:${label}`] = {
      unit: 'ms por frame',
      frames: d.length,
      fps_medio: Math.round((d.length / total) * 1000 * 10) / 10,
      ...stats(d),
      percent_acima_33ms: Math.round((d.filter((x) => x > 33).length / d.length) * 1000) / 10,
    }
    console.log(label, JSON.stringify(result.results[`frames:${label}`]))
    await ctx.close()
  }

  await browser.close()
  await wipe()
  writeFileSync(out, JSON.stringify(result, null, 2))
  console.log(`\nResultados em ${out}`)
})()
