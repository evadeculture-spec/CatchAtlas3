// «Os meus pins» contra o servidor REAL: search_pins (permissões, precisão pública, filtros, contagens) e
// community-share (zona / ponto exato / privado). Duas sessões de teste reais (sem email), dados fictícios,
// apagadas no fim. Exige a migração 20261113000100_my_pins_search.sql e a função community-share atualizada.
// Uso: NODE_USE_ENV_PROXY=1 node e2e/meuspins.backend.mjs
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.VITE_SUPABASE_URL || 'https://xachgvjmhmnwaguayrcv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PjJKSFp2h6WwQy8i1XJX4A_5qlsSHhS'
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
async function guest() {
  const r = await fetch(`${URL_}/functions/v1/guest-session`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ privacyNoticeVersion: '2026-11-08' }) })
  if (!r.ok) throw new Error(`guest-session HTTP ${r.status}: ${await r.text()}`)
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.setSession(await r.json())
  if (error) throw error
  return { sb, uid: data.user.id }
}
const T = Date.now().toString(36)
const W = (s) => `teste-${s}-${T}` // massas de água fictícias, isolam cada cenário
async function ping(c, o) {
  const id = crypto.randomUUID()
  const { error } = await c.sb.from('pings').insert({
    id, kind: o.kind ?? 'captura', occurred_at: o.at, occurred_tz: o.tz ?? 'Europe/Lisbon', time_source: 'dispositivo', time_reliability: 'alta',
    lat: o.lat ?? 39.601, lng: o.lng ?? -8.247, location_source: 'gps', water_body_ref: o.water, water_body_name: 'Água de teste',
  })
  if (error) throw new Error(`ping: ${error.message}`)
  if (o.species) {
    const { error: e2 } = await c.sb.from('catches').insert({ ping_id: id, species: o.species, weight_g: o.weight ?? null })
    if (e2) throw new Error(`captura: ${e2.message}`)
  }
  return id
}
const share = async (c, id, mode) => {
  const { data, error } = await c.sb.functions.invoke('community-share', { body: { action: 'publish', pingId: id, mode } })
  if (error) throw new Error(`partilha: ${error.message}`)
  return data
}
const revoke = (c, id) => c.sb.functions.invoke('community-share', { body: { action: 'revoke', pingId: id } })
async function search(c, p) {
  const { data, error } = await c.sb.rpc('search_pins', p)
  if (error) throw new Error(`search_pins: ${error.message}`)
  return { rows: data, total: data[0]?.total ?? 0, inView: data[0]?.in_view ?? 0 }
}
const n = async (c, p) => (await search(c, p)).total

let A, B
try {
  A = await guest()
  B = await guest()

  // ------------------------------------------------------------ 2 → 10 → 2 e conteúdo entregue à outra conta
  const wz = W('zona')
  const a1 = await ping(A, { water: wz, at: '2025-02-10T09:00:00Z', species: 'Carpa', weight: 2000 })
  const a2 = await ping(A, { water: wz, at: '2025-02-10T10:00:00Z', species: 'Carpa', weight: 2500, lat: 39.6031, lng: -8.2462 })
  await share(A, a2, 'zona')
  for (let i = 0; i < 8; i++) await share(B, await ping(B, { water: wz, at: `2025-02-${String(11 + i).padStart(2, '0')}T08:00:00Z`, species: 'Carpa', weight: 1500 + i * 100, lat: 39.602 + i * 0.0003, lng: -8.248 }), 'zona')
  await ping(B, { water: wz, at: '2025-02-10T08:00:00Z', species: 'Carpa', weight: 1800 }) // privado de terceiro
  ok('A: vista pessoal = 2', (await n(A, { p_water: wz })) === 2)
  ok('A: com a comunidade = 10 (o público de A conta uma vez; o privado de B nunca aparece)', (await n(A, { p_water: wz, p_community: true })) === 10)
  ok('A: desligar a comunidade repõe 2', (await n(A, { p_water: wz })) === 2)
  const bView = await search(B, { p_water: wz, p_community: true })
  const aSeen = bView.rows.filter((r) => r.source === 'comm')
  ok('B recebe só o report público de A (não o privado)', aSeen.length === 1 && !bView.rows.some((r) => r.id === a1))
  const zc = (v) => Math.round((Math.floor(v / 0.05) + 0.5) * 0.05 * 1e4) / 1e4
  ok('B recebe a zona: ponto = centro estável da zona, nunca o ponto exato', aSeen[0]?.precision === 'zona' && aSeen[0].lat === zc(39.6031) && aSeen[0].lng === zc(-8.2462) && aSeen[0].lat !== 39.6031, JSON.stringify({ lat: aSeen[0]?.lat, lng: aSeen[0]?.lng }))
  ok('B não recebe o ID do registo privado nem lê a tabela de pings de A', !bView.rows.some((r) => r.id === a2) && ((await B.sb.from('pings').select('id').eq('id', a2)).data ?? []).length === 0)
  const { error: colErr } = await B.sb.from('shared_reports').select('exact_lat').limit(1)
  ok('as colunas do ponto exato não são legíveis diretamente', !!colErr)
  // Mudanças de modo: exato → zona → privado.
  await share(A, a2, 'exato')
  const ex = (await search(B, { p_water: wz, p_community: true })).rows.find((r) => r.source === 'comm')
  ok('modo «ponto exato»: B recebe o ponto exato, por escolha explícita de A', ex?.precision === 'exato' && ex.lat === 39.6031 && ex.lng === -8.2462)
  await share(A, a2, 'zona')
  const zo = (await search(B, { p_water: wz, p_community: true })).rows.find((r) => r.source === 'comm')
  ok('exato → zona: o ponto exato deixa de ser entregue', zo?.precision === 'zona' && zo.lat !== 39.6031)
  await revoke(A, a2)
  ok('zona → privado: deixa de aparecer a B', !(await search(B, { p_water: wz, p_community: true })).rows.some((r) => r.source === 'comm'))
  ok('e A continua a ver o seu registo com o ponto exato', (await search(A, { p_water: wz })).rows.find((r) => r.id === a2)?.lat === 39.6031)
  // Mover um report partilhado: a versão pública acompanha (gatilho), sem nova publicação.
  await share(A, a2, 'zona')
  await A.sb.from('pings').update({ lat: 39.7012, lng: -8.3011 }).eq('id', a2)
  const mv = (await search(B, { p_water: wz, p_community: true })).rows.find((r) => r.source === 'comm')
  ok('mover o report atualiza a zona pública', mv?.lat === zc(39.7012) && mv.lng === zc(-8.3011))

  // ------------------------------------------------------------ espécie, peso, horas
  const wp = W('pesos')
  await ping(A, { water: wp, at: '2025-02-10T07:00:00Z', species: 'Carpa', weight: 1900 })
  await ping(A, { water: wp, at: '2025-02-10T09:00:00Z', species: 'Carpa', weight: 2000 })
  await ping(A, { water: wp, at: '2025-02-10T11:00:00Z', species: 'Carpa', weight: 2100 })
  await ping(A, { water: wp, at: '2025-02-10T14:00:00Z', species: 'Achigã', weight: 3000 })
  ok('só carpa = 3', (await n(A, { p_water: wp, p_species: ['Carpa'] })) === 3)
  ok('só mais de 2 kg = 2', (await n(A, { p_water: wp, p_weight_op: 'gt', p_weight_g: 2000 })) === 2)
  ok('só 07h–12h = 3', (await n(A, { p_water: wp, p_min_from: 420, p_min_to: 720 })) === 3)
  ok('os três juntos = 1', (await n(A, { p_water: wp, p_species: ['carpa'], p_weight_op: 'gt', p_weight_g: 2000, p_min_from: 420, p_min_to: 720 })) === 1)
  ok('menos de 2 kg = 1', (await n(A, { p_water: wp, p_weight_op: 'lt', p_weight_g: 2000 })) === 1)
  await ping(A, { water: wp, at: '2025-02-10T08:00:00Z', species: 'Carpa' }) // peso desconhecido
  ok('peso desconhecido: elegível sem filtro de peso (carpa = 4), excluído com peso', (await n(A, { p_water: wp, p_species: ['Carpa'] })) === 4 && (await n(A, { p_water: wp, p_weight_op: 'lt', p_weight_g: 99999 })) === 4)
  const { error: lpErr } = await A.sb.from('pins').insert({ name: 'Pesqueiro de teste', lat: 39.6, lng: -8.25, water_body_ref: wp })
  ok('pesqueiro isolado conta como pin (sem filtros) e sai com espécie', !lpErr && (await n(A, { p_water: wp })) === 6 && (await n(A, { p_water: wp, p_species: ['Carpa'] })) === 4, lpErr?.message ?? '')
  ok('zero resultados', (await n(A, { p_water: wp, p_species: ['Lúcio'] })) === 0)
  ok('peso inválido é recusado pelo servidor', !!(await A.sb.rpc('search_pins', { p_weight_op: 'x', p_weight_g: 1 })).error)
  // Total vs nesta área (mesma pesquisa; área só à volta de 3 dos pontos).
  const s = await search(A, { p_water: wz, p_community: true, p_west: -8.2485, p_south: 39.6005, p_east: -8.2465, p_north: 39.6025 })
  ok('total da pesquisa ≠ nesta área (calculados sobre o conjunto completo)', s.total === 10 && s.inView < s.total && s.inView > 0, `total ${s.total}, área ${s.inView}`)

  // ------------------------------------------------------------ horas: fim inclusivo e janela noturna
  const wh = W('horas')
  await ping(A, { water: wh, at: '2025-02-13T12:00:30Z' })
  await ping(A, { water: wh, at: '2025-02-13T12:01:00Z' })
  ok('fim às 12h00 inclui 12h00 e exclui 12h01 (último dia do intervalo)', (await n(A, { p_water: wh, p_date_from: '2025-02-13', p_date_to: '2025-02-13', p_min_from: 600, p_min_to: 720 })) === 1)
  const wn = W('noite')
  for (const at of ['2025-02-13T23:00:00Z', '2025-02-14T01:00:00Z', '2025-02-13T01:00:00Z', '2025-02-14T23:00:00Z']) await ping(A, { water: wn, at })
  ok('22h–02h só no dia 13: inclui 23h do 13 e 01h do 14; exclui a madrugada do 13', (await n(A, { p_water: wn, p_date_from: '2025-02-13', p_date_to: '2025-02-13', p_min_from: 1320, p_min_to: 120 })) === 2)

  // ------------------------------------------------------------ datas, anos e fusos (Portugal / Espanha)
  const wd = W('datas')
  for (const y of ['2024', '2025']) for (const d of ['02-12', '02-13', '03-20', '03-21']) await ping(A, { water: wd, at: `${y}-${d}T10:00:00Z` })
  ok('13 fev–20 mar: limites incluídos, só esse ano = 2', (await n(A, { p_water: wd, p_date_from: '2025-02-13', p_date_to: '2025-03-20' })) === 2)
  ok('«Repetir em todos os anos» = 4', (await n(A, { p_water: wd, p_date_from: '2025-02-13', p_date_to: '2025-03-20', p_yearly: true })) === 4)
  const wf = W('fusos')
  await ping(A, { water: wf, at: '2025-02-12T23:30:00Z', tz: 'Europe/Lisbon' })
  const es = await ping(A, { water: wf, at: '2025-02-12T23:30:00Z', tz: 'Europe/Madrid' })
  const f = await search(A, { p_water: wf, p_date_from: '2025-02-13', p_date_to: '2025-03-20' })
  ok('data local do sítio: o mesmo instante é dia 13 em Espanha e dia 12 em Portugal', f.total === 1 && f.rows[0].id === es)
  const wy = W('anos')
  for (const at of ['2028-02-29T10:00:00Z', '2025-02-28T10:00:00Z', '2025-03-01T10:00:00Z', '2022-12-28T10:00:00Z', '2023-01-05T10:00:00Z']) await ping(A, { water: wy, at })
  ok('29 de fevereiro sozinho, anual: só anos bissextos', (await n(A, { p_water: wy, p_date_from: '2024-02-29', p_date_to: '2024-02-29', p_yearly: true })) === 1)
  ok('anual dezembro → janeiro dá a volta ao ano', (await n(A, { p_water: wy, p_date_from: '2024-12-20', p_date_to: '2025-01-10', p_yearly: true })) === 2)
  // Ordenação: mesmo minuto → ID; o servidor ordena por data desc e ID.
  const wo = W('ordem')
  const o1 = await ping(A, { water: wo, at: '2025-02-10T07:00:00Z' })
  const o2 = await ping(A, { water: wo, at: '2025-02-10T07:00:00Z' })
  const ord = (await search(A, { p_water: wo })).rows.map((r) => r.id)
  ok('dois reports no mesmo minuto: ordem estável pelo ID', JSON.stringify(ord) === JSON.stringify([o1, o2].sort()))
} catch (e) {
  ok('execução sem exceções', false, e.message)
} finally {
  for (const c of [A, B]) if (c) await c.sb.functions.invoke('delete-account', { body: { confirm: 'ELIMINAR' } }).catch(() => undefined)
  console.log(results.join('\n'))
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} PASS · ${results.filter((r) => r.startsWith('FAIL')).length} FAIL`)
}
