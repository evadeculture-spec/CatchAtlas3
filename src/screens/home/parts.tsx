import { ChevronRight, type LucideIcon } from 'lucide-react'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { StoryArt } from '../../data/storyArt'
import { cx } from '../../components/ui'

const RM = '(prefers-reduced-motion: reduce)'
/** true quando o sistema pede movimento reduzido. */
export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(RM)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(RM).matches,
    () => false,
  )
}

/** Fotografia de fundo em ecrã inteiro; se falhar, fica a cor/gradiente de recurso. */
export function ArtImage({ art, className, sizes = '100vw', priority }: { art: StoryArt; className?: string; sizes?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="absolute inset-0" style={{ background: art.fallback }} aria-hidden>
      {art.src && !failed && (
        <img
          src={art.src}
          srcSet={art.srcSet || undefined}
          sizes={sizes}
          alt=""
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          onError={() => setFailed(true)}
          className={cx('h-full w-full object-cover', className)}
          style={{ objectPosition: art.position }}
        />
      )}
    </div>
  )
}

/** Lista de atalhos com separadores finos (sem cartões). */
export function ToolList({ title, items }: { title: string; items: { to: string; label: string; hint?: string; icon: LucideIcon }[] }) {
  return (
    <section className="mt-10" aria-label={title}>
      <h3 className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/55">{title}</h3>
      <ul className="mt-2 divide-y divide-white/10 border-y border-white/10">
        {items.map((it) => (
          <li key={it.to}>
            <Link to={it.to} className="group flex min-h-14 items-center gap-3.5 py-2.5 text-white transition-colors hover:text-teal focus-visible:text-teal">
              <it.icon className="h-5 w-5 shrink-0 text-white/70 transition-colors group-hover:text-teal" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{it.label}</span>
                {it.hint && <span className="block truncate text-[12.5px] text-white/55">{it.hint}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Credit({ art, label }: { art: StoryArt; label?: string }) {
  if (!art.author) return null
  return (
    <p className="mt-10 text-[11px] text-white/45">
      {label ? `${label} · ` : ''}Foto de{' '}
      <a href={art.authorUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-2 hover:text-white">
        {art.author}
      </a>{' '}
      no{' '}
      <a href={art.pageUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-2 hover:text-white">
        Unsplash
      </a>
    </p>
  )
}

export function Glass({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-3xl bg-black/25 p-4 ring-1 ring-white/10 backdrop-blur-md', className)}>{children}</div>
}
