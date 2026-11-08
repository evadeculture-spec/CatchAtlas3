import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BrandLockup } from '../../components/BrandMark'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="pt-safe min-h-dvh bg-ink px-4 py-8 sm:grid sm:place-items-center">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-8 inline-block rounded-xl" aria-label="Lança Lance — início">
          <BrandLockup light />
        </Link>
        <div className="rounded-[28px] bg-white p-6 shadow-lift sm:p-8">
          <h1 className="text-[22px] font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-[13.5px] text-white/70">{footer}</div>}
      </div>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="rounded-2xl bg-[#fdf0ee] px-4 py-3 text-[13.5px] font-semibold text-[#7b2318]" role="alert">
      {message}
    </p>
  )
}
