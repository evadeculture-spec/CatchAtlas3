// Ensaio de carga do Atlas (leituras por área visível, escritas de pins e envios de fotografias),
// contra o backend real, a partir de UM cliente (este contentor, através de um proxy de saída).
// Uso: E2E_B_EMAIL=… E2E_B_PASSWORD=… node e2e/load.mjs docs/lanca/carga.json
// Pré-requisito: dados sintéticos do utilizador B (ver docs/LANCA_LANCE.md, secção de medições).
// Hipótese explícita: 300 sessões simultâneas para 6 000 subscritores ativos. Este ensaio mede níveis
// de concorrência mais baixos a partir de uma só origem; as conclusões para 300 sessões exigem
// clientes distribuídos e infraestrutura representativa (plano pago, pool de ligações dimensionado).
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const out = process.argv[2] || 'docs/lanca/carga.json'
const URL_ = process.env.VITE_SUPABASE_URL || 'https://xachgvjmhmnwaguayrcv.supabase.co'
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PjJKSFp2h6WwQy8i1XJX4A_5qlsSHhS'
const sb = createClient(URL_, KEY, { auth: { persistSession: false } })
const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: process.env.E2E_B_EMAIL, password: process.env.E2E_B_PASSWORD })
if (authErr) throw authErr
const uid = auth.user.id

const q = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]) : null
}
const stats = (xs) => ({ n: xs.length, p50: q(xs, 50), p95: q(xs, 95), p99: q(xs, 99), max: xs.length ? Math.round(Math.max(...xs)) : null })
const rnd = (a, b) => a + Math.random() * (b - a)

/** Vista aleatória: 50 % margem da albufeira popular, 25 % albufeira inteira, 25 % região/Península (agregado). */
function viewport() {
  const r = Math.random()
  if (r < 0.5) {
    const lat = rnd(39.56, 39.78), lng = rnd(-8.31, -8.18)
    return { b: [lng - 0.015, lat - 0.01, lng + 0.015, lat + 0.01], cell: null, kind: 'margem' }
  }
  if (r < 0.75) return { b: [-8.33, 39.53, -8.15, 39.86], cell: null, kind: 'albufeira' }
  return Math.random() < 0.5 ? { b: [-9.6, 36.9, -6.1, 42.2], cell: 0.5, kind: 'peninsula' } : { b: [-8.9, 39.0, -7.6, 40.2], cell: 0.1, kind: 'regiao' }
}

async function readPhase(concurrency, seconds) {
  const lat = { margem: [], albufeira: [], peninsula: [], regiao: [] }
  const all = []
  let errors = 0
  let rows = 0
  const end = Date.now() + seconds * 1000
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (Date.now() < end) {
        const v = viewport()
        const t0 = performance.now()
        const { data, error } = await sb.rpc('my_atlas_pins', { p_west: v.b[0], p_south: v.b[1], p_east: v.b[2], p_north: v.b[3], p_cell: v.cell, p_limit: 1500 })
        const ms = performance.now() - t0
        if (error) errors++
        else {
          rows += data.length
          lat[v.kind].push(ms)
          all.push(ms)
        }
      }
    }),
  )
  return { concurrency, seconds, requests: all.length + errors, rps: Math.round(((all.length + errors) / seconds) * 10) / 10, errors, avg_rows: Math.round(rows / Math.max(1, all.length)), latency_ms: stats(all), by_view: Object.fromEntries(Object.entries(lat).map(([k, v]) => [k, stats(v)])) }
}

async function writePhase(n) {
  const ids = Array.from({ length: n }, () => crypto.randomUUID())
  const row = (id) => ({ id, kind: 'captura', occurred_at: new Date(Date.now() - 3600000).toISOString(), occurred_tz: 'Europe/Lisbon', time_source: 'dispositivo', time_reliability: 'alta', lat: rnd(39.56, 39.78), lng: rnd(-8.31, -8.18), location_source: 'gps', water_body_ref: 'ensaio-carga', water_body_name: 'Ensaio de carga' })
  const lat = []
  let errors = 0
  const t0 = performance.now()
  await Promise.all(
    ids.map(async (id) => {
      const s = performance.now()
      const { error } = await sb.from('pings').insert(row(id))
      if (error) errors++
      else lat.push(performance.now() - s)
    }),
  )
  // Repetição de TODOS os envios (como depois de uma falha de rede): o mesmo ID não pode duplicar.
  let dupRejected = 0
  await Promise.all(
    ids.map(async (id) => {
      const { error } = await sb.from('pings').insert(row(id))
      if (error?.code === '23505') dupRejected++
    }),
  )
  const { count } = await sb.from('pings').select('id', { count: 'exact', head: true }).in('id', ids)
  return { inserts: n, wall_ms: Math.round(performance.now() - t0), latency_ms: stats(lat), errors, retries_rejected_as_duplicate: dupRejected, rows_on_server: count, duplicates: (count ?? 0) - (n - errors), ids }
}

async function uploadPhase(n, pingIds) {
  const img = readFileSync(new URL('./fixtures/exif-photo.jpg', import.meta.url))
  const lat = []
  let errors = 0
  const paths = []
  await Promise.all(
    pingIds.slice(0, n).map(async (pingId) => {
      const id = crypto.randomUUID()
      const path = `${uid}/${id}-orig.jpg`
      const s = performance.now()
      const up = await sb.storage.from('ping-media').upload(path, img, { contentType: 'image/jpeg', upsert: true })
      const ins = up.error ? up : await sb.from('ping_media').insert({ id, ping_id: pingId, storage_path: path, mime: 'image/jpeg', bytes: img.length })
      if (up.error || ins.error) errors++
      else lat.push(performance.now() - s)
      paths.push(path)
    }),
  )
  return { uploads: n, bytes_each: img.length, latency_ms: stats(lat), errors, paths }
}

const result = { date: new Date().toISOString(), origin: 'um cliente (contentor) → proxy → Supabase eu-west-3 (plano gratuito)', hypothesis: '300 sessões simultâneas para 6 000 subscritores ativos (não ensaiado diretamente: ver nota)', reads: [], writes: null, uploads: null }
const { count: dataset } = await sb.from('pings').select('id', { count: 'exact', head: true })
const { count: datasetPins } = await sb.from('pins').select('id', { count: 'exact', head: true })
result.dataset = { pings: dataset, pins: datasetPins, note: 'dados sintéticos com densidade desigual (albufeira popular: Castelo do Bode)' }
for (const c of [10, 30, 60]) {
  const r = await readPhase(c, 30)
  console.log('leituras', c, JSON.stringify({ rps: r.rps, errors: r.errors, latency: r.latency_ms }))
  result.reads.push(r)
}
const w = await writePhase(40)
console.log('escritas', JSON.stringify({ ...w, ids: undefined }))
result.uploads = await uploadPhase(10, w.ids)
console.log('envios', JSON.stringify({ ...result.uploads, paths: undefined }))
result.writes = { ...w, ids: undefined }
// Limpeza do que este ensaio criou.
await sb.storage.from('ping-media').remove(result.uploads.paths)
await sb.from('pings').delete().in('id', w.ids)
result.uploads = { ...result.uploads, paths: undefined }
writeFileSync(out, JSON.stringify(result, null, 2))
console.log(`Resultados em ${out}`)
