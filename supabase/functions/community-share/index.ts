// Lança Lance — publicar/revogar a versão comunitária de um Ping (decisão explícita do dono).
// POST { action: 'publish' | 'revoke', pingId, mode?: 'zona' | 'exato' }. A versão publicada é uma linha
// SEPARADA em shared_reports. «zona» (por omissão) guarda só a zona pública estável; «exato» guarda também o
// ponto exato, por escolha explícita do autor. Publicar de novo com outro modo atualiza a versão pública
// (exato → zona apaga o ponto exato). A fotografia partilhada é a versão de visualização (reencodada no
// dispositivo, sem EXIF/GPS) copiada para o bucket community-media.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { APPROX_CELL_DEG, approximate, dayPeriod, localDateHour } from '../_shared/approx.ts'
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
  const body = await req.json().catch(() => ({}))
  const pingId = String(body?.pingId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(pingId)) return json(req, { error: 'Identificador inválido' }, 400)
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })

  if (body?.action === 'revoke') {
    const { data: share } = await admin.from('shared_reports').select('id, photo_path').eq('ping_id', pingId).eq('owner_id', user.id).maybeSingle()
    if (!share) return json(req, { ok: true, revoked: false })
    if (share.photo_path) {
      const { error } = await admin.storage.from('community-media').remove([share.photo_path])
      if (error) return json(req, { error: `Não foi possível retirar a fotografia partilhada (${error.message}).` }, 500)
    }
    const { error } = await admin.from('shared_reports').delete().eq('id', share.id)
    if (error) return json(req, { error: error.message }, 500)
    await admin.from('audit_log').insert({ owner_id: user.id, action: 'unshare', entity: 'shared_reports', entity_id: share.id })
    return json(req, { ok: true, revoked: true })
  }
  if (body?.action !== 'publish') return json(req, { error: 'Ação inválida' }, 400)
  const mode: 'zona' | 'exato' = body?.mode === 'exato' ? 'exato' : 'zona'

  const { data: ping } = await admin.from('pings').select('id, owner_id, kind, occurred_at, occurred_tz, lat, lng, technique, water_body_name, water_body_ref').eq('id', pingId).eq('owner_id', user.id).maybeSingle()
  if (!ping) return json(req, { error: 'Registo não encontrado.' }, 404)
  if (ping.lat === null || ping.lng === null) return json(req, { error: 'Só é possível partilhar registos com localização.' }, 400)
  const ap = approximate(ping.lat, ping.lng, ping.water_body_name)
  const zoneId = `${Math.floor(ping.lat / APPROX_CELL_DEG)}:${Math.floor(ping.lng / APPROX_CELL_DEG)}`
  const exact = mode === 'exato' ? { exact_lat: ping.lat, exact_lng: ping.lng } : { exact_lat: null, exact_lng: null }
  const { data: existing } = await admin.from('shared_reports').select('id, share_mode').eq('ping_id', pingId).maybeSingle()
  if (existing) {
    // Mudança de modo (ou republicação): a versão pública passa a ter só o que o modo permite.
    const { error } = await admin.from('shared_reports').update({ share_mode: mode, ...exact, approx_lat: ap.lat, approx_lng: ap.lng, zone_id: zoneId }).eq('id', existing.id)
    if (error) return json(req, { error: error.message }, 500)
    if (existing.share_mode !== mode) await admin.from('audit_log').insert({ owner_id: user.id, action: 'share', entity: 'shared_reports', entity_id: existing.id })
    return json(req, { ok: true, shareId: existing.id, mode, already: true })
  }

  const [{ data: catchRow }, { data: media }] = await Promise.all([
    admin.from('catches').select('species, weight_g').eq('ping_id', pingId).order('created_at').limit(1).maybeSingle(),
    admin.from('ping_media').select('display_path').eq('ping_id', pingId).not('display_path', 'is', null).order('position').limit(1).maybeSingle(),
  ])
  const shareId = crypto.randomUUID()
  let photoPath: string | null = null
  if (media?.display_path) {
    // A versão de visualização foi reencodada no dispositivo (canvas): não tem EXIF nem GPS.
    const { data: blob, error } = await admin.storage.from('ping-media').download(media.display_path)
    if (error || !blob) return json(req, { error: 'Não foi possível preparar a fotografia partilhada.' }, 500)
    const ext = media.display_path.endsWith('.webp') ? 'webp' : media.display_path.endsWith('.png') ? 'png' : 'jpg'
    photoPath = `${shareId}.${ext}`
    // Sem cache na CDN: ao revogar, a imagem deixa de ser servida de imediato.
    const up = await admin.storage.from('community-media').upload(photoPath, blob, { contentType: blob.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`, cacheControl: '0' })
    if (up.error) return json(req, { error: `Falha ao publicar a fotografia (${up.error.message}).` }, 500)
  }
  const { date, hour } = localDateHour(ping.occurred_at, ping.occurred_tz || 'Europe/Lisbon')
  const { error } = await admin.from('shared_reports').insert({
    id: shareId, ping_id: pingId, owner_id: user.id, kind: ping.kind, species: catchRow?.species ?? null, technique: ping.technique,
    water_body_name: ping.water_body_name, approx_lat: ap.lat, approx_lng: ap.lng, approx_label: ap.label, precision_km: ap.precisionKm,
    occurred_on: date, day_period: dayPeriod(hour), photo_path: photoPath,
    share_mode: mode, ...exact, zone_id: zoneId, water_body_ref: ping.water_body_ref, weight_g: catchRow?.weight_g ?? null,
    occurred_at: ping.occurred_at, occurred_tz: ping.occurred_tz,
  })
  if (error) {
    if (photoPath) await admin.storage.from('community-media').remove([photoPath])
    return json(req, { error: error.code === '23505' ? 'Já está partilhado.' : error.message }, error.code === '23505' ? 409 : 500)
  }
  await admin.from('audit_log').insert({ owner_id: user.id, action: 'share', entity: 'shared_reports', entity_id: shareId })
  return json(req, { ok: true, shareId, mode })
})
