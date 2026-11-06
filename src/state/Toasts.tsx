import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Tone = 'success' | 'info' | 'warning'
interface Toast {
  id: number
  message: string
  detail?: string
  tone: Tone
}

const ToastCtx = createContext<(message: string, opts?: { detail?: string; tone?: Tone }) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))
  const push = useCallback((message: string, opts?: { detail?: string; tone?: Tone }) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, message, detail: opts?.detail, tone: opts?.tone ?? 'success' }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.detail ? 5200 : 3400)
  }, [])
  const Icon = { success: CheckCircle2, info: Info, warning: TriangleAlert }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+12px)] lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const I = Icon[t.tone]
          return (
            <div key={t.id} className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lift">
              <I className={`mt-0.5 h-5 w-5 shrink-0 ${t.tone === 'warning' ? 'text-amber' : 'text-teal'}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.message}</p>
                {t.detail && <p className="mt-0.5 text-[13px] leading-snug text-white/70">{t.detail}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="-m-1 rounded-full p-1 text-white/60 hover:text-white" aria-label="Fechar aviso">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
