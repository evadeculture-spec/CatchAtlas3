// Verificações ponta a ponta do backend real do Lança Lance (Supabase: Auth, RLS, Storage, Edge Functions).
// Uso: E2E_A_EMAIL=… E2E_A_PASSWORD=… E2E_B_EMAIL=… E2E_B_PASSWORD=… node e2e/backend.e2e.mjs
// (com NODE_USE_ENV_PROXY=1 atrás de um proxy). Usa DOIS utilizadores de teste confirmados e apaga no
// fim tudo o que criou (pins, pings, jornadas, ficheiros). Nunca usa a chave de serviço.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.VITE_SUPABASE_URL || 'https://xachgvjmhmnwaguayrcv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PjJKSFp2h6WwQy8i1XJX4A_5qlsSHhS'
const results = []
const ok = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) process.exitCode = 1
}
const client = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

async function login(email, password) {
  const sb = client()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return { sb, uid: data.user.id, token: data.session.access_token }
}

const A = await login(process.env.E2E_A_EMAIL, process.env.E2E_A_PASSWORD)
const B = await login(process.env.E2E_B_EMAIL, process.env.E2E_B_PASSWORD)
const anon = client()
const created = { pins: [], pings: [], journeys: [], files: [] }

try {
  // ------------------------------------------------------------ perfil
  const { data: prof } = await A.sb.from('profiles').select('id, display_name, privacy_notice_version, profile_visibility').eq('id', A.uid).single()
  ok('perfil criado no registo', prof?.display_name === 'Teste E2E A' && prof.privacy_notice_version === '2026-11-08' && prof.profile_visibility === 'private')
  const { data: profB } = await B.sb.from('profiles').select('id').eq('id', A.uid)
  ok('perfil de A invisível para B', Array.isArray(profB) && profB.length === 0)
  const { error: visErr } = await A.sb.from('profiles').update({ profile_visibility: 'public' }).eq('id', A.uid)
  ok('perfil não pode tornar-se público (só privado nesta fase)', !!visErr)
  const { data: anonPins, error: anonErr } = await anon.from('pins').select('id')
  ok('visitante anónimo não lê pins', !!anonErr || (anonPins ?? []).length === 0)

  // ------------------------------------------------------------ pins
  const { data: pin, error: pinErr } = await A.sb.from('pins').insert({ name: 'E2E Margem norte', category: 'spot', lat: 39.4612, lng: -8.1977, coord_source: 'mapa', environment: 'albufeira', target_species: ['Achigã'], private_notes: 'nota privada' }).select().single()
  ok('A cria um pin', !pinErr && pin?.owner_id === A.uid, pinErr?.message)
  created.pins.push(pin.id)
  const { data: coast } = await A.sb.from('pins').insert({ name: 'E2E Costa', category: 'spot', lat: 38.6905, lng: -9.4210, coord_source: 'mapa', environment: 'costa' }).select().single()
  created.pins.push(coast.id)
  const { data: seenByB } = await B.sb.from('pins').select('id').eq('id', pin.id)
  ok('B não vê o pin de A', seenByB?.length === 0)
  const { data: updB } = await B.sb.from('pins').update({ name: 'hack' }).eq('id', pin.id).select()
  ok('B não altera o pin de A', (updB ?? []).length === 0)
  const { error: forgeErr } = await B.sb.from('pins').insert({ owner_id: A.uid, name: 'forjado', category: 'spot', lat: 39, lng: -8 })
  ok('B não cria pins em nome de A', !!forgeErr)
  const { data: near } = await A.sb.rpc('nearby_pins', { p_lat: 39.4613, p_lng: -8.1978, p_radius_m: 150 })
  ok('deteção de pin próximo (deduplicação)', near?.[0]?.id === pin.id && near[0].distance_m < 30, `${near?.[0]?.distance_m?.toFixed?.(1)} m`)
  const { data: nearB } = await B.sb.rpc('nearby_pins', { p_lat: 39.4613, p_lng: -8.1978, p_radius_m: 150 })
  ok('pins próximos de A não aparecem a B', (nearB ?? []).length === 0)

  // ------------------------------------------------------------ pings
  const old = '2019-06-15T06:40:00Z'
  const recent = '2024-05-04T18:10:00Z'
  const ins = (row) => A.sb.from('pings').insert({ client_created_at: new Date().toISOString(), ...row }).select().single()
  const { data: p1, error: p1Err } = await ins({ pin_id: pin.id, kind: 'captura', occurred_at: recent, occurred_tz: 'Europe/Lisbon', time_source: 'foto-exif', time_reliability: 'alta', lat: 39.4613, lng: -8.1976, accuracy_m: 8, location_source: 'gps', modality: 'spinning', technique: 'jerkbait', outcome: 'sucesso', catch_count: 1 })
  ok('A cria um ping de captura', !p1Err && p1?.enrichment_status === 'pendente', p1Err?.message)
  created.pings.push(p1.id)
  const { data: p2 } = await ins({ pin_id: pin.id, kind: 'sem-captura', occurred_at: old, occurred_tz: 'Europe/Lisbon', time_source: 'manual', time_reliability: 'media', lat: 39.4613, lng: -8.1976, location_source: 'pin', outcome: 'sem-sucesso' })
  created.pings.push(p2.id)
  const { data: p3 } = await ins({ kind: 'observacao', occurred_at: new Date().toISOString(), occurred_tz: 'Europe/Lisbon', time_source: 'dispositivo', time_reliability: 'alta', location_source: 'nenhuma', notes: 'sem localização' })
  created.pings.push(p3.id)
  const { data: p4 } = await ins({ pin_id: coast.id, kind: 'condicoes', occurred_at: new Date(Date.now() - 3 * 3600000).toISOString(), occurred_tz: 'Europe/Lisbon', time_source: 'dispositivo', time_reliability: 'alta', lat: 38.6905, lng: -9.4210, location_source: 'pin' })
  created.pings.push(p4.id)
  const { error: futErr } = await ins({ kind: 'observacao', occurred_at: new Date(Date.now() + 5 * 86400000).toISOString(), time_source: 'manual', time_reliability: 'baixa', location_source: 'nenhuma' })
  ok('ping no futuro (> 2 dias) é rejeitado', !!futErr)
  const { error: halfErr } = await ins({ kind: 'observacao', occurred_at: recent, time_source: 'manual', time_reliability: 'baixa', lat: 39.4, location_source: 'mapa' })
  ok('coordenadas incompletas são rejeitadas', !!halfErr)
  const { error: enrichForge } = await A.sb.from('pings').update({ enrichment_status: 'concluido' }).eq('id', p1.id)
  ok('o cliente não pode marcar o enriquecimento como concluído', !!enrichForge)
  const { data: catchRow, error: cErr } = await A.sb.from('catches').insert({ ping_id: p1.id, species: 'Achigã', length_cm: 41, weight_g: 1180, released: true }).select().single()
  ok('captura associada ao ping', !cErr && catchRow?.ping_id === p1.id, cErr?.message)
  const { error: crossCatch } = await B.sb.from('catches').insert({ ping_id: p1.id, species: 'x' })
  ok('B não associa capturas ao ping de A', !!crossCatch)
  const { data: pingsB } = await B.sb.from('pings').select('id').in('id', created.pings)
  ok('B não vê nenhum ping de A', pingsB?.length === 0)

  // ------------------------------------------------------------ fotografias privadas
  const jpg = readFileSync(new URL('./fixtures/test-image.jpg', import.meta.url))
  const mediaId = crypto.randomUUID()
  const path = `${A.uid}/${mediaId}-orig.jpg`
  const { error: upErr } = await A.sb.storage.from('ping-media').upload(path, jpg, { contentType: 'image/jpeg' })
  ok('A carrega uma fotografia no bucket privado', !upErr, upErr?.message)
  created.files.push(path)
  const { error: upCross } = await A.sb.storage.from('ping-media').upload(`${B.uid}/${mediaId}-orig.jpg`, jpg, { contentType: 'image/jpeg' })
  ok('A não escreve na pasta de B', !!upCross)
  const { error: badType } = await A.sb.storage.from('ping-media').upload(`${A.uid}/${mediaId}.html`, Buffer.from('<script>'), { contentType: 'text/html' })
  ok('o bucket recusa tipos que não são imagem', !!badType)
  const { data: dlB, error: dlBErr } = await B.sb.storage.from('ping-media').download(path)
  ok('B não descarrega a fotografia de A', !dlB && !!dlBErr)
  const pub = await fetch(`${URL_}/storage/v1/object/public/ping-media/${path}`)
  ok('não existe URL público da fotografia', pub.status >= 400, `HTTP ${pub.status}`)
  const { data: signed } = await A.sb.storage.from('ping-media').createSignedUrl(path, 60)
  const sres = signed ? await fetch(signed.signedUrl) : null
  ok('URL assinado e temporário funciona para o dono', sres?.status === 200)
  const { data: signedB } = await B.sb.storage.from('ping-media').createSignedUrl(path, 60)
  ok('B não consegue assinar URL para a fotografia de A', !signedB)
  const { error: pmErr } = await A.sb.from('ping_media').insert({ ping_id: p1.id, storage_path: path, mime: 'image/jpeg', width: 2000, height: 1333, bytes: jpg.length, exif_has_gps: false })
  ok('metadados da fotografia associados ao ping', !pmErr, pmErr?.message)
  const { error: pmCross } = await B.sb.from('ping_media').insert({ ping_id: p1.id, storage_path: `${B.uid}/x.jpg`, mime: 'image/jpeg', bytes: 10 })
  ok('B não associa fotografias ao ping de A', !!pmCross)

  // ------------------------------------------------------------ enriquecimento (Edge Function real)
  const call = async (who, fn, body) => {
    const r = await fetch(`${URL_}/functions/v1/${fn}`, { method: 'POST', headers: { Authorization: `Bearer ${who.token}`, apikey: KEY, 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify(body) })
    return { status: r.status, body: await r.json().catch(() => null), cors: r.headers.get('access-control-allow-origin') }
  }
  const noAuth = await fetch(`${URL_}/functions/v1/enrich-ping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  ok('Edge Function exige sessão', noAuth.status === 401, `HTTP ${noAuth.status}`)
  const cross = await call(B, 'enrich-ping', { pingId: p1.id })
  ok('B não enriquece pings de A', cross.status === 404, `HTTP ${cross.status}`)
  for (const p of [p1, p2, p3, p4]) {
    const r = await call(A, 'enrich-ping', { pingId: p.id })
    ok(`enriquecimento do ping ${p.kind}`, r.status === 200 && Array.isArray(r.body?.results), `${r.status} ${JSON.stringify(r.body?.results?.[0] ?? r.body)}`)
  }
  ok('CORS restrito à origem da app', (await call(A, 'enrich-ping', { pingId: p3.id })).cors === 'http://localhost:5173')
  const { data: envs } = await A.sb.from('ping_environment').select('*').in('ping_id', [p1.id, p2.id, p4.id])
  const e1 = envs?.find((e) => e.ping_id === p1.id)
  const e2 = envs?.find((e) => e.ping_id === p2.id)
  const e4 = envs?.find((e) => e.ping_id === p4.id)
  ok('2024: arquivo de previsões, marcado como estimativa de modelo', e1?.dataset === 'historical-forecast' && e1.data_kind === 'estimado' && typeof e1.air_temp_c === 'number', `${e1?.dataset}/${e1?.data_kind} ${e1?.air_temp_c} °C`)
  ok('hora de referência = hora do acontecimento', e1 && Math.abs(new Date(e1.reference_time) - new Date(recent)) <= 30 * 60000, e1?.reference_time)
  ok('2019: reanálise ERA5 (histórico), nunca o tempo atual', e2?.dataset === 'archive' && e2.data_kind === 'historico' && e2.reference_time?.startsWith('2019-06-15'), `${e2?.dataset}/${e2?.data_kind} ${e2?.reference_time}`)
  ok('astronomia calculada (nascer do sol, lua)', !!e2?.sunrise && typeof e2.moon_illumination === 'number')
  ok('coordenadas arredondadas na proveniência', e1?.quality?.coords_rounded_deg === 0.01 && Array.isArray(e1.sources) && e1.sources.some((s) => s.group === 'agua-interior' && s.data_kind === 'indisponivel'))
  ok('água interior mostrada como indisponível (null)', e1 && e1.water_temp_c === null && e1.river_flow_m3s === null)
  ok('ping costeiro com dados marinhos (ou parcial)', !!e4 && (typeof e4.wave_height_m === 'number' || e4.quality?.errors?.some((x) => x.startsWith('marine'))), `ondas ${e4?.wave_height_m} m`)
  const { data: st } = await A.sb.from('pings').select('id, enrichment_status').in('id', [p1.id, p2.id, p3.id])
  ok('estados finais do enriquecimento', st?.find((x) => x.id === p3.id)?.enrichment_status === 'sem-localizacao' && ['concluido', 'parcial'].includes(st?.find((x) => x.id === p1.id)?.enrichment_status))
  const { data: envB } = await B.sb.from('ping_environment').select('ping_id').in('ping_id', [p1.id, p2.id])
  ok('B não lê as condições dos pings de A', envB?.length === 0)
  const t0 = Date.now()
  await A.sb.from('pings').update({ occurred_at: '2024-05-04T19:10:00Z' }).eq('id', p1.id)
  const { data: reset } = await A.sb.from('pings').select('enrichment_status, enrichment_attempts').eq('id', p1.id).single()
  ok('alterar hora/local volta a pôr o enriquecimento pendente', reset?.enrichment_status === 'pendente' && reset.enrichment_attempts === 0)
  const again = await call(A, 'enrich-ping', { pingId: p1.id })
  const { data: e1b } = await A.sb.from('ping_environment').select('reference_time, sources').eq('ping_id', p1.id).single()
  ok('reenriquecimento usa a cache (sem novo pedido ao fornecedor)', again.status === 200 && e1b?.sources?.some((s) => s.group === 'meteorologia' && s.cached === true), `${Date.now() - t0} ms`)

  // ------------------------------------------------------------ planeador: condições
  const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
  const c1 = await call(A, 'conditions', { lat: 39.4612, lng: -8.1977, date: inDays(3), timezone: 'Europe/Lisbon' })
  ok('previsão para daqui a 3 dias (marcada como previsão)', c1.status === 200 && c1.body?.available && c1.body.kind === 'previsao' && Array.isArray(c1.body.data?.daily?.temperature_2m_max), `${c1.body?.kind} ${c1.body?.data?.daily?.temperature_2m_max?.[0]} °C`)
  const c2 = await call(A, 'conditions', { lat: 39.4612, lng: -8.1977, date: inDays(40), timezone: 'Europe/Lisbon' })
  ok('sem previsão para lá de 15 dias (não inventa)', c2.status === 200 && c2.body?.available === false && !!c2.body.astronomy)
  const c3 = await call(A, 'conditions', { lat: 999, lng: 0, date: inDays(1) })
  ok('consulta inválida rejeitada', c3.status === 400)

  // ------------------------------------------------------------ jornadas
  const { data: j, error: jErr } = await A.sb.from('journeys').insert({ title: 'E2E Jornada', journey_date: inDays(3), start_time: '06:30', modality: 'spinning', target_species: ['Achigã'], checklist: [{ id: 'licenca', label: 'Licença de pesca válida', done: false }] }).select().single()
  ok('A cria uma jornada', !jErr, jErr?.message)
  created.journeys.push(j.id)
  const { error: jpErr } = await A.sb.from('journey_pins').insert([{ journey_id: j.id, pin_id: pin.id, position: 0 }, { journey_id: j.id, pin_id: coast.id, position: 1 }])
  ok('pins ordenados na jornada', !jpErr, jpErr?.message)
  const { data: jB } = await B.sb.from('journeys').insert({ title: 'B jornada', journey_date: inDays(2) }).select().single()
  const { error: jpCross } = await B.sb.from('journey_pins').insert({ journey_id: jB.id, pin_id: pin.id, position: 0 })
  ok('B não usa pins de A nas suas jornadas', !!jpCross)
  await B.sb.from('journeys').delete().eq('id', jB.id)

  // ------------------------------------------------------------ painel, histórico, auditoria
  const { data: sum } = await A.sb.rpc('angler_summary')
  const s = Array.isArray(sum) ? sum[0] : sum
  ok('contadores do painel com dados reais', s?.pins >= 2 && s.pings >= 4 && s.catches >= 1 && s.photos >= 1, JSON.stringify(s))
  const { data: sumB } = await B.sb.rpc('angler_summary')
  const sb2 = Array.isArray(sumB) ? sumB[0] : sumB
  ok('contadores de B não incluem dados de A', Number(sb2?.pings ?? 0) === 0)
  const { data: tl } = await A.sb.from('activity_timeline').select('kind, id, at').order('at', { ascending: false }).limit(50)
  ok('cronologia com pings, pins, jornadas e capturas', ['ping', 'pin', 'journey', 'catch'].every((k) => tl?.some((r) => r.kind === k)))
  const { data: tlB } = await B.sb.from('activity_timeline').select('id').in('id', created.pings)
  ok('cronologia de A invisível para B', tlB?.length === 0)
  await A.sb.from('pins').update({ status: 'arquivado' }).eq('id', coast.id)
  const { data: audit } = await A.sb.from('audit_log').select('action, entity').eq('entity_id', coast.id)
  ok('arquivo registado na auditoria', audit?.some((a) => a.action === 'archive'))
  const { error: auditForge } = await A.sb.from('audit_log').insert({ action: 'delete', entity: 'pins', entity_id: pin.id })
  ok('o cliente não forja entradas de eliminação na auditoria', !!auditForge)
  const { data: srcs } = await A.sb.from('data_sources').select('key')
  ok('fontes de dados documentadas e legíveis', srcs?.length >= 7)
  const { data: cache, error: cacheErr } = await A.sb.from('env_cache').select('key').limit(1)
  ok('cache do servidor inacessível ao cliente', !!cacheErr || (cache ?? []).length === 0)

  // ------------------------------------------------------------ apagar pin mantém os pings
  await A.sb.from('pings').delete().eq('id', p4.id)
  const { error: delPinErr } = await A.sb.from('pins').delete().eq('id', coast.id)
  ok('apagar um pin', !delPinErr)
  const { data: keep } = await A.sb.from('pings').select('id, pin_id').eq('id', p2.id).single()
  ok('pings mantêm-se quando outro pin é apagado', keep?.pin_id === pin.id)
} catch (e) {
  ok('execução sem exceções', false, e.message)
} finally {
  // Limpeza: tudo o que o teste criou (os utilizadores de teste mantêm-se).
  if (created.files.length) await A.sb.storage.from('ping-media').remove(created.files)
  if (created.journeys.length) await A.sb.from('journeys').delete().in('id', created.journeys)
  if (created.pings.length) await A.sb.from('pings').delete().in('id', created.pings)
  if (created.pins.length) await A.sb.from('pins').delete().in('id', created.pins)
  const { data: left } = await A.sb.from('pins').select('id').in('id', created.pins)
  ok('limpeza concluída', (left ?? []).length === 0)
  console.log(results.join('\n'))
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} verificações passaram`)
}
