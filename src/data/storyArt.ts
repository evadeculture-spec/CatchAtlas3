import { PHOTO_CATALOG } from '../lib/photos/catalog'

/** Imagem de fundo de cada universo da página inicial (Unsplash, servida pelo CDN, com crédito). */
export interface StoryArt {
  srcSet: string
  src: string
  alt: string
  author: string
  authorUrl: string
  pageUrl: string
  /** Posição do recorte (object-position). */
  position: string
  /** Cor de fundo enquanto a imagem carrega (ou se falhar). */
  fallback: string
}

const UTM = 'utm_source=atlascatch&utm_medium=referral'

function fromCatalog(assetId: string, alt: string, position: string, fallback: string): StoryArt | null {
  const a = PHOTO_CATALOG.assets.find((x) => x.id === assetId)
  if (!a || !a.variants.length) return null
  const sorted = [...a.variants].sort((x, y) => x.width - y.width)
  return {
    srcSet: sorted.map((v) => `${v.src} ${v.width}w`).join(', '),
    src: sorted[Math.min(1, sorted.length - 1)].src,
    alt,
    author: a.author,
    authorUrl: a.authorUrl ?? a.sourcePageUrl,
    pageUrl: a.sourcePageUrl,
    position,
    fallback,
  }
}

const NIGHT_BASE = 'https://images.unsplash.com/photo-1785295091227-42bf1a64fb4a?ixlib=rb-4.1.0&auto=format&fit=max&q=75'

/** Dia: Embalse de El Atazar (a descrição do autor identifica o local). */
export const DAY_ART: StoryArt = fromCatalog(
  'unsplash-PvtTuKDbmfQ',
  'Embalse de El Atazar ao fim do dia, com montanhas e água calma',
  '50% 55%',
  'linear-gradient(180deg,#2c5a6e 0%,#1d4152 55%,#102b3a 100%)',
) ?? {
  srcSet: '',
  src: '',
  alt: '',
  author: '',
  authorUrl: '',
  pageUrl: '',
  position: '50% 50%',
  fallback: 'linear-gradient(180deg,#2c5a6e 0%,#1d4152 55%,#102b3a 100%)',
}

/** Noite: lago com a lua refletida (Donna Elliot, Unsplash). Imagem ilustrativa, não é uma barragem. */
export const NIGHT_ART: StoryArt = {
  srcSet: [640, 1080, 1600, 2400].map((w) => `${NIGHT_BASE}&w=${w} ${w}w`).join(', '),
  src: `${NIGHT_BASE}&w=1080`,
  alt: 'Lua cheia a iluminar um lago escuro entre montanhas',
  author: 'Donna Elliot',
  authorUrl: `https://unsplash.com/@peakdancer?${UTM}`,
  pageUrl: `https://unsplash.com/photos/RVZ2b22sObQ?${UTM}`,
  position: '50% 40%',
  fallback: 'radial-gradient(ellipse 60% 40% at 50% 28%,#1f3550 0%,transparent 70%),linear-gradient(180deg,#0b1626 0%,#0a1a2a 60%,#07121c 100%)',
}
