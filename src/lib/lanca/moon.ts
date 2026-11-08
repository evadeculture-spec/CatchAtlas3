/** Nome da fase lunar (0 = nova, 0,5 = cheia) — igual ao do servidor (supabase/functions/_shared). */
export function moonPhaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1
  if (p < 0.03 || p > 0.97) return 'Lua nova'
  if (p < 0.22) return 'Crescente'
  if (p < 0.28) return 'Quarto crescente'
  if (p < 0.47) return 'Crescente gibosa'
  if (p < 0.53) return 'Lua cheia'
  if (p < 0.72) return 'Minguante gibosa'
  if (p < 0.78) return 'Quarto minguante'
  return 'Minguante'
}
