import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase do Lança Lance.
 *
 * VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são PÚBLICAS (vão no JavaScript entregue ao
 * browser). A chave publicável só dá acesso ao que as políticas RLS permitem ao utilizador com sessão
 * iniciada; a chave de serviço NUNCA pode estar no frontend (só nas Edge Functions).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const backendConfigured = !!(url && key)

let client: SupabaseClient | null = null
export function sb(): SupabaseClient {
  if (!backendConfigured) throw new Error('Backend não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).')
  if (!client)
    client = createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'lancalance-auth' },
    })
  return client
}

export const PING_BUCKET = 'ping-media'
export const AVATAR_BUCKET = 'avatars'
/** Validade dos URLs assinados das fotografias (as fotografias nunca têm URL público permanente). */
export const SIGNED_URL_TTL_S = 60 * 30
