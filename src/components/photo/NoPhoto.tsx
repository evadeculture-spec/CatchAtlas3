import { ImageOff } from 'lucide-react'
import type { Dam } from '../../data/types'
import { cx } from '../ui'
import { LocatorMap } from './LocatorMap'

/**
 * Fallback honesto quando não há fotografia aprovada (ou o carregamento falhou):
 * superfície neutra com localização aproximada. Nunca mostra outra barragem.
 */
export interface FallbackLayout {
  labelClass?: string
  locatorClass?: string
}

export function NoPhoto({ dam, variant, failed, layout }: { dam: Dam; variant: 'hero' | 'card' | 'thumb'; failed?: boolean; layout?: FallbackLayout }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#163444]" data-photo-state={failed ? 'erro' : 'sem-foto'}>
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{ backgroundImage: 'radial-gradient(rgb(143 217 205 / 0.35) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
        aria-hidden
      />
      {variant !== 'thumb' && (
        <LocatorMap dam={dam} className={cx('absolute', layout?.locatorClass ?? (variant === 'hero' ? 'right-[6%] top-[18%] w-[min(52%,360px)] opacity-90' : 'right-2 top-12 w-[52%] opacity-80'))} />
      )}
      {variant === 'thumb' ? (
        <ImageOff className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-white/40" aria-hidden />
      ) : (
        <span
          className={cx(
            'absolute inline-flex items-center gap-1.5 rounded-full bg-black/30 font-bold text-white/90 backdrop-blur',
            layout?.labelClass ?? (variant === 'hero' ? 'left-4 top-[4.5rem] px-3 py-1.5 text-[12px] lg:left-8 lg:top-20' : 'left-2.5 top-2.5 px-2 py-1 text-[10.5px]'),
          )}
        >
          <ImageOff className="h-3.5 w-3.5" aria-hidden />
          {failed ? 'Fotografia indisponível de momento' : 'Fotografia ainda não disponível'}
        </span>
      )}
    </div>
  )
}
