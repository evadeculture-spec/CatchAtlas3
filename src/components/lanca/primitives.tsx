import { AlertTriangle, Info, Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react'
import { friendly } from '../../lib/lanca/api'
import { DATA_KIND } from '../../lib/lanca/labels'
import { Button, cx } from '../ui'

/**
 * Carregamento assíncrono com estados de erro e recarregamento. O resultado fica associado à chave
 * das dependências: enquanto não chega o resultado da chave atual, `loading` é verdadeiro.
 * As dependências devem ser valores simples (ids, datas).
 */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [nonce, setNonce] = useState(0)
  const depsKey = JSON.stringify(deps)
  const [res, setRes] = useState<{ depsKey: string | null; nonce: number; data: T | null; error: string | null }>({ depsKey: null, nonce: -1, data: null, error: null })
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })
  useEffect(() => {
    let alive = true
    fnRef.current().then(
      (data) => alive && setRes({ depsKey, nonce, data, error: null }),
      (e) => alive && setRes((r) => ({ depsKey, nonce, data: r.depsKey === depsKey ? r.data : null, error: friendly(e) })),
    )
    return () => {
      alive = false
    }
  }, [depsKey, nonce])
  const reload = useCallback(async () => setNonce((n) => n + 1), [])
  const setData = useCallback((data: T) => setRes((r) => ({ ...r, data })), [])
  const same = res.depsKey === depsKey
  // loading: ainda sem resultado para estas dependências; refreshing: a recarregar mantendo os dados atuais.
  return { data: same ? res.data : null, error: same ? res.error : null, loading: !same, refreshing: same && res.nonce !== nonce, reload, setData }
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-2xl bg-[#e3eaec]', className)} aria-hidden />
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="A carregar">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-white p-3 shadow-card">
          <Skeleton className="h-14 w-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-[#fdf0ee] p-4 text-[13.5px] text-[#7b2318]" role="alert">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{message}</p>
        {onRetry && (
          <Button size="sm" variant="outline" icon={RefreshCw} className="mt-3" onClick={onRetry}>
            Tentar de novo
          </Button>
        )}
      </div>
    </div>
  )
}

export function Notice({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'warn'; className?: string }) {
  const I = tone === 'warn' ? AlertTriangle : Info
  return (
    <div className={cx('flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[12.5px] leading-relaxed', tone === 'warn' ? 'bg-amber-50 text-amber-800' : 'bg-mist text-muted', className)}>
      <I className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Spinner({ label = 'A carregar' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </span>
  )
}

/** Etiqueta da natureza do dado (estimativa de modelo, histórico, previsão, calculado, indisponível). */
export function KindBadge({ kind, className }: { kind: keyof typeof DATA_KIND; className?: string }) {
  const k = DATA_KIND[kind]
  const tone = kind === 'previsao' ? 'bg-[#e8f0fb] text-[#24508a]' : kind === 'historico' ? 'bg-[#efe9f7] text-[#5a3f86]' : kind === 'indisponivel' ? 'bg-mist text-subtle' : kind === 'calculado' ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-800'
  return (
    <span title={k.text} className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em]', tone, className)}>
      {k.label}
    </span>
  )
}

/** Linha "rótulo: valor" com valor indisponível explícito (nunca inventado). */
export function KV({ label, value, hint }: { label: string; value: ReactNode | null | undefined; hint?: string }) {
  const missing = value === null || value === undefined || value === ''
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/70 py-2 last:border-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cx('tnum text-right text-[13.5px] font-bold', missing ? 'font-semibold text-subtle' : 'text-ink')} title={hint}>
        {missing ? 'indisponível' : value}
      </dd>
    </div>
  )
}

export function Panel({ title, children, actions, className, kicker }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string; kicker?: string }) {
  return (
    <section className={cx('rounded-[var(--radius-card)] bg-white p-4 shadow-card sm:p-5', className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {kicker && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{kicker}</p>}
            {title && <h2 className="text-[16px] font-extrabold text-ink">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export const textareaCls =
  'min-h-24 w-full rounded-2xl border border-line bg-white px-4 py-3 text-[15px] text-ink placeholder:text-subtle outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/15'
export const selectCls =
  'h-12 w-full appearance-none rounded-2xl border border-line bg-white px-4 text-[15px] text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/15'
