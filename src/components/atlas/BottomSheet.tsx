import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { cx } from '../ui'

export type SheetSnap = 'peek' | 'half' | 'full'
const ORDER: SheetSnap[] = ['peek', 'half', 'full']

export function useMediaQuery(q: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(q).matches,
    () => false,
  )
}

/** Altura visível de cada estado (px), para o mapa enquadrar a seleção acima do painel. */
export function sheetHeight(snap: SheetSnap, vh: number, peek: number) {
  return snap === 'peek' ? peek : snap === 'half' ? Math.round(vh * 0.5) : Math.round(vh - 132)
}

/**
 * Painel inferior (telemóvel e tablet em retrato) com três estados: recolhido, intermédio e expandido.
 * Arrastar a pega muda de estado; tocar na pega alterna. O conteúdo tem scroll próprio
 * (overscroll-contain): rolar o painel nunca move o mapa por baixo.
 */
export function BottomSheet({ snap, onSnap, peek, label, header, children }: { snap: SheetSnap; onSnap: (s: SheetSnap) => void; peek: number; label: string; header: ReactNode; children: ReactNode }) {
  const [vh, setVh] = useState(() => window.innerHeight)
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ y: number; h: number; t: number } | null>(null)
  const dragged = useRef(false)
  useEffect(() => {
    const on = () => setVh(window.visualViewport?.height ?? window.innerHeight)
    on()
    window.addEventListener('resize', on)
    window.visualViewport?.addEventListener('resize', on)
    return () => {
      window.removeEventListener('resize', on)
      window.visualViewport?.removeEventListener('resize', on)
    }
  }, [])
  const h = drag ?? sheetHeight(snap, vh, peek)
  const nearest = (px: number, velocity: number) => {
    const hs = ORDER.map((s) => sheetHeight(s, vh, peek))
    if (Math.abs(velocity) > 0.6) {
      const i = ORDER.indexOf(snap)
      return ORDER[Math.max(0, Math.min(2, i + (velocity < 0 ? 1 : -1)))]
    }
    let best = 0
    hs.forEach((v, i) => {
      if (Math.abs(v - px) < Math.abs(hs[best] - px)) best = i
    })
    return ORDER[best]
  }
  return (
    <section
      className={cx('pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[22px] border-t border-white/10 bg-[#0a2230]/95 shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-xl', drag === null && 'transition-[height] duration-300 ease-out motion-reduce:transition-none')}
      style={{ height: h, maxHeight: 'calc(100dvh - 96px)' }}
      aria-label={label}
      data-sheet={snap}
      data-no-swipe
    >
      <div
        className="shrink-0 touch-none select-none"
        onPointerDown={(e) => {
          if ((e.target as Element).closest('button:not([data-sheet-handle]), a, input')) return
          start.current = { y: e.clientY, h, t: performance.now() }
          dragged.current = false
        }}
        onPointerMove={(e) => {
          if (!start.current) return
          const dy = e.clientY - start.current.y
          if (Math.abs(dy) < 4 && drag === null) return
          // Só captura o ponteiro quando o arrasto começa: um toque simples continua a ser um clique na pega.
          if (!dragged.current) {
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              // O ponteiro pode já ter terminado; o arrasto continua sem captura.
            }
          }
          dragged.current = true
          setDrag(Math.max(peek - 20, Math.min(vh - 110, start.current.h - dy)))
        }}
        onPointerUp={(e) => {
          const s = start.current
          start.current = null
          if (!s || drag === null) return
          const v = (e.clientY - s.y) / Math.max(1, performance.now() - s.t)
          onSnap(nearest(drag, v))
          setDrag(null)
        }}
        onPointerCancel={() => {
          start.current = null
          setDrag(null)
        }}
      >
        <button
          type="button"
          data-sheet-handle
          onClick={() => {
            // Depois de arrastar, o clique sintético não volta a mudar o estado.
            if (dragged.current) {
              dragged.current = false
              return
            }
            onSnap(ORDER[(ORDER.indexOf(snap) + 1) % 3])
          }}
          aria-label={snap === 'full' ? 'Recolher painel' : 'Expandir painel'}
          aria-expanded={snap !== 'peek'}
          className="mx-auto flex h-7 w-16 items-center justify-center"
        >
          <span className="h-1.5 w-10 rounded-full bg-white/30" aria-hidden />
        </button>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">{children}</div>
    </section>
  )
}
