/**
 * Controlos compactos dos mapas embebidos e de módulo (mesmo motor do Atlas): 2D/3D, aproximar, afastar e
 * norte. O Atlas (ecrã principal) usa o conjunto completo em AtlasControls; aqui fica o essencial, com alvos de
 * toque de 44 px e nomes acessíveis.
 */
import { Compass, Minus, Plus } from 'lucide-react'
import type { RefObject } from 'react'
import { cx } from '../ui'
import type { AtlasMapHandle } from './AtlasMap'

export function MapQuickControls({ handle, mode, onMode, dem, className }: { handle: RefObject<AtlasMapHandle | null>; mode: '2d' | '3d'; onMode: (m: '2d' | '3d') => void; dem: 'off' | 'loading' | 'ok' | 'failed'; className?: string }) {
  const btn = 'press grid h-11 w-11 place-items-center text-[#f4f7f8] hover:bg-white/10 disabled:opacity-40'
  return (
    <div className={cx('pointer-events-auto flex flex-col items-end gap-2', className)} data-map-controls>
      <div className="flex overflow-hidden rounded-full border border-white/12 bg-[#0a2230]/92 shadow-lg backdrop-blur" role="group" aria-label="Modo do mapa">
        {(['2d', '3d'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            disabled={m === '3d' && dem === 'failed'}
            title={m === '3d' && dem === 'failed' ? 'Relevo indisponível de momento' : undefined}
            onClick={() => onMode(m)}
            className={cx('min-h-11 px-3.5 text-[13px] font-extrabold', mode === m ? 'bg-white text-[#071923]' : 'text-[#f4f7f8]')}
            data-mode={m}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a2230]/92 shadow-lg backdrop-blur">
        <button type="button" className={btn} onClick={() => handle.current?.zoomBy(1)} aria-label="Aproximar">
          <Plus className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" className={btn} onClick={() => handle.current?.zoomBy(-1)} aria-label="Afastar">
          <Minus className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" className={btn} onClick={() => handle.current?.north()} aria-label="Orientar a norte">
          <Compass className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  )
}
