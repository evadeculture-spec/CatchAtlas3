import { Compass, Info, Layers, List, LocateFixed, Loader2, Map as MapIcon, Maximize2, Menu, MoreHorizontal, Plus, Search, SlidersHorizontal, Waves } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cx } from '../ui'

/**
 * Barras flutuantes do modo imersivo do Atlas: uma superior (menu, pesquisa, filtros, mais) e uma inferior
 * (explorar águas, pins, marcar pin). São só apresentação: o estado (filtros, país, favoritos, modo 2D/3D,
 * camadas) continua no ecrã do Atlas e no URL, por isso nada se perde ao recolher ou expandir.
 */

/** Vidro: transparência só no fundo; texto e ícones opacos. */
export const glass =
  'border border-white/15 bg-[#0a2230]/60 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-[#0a2230]/92'
/** Entrada e saída das camadas de interface (rápida, sem animar durante o movimento da câmara). */
export const fade = 'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none'
const icon = 'press grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#f4f7f8] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#83e5ef] aria-expanded:bg-white/15'

export type TopPopover = 'filters' | 'more' | 'layers' | null

/** Fecha o popover com Escape ou com um toque fora (sem camada por cima do mapa: os gestos passam sempre). */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close.current()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('keydown', key)
    }
  }, [open, ref])
}

export function FloatingTopBar({
  visible,
  popover,
  onPopover,
  activeFilters,
  onMenu,
  onSearch,
  filters,
  layers,
  more,
}: {
  visible: boolean
  popover: TopPopover
  onPopover: (p: TopPopover) => void
  activeFilters: number
  onMenu: () => void
  onSearch: () => void
  filters: ReactNode
  layers: ReactNode
  more: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(visible && popover !== null, ref, () => onPopover(null))
  const toggle = (p: TopPopover) => onPopover(popover === p ? null : p)
  return (
    <div
      ref={ref}
      className={cx('pointer-events-none absolute left-3 top-[calc(env(safe-area-inset-top)+10px)] z-40 max-w-[calc(100vw-24px)] sm:left-4', fade, visible ? 'animate-[float-in-top_200ms_ease-out] opacity-100 motion-reduce:animate-none' : '-translate-y-2 opacity-0')}
      inert={!visible}
      data-floating-top
      data-no-swipe
    >
      <nav aria-label="Controlos do mapa" className={cx('pointer-events-auto inline-flex h-[52px] items-center gap-0.5 rounded-full px-1', glass)}>
        <button type="button" className={icon} onClick={onMenu} aria-label="Menu" title="Menu">
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" className={icon} onClick={onSearch} aria-label="Pesquisar barragem, lagoa ou rio" title="Pesquisar">
          <Search className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          className={cx(icon.replace('grid ', 'flex '), 'relative w-auto min-w-11 items-center justify-center gap-1.5 px-3 text-[13.5px] font-bold')}
          onClick={() => toggle('filters')}
          aria-expanded={popover === 'filters'}
          aria-label={activeFilters ? `Filtros (${activeFilters} ativos)` : 'Filtros'}
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />
          <span className="hidden min-[360px]:inline">Filtros</span>
          {activeFilters > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#38c9d5] px-1 text-[11px] font-extrabold text-[#071923]" aria-hidden>{activeFilters}</span>}
        </button>
        <button type="button" className={icon} onClick={() => toggle('more')} aria-expanded={popover === 'more'} aria-label="Mais: percursos, 2D/3D, camadas, posição e fontes" title="Mais">
          <MoreHorizontal className="h-5 w-5" aria-hidden />
        </button>
      </nav>
      {popover && (
        <div className="pointer-events-auto mt-2 origin-top-left animate-[pop_160ms_ease-out] motion-reduce:animate-none" data-floating-popover={popover}>
          {popover === 'filters' ? (
            <div className={cx('w-[min(360px,calc(100vw-24px))] rounded-3xl p-3', glass)} role="dialog" aria-label="Filtros">
              {filters}
            </div>
          ) : popover === 'layers' ? (
            layers
          ) : (
            more
          )}
        </div>
      )}
    </div>
  )
}

/** Conteúdo do menu «Mais» da barra superior: tudo o que estava no cabeçalho e na coluna da direita. */
export function MoreMenu({
  mode,
  locating,
  bearing,
  onMode,
  onLayers,
  onLocate,
  onNorth,
  onPeninsula,
  onList,
  onSources,
  onExpand,
}: {
  mode: '2d' | '3d'
  locating: boolean
  bearing: number
  onMode: (m: '2d' | '3d') => void
  onLayers: () => void
  onLocate: () => void
  onNorth: () => void
  onPeninsula: () => void
  onList: () => void
  onSources: () => void
  onExpand: () => void
}) {
  const row = 'press flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-[14px] font-bold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#83e5ef]'
  return (
    <div className={cx('w-[min(300px,calc(100vw-24px))] rounded-3xl p-2', glass)} role="dialog" aria-label="Mais controlos">
      <nav aria-label="Percursos" className="mb-2 flex rounded-full bg-black/20 p-1">
        <span aria-current="page" className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-[#f4f7f8] text-[13px] font-extrabold text-[#071923]">Jornada</span>
        <Link to="/conta/historico" className="press inline-flex h-10 flex-1 items-center justify-center rounded-full text-[13px] font-bold text-[#d7e2e6] hover:bg-white/10" aria-label="Gera a tua história: abrir o diário privado">
          História
        </Link>
      </nav>
      <div role="group" aria-label="Modo de visualização" className="mb-1 flex rounded-full bg-black/20 p-1">
        {(['2d', '3d'] as const).map((m) => (
          <button key={m} type="button" onClick={() => onMode(m)} aria-pressed={mode === m} className={cx('press h-10 flex-1 rounded-full text-[13px] font-extrabold', mode === m ? 'bg-[#f4f7f8] text-[#071923]' : 'text-[#d7e2e6] hover:bg-white/10')}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <button type="button" className={row} onClick={onLayers}>
        <Layers className="h-5 w-5 text-[#83e5ef]" aria-hidden /> Camadas
      </button>
      <button type="button" className={row} onClick={onLocate}>
        {locating ? <Loader2 className="h-5 w-5 animate-spin text-[#83e5ef]" aria-hidden /> : <LocateFixed className="h-5 w-5 text-[#83e5ef]" aria-hidden />} A minha posição
      </button>
      {Math.abs(bearing) > 0.5 && (
        <button type="button" className={row} onClick={onNorth}>
          <Compass className="h-5 w-5 text-[#83e5ef]" style={{ transform: `rotate(${-bearing - 45}deg)` }} aria-hidden /> Norte para cima
        </button>
      )}
      <button type="button" className={row} onClick={onPeninsula}>
        <MapIcon className="h-5 w-5 text-[#83e5ef]" aria-hidden /> Ver Península
      </button>
      <button type="button" className={row} onClick={onList}>
        <List className="h-5 w-5 text-[#83e5ef]" aria-hidden /> Lista de águas nesta vista
      </button>
      <button type="button" className={row} onClick={onSources}>
        <Info className="h-5 w-5 text-[#83e5ef]" aria-hidden /> Fontes e cobertura
      </button>
      <button type="button" className={cx(row, 'border-t border-white/10')} onClick={onExpand} data-action="expandir-interface">
        <Maximize2 className="h-5 w-5 text-[#83e5ef]" aria-hidden /> Mostrar todos os controlos
      </button>
    </div>
  )
}

export function FloatingBottomBar({ visible, title, pinsOn, onExplore, onPins, onMark }: { visible: boolean; title: string; pinsOn: boolean; onExplore: () => void; onPins: () => void; onMark: () => void }) {
  return (
    <div
      className={cx('pointer-events-none absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 flex justify-center sm:inset-x-4', fade, visible ? 'animate-[float-in-bottom_200ms_ease-out] opacity-100 motion-reduce:animate-none' : 'translate-y-3 opacity-0')}
      inert={!visible}
      data-floating-bottom
      data-no-swipe
    >
      <div className={cx('pointer-events-auto flex h-[56px] max-w-full items-center gap-1 rounded-full p-1.5', glass)}>
        <button type="button" onClick={onExplore} className="press flex h-11 min-w-11 shrink items-center justify-center gap-2 rounded-full px-3 text-[14px] font-bold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#83e5ef]" data-action="explorar-aguas" aria-label={`${title}: abrir painel`}>
          <Waves className="h-[18px] w-[18px] shrink-0 text-[#83e5ef]" aria-hidden />
          <span className="hidden max-w-[34vw] truncate min-[360px]:inline sm:max-w-[220px]">{title}</span>
        </button>
        <button
          type="button"
          onClick={onPins}
          aria-pressed={pinsOn}
          aria-label={pinsOn ? 'Os meus pins visíveis no mapa (tocar para esconder)' : 'Os meus pins escondidos (tocar para mostrar)'}
          className={cx('press flex h-11 shrink-0 items-center rounded-full px-3 text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-[#83e5ef]', pinsOn ? 'bg-white/15 text-[#f4f7f8]' : 'text-[#b5c5cc] hover:bg-white/10')}
        >
          Pins
        </button>
        <button type="button" onClick={onMark} className="press flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#38c9d5] pl-3 pr-4 text-[14px] font-extrabold text-[#071923] hover:bg-[#5fd6e0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f7f8]" data-action="marcar-pin">
          <Plus className="h-5 w-5" strokeWidth={2.6} aria-hidden /> <span>Marcar pin</span>
        </button>
      </div>
    </div>
  )
}
