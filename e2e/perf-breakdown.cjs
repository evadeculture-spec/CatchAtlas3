// Custo dominante dos frames: o mesmo percurso de 12 s em 3D, em 2D e sem a camada dos pins.
const { chromium } = require('playwright')
const base = process.argv[2] || 'http://localhost:4173'
;(async () => {
  const b = await chromium.launch()
  const out = {}
  for (const [label, qs] of [['3D (relevo e terreno)', '&meus=0'], ['2D (sem terreno)', '&modo=2d&meus=0'], ['3D com camada de pins', '']]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const p = await ctx.newPage()
    await p.goto(base + '/privacidade')
    await p.evaluate(() => localStorage.setItem('atlascatch-demo-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('atlascatch-demo-v1') || '{}'), onboarded: true })))
    await p.goto(`${base}/?v=-8.24839,39.60045,14.2,55,20${qs}`)
    await p.waitForSelector('[data-atlas-status="ready"]', { timeout: 180000 })
    await p.waitForTimeout(4000)
    const d = await p.evaluate(() => new Promise((res) => {
      const map = document.querySelector('[data-atlas-map] > div').__map
      const ds = []
      const gpu = []
      let last = performance.now()
      const t0 = last
      map.on('render', () => gpu.push(performance.now()))
      const tick = (t) => { ds.push(t - last); last = t; if (t - t0 < 12000) requestAnimationFrame(tick); else res({ ds, renders: gpu.length }) }
      requestAnimationFrame(tick)
      const c = map.getCenter()
      map.easeTo({ center: [c.lng + 0.02, c.lat + 0.01], bearing: 80, zoom: 15, duration: 5800 })
      setTimeout(() => map.easeTo({ center: [c.lng, c.lat], bearing: 20, zoom: 14.2, duration: 5800 }), 6000)
    }))
    const s = d.ds.slice(1).sort((a, x) => a - x)
    const sum = s.reduce((a, x) => a + x, 0)
    out[label] = { frames: s.length, fps: Math.round((s.length / sum) * 10000) / 10, p50: Math.round(s[Math.floor(s.length * 0.5)]), p95: Math.round(s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]) }
    console.log(label, JSON.stringify(out[label]))
    await ctx.close()
  }
  await b.close()
})()
