import { brand } from '../config/brand'
import { cx } from './ui'

/** Marca Lança Lance (logótipo tipográfico até existir o logótipo definitivo). `light` para fundos escuros. */
export function BrandLockup({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2', light ? 'text-white' : 'text-ink')} aria-label={brand.name} role="img">
      <svg viewBox="0 0 32 32" className={compact ? 'h-7 w-7' : 'h-9 w-9'} aria-hidden>
        <rect width="32" height="32" rx="9" fill="#20bfa9" />
        <path d="M8 23 L22 9" stroke="#102b3a" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M22 9 c2.6 2 2.8 6.2 0.4 9.4" fill="none" stroke="#102b3a" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="22.4" cy="20.2" r="2.3" fill="#f2b544" stroke="#102b3a" strokeWidth="1.4" />
      </svg>
      <span className={cx('font-display font-semibold leading-none tracking-tight', compact ? 'text-[19px]' : 'text-[24px]')}>
        Lança<span className="text-teal"> Lance</span>
      </span>
    </span>
  )
}
