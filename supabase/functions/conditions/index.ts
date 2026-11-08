// Lança Lance — condições previstas (ou passadas) para um local e um dia, para o planeador.
// POST { lat, lng, date, timezone }. Coordenadas arredondadas a 0,01° antes de sair do servidor.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import SunCalc from 'npm:suncalc@1.9.0'
import { astronomy, DATASET_URL, SOURCE_KEY } from '../_shared/enrichment.ts'
import { buildForecastUrl, forecastDataset, validateQuery } from '../_shared/forecast.ts'
import { corsHeaders, json } from '../_shared/http.ts'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Método não permitido' }, 405)
  const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(req, { error: 'Sessão inválida' }, 401)
  let raw: Record<string, unknown>
  try {
    raw = await req.json()
  } catch {
    return json(req, { error: 'Pedido inválido' }, 400)
  }
  const q = validateQuery(raw as never)
  if (typeof q === 'string') return json(req, { error: q }, 400)
  const now = new Date()
  const noon = new Date(`${q.date}T12:00:00Z`)
  const astro = astronomy(SunCalc, noon, q.lat, q.lng)
  const plan = forecastDataset(q.date, now)
  if (!plan) return json(req, { available: false, reason: 'Fora do horizonte de previsão (até 15 dias).', astronomy: astro, astronomySource: 'suncalc' })

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
  const url = buildForecastUrl(DATASET_URL[plan.dataset], q, plan.dataset)
  const key = `cond:${plan.dataset}:${q.lat.toFixed(2)}:${q.lng.toFixed(2)}:${q.date}:${q.timezone}`
  const { data: hit } = await admin.from('env_cache').select('payload, expires_at, fetched_at').eq('key', key).maybeSingle()
  let payload = hit && (!hit.expires_at || new Date(hit.expires_at).getTime() > Date.now()) ? hit.payload : null
  let fetchedAt = hit?.fetched_at ?? null
  if (!payload) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 12000)
      const r = await fetch(url, { headers: { 'User-Agent': 'LancaLance/1.0 (planeador)' }, signal: ctl.signal })
      clearTimeout(t)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      payload = await r.json()
      fetchedAt = new Date().toISOString()
      const ttl = plan.kind === 'previsao' ? 3600000 : plan.kind === 'estimado' ? 6 * 3600000 : null
      await admin.from('env_cache').upsert({ key, payload, fetched_at: fetchedAt, expires_at: ttl ? new Date(Date.now() + ttl).toISOString() : null })
    } catch (e) {
      // Fallback: cópia antiga da cache, assinalada como desatualizada.
      if (hit?.payload) return json(req, { available: true, stale: true, kind: plan.kind, dataset: plan.dataset, source: SOURCE_KEY[plan.dataset], fetchedAt: hit.fetched_at, data: hit.payload, astronomy: astro })
      return json(req, { available: false, reason: `Fornecedor meteorológico indisponível (${(e as Error).message}).`, astronomy: astro })
    }
  }
  return json(req, { available: true, stale: false, kind: plan.kind, dataset: plan.dataset, source: SOURCE_KEY[plan.dataset], fetchedAt, data: payload, astronomy: astro, cellDeg: 0.01 })
})
