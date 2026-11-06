import { Fish, ImageOff, Lock, MapPin } from 'lucide-react'
import { anglerById } from '../data/anglers'
import { damById } from '../data/dams'
import { speciesById } from '../data/catalog'
import type { Catch } from '../data/types'
import { formatKg } from '../lib/format'
import { usePhotoUrl } from '../lib/usePhotoUrl'
import { useApp } from '../state/AppState'
import { cx } from './ui'

export function useAnglerName() {
  const { state } = useApp()
  return (id: string) => (anglerById[id]?.isDemoUser ? state.profile.name || 'Tu' : (anglerById[id]?.name ?? 'Pescador'))
}

export function Avatar({ anglerId, size = 36, ring }: { anglerId: string; size?: number; ring?: boolean }) {
  const { state } = useApp()
  const name = useAnglerName()(anglerId)
  const a = anglerById[anglerId]
  const color = a?.isDemoUser ? state.profile.avatarColor : (a?.color ?? '#8A9BA2')
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className={cx('inline-grid shrink-0 place-items-center rounded-full font-extrabold text-ink', ring && 'ring-[3px] ring-white')}
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials || '•'}
    </span>
  )
}

/** Fotografia do utilizador ou cartão gráfico neutro (nunca uma foto de espécie genérica). */
export function CatchVisual({ c, className, iconSize = 28 }: { c: Catch; className?: string; iconSize?: number }) {
  const { url, loading, failed } = usePhotoUrl(c.id, c.hasPhoto)
  const sp = speciesById[c.speciesId]
  if (c.hasPhoto && url) return <img src={url} alt={`Fotografia da captura: ${sp.name}`} className={cx('h-full w-full object-cover', className)} />
  if (c.hasPhoto && loading) return <div className={cx('skeleton h-full w-full', className)} />
  return (
    <div className={cx('relative grid h-full w-full place-items-center overflow-hidden bg-ink', className)} aria-hidden>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full opacity-25" preserveAspectRatio="none">
        {[18, 34, 50, 66, 82].map((y) => (
          <path key={y} d={`M-5 ${y} Q 25 ${y - 6} 50 ${y} T 105 ${y}`} fill="none" stroke={sp.color} strokeWidth="0.8" />
        ))}
      </svg>
      <Fish style={{ width: iconSize, height: iconSize, color: sp.color }} strokeWidth={1.6} />
      {failed && <ImageOff className="absolute right-2 top-2 h-4 w-4 text-white/50" aria-label="Fotografia indisponível" />}
    </div>
  )
}

export function SpeciesDot({ id, className }: { id: Catch['speciesId']; className?: string }) {
  return <span className={cx('inline-block h-2 w-2 rounded-full', className)} style={{ background: speciesById[id].color }} aria-hidden />
}

export function CatchRow({ c, showAngler = true, onClick }: { c: Catch; showAngler?: boolean; onClick?: () => void }) {
  const name = useAnglerName()
  const sp = speciesById[c.speciesId]
  return (
    <button onClick={onClick} className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-mist/70">
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <CatchVisual c={c} iconSize={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[14px] font-extrabold text-ink">
          {sp.name}
          {c.visibility === 'privada' && <Lock className="h-3.5 w-3.5 text-subtle" aria-label="Privada" />}
        </span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
          {damById[c.damId]?.name}
          {showAngler && <span className="truncate"> · {name(c.anglerId)}</span>}
        </span>
      </span>
      <span className="tnum shrink-0 text-right text-[15px] font-extrabold text-ink">{formatKg(c.weightG)}</span>
    </button>
  )
}
