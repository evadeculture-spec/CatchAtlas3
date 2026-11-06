import { ArrowDownToLine, ArrowUpFromLine, Compass, Info, List, LocateFixed, Loader2, Minus, Plus, RotateCcw, RotateCw, SlidersHorizontal } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cx } from '../ui'

const btn =
  'press grid h-11 w-11 place-items-center text-[#f4f7f8] transition hover:bg-white/10 focus-visible:outline-[#83e5ef] disabled:opacity-40 disabled:hover:bg-transparent'

function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a2230]/88 shadow-[0_8px_24px_-10px_rgb(0_0_0/0.7)] backdrop-blur-md">
      {children}
    </div>
  )
}

/** Controlos visíveis do mapa (alternativas aos gestos de rotação e inclinação, para rato, teclado e toque). */
export function AtlasControls({
  mode,
  bearing,
  pitch,
  locating,
  compact,
  onZoom,
  onNorth,
  onRotate,
  onTilt,
  onMode,
  onPeninsula,
  onLocate,
  onList,
  onSources,
}: {
  mode: '2d' | '3d'
  bearing: number
  pitch: number
  locating: boolean
  compact: boolean
  onZoom: (d: number) => void
  onNorth: () => void
  onRotate: (deg: number) => void
  onTilt: (deg: number) => void
  onMode: (m: '2d' | '3d') => void
  onPeninsula: () => void
  onLocate: () => void
  onList?: () => void
  onSources: () => void
}) {
  const [more, setMore] = useState(false)
  const showView = !compact || more
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2" data-no-swipe>
      <div role="group" aria-label="Modo de visualização" className="flex rounded-full border border-white/10 bg-[#0a2230]/88 p-1 shadow-[0_8px_24px_-10px_rgb(0_0_0/0.7)] backdrop-blur-md">
        {(['2d', '3d'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            aria-pressed={mode === m}
            className={cx('press h-9 min-w-11 rounded-full px-3 text-[12.5px] font-extrabold tracking-wide', mode === m ? 'bg-[#f4f7f8] text-[#071923]' : 'text-[#b5c5cc] hover:bg-white/10')}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <Group label="Zoom">
        <button type="button" className={btn} onClick={() => onZoom(1)} aria-label="Aproximar" title="Aproximar">
          <Plus className="h-5 w-5" aria-hidden />
        </button>
        <span className="mx-2 h-px bg-white/10" aria-hidden />
        <button type="button" className={btn} onClick={() => onZoom(-1)} aria-label="Afastar" title="Afastar">
          <Minus className="h-5 w-5" aria-hidden />
        </button>
      </Group>
      <Group label="Orientação">
        <button type="button" className={btn} onClick={onNorth} aria-label={`Norte para cima (rotação atual ${Math.round(bearing)}°)`} title="Norte">
          <Compass className="h-5 w-5 transition-transform" style={{ transform: `rotate(${-bearing - 45}deg)` }} aria-hidden />
        </button>
        {compact && (
          <button type="button" className={btn} onClick={() => setMore((v) => !v)} aria-expanded={more} aria-label="Mais controlos de vista (rodar e inclinar)" title="Rodar e inclinar">
            <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
        {showView && (
          <>
            <span className="mx-2 h-px bg-white/10" aria-hidden />
            <button type="button" className={btn} onClick={() => onRotate(-20)} aria-label="Rodar para a esquerda" title="Rodar para a esquerda">
              <RotateCcw className="h-[18px] w-[18px]" aria-hidden />
            </button>
            <button type="button" className={btn} onClick={() => onRotate(20)} aria-label="Rodar para a direita" title="Rodar para a direita">
              <RotateCw className="h-[18px] w-[18px]" aria-hidden />
            </button>
            {mode === '3d' && (
              <>
                <span className="mx-2 h-px bg-white/10" aria-hidden />
                <button type="button" className={btn} onClick={() => onTilt(10)} disabled={pitch >= 67} aria-label="Inclinar mais" title="Inclinar mais">
                  <ArrowUpFromLine className="h-[18px] w-[18px]" aria-hidden />
                </button>
                <button type="button" className={btn} onClick={() => onTilt(-10)} disabled={pitch <= 1} aria-label="Inclinar menos" title="Inclinar menos">
                  <ArrowDownToLine className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </>
            )}
          </>
        )}
      </Group>
      <Group label="Navegação">
        <button type="button" className={btn} onClick={onPeninsula} aria-label="Ver Península" title="Ver Península">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
            <path d="M5 8.5 7.5 5l5 .5 5-1 1.8 2.6-1.3 2.4 1.5 2.7-2.8 2.5-1.7 3.3-4 .9-3-1.4-2.3.8-.9-2.2.6-3.4L4 10.6Z" />
          </svg>
        </button>
        <button type="button" className={btn} onClick={onLocate} aria-label="A minha localização" title="A minha localização">
          {locating ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LocateFixed className="h-5 w-5" aria-hidden />}
        </button>
        {onList && (
          <button type="button" className={btn} onClick={onList} aria-label="Lista de águas nesta vista" title="Lista">
            <List className="h-5 w-5" aria-hidden />
          </button>
        )}
        <button type="button" className={btn} onClick={onSources} aria-label="Fontes, cobertura e atribuição" title="Fontes">
          <Info className="h-5 w-5" aria-hidden />
        </button>
      </Group>
    </div>
  )
}
