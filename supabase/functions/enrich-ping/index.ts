// Lança Lance — enriquecimento ambiental dos Pings (assíncrono, idempotente, com cache e fallback).
// POST { pingId } enriquece um ping do utilizador; POST { sweep: true } retoma os pendentes/falhados
// do utilizador (tentativas controladas com recuo). Nunca regista coordenadas nos logs.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import SunCalc from 'npm:suncalc@1.9.0'
import {
  astronomy, buildMarineUrl, buildWeatherUrl, cacheKey, cacheTtlMs, datasetPlan, dataKindFor, extractMarine,
  extractWeather, isCoastal, SOURCE_KEY, type Dataset, type OpenMeteoHourly,
} from '../_shared/enrichment.ts'
import { corsHeaders, json } from '../_shared/http.ts'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAX_ATTEMPTS = 5
const UA = 'LancaLance/1.0 (enriquecimento ambiental)'

type Admin = ReturnType<typeof createClient>

async function cachedFetch(admin: Admin, key: string, url: string, ttlMs: number | null): Promise<{ data: OpenMeteoHourly; cached: boolean }> {
  const { data: hit } = await admin.from('env_cache').select('payload, expires_at').eq('key', key).maybeSingle()
  if (hit && (!hit.expires_at || new Date(hit.expires_at).getTime() > Date.now())) return { data: hit.payload as OpenMeteoHourly, cached: true }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 12000)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctl.signal })
    if (!r.ok) throw new Error(`fornecedor HTTP ${r.status}`)
    const data = (await r.json()) as OpenMeteoHourly & { error?: boolean; reason?: string }
    if (data.error) throw new Error(`fornecedor: ${data.reason ?? 'erro'}`)
    await admin.from('env_cache').upsert({ key, payload: data, fetched_at: new Date().toISOString(), expires_at: ttlMs === null ? null : new Date(Date.now() + ttlMs).toISOString() })
    return { data, cached: false }
  } finally {
    clearTimeout(timer)
  }
}

interface PingRow {
  id: string
  owner_id: string
  occurred_at: string
  lat: number | null
  lng: number | null
  enrichment_status: string
  enrichment_attempts: number
  pin: { environment: string | null } | null
}

async function enrichOne(admin: Admin, ping: PingRow) {
  const occurredAt = new Date(ping.occurred_at)
  const now = new Date()
  if (ping.lat === null || ping.lng === null) {
    await admin.from('pings').update({ enrichment_status: 'sem-localizacao', enrichment_error: null, enriched_at: now.toISOString() }).eq('id', ping.id)
    return { id: ping.id, status: 'sem-localizacao' }
  }
  const sources: Record<string, unknown>[] = []
  const errors: string[] = []
  let weather = null
  let used: Dataset | null = null
  for (const ds of datasetPlan(occurredAt, now)) {
    try {
      const res = await cachedFetch(admin, cacheKey(ds, ping.lat, ping.lng, occurredAt), buildWeatherUrl(ds, ping.lat, ping.lng, occurredAt), cacheTtlMs(ds, occurredAt, now))
      weather = extractWeather(res.data, occurredAt)
      if (weather) {
        used = ds
        sources.push({ group: 'meteorologia', source: SOURCE_KEY[ds], dataset: ds, data_kind: dataKindFor(ds, occurredAt, now), cached: res.cached, cell_deg: 0.01 })
        break
      }
      errors.push(`${ds}: sem dados para a hora do acontecimento`)
    } catch (e) {
      errors.push(`${ds}: ${(e as Error).message}`)
    }
  }
  const astro = astronomy(SunCalc, occurredAt, ping.lat, ping.lng)
  sources.push({ group: 'astronomia', source: 'suncalc', data_kind: 'calculado' })

  let marine = null
  if (isCoastal(ping.pin?.environment)) {
    try {
      const res = await cachedFetch(admin, cacheKey('marine', ping.lat, ping.lng, occurredAt), buildMarineUrl(ping.lat, ping.lng, occurredAt), cacheTtlMs('marine', occurredAt, now))
      marine = extractMarine(res.data, occurredAt)
      if (marine) sources.push({ group: 'mar', source: 'open-meteo-marine', data_kind: 'estimado', cached: res.cached })
      else errors.push('marine: sem dados')
    } catch (e) {
      errors.push(`marine: ${(e as Error).message}`)
    }
  }
  sources.push({ group: 'agua-interior', source: 'agua-interior', data_kind: 'indisponivel' })

  const status = weather ? (errors.length && isCoastal(ping.pin?.environment) && !marine ? 'parcial' : 'concluido') : 'falhou'
  const snapshot = {
    ping_id: ping.id,
    owner_id: ping.owner_id,
    provider: 'open-meteo',
    dataset: used ?? 'nenhum',
    data_kind: used ? dataKindFor(used, occurredAt, now) : 'estimado',
    ...(weather ?? {}),
    ...astro,
    ...(marine ?? {}),
    sources,
    quality: { grid_resolution: used === 'archive' ? 'ERA5 ~9–25 km' : 'modelo 1–11 km', time_offset_min: weather?.time_offset_min ?? null, coords_rounded_deg: 0.01, errors },
  }
  // O snapshot astronómico guarda-se mesmo sem meteorologia (é calculado localmente).
  const { error: upErr } = await admin.from('ping_environment').upsert(snapshot)
  if (upErr) throw new Error(`gravar snapshot: ${upErr.message}`)
  await admin.from('pings').update({
    enrichment_status: status,
    enrichment_error: errors.length ? errors.join(' · ').slice(0, 500) : null,
    enriched_at: new Date().toISOString(),
  }).eq('id', ping.id)
  return { id: ping.id, status }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Método não permitido' }, 405)
  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(req, { error: 'Sessão inválida' }, 401)
  let body: { pingId?: string; sweep?: boolean }
  try {
    body = await req.json()
  } catch {
    return json(req, { error: 'Pedido inválido' }, 400)
  }
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
  const cols = 'id, owner_id, occurred_at, lat, lng, enrichment_status, enrichment_attempts, pin:pins(environment)'

  let candidates: PingRow[]
  if (body.pingId) {
    if (!/^[0-9a-f-]{36}$/i.test(body.pingId)) return json(req, { error: 'Identificador inválido' }, 400)
    const { data } = await admin.from('pings').select(cols).eq('id', body.pingId).eq('owner_id', user.id).maybeSingle()
    if (!data) return json(req, { error: 'Ping não encontrado' }, 404)
    candidates = [data as unknown as PingRow]
  } else if (body.sweep) {
    const staleBefore = new Date(Date.now() - 5 * 60000).toISOString()
    const { data } = await admin.from('pings').select(cols).eq('owner_id', user.id)
      .or(`enrichment_status.eq.pendente,and(enrichment_status.eq.falhou,enrichment_started_at.lt.${staleBefore}),and(enrichment_status.eq.em-curso,enrichment_started_at.lt.${staleBefore})`)
      .lt('enrichment_attempts', MAX_ATTEMPTS).order('occurred_at', { ascending: false }).limit(5)
    candidates = (data ?? []) as unknown as PingRow[]
  } else return json(req, { error: 'Indique pingId ou sweep' }, 400)

  const results = []
  for (const p of candidates) {
    if (p.enrichment_attempts >= MAX_ATTEMPTS) {
      results.push({ id: p.id, status: p.enrichment_status, skipped: 'limite de tentativas' })
      continue
    }
    // Reclamação atómica: só um pedido processa cada ping (evita chamadas duplicadas ao fornecedor).
    const staleBefore = new Date(Date.now() - 5 * 60000).toISOString()
    const { data: claimed } = await admin.from('pings')
      .update({ enrichment_status: 'em-curso', enrichment_started_at: new Date().toISOString(), enrichment_attempts: p.enrichment_attempts + 1 })
      .eq('id', p.id).eq('enrichment_attempts', p.enrichment_attempts)
      .or(`enrichment_status.in.(pendente,falhou,concluido,parcial,sem-localizacao),enrichment_started_at.lt.${staleBefore}`)
      .select('id')
    if (!claimed?.length) {
      results.push({ id: p.id, status: 'em-curso', skipped: 'já em processamento' })
      continue
    }
    try {
      results.push(await enrichOne(admin, p))
    } catch (e) {
      await admin.from('pings').update({ enrichment_status: 'falhou', enrichment_error: (e as Error).message.slice(0, 500) }).eq('id', p.id)
      results.push({ id: p.id, status: 'falhou' })
    }
  }
  return json(req, { results })
})
