// Lança Lance — sessão de teste sem email.
// POST { privacyNoticeVersion }. Cria uma conta real de teste com um email interno (domínio reservado
// .invalid: nunca recebe nem envia correio), confirmada pelo servidor e marcada em app_metadata.guest
// (só o servidor a pode alterar). Devolve logo a sessão (tokens); a palavra-passe é aleatória e nunca sai
// do servidor, por isso não há forma de voltar a entrar depois de sair (terminar a sessão apaga os dados).
// Limites contra abuso: por rede (HMAC do IP, nunca o IP em claro) e global por dia.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { corsHeaders, json } from '../_shared/http.ts'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PER_NETWORK_PER_HOUR = 10
const GLOBAL_PER_DAY = 300

const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
async function hmac(key: Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(msg))
}
// Chave própria, derivada do segredo do servidor (separação de finalidades).
let ipKey: Uint8Array | null = null
async function networkHash(ip: string) {
  ipKey ??= new Uint8Array(await hmac(enc.encode(SERVICE), 'lanca-guest-network-v1'))
  return hex(await hmac(ipKey, ip))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Método não permitido' }, 405)
  const body = await req.json().catch(() => ({}))
  const notice = String(body?.privacyNoticeVersion ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(notice)) return json(req, { error: 'É preciso aceitar o aviso de privacidade.' }, 400)

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido'
  const net = await networkHash(ip)
  const now = Date.now()
  // Limpeza dos registos antigos fora do caminho da resposta.
  const cleanup = admin.from('guest_sessions').delete().lt('created_at', new Date(now - 2 * 86400_000).toISOString()).then(() => undefined)
  // deno-lint-ignore no-explicit-any
  ;(globalThis as any).EdgeRuntime?.waitUntil?.(cleanup)
  const [{ count: perNet }, { count: perDay }] = await Promise.all([
    admin.from('guest_sessions').select('id', { count: 'exact', head: true }).eq('ip_hash', net).gte('created_at', new Date(now - 3600_000).toISOString()),
    admin.from('guest_sessions').select('id', { count: 'exact', head: true }).gte('created_at', new Date(now - 86400_000).toISOString()),
  ])
  if ((perNet ?? 0) >= PER_NETWORK_PER_HOUR) return json(req, { error: 'Demasiadas sessões de teste a partir desta rede. Aguarde uma hora e tente de novo.' }, 429)
  if ((perDay ?? 0) >= GLOBAL_PER_DAY) return json(req, { error: 'Limite diário de sessões de teste atingido. Tente amanhã.' }, 429)

  const email = `sessao-teste-${crypto.randomUUID()}@lanca-lance.invalid`
  const password = hex(crypto.getRandomValues(new Uint8Array(32)).buffer)
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Sessão de teste', privacy_notice_version: notice },
    app_metadata: { guest: true },
  })
  if (error || !created?.user) return json(req, { error: `Não foi possível abrir a sessão de teste (${error?.message ?? 'erro desconhecido'}).` }, 500)
  const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const [, { data: signed, error: signErr }] = await Promise.all([
    admin.from('guest_sessions').insert({ ip_hash: net, user_id: created.user.id }),
    anon.auth.signInWithPassword({ email, password }),
  ])
  if (signErr || !signed.session) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json(req, { error: `Não foi possível abrir a sessão de teste (${signErr?.message ?? 'sem sessão'}).` }, 500)
  }
  return json(req, { access_token: signed.session.access_token, refresh_token: signed.session.refresh_token })
})
