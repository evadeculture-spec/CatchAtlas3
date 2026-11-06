import type { Dam } from '../../data/types'
import type { FallbackLayout } from './NoPhoto'
import { PhotoImage } from './PhotoImage'
import { useDamPhotos } from './useDamPhotos'

/** Capa da albufeira (fotografia aprovada ou fallback honesto), para cartões e listas. */
export function DamCover({ dam, variant, sizes, priority, fallback }: { dam: Dam; variant: 'hero' | 'card' | 'thumb'; sizes: string; priority?: boolean; fallback?: FallbackLayout }) {
  const { cover } = useDamPhotos(dam.id)
  return <PhotoImage dam={dam} photo={cover} variant={variant} sizes={sizes} priority={priority} fallback={fallback} />
}
