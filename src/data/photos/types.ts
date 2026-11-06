// Modelo de fotografias reais das albufeiras: proveniência, direitos e estados separados.
// Identidade, direitos e publicação são estados independentes; só se publica com os três aprovados.

export type IdentityStatus = 'candidato' | 'confirmado' | 'rejeitado' | 'revisao' | 'ilustrativa'
/** Para fotografias de banco de imagens: o que a imagem representa em relação à albufeira. */
export type PhotoDepicts = 'esta-albufeira' | 'mesma-zona' | 'ilustrativa'
export type RightsStatus = 'por-verificar' | 'aprovado' | 'rejeitado'
export type PublicationStatus = 'rascunho' | 'publicado' | 'retirado'
export type PhotoRole = 'capa' | 'margens' | 'estruturas' | 'aerea' | 'complementar'

export interface PhotoLicense {
  /** Ex.: "CC BY-SA 4.0", "CC0", "Domínio público". */
  name: string
  url: string | null
  requiresAttribution: boolean
  shareAlike: boolean
  commercialUse: boolean
  derivatives: boolean
}

export interface PhotoVariant {
  width: number
  height: number
  format: 'webp' | 'jpeg'
  /** Caminho servido pelo próprio projeto (derivado otimizado, sem EXIF/GPS). */
  src: string
}

export interface PhotoAsset {
  id: string
  provider: 'wikimedia-commons' | 'cedida' | 'unsplash'
  externalId: string | null
  title: string
  sourcePageUrl: string
  originalFileUrl: string | null
  author: string
  authorUrl: string | null
  license: PhotoLicense
  /** Texto de atribuição a mostrar junto da fotografia e em exportações. */
  attribution: string
  /** Alterações feitas ao original (ex.: "Redimensionada e recortada; metadados removidos"). */
  changes: string
  width: number
  height: number
  /** Data de captação documentada na fonte; null quando desconhecida (nunca a data de upload). */
  capturedAt: string | null
  collectedAt: string
  /** SHA-1 do ficheiro original, para detetar duplicados entre locais. */
  checksumSha1: string
  /** Coordenadas documentadas na fonte; null quando inexistentes. */
  location: { lat: number; lon: number } | null
  locationEvidence: string[]
  identity: IdentityStatus
  identityBasis: string
  identityMethod: 'automatica' | 'humana' | null
  identityReviewer: string | null
  rights: RightsStatus
  rightsBasis: string
  publication: PublicationStatus
  /** Se os créditos/condições podem acompanhar exportações (ex.: histórias). */
  exportAllowed: boolean
  variants: PhotoVariant[]
  alt: string
  /** Só em fotografias do Unsplash (nunca verificadas no local). */
  depicts?: PhotoDepicts
}

export interface FocalPoint {
  /** 0–1, relativo à imagem original. */
  x: number
  y: number
}

export interface DamPhotoLink {
  assetId: string
  damId: string
  role: PhotoRole
  order: number
  basis: string
  focal: { mobile: FocalPoint; desktop: FocalPoint }
}

export interface PhotoObservation {
  id: string
  assetId: string
  /** Checksum do asset analisado: a observação só vale para essa fotografia exata. */
  assetChecksum: string
  layer: 'observado' | 'hipotese'
  category: 'margem' | 'vegetacao' | 'rocha' | 'estrutura' | 'superficie' | 'construcao' | 'outro'
  text: string
  /** Região normalizada (0–1) no original, quando aplicável. */
  region: { x: number; y: number; w: number; h: number } | null
  origin: 'manual' | 'ia'
  confidence: 'baixa' | 'media' | 'alta'
  limitations: string
  review: 'pendente' | 'aprovada' | 'rejeitada'
  analysisVersion: string
  model: string | null
  analyzedAt: string
}

export interface PhotoCatalog {
  generatedAt: string | null
  assets: PhotoAsset[]
  links: DamPhotoLink[]
  observations: PhotoObservation[]
  /** Pares de barragens adjacentes/transfronteiriças que podem partilhar uma fotografia. */
  adjacentPairs: [string, string][]
}
