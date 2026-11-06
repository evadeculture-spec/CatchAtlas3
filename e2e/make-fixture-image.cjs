// Gera a imagem de TESTE (padrão neutro com texto), usada só no build e2e.
const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 2000, height: 1333 } })
  await p.setContent(`<body style="margin:0;width:2000px;height:1333px;background:linear-gradient(180deg,#9fb8c4 0%,#c9d3c8 45%,#55707a 46%,#20414f 100%);font:700 90px sans-serif;color:rgba(255,255,255,.85);display:grid;place-items:center">
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.18) 2px,transparent 2px),linear-gradient(90deg,rgba(255,255,255,.18) 2px,transparent 2px);background-size:200px 200px"></div>
    <div style="position:relative;text-align:center">IMAGEM DE TESTE<br><span style="font-size:48px">não é uma fotografia real</span></div></body>`)
  await p.screenshot({ path: process.argv[2], type: 'jpeg', quality: 80 })
  await b.close()
})()
