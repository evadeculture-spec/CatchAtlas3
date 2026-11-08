// Verificações ponta a ponta da área privada do Lança Lance, num browser real (Chromium do Playwright)
// e contra o backend real (Supabase + Edge Functions + Open-Meteo).
// Uso: npm run build && npx vite preview --port 4173 &
//      E2E_A_EMAIL=… E2E_A_PASSWORD=… E2E_B_EMAIL=… E2E_B_PASSWORD=… node e2e/lanca.e2e.cjs http://localhost:4173 screenshots/lanca
// Os dois utilizadores de TESTE têm de existir e estar confirmados. O teste apaga, no início e no fim,
// todos os dados do utilizador A (por isso nunca usar contas reais).
const { chromium } = require('playwright')
const { mkdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const { createClient } = require('@supabase/supabase-js')

const base = process.argv[2] || 'http://localhost:4173'
const shots = process.argv[3] || 'screenshots/lanca'
mkdirSync(shots, { recursive: true })
const URL_ = process.env.VITE_SUPABASE_URL || 'https://xachgvjmhmnwaguayrcv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PjJKSFp2h6WwQy8i1XJX4A_5qlsSHhS'
const A = { email: process.env.E2E_A_EMAIL, password: process.env.E2E_A_PASSWORD }
const B = { email: process.env.E2E_B_EMAIL, password: process.env.E2E_B_PASSWORD }
const PHOTO = join(__dirname, 'fixtures', 'exif-photo.jpg') // EXIF: 2023-06-10 07:15 +01:00, GPS 39.46125, -8.19765
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
const IGNORED = /Failed to load resource|ERR_|AJAXError|Failed to fetch|net::/

async function wipe(who) {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword(who)
  if (error) throw new Error(`login ${who.email}: ${error.message}`)
  const uid = data.user.id
  for (const bucket of ['ping-media', 'avatars']) {
    const { data: files } = await sb.storage.from(bucket).list(uid, { limit: 1000 })
    if (files?.length) await sb.storage.from(bucket).remove(files.map((f) => `${uid}/${f.name}`))
  }
  await sb.from('pings').delete().eq('owner_id', uid)
  await sb.from('journeys').delete().eq('owner_id', uid)
  await sb.from('pins').delete().eq('owner_id', uid)
  await sb.from('equipment').delete().eq('owner_id', uid)
  await sb.from('profiles').update({ unit_temperature: 'c', avatar_path: null }).eq('id', uid)
  return uid
}

async function context(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!opts.touch, isMobile: !!opts.touch, acceptDownloads: true, reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 38.7223, longitude: -9.1393, accuracy: 20 } })
  const page = await ctx.newPage()
  page.setDefaultNavigationTimeout(90000)
  page.setDefaultTimeout(45000)
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !IGNORED.test(m.text()) && page.errors.push(m.text()))
  // A demonstração abre com onboarding; marca-o como visto para ir direto às páginas.
  await page.goto(base + '/privacidade', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    try {
      const k = 'atlascatch-demo-v1'
      const s = JSON.parse(localStorage.getItem(k) || '{}')
      localStorage.setItem(k, JSON.stringify({ ...s, onboarded: true }))
    } catch {
      /* sem armazenamento */
    }
  })
  return { ctx, page }
}

async function login(page, who) {
  await page.goto(base + '/entrar', { waitUntil: 'domcontentloaded' })
  await page.fill('#email', who.email)
  await page.fill('#password', who.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL(/\/conta$/, { timeout: 30000 })
}
const text = (page) => page.locator('main').innerText()
/** Sem deslocamento horizontal da página (nada mais largo do que o ecrã). */
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const widthChecks = []
async function checkWidth(page, name) {
  const extra = await overflow(page)
  widthChecks.push(`${name}${extra > 1 ? ` (+${extra}px)` : ''}`)
  if (extra > 1) ok(`sem deslocamento horizontal: ${name}`, false, `+${extra}px`)
}

;(async () => {
  const uidA = await wipe(A)
  await wipe(B)
  const browser = await chromium.launch()
  try {
    // ---------------------------------------------------------------- rotas protegidas
    {
      const { ctx, page } = await context(browser, { width: 390, height: 844 }, { touch: true })
      await page.goto(base + '/conta/pings', { waitUntil: 'domcontentloaded' })
      await page.waitForURL(/\/entrar\?next=/)
      ok('rota privada sem sessão envia para o login', page.url().includes('next=%2Fconta%2Fpings'))
      await page.goto(base + '/registar', { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('text=aviso de privacidade')
      ok('registo exige aceitar o aviso de privacidade', (await page.locator('input[type=checkbox]').count()) === 1)
      await page.fill('#email', 'x@lancalance.test')
      await page.fill('#password', 'abc')
      ok('palavra-passe fraca é assinalada', await page.getByText('Use pelo menos 8 caracteres.').isVisible())
      await page.screenshot({ path: join(shots, 'registo-390.png') })
      await checkWidth(page, 'registo-390')
      await page.goto(base + '/entrar', { waitUntil: 'domcontentloaded' })
      await page.fill('#email', A.email)
      await page.fill('#password', 'errada-123')
      await page.getByRole('button', { name: 'Entrar', exact: true }).click()
      await page.waitForSelector('text=Email ou palavra-passe incorretos.')
      ok('login com palavra-passe errada é recusado', true)
      await ctx.close()
    }

    // ---------------------------------------------------------------- fluxo principal (telemóvel)
    const { ctx, page } = await context(browser, { width: 390, height: 844 }, { touch: true })
    await login(page, A)
    await page.waitForSelector('text=Pins guardados')
    ok('login e painel privado', (await text(page)).includes('Criar Ping'))
    await page.screenshot({ path: join(shots, 'painel-vazio-390.png') })
    await checkWidth(page, 'painel-vazio-390')

    // Pin por coordenadas escritas
    await page.goto(base + '/conta/pins/novo', { waitUntil: 'domcontentloaded' })
    await page.fill('#name', 'E2E Margem da ponte')
    await page.getByText('Escrever coordenadas').click()
    await page.fill('input[aria-label="Coordenadas (latitude, longitude)"]', '39.4612, -8.1977')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await page.getByText('39.46120, -8.19770').waitFor()
    await page.screenshot({ path: join(shots, 'pin-novo-390.png') })
    await checkWidth(page, 'pin-novo-390')
    await page.getByRole('button', { name: 'Criar Pin' }).click()
    await page.waitForURL(/\/conta\/pins\/[0-9a-f-]{36}$/)
    const pinId = page.url().split('/').pop()
    await page.getByText('Histórico deste local').waitFor()
    ok('Pin criado e aberto', (await text(page)).includes('E2E Margem da ponte'))

    // Ping a partir de fotografia com EXIF
    await page.goto(base + '/conta/pings/novo', { waitUntil: 'domcontentloaded' })
    await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO)
    await page.locator('img[alt="Pré-visualização"]').waitFor()
    await page.getByRole('radio', { name: /Captura/ }).click()
    await page.getByText('Metadados da fotografia · fiabilidade alta').waitFor()
    const when = await page.locator('#h-hora').locator('..').innerText()
    ok('hora lida do EXIF (com fuso), não a hora atual', /2023/.test(when) && /07:15/.test(when) && /Europe\/Lisbon/.test(when), when.split('\n').slice(1, 3).join(' | '))
    await page.getByText('39.46125, -8.19765').waitFor()
    ok('local lido do GPS da fotografia', true)
    await page.getByRole('button', { name: 'Posição atual' }).click()
    await page.getByText(/A fotografia foi tirada a .* da sua posição atual/).waitFor()
    ok('divergência fotografia/posição atual pede confirmação', true)
    await page.getByRole('button', { name: 'Local da fotografia' }).click()
    await page.getByText(/do Pin E2E Margem da ponte\. Associar\?/).waitFor()
    ok('sugere o Pin próximo sem associar sozinho', (await page.locator('#pin').inputValue()) === '')
    await page.getByRole('button', { name: 'Associar' }).click()
    await page.fill('#species', 'Achigã')
    await page.fill('#len', '38')
    await page.screenshot({ path: join(shots, 'ping-novo-390.png'), fullPage: true })
    await checkWidth(page, 'ping-novo-390')
    await page.getByRole('button', { name: 'Guardar Ping' }).click()
    await page.waitForURL(/\/conta\/pings\/[0-9a-f-]{36}$/, { timeout: 60000 })
    const pingId = page.url().split('/').pop()
    await page.getByText('Condições do momento').waitFor({ timeout: 90000 })
    await page.getByText('Temperatura do ar').waitFor()
    const detail = await text(page)
    ok('Ping associado ao Pin e com captura', detail.includes('Pin: E2E Margem da ponte') && detail.includes('Achigã') && detail.includes('38 cm'))
    ok('condições de 2023 marcadas como estimativa de modelo', /estimativa de modelo/i.test(detail) && /hora de referência .*2023/i.test(detail), (detail.match(/hora de referência[^\n]*/) || [''])[0])
    ok('temperatura do momento com valor e unidade', /Temperatura do ar\s*\n?\s*-?\d+(,\d)? °C/.test(detail))
    ok('água interior mostrada como indisponível', /Temperatura da água\s*\n?\s*indisponível/.test(detail))
    const src = await page.locator('img[alt^="Fotografia do Ping"]').first().getAttribute('src')
    ok('fotografia servida por URL assinado temporário', !!src && src.includes('/storage/v1/object/sign/') && src.includes('token='))
    await page.screenshot({ path: join(shots, 'ping-detalhe-390.png'), fullPage: true })
    await checkWidth(page, 'ping-detalhe-390')

    // Ping sem localização e sem fotografia (não é impedido)
    await page.goto(base + '/conta/pings/novo', { waitUntil: 'domcontentloaded' })
    await page.getByRole('radio', { name: /Observação/ }).click()
    await page.getByRole('button', { name: 'Sem localização' }).click()
    await page.fill('#notes', 'Água turva depois da chuva')
    await page.getByRole('button', { name: 'Guardar Ping' }).click()
    await page.waitForURL(/\/conta\/pings\/[0-9a-f-]{36}$/)
    await page.getByText('Este Ping não tem localização').waitFor()
    ok('Ping sem GPS e sem fotografia é guardado', (await text(page)).includes('Água turva'))
    await page.getByRole('button', { name: 'Apagar Ping' }).click()
    await page.getByRole('button', { name: 'Apagar', exact: true }).click()
    await page.waitForURL(/\/conta\/pings$/)
    ok('apagar Ping', true)

    // Jornada para amanhã com o Pin
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await page.goto(base + `/conta/jornadas/nova?pin=${pinId}`, { waitUntil: 'domcontentloaded' })
    await page.fill('#d', tomorrow)
    await page.getByRole('button', { name: 'Criar jornada' }).click()
    await page.waitForURL(/\/conta\/jornadas\/[0-9a-f-]{36}$/)
    await page.getByText('Condições para o dia').waitFor()
    await page.getByText('Previsão', { exact: true }).first().waitFor({ timeout: 60000 })
    const jt = await text(page)
    ok('planeador com previsão marcada como previsão', /\bprevisão\b/i.test(jt) && jt.includes('Vento máximo'))
    ok('planeador usa o histórico real do local', jt.includes('Neste local existe 1 report'))
    ok('lista de verificação com licença', jt.includes('Licença de pesca válida'))
    await page.screenshot({ path: join(shots, 'jornada-390.png'), fullPage: true })
    await checkWidth(page, 'jornada-390')

    // Histórico, inteligência, mapa
    await page.goto(base + '/conta/historico', { waitUntil: 'domcontentloaded' })
    await page.getByText('Ping · Captura').first().waitFor()
    await page.getByRole('radio', { name: 'Por espécie' }).click()
    await page.getByText('Achigã').first().waitFor()
    ok('histórico cronológico e por espécie', true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByText('Ping · Captura').first().waitFor()
    ok('histórico consistente após recarregar', true)
    await page.goto(base + '/conta/inteligencia', { waitUntil: 'domcontentloaded' })
    await page.getByText('Como ler:').waitFor()
    ok('inteligência com aviso de amostra e causalidade', (await text(page)).includes('amostra') || (await text(page)).includes('São precisas'))
    await page.screenshot({ path: join(shots, 'inteligencia-390.png'), fullPage: true })
    await checkWidth(page, 'inteligencia-390')
    await page.goto(base + '/conta/mapa', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Pins (1)' }).waitFor()
    await page.getByRole('button', { name: 'Pings (1)' }).waitFor()
    await page.waitForTimeout(2500)
    ok('mapa com camadas de Pins e Pings', true)
    await page.screenshot({ path: join(shots, 'mapa-390.png') })
    await checkWidth(page, 'mapa-390')

    // Unidades
    await page.goto(base + '/conta/definicoes', { waitUntil: 'domcontentloaded' })
    await page.getByText('Unidades').first().waitFor()
    await checkWidth(page, 'definicoes-390')
    await page.screenshot({ path: join(shots, 'definicoes-390.png'), fullPage: true })
    await page.getByRole('radio', { name: '°F' }).click()
    await page.getByText('Unidades atualizadas').waitFor()
    await page.goto(base + `/conta/pings/${pingId}`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Temperatura do ar').waitFor()
    ok('unidades do perfil aplicadas (°F)', /\d+ °F/.test(await text(page)))

    // Exportação
    await page.goto(base + '/conta/definicoes', { waitUntil: 'domcontentloaded' })
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar dados (JSON)' }).click()])
    const exported = JSON.parse(readFileSync(await dl.path(), 'utf8'))
    ok('exportação RGPD (JSON) com os dados reais', exported.format === 'lanca-lance-export' && exported.pings.length === 1 && exported.pins.length === 1 && exported.photos.length === 1 && exported.conditions.length === 1)
    await page.getByRole('radio', { name: '°C' }).click()
    for (const path of ['/conta/pins', '/conta/pings', '/conta/jornadas', '/conta/historico']) {
      await page.goto(base + path, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)
      await checkWidth(page, path)
    }
    ok('ecrãs privados sem deslocamento horizontal a 390 px', !widthChecks.some((w) => w.includes('px)')), widthChecks.join(', '))
    ok('sem erros na consola (telemóvel)', page.errors.length === 0, page.errors.slice(0, 3).join(' | '))
    await ctx.close()

    // ---------------------------------------------------------------- desktop
    {
      const { ctx: c2, page: p2 } = await context(browser, { width: 1440, height: 900 })
      await login(p2, A)
      await p2.getByText('Pins guardados').waitFor()
      await p2.waitForTimeout(1500)
      await p2.screenshot({ path: join(shots, 'painel-1440.png') })
      await p2.goto(base + `/conta/pings/${pingId}`, { waitUntil: 'domcontentloaded' })
      await p2.getByText('Condições do momento').waitFor()
      await p2.waitForTimeout(1500)
      await p2.screenshot({ path: join(shots, 'ping-detalhe-1440.png'), fullPage: true })
      await p2.goto(base + `/conta/pins/${pinId}`, { waitUntil: 'domcontentloaded' })
      await p2.getByText('Histórico deste local').waitFor()
      await p2.waitForTimeout(1500)
      await p2.screenshot({ path: join(shots, 'pin-1440.png'), fullPage: true })
      await p2.goto(base + '/conta/mapa', { waitUntil: 'domcontentloaded' })
      await p2.getByRole('button', { name: 'Pins (1)' }).waitFor()
      await p2.waitForTimeout(2500)
      await p2.screenshot({ path: join(shots, 'mapa-1440.png') })
      ok('sem erros na consola (desktop)', p2.errors.length === 0, p2.errors.slice(0, 3).join(' | '))
      await c2.close()
    }

    // ---------------------------------------------------------------- isolamento entre utilizadores na interface
    {
      const { ctx: c3, page: p3 } = await context(browser, { width: 390, height: 844 }, { touch: true })
      await login(p3, B)
      await p3.goto(base + `/conta/pings/${pingId}`, { waitUntil: 'domcontentloaded' })
      await p3.getByText('Registo não encontrado.').waitFor()
      ok('B não abre o Ping de A (mesma resposta que um id inexistente)', !(await text(p3)).includes('Achigã'))
      await p3.goto(base + `/conta/pins/${pinId}`, { waitUntil: 'domcontentloaded' })
      await p3.getByText('Registo não encontrado.').waitFor()
      ok('B não abre o Pin de A', true)
      await p3.goto(base + '/conta/pings', { waitUntil: 'domcontentloaded' })
      await p3.getByText('Ainda não tem Pings').waitFor()
      ok('lista de B vazia (sem dados de A)', true)
      await c3.close()
    }
  } catch (e) {
    ok('execução sem exceções', false, e.message.split('\n')[0])
  } finally {
    await browser.close()
    await wipe(A)
    ok('limpeza dos dados de teste', !!uidA)
    console.log(results.join('\n'))
    console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} verificações passaram`)
  }
})()
