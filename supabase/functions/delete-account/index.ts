// Lança Lance — eliminação da conta (RGPD, direito ao apagamento). Apaga as fotografias privadas do
// utilizador e depois a conta; as tabelas apagam-se em cascata. Exige confirmação explícita.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
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
  if (body?.confirm !== 'ELIMINAR') return json(req, { error: 'Confirmação em falta' }, 400)

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
  let removed = 0
  // Versões partilhadas na comunidade: as fotografias derivadas têm o nome da partilha.
  const { data: shares } = await admin.from('shared_reports').select('photo_path').eq('owner_id', user.id)
  const sharedPhotos = (shares ?? []).map((s) => s.photo_path).filter((p): p is string => !!p)
  if (sharedPhotos.length) {
    const { error: shErr } = await admin.storage.from('community-media').remove(sharedPhotos)
    if (shErr) return json(req, { error: `Não foi possível retirar as fotografias partilhadas (${shErr.message}). Nada foi eliminado.` }, 500)
    removed += sharedPhotos.length
  }
  for (const bucket of ['ping-media', 'avatars']) {
    // Ficheiros guardados em <uid>/<ficheiro> (um nível): listagem paginada e remoção em lotes.
    for (;;) {
      const { data, error } = await admin.storage.from(bucket).list(user.id, { limit: 1000, offset: 0 })
      if (error) return json(req, { error: `Não foi possível apagar as fotografias (${error.message}). Nada foi eliminado.` }, 500)
      if (!data?.length) break
      const names = data.filter((o) => o.id).map((o) => `${user.id}/${o.name}`)
      if (!names.length) break
      const { error: rmErr } = await admin.storage.from(bucket).remove(names)
      if (rmErr) return json(req, { error: `Falha ao apagar fotografias (${rmErr.message}).` }, 500)
      removed += names.length
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return json(req, { error: `Fotografias apagadas, mas a conta não foi eliminada (${error.message}). Tente de novo.` }, 500)
  return json(req, { ok: true, removedFiles: removed })
})
