import { useState, type CSSProperties } from 'react'
import type { Dam } from '../../data/types'
import type { DamPhoto } from '../../lib/photos/rules'
import { cx } from '../ui'
import { NoPhoto, type FallbackLayout } from './NoPhoto'

const pos = (p: { x: number; y: number }) => `${Math.round(p.x * 100)}% ${Math.round(p.y * 100)}%`

/**
 * Fotografia aprovada com variantes responsivas e ponto focal por formato.
 * Se o carregamento falhar, mostra o fallback uma única vez (sem ciclos de erro).
 */
export function PhotoImage({
  dam,
  photo,
  variant,
  sizes,
  priority,
  fit = 'cover',
  fallback,
}: {
  dam: Dam
  photo: DamPhoto | null
  variant: 'hero' | 'card' | 'thumb'
  sizes: string
  priority?: boolean
  fit?: 'cover' | 'contain'
  fallback?: FallbackLayout
}) {
  const [failedId, setFailedId] = useState<string | null>(null)
  if (!photo || failedId === photo.asset.id) return <NoPhoto dam={dam} variant={variant} failed={!!photo} layout={fallback} />
  const { asset, link } = photo
  const webp = asset.variants.filter((v) => v.format === 'webp')
  const jpeg = [...asset.variants.filter((v) => v.format === 'jpeg')].sort((a, b) => a.width - b.width)
  const defaultVariant = jpeg[Math.min(1, jpeg.length - 1)] ?? asset.variants[0]
  const style = { '--fm': pos(link.focal.mobile), '--fd': pos(link.focal.desktop) } as CSSProperties
  return (
    <picture className="absolute inset-0" data-photo-state="foto" data-asset-id={asset.id}>
      {webp.length > 0 && <source type="image/webp" srcSet={webp.map((v) => `${v.src} ${v.width}w`).join(', ')} sizes={sizes} />}
      <img
        src={defaultVariant.src}
        srcSet={jpeg.map((v) => `${v.src} ${v.width}w`).join(', ') || undefined}
        sizes={sizes}
        width={asset.width}
        height={asset.height}
        alt={asset.alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={() => setFailedId(asset.id)}
        style={fit === 'cover' ? style : undefined}
        className={cx('h-full w-full', fit === 'cover' ? 'object-cover object-[var(--fm)] lg:object-[var(--fd)]' : 'object-contain')}
      />
    </picture>
  )
}
