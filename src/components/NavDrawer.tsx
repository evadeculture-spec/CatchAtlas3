import { Plus, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink } from 'react-router'
import { brand } from '../config/brand'
import { BrandLockup } from './BrandMark'
import { NAV, SECONDARY } from './nav'
import { cx } from './ui'

/** Menu completo da app em gaveta lateral (usado na página inicial imersiva). */
export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('a,button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('a,button')]
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button type="button" aria-label="Fechar menu" className="fade-in absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="drawer-in pt-safe pb-safe absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col overflow-y-auto bg-ink px-5 py-5 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <Link to="/" onClick={onClose} className="rounded-xl" aria-label={`${brand.name} — início`}>
            <BrandLockup light compact />
          </Link>
          <button type="button" onClick={onClose} className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <Link to="/capturas/nova" onClick={onClose} className="press mt-6 flex h-12 items-center justify-center gap-2 rounded-full bg-teal text-[14px] font-extrabold text-ink hover:bg-[#2fcab4]">
          <Plus className="h-5 w-5" aria-hidden /> Registar captura
        </Link>
        <nav className="mt-5 space-y-1" aria-label="Navegação principal">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={onClose} className={({ isActive }) => cx('press flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-bold', isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')}>
              <n.icon className="h-5 w-5" aria-hidden /> {n.label}
            </NavLink>
          ))}
          <p className="px-3 pb-1 pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">Informação e comunidade</p>
          {SECONDARY.map((n) => (
            <NavLink key={n.to} to={n.to} onClick={onClose} className={({ isActive }) => cx('press flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-bold', isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white')}>
              <n.icon className="h-[18px] w-[18px]" aria-hidden /> {n.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto pt-6 text-[12px] leading-relaxed text-white/50">
          <span className="font-bold text-amber">{brand.demoLabel}.</span> Os dados são fictícios e as alterações ficam apenas neste navegador.
        </p>
      </div>
    </div>,
    document.body,
  )
}
