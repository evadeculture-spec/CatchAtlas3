import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { brand } from '../config/brand'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'dark' | 'ghost' | 'outline' | 'danger' | 'soft'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-teal text-ink hover:bg-[#2fcab4] shadow-[0_6px_16px_-6px_rgb(32_191_169/0.7)]',
  dark: 'bg-ink text-white hover:bg-ink-2',
  ghost: 'text-ink hover:bg-ink/5',
  outline: 'border border-line bg-white text-ink hover:border-ink/25',
  danger: 'bg-danger text-white hover:bg-[#a93226]',
  soft: 'bg-mist text-ink hover:bg-[#dfe9ea]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'press inline-flex items-center justify-center gap-2 rounded-full font-bold disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' && 'h-9 px-3.5 text-[13px]',
        size === 'md' && 'h-11 px-5 text-sm',
        size === 'lg' && 'h-13 px-6 text-[15px]',
        VARIANTS[variant],
        className,
      )}
    >
      {Icon && <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} aria-hidden />}
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  children,
}: { to: string; variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cx(
        'press inline-flex items-center justify-center gap-2 rounded-full font-bold',
        size === 'sm' && 'h-9 px-3.5 text-[13px]',
        size === 'md' && 'h-11 px-5 text-sm',
        size === 'lg' && 'h-13 px-6 text-[15px]',
        VARIANTS[variant],
        className,
      )}
    >
      {Icon && <Icon className="h-[18px] w-[18px]" aria-hidden />}
      {children}
    </Link>
  )
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  tone = 'light',
  active,
  className,
}: { icon: LucideIcon; label: string; onClick?: () => void; tone?: 'light' | 'glass' | 'plain'; active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'press grid h-11 w-11 shrink-0 place-items-center rounded-full',
        tone === 'light' && 'bg-white text-ink shadow-card hover:bg-mist',
        tone === 'glass' && 'bg-black/25 text-white backdrop-blur-md hover:bg-black/35',
        tone === 'plain' && 'text-ink hover:bg-ink/5',
        className,
      )}
    >
      <Icon className={cx('h-5 w-5', active && 'fill-current')} aria-hidden />
    </button>
  )
}

/** Volta ao ecrã anterior; se o utilizador abriu o link diretamente, vai para o destino de recurso. */
export function useBack(fallback: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (location.key !== 'default' && window.history.length > 1) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}

export function PageHeader({
  title,
  back,
  actions,
  eyebrow,
  transparent,
}: { title?: string; back?: string; actions?: ReactNode; eyebrow?: string; transparent?: boolean }) {
  const goBack = useBack(back ?? '/')
  return (
    <header
      className={cx(
        'pt-safe top-0 z-30',
        transparent ? 'pointer-events-none absolute inset-x-0 lg:left-0' : 'sticky border-b border-line/70 bg-canvas/85 backdrop-blur-xl',
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 lg:px-8">
        {back !== undefined && (
          <span className="pointer-events-auto -ml-1.5">
            <IconButton icon={ArrowLeft} label="Voltar" onClick={goBack} tone={transparent ? 'glass' : 'plain'} />
          </span>
        )}
        {title && (
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>}
            <h1 className="truncate text-[17px] font-extrabold text-ink">{title}</h1>
          </div>
        )}
        {!title && <div className="flex-1" />}
        <div className="pointer-events-auto flex items-center gap-1.5">{actions}</div>
      </div>
    </header>
  )
}

export function DemoTag({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
        tone === 'light' ? 'bg-amber-50 text-amber-800' : 'bg-black/30 text-white/90 backdrop-blur-md',
        className,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', tone === 'light' ? 'bg-amber' : 'bg-amber')} aria-hidden />
      {brand.demoLabel}
    </span>
  )
}

export function Tag({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'teal' | 'amber' | 'glass' | 'ink'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',
        tone === 'neutral' && 'bg-mist text-muted',
        tone === 'teal' && 'bg-teal-50 text-teal-700',
        tone === 'amber' && 'bg-amber-50 text-amber-800',
        tone === 'glass' && 'bg-black/30 text-white backdrop-blur-md',
        tone === 'ink' && 'bg-ink text-white',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Chip({
  active,
  onClick,
  children,
  icon: Icon,
  className,
}: { active?: boolean; onClick?: () => void; children: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-bold',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/30',
        className,
      )}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden />}
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  tone = 'light',
}: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: LucideIcon }[]; label: string; className?: string; tone?: 'light' | 'dark' }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex rounded-full p-1', tone === 'light' ? 'bg-mist' : 'bg-white/10', className)}>
      {options.map((o) => {
        const active = o.id === value
        const I = o.icon
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cx(
              'press inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold',
              active ? (tone === 'light' ? 'bg-white text-ink shadow-card' : 'bg-white text-ink') : tone === 'light' ? 'text-muted hover:text-ink' : 'text-white/75 hover:text-white',
            )}
          >
            {I && <I className="h-4 w-4" aria-hidden />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SectionHeader({ title, to, linkLabel = 'Ver tudo', kicker }: { title: string; to?: string; linkLabel?: string; kicker?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {kicker && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">{kicker}</p>}
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="press -mr-2 inline-flex h-9 items-center gap-0.5 rounded-full px-2 text-[13px] font-bold text-teal-700 hover:bg-teal-50">
          {linkLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  )
}

export function Card({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <As className={cx('rounded-[var(--radius-card)] bg-white shadow-card', className)}>{children}</As>
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 font-extrabold text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, error, children, htmlFor, optional }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-[13px] font-bold text-ink">
        {label}
        {optional && <span className="text-[12px] font-semibold text-subtle">Opcional</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[12.5px] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[12.5px] text-muted">{hint}</p>
      )}
    </div>
  )
}

export const inputCls =
  'h-12 w-full rounded-2xl border border-line bg-white px-4 text-[15px] text-ink placeholder:text-subtle outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/15'

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cx('flex cursor-pointer items-center justify-between gap-4 py-1', disabled && 'cursor-not-allowed opacity-50')}>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{description}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-[#cfd9dc] transition peer-checked:bg-teal peer-focus-visible:ring-4 peer-focus-visible:ring-teal/30 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  )
}

export function Stat({ label, value, sub, icon: Icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </p>
      <p className="tnum mt-1 truncate text-[22px] font-extrabold leading-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[12px] text-muted">{sub}</p>}
    </div>
  )
}
