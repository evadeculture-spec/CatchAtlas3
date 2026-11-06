import { Anchor, Backpack, Fish, Gauge, Package, Wrench } from 'lucide-react'
import type { Listing, ListingCategory } from '../data/types'
import { usePhotoUrl } from '../lib/usePhotoUrl'
import { cx } from './ui'

const ICONS: Record<ListingCategory, typeof Fish> = {
  canas: Wrench,
  carretos: Gauge,
  amostras: Fish,
  embarcacoes: Anchor,
  eletronica: Package,
  acessorios: Backpack,
}

/** Fotografia do anúncio ou cartão gráfico neutro com o ícone da categoria. */
export function ListingVisual({ l, className, iconSize = 30 }: { l: Listing; className?: string; iconSize?: number }) {
  const { url, loading } = usePhotoUrl(`mk-${l.id}`, l.hasPhoto)
  if (l.hasPhoto && url) return <img src={url} alt={`Fotografia: ${l.title}`} className={cx('h-full w-full object-cover', className)} />
  if (l.hasPhoto && loading) return <div className={cx('skeleton h-full w-full', className)} />
  const I = ICONS[l.category]
  return (
    <div className={cx('grid h-full w-full place-items-center bg-[#E3ECEE]', className)} aria-hidden>
      <I style={{ width: iconSize, height: iconSize }} className="text-ink/45" strokeWidth={1.6} />
    </div>
  )
}
