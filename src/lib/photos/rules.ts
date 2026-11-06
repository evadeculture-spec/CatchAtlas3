import type { DamPhotoLink, PhotoAsset, PhotoCatalog, PhotoObservation, PhotoRole } from '../../data/photos/types'

/** Fotografia de banco de imagens (Unsplash): publicada com etiqueta, nunca dada como verificada. */
export const isStock = (a: PhotoAsset) => a.provider === 'unsplash'

/**
 * Publicável com direitos aprovados e estado publicado, e ainda: identidade confirmada,
 * ou fotografia do Unsplash marcada como ilustrativa (mostrada sempre com essa indicação).
 */
export const isPublishable = (a: PhotoAsset) =>
  (a.identity === 'confirmado' || (isStock(a) && a.identity === 'ilustrativa')) &&
  a.rights === 'aprovado' &&
  a.publication === 'publicado' &&
  a.variants.length > 0

/** Variantes servidas a partir do próprio projeto ou, no caso do Unsplash, do seu CDN de imagens (como exigem as regras da API). */
export const isSafeVariantSrc = (src: string) =>
  /^\/photos\/[a-z0-9-]+\/[a-z0-9._-]+\.(webp|jpe?g)$/i.test(src) || /^https:\/\/images\.unsplash\.com\/photo-[0-9a-f-]+\?[a-z0-9=&._-]+$/i.test(src)

export interface DamPhoto {
  asset: PhotoAsset
  link: DamPhotoLink
}

export function photosForDam(catalog: PhotoCatalog, damId: string): DamPhoto[] {
  const byId = new Map(catalog.assets.map((a) => [a.id, a]))
  const all = catalog.links
    .filter((l) => l.damId === damId)
    .map((l) => ({ link: l, asset: byId.get(l.assetId) }))
    .filter((p): p is DamPhoto => !!p.asset && isPublishable(p.asset) && p.asset.variants.every((v) => isSafeVariantSrc(v.src)))
  // Havendo fotografias verificadas desta albufeira, as do Unsplash deixam de aparecer.
  const verified = all.filter((p) => !isStock(p.asset))
  return (verified.length > 0 ? verified : all)
    .sort((a, b) => Number(b.link.role === 'capa') - Number(a.link.role === 'capa') || a.link.order - b.link.order)
}

export const coverForDam = (catalog: PhotoCatalog, damId: string): DamPhoto | null =>
  photosForDam(catalog, damId).find((p) => p.link.role === 'capa') ?? null

/** Observações aprovadas e ligadas à fotografia exata (mesmo id e mesmo checksum). */
export function observationsFor(catalog: PhotoCatalog, asset: PhotoAsset, layer?: PhotoObservation['layer']): PhotoObservation[] {
  return catalog.observations.filter(
    (o) => o.assetId === asset.id && o.assetChecksum === asset.checksumSha1 && o.review === 'aprovada' && (!layer || o.layer === layer),
  )
}

export interface DuplicateConflict {
  checksum: string
  assetIds: string[]
  damIds: string[]
}

/** Assinala a mesma imagem (checksum) ligada a albufeiras não declaradas como adjacentes. */
export function findDuplicateConflicts(catalog: PhotoCatalog): DuplicateConflict[] {
  const adj = new Set(catalog.adjacentPairs.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]))
  const byChecksum = new Map<string, PhotoAsset[]>()
  for (const a of catalog.assets) byChecksum.set(a.checksumSha1, [...(byChecksum.get(a.checksumSha1) ?? []), a])
  const out: DuplicateConflict[] = []
  for (const [checksum, assets] of byChecksum) {
    const ids = new Set(assets.map((a) => a.id))
    const dams = [...new Set(catalog.links.filter((l) => ids.has(l.assetId)).map((l) => l.damId))]
    const incompatible = dams.some((a, i) => dams.slice(i + 1).some((b) => !adj.has(`${a}|${b}`)))
    if (dams.length > 1 && incompatible) out.push({ checksum, assetIds: [...ids], damIds: dams })
  }
  return out
}

export const ROLE_LABEL: Record<PhotoRole, string> = {
  capa: 'Capa',
  margens: 'Margens',
  estruturas: 'Estruturas',
  aerea: 'Vista aérea',
  complementar: 'Complementar',
}

export const shortCredit = (a: PhotoAsset) => (isStock(a) ? `${a.author} · Unsplash` : `${a.author} · ${a.license.name}`)

/** Etiqueta curta para fotografias do Unsplash; null nas verificadas. */
export function stockLabel(a: PhotoAsset): string | null {
  if (!isStock(a)) return null
  if (a.depicts === 'esta-albufeira') return 'Segundo o autor'
  if (a.depicts === 'mesma-zona') return 'Mesma zona'
  return 'Imagem ilustrativa'
}

export const capturedLabel = (a: PhotoAsset) =>
  a.capturedAt ? `Captada em ${a.capturedAt}` : 'Data de captação não documentada na fonte'

/** O que nunca se deduz de uma fotografia isolada (mostrado como limite explícito). */
export const NOT_INFERABLE = [
  'Profundidade e batimetria',
  'Temperatura e oxigénio da água',
  'Espécies presentes e atividade do peixe',
  'Qualidade da água e turbidez medida',
  'Acesso autorizado, navegação ou segurança',
  'Nível atual da albufeira',
]
