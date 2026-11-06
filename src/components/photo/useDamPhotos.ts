import { useMemo } from 'react'
import { PHOTO_CATALOG } from '../../lib/photos/catalog'
import { coverForDam, photosForDam } from '../../lib/photos/rules'

/** Fotografias publicadas (identidade + direitos + publicação aprovados) de uma albufeira. */
export function useDamPhotos(damId: string) {
  return useMemo(() => ({ cover: coverForDam(PHOTO_CATALOG, damId), all: photosForDam(PHOTO_CATALOG, damId) }), [damId])
}
