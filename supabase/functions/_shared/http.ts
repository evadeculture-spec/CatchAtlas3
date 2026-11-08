// Utilitários HTTP das Edge Functions do Lança Lance (CORS restrito e respostas JSON).
const DEFAULT_ORIGINS = ['https://atlascatch.netlify.app', 'http://localhost:5173', 'http://localhost:4173']

export function corsHeaders(req: Request, allowed: string[] = DEFAULT_ORIGINS): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const ok = allowed.includes(origin) || /^https:\/\/[a-z0-9-]+--atlascatch\.netlify\.app$/.test(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export const json = (req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } })
