import { brand } from '../config/brand'

/** Logótipo CatchAtlas (peixe, coração-marcador e nome). `light` para fundos escuros. */
export function BrandLockup({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <img
      src={light ? brand.logo.srcLight : brand.logo.src}
      width={brand.logo.width}
      height={brand.logo.height}
      alt={brand.name}
      decoding="async"
      className={compact ? 'h-7 w-auto' : 'h-10 w-auto'}
    />
  )
}
