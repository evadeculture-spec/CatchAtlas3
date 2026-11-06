import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, IconButton } from './ui'

/** Folha inferior no telemóvel, diálogo centrado no desktop. Fecha com Esc e clique fora. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="fade-in absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-in pb-safe relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] bg-white outline-none sm:max-w-md sm:rounded-[28px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/95 px-5 pb-2 pt-4 backdrop-blur">
          <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line sm:hidden" aria-hidden />
          <h2 id={titleId} className="pt-2 text-[17px] font-extrabold text-ink">
            {title}
          </h2>
          <IconButton icon={X} label="Fechar" onClick={onClose} tone="plain" />
        </div>
        <div className="px-5 pb-5">{children}</div>
        {footer && <div className="sticky bottom-0 border-t border-line bg-white px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel,
  danger,
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; text: string; confirmLabel: string; danger?: boolean }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'dark'} className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-[14.5px] leading-relaxed text-muted">{text}</p>
    </Sheet>
  )
}
