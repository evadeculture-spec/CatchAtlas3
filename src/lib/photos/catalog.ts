import raw from '../../data/photos/catalog.json'
import unsplash from '../../data/photos/unsplash.json'
import type { PhotoCatalog } from '../../data/photos/types'

const verified = raw as unknown as PhotoCatalog
const stock = unsplash as unknown as PhotoCatalog

/**
 * Catálogo gerado pelo pipeline (scripts/photos) + capas do Unsplash (src/data/photos/unsplash.json).
 * As do Unsplash ficam num ficheiro à parte para o `publish` do pipeline não as apagar;
 * uma fotografia verificada substitui sempre a do Unsplash (ver rules.ts).
 */
export const PHOTO_CATALOG: PhotoCatalog = {
  ...verified,
  assets: [...verified.assets, ...stock.assets],
  links: [...verified.links, ...stock.links],
}
