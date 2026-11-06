import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Dam } from '../data/types'
import { cx } from './ui'

// Contornos MUITO simplificados (aprox.), apenas para orientação esquemática.
export const IBERIA: [number, number][] = [
  [-8.87, 41.87], [-8.9, 42.1], [-8.85, 42.6], [-9.3, 42.9], [-9.25, 43.2], [-8.3, 43.55], [-7.7, 43.75], [-7.0, 43.55],
  [-5.8, 43.6], [-4.5, 43.4], [-3.5, 43.48], [-2.9, 43.4], [-1.8, 43.38], [-1.4, 43.1], [-0.7, 42.85], [0.7, 42.85],
  [1.5, 42.45], [3.15, 42.45], [3.3, 42.3], [3.2, 41.9], [2.2, 41.35], [1.0, 41.05], [0.9, 40.7], [0.0, 39.9],
  [-0.3, 39.45], [0.2, 38.75], [-0.5, 38.3], [-0.75, 37.6], [-1.3, 37.55], [-1.9, 36.9], [-2.2, 36.72], [-3.4, 36.72],
  [-4.4, 36.7], [-5.0, 36.45], [-5.6, 36.0], [-6.0, 36.3], [-6.4, 36.8], [-6.95, 37.2], [-7.42, 37.18], [-7.9, 37.0],
  [-8.3, 37.1], [-8.65, 37.1], [-8.99, 37.02], [-8.8, 37.4], [-8.82, 37.9], [-8.75, 38.3], [-9.2, 38.42], [-9.05, 38.6],
  [-9.5, 38.78], [-9.4, 39.1], [-9.35, 39.36], [-9.05, 39.6], [-8.9, 40.0], [-8.75, 40.6], [-8.66, 41.2], [-8.8, 41.55],
]
export const PORTUGAL: [number, number][] = [
  [-8.87, 41.87], [-8.6, 42.05], [-8.2, 42.14], [-8.0, 41.95], [-7.6, 41.88], [-7.2, 41.98], [-6.9, 41.94], [-6.55, 41.94],
  [-6.2, 41.6], [-6.5, 41.3], [-6.8, 41.05], [-6.93, 40.6], [-6.85, 40.25], [-7.0, 39.9], [-7.5, 39.66], [-7.25, 39.45],
  [-7.0, 39.1], [-7.05, 38.85], [-7.3, 38.45], [-7.0, 38.15], [-7.25, 37.95], [-7.5, 37.55], [-7.42, 37.18], [-7.9, 37.0],
  [-8.3, 37.1], [-8.65, 37.1], [-8.99, 37.02], [-8.8, 37.4], [-8.82, 37.9], [-8.75, 38.3], [-9.2, 38.42], [-9.05, 38.6],
  [-9.5, 38.78], [-9.4, 39.1], [-9.35, 39.36], [-9.05, 39.6], [-8.9, 40.0], [-8.75, 40.6], [-8.66, 41.2], [-8.8, 41.55],
]

export type MapView = 'pt' | 'iberia'
const VIEWS: Record<MapView, { lon: [number, number]; lat: [number, number]; w: number; h: number }> = {
  pt: { lon: [-9.75, -6.0], lat: [36.8, 42.35], w: 220, h: 340 },
  iberia: { lon: [-9.9, 3.6], lat: [35.8, 44.0], w: 330, h: 262 },
}

export interface MapPing {
  id: string
  lat: number
  lon: number
  color: string
  /** 0–1: pings mais recentes são maiores e mais opacos. */
  weight: number
  label: string
}

export function SchematicMap({
  dams,
  selected,
  onSelect,
  favorites = [],
  className,
  view = 'pt',
  pings,
  selectedPing,
  onSelectPing,
  overlay,
}: {
  dams: Dam[]
  selected?: string
  onSelect?: (id: string) => void
  favorites?: string[]
  className?: string
  view?: MapView
  pings?: MapPing[]
  selectedPing?: string
  onSelectPing?: (id: string) => void
  overlay?: ReactNode
}) {
  const v = VIEWS[view]
  const px = (lon: number) => ((lon - v.lon[0]) / (v.lon[1] - v.lon[0])) * v.w
  const py = (lat: number) => ((v.lat[1] - lat) / (v.lat[1] - v.lat[0])) * v.h
  const path = (pts: [number, number][]) => pts.map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join(' ') + ' Z'
  const dense = dams.length > 30
  const pct = (lon: number, lat: number) => ({ left: `${(px(lon) / v.w) * 100}%`, top: `${(py(lat) / v.h) * 100}%` })

  return (
    <div className={cx('relative overflow-hidden rounded-[var(--radius-card)] bg-[#E2ECEF]', className)}>
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(#c6d5da 1px, transparent 1px)', backgroundSize: '14px 14px' }} aria-hidden />
      <div className="relative mx-auto h-full max-h-full max-w-full" style={{ aspectRatio: `${v.w} / ${v.h}` }}>
        <svg viewBox={`0 0 ${v.w} ${v.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <path d={path(IBERIA)} fill="#EEF2F0" stroke="#B5C7CC" strokeWidth="1" strokeLinejoin="round" />
          <path d={path(PORTUGAL)} fill="#FAFCFC" stroke="#9FB5BB" strokeWidth="1.1" strokeLinejoin="round" />
          {view === 'pt' ? (
            <>
              <text x={12} y={v.h * 0.62} fill="#7F969C" fontSize="8" fontWeight="700" letterSpacing="2">OCEANO</text>
              <text x={12} y={v.h * 0.62 + 10} fill="#7F969C" fontSize="8" fontWeight="700" letterSpacing="2">ATLÂNTICO</text>
              <text x={v.w - 50} y={v.h * 0.28} fill="#9AADB2" fontSize="7.5" fontWeight="700" letterSpacing="1.5">ESPANHA</text>
            </>
          ) : (
            <>
              <text x={px(-5.2)} y={py(42.7)} fill="#9AADB2" fontSize="8" fontWeight="800" letterSpacing="2">ESPANHA</text>
              <text x={px(-9.8)} y={py(36.3)} fill="#7F969C" fontSize="6.5" fontWeight="800" letterSpacing="1.5">ATLÂNTICO</text>
            </>
          )}
        </svg>

        {pings?.map((p) => {
          const active = p.id === selectedPing
          const size = 8 + p.weight * 8
          const Tag = onSelectPing ? 'button' : 'span'
          return (
            <Tag
              key={p.id}
              {...(onSelectPing ? { type: 'button' as const, onClick: () => onSelectPing(p.id), 'aria-label': p.label, 'aria-pressed': active } : { 'aria-hidden': true })}
              className="absolute -translate-x-1/2 -translate-y-1/2 p-1.5"
              style={{ ...pct(p.lon, p.lat), zIndex: active ? 6 : 2 }}
            >
              {p.weight > 0.75 && <span className="pulse-ring absolute inset-1.5 rounded-full" style={{ background: p.color }} aria-hidden />}
              <span
                className={cx('relative block rounded-full border-2 border-white shadow-card transition-transform', active && 'scale-150')}
                style={{ width: size, height: size, background: p.color, opacity: 0.55 + p.weight * 0.45 }}
              />
            </Tag>
          )
        })}

        {dams.map((d) => {
          const active = d.id === selected
          return (
            <button
              key={d.id}
              onClick={() => onSelect?.(d.id)}
              aria-label={`${d.name}${favorites.includes(d.id) ? ' (favorita)' : ''}`}
              aria-pressed={active}
              className={cx('group absolute -translate-x-1/2 -translate-y-1/2', dense ? 'p-1' : 'p-2')}
              style={{ ...pct(d.approx.lon, d.approx.lat), zIndex: active ? 5 : 1 }}
            >
              {active && <span className="pulse-ring absolute inset-2 rounded-full bg-teal" aria-hidden />}
              <span
                className={cx(
                  'relative grid place-items-center rounded-full border-[2.5px] border-white shadow-lift transition-transform',
                  active ? 'h-6 w-6 scale-110 bg-teal' : pings ? 'h-3.5 w-3.5 bg-ink/70' : dense ? 'h-3.5 w-3.5 border-2 bg-ink group-hover:scale-125' : 'h-5 w-5 bg-ink group-hover:scale-110',
                )}
              >
                {favorites.includes(d.id) && !pings && !dense && <span className="h-1.5 w-1.5 rounded-full bg-amber" />}
              </span>
              <span
                className={cx(
                  'pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white shadow-card transition-opacity',
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
                )}
              >
                {d.name}
              </span>
            </button>
          )
        })}
      </div>
      <p className="absolute right-2 top-2 flex max-w-[62%] items-start gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10.5px] font-semibold leading-snug text-muted shadow-card backdrop-blur">
        <Info className="mt-px h-3 w-3 shrink-0 text-teal-700" aria-hidden />
        Esquemático · posições aproximadas · não serve para navegação
      </p>
      {overlay}
    </div>
  )
}
