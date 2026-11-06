import { ChevronLeft, ChevronRight, Info, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Dam } from '../../data/types'
import { ROLE_LABEL, shortCredit, stockLabel, type DamPhoto } from '../../lib/photos/rules'
import { cx } from '../ui'
import { PhotoCredits } from './PhotoCredits'

/**
 * Galeria em ecrã inteiro, sem gradiente, para inspecionar a fotografia.
 * Teclado: setas mudam de foto, Esc fecha, + / − fazem zoom.
 */
export function PhotoGallery({ dam, photos, start = 0, onClose }: { dam: Dam; photos: DamPhoto[]; start?: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const [zoom, setZoom] = useState(false)
  const [credits, setCredits] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const p = photos[i]

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (credits) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') { setI((x) => Math.min(photos.length - 1, x + 1)); setZoom(false) }
      if (e.key === 'ArrowLeft') { setI((x) => Math.max(0, x - 1)); setZoom(false) }
      if (e.key === '+' || e.key === '=') setZoom(true)
      if (e.key === '-') setZoom(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [photos.length, onClose, credits])

  if (!p) return null
  const largest = [...p.asset.variants].sort((a, b) => b.width - a.width)[0]
  return createPortal(
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Fotografias de ${dam.name}`} className="fade-in fixed inset-0 z-[75] flex flex-col bg-[#0b1a22] text-white outline-none">
      <div className="pt-safe flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={onClose} className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar galeria">
          <X className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[14px] font-bold">
          {dam.name} · {ROLE_LABEL[p.link.role]} {photos.length > 1 && <span className="text-white/60">({i + 1}/{photos.length})</span>}
        </p>
        <button type="button" onClick={() => setZoom((z) => !z)} className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label={zoom ? 'Reduzir zoom' : 'Ampliar'} aria-pressed={zoom}>
          {zoom ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
        </button>
        <button type="button" onClick={() => setCredits(true)} className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Créditos e licença">
          <Info className="h-5 w-5" />
        </button>
      </div>
      <div className={cx('relative flex-1', zoom ? 'overflow-auto' : 'overflow-hidden')}>
        <img
          src={largest.src}
          alt={p.asset.alt}
          width={p.asset.width}
          height={p.asset.height}
          className={cx('mx-auto block', zoom ? 'max-w-none' : 'absolute inset-0 h-full w-full object-contain')}
          style={zoom ? { width: `${Math.min(p.asset.width, 2400)}px` } : undefined}
        />
        {photos.length > 1 && !zoom && (
          <>
            <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="press absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/40 disabled:opacity-30" aria-label="Fotografia anterior">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" disabled={i === photos.length - 1} onClick={() => setI(i + 1)} className="press absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/40 disabled:opacity-30" aria-label="Fotografia seguinte">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
      <p className="pb-safe px-4 py-3 text-center text-[12px] text-white/70">
        {stockLabel(p.asset) ? `${stockLabel(p.asset)} · ${shortCredit(p.asset)} · ${p.asset.alt}` : `${shortCredit(p.asset)} · Fotografia de um setor e de um momento; não mostra condições atuais.`}
      </p>
      <PhotoCredits asset={p.asset} open={credits} onClose={() => setCredits(false)} />
    </div>,
    document.body,
  )
}
