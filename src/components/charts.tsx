import { useState } from 'react'
import { speciesById } from '../data/catalog'
import type { SpeciesId } from '../data/types'
import { formatKgShort } from '../lib/format'
import type { HourPoint } from '../lib/weather'
import { cx } from './ui'

/** Gráfico horário: temperatura do ar (linha) e vento (barras). Valores simulados. */
export function HourlyChart({ data, highlight }: { data: HourPoint[]; highlight?: [number, number] }) {
  const [sel, setSel] = useState(() => data.findIndex((d) => d.hour === 9))
  const W = 100
  const H = 60
  const temps = data.map((d) => d.air)
  const tMin = Math.min(...temps) - 1
  const tMax = Math.max(...temps) + 1
  const wMax = Math.max(25, ...data.map((d) => d.wind))
  const x = (i: number) => (i / (data.length - 1)) * W
  const y = (t: number) => H - 6 - ((t - tMin) / (tMax - tMin)) * (H - 16)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(d.air).toFixed(2)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const cur = data[sel] ?? data[0]
  const hiStart = highlight ? data.findIndex((d) => d.hour >= highlight[0]) : -1
  const hiEnd = highlight ? data.findLastIndex((d) => d.hour <= highlight[1]) : -1

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[12px] font-semibold text-muted">Às {String(cur.hour).padStart(2, '0')}:00</p>
          <p className="tnum text-[15px] font-extrabold text-ink">
            {Math.round(cur.air)} °C <span className="mx-1 text-subtle">·</span> vento {cur.wind} km/h
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-teal" /> Ar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2 rounded-sm bg-ink/15" /> Vento
          </span>
        </div>
      </div>
      <div className="relative h-36">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="hc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#20BFA9" stopOpacity=".28" />
              <stop offset="1" stopColor="#20BFA9" stopOpacity="0" />
            </linearGradient>
          </defs>
          {hiStart >= 0 && hiEnd >= hiStart && (
            <rect x={x(hiStart) - 1.5} width={x(hiEnd) - x(hiStart) + 3} y={0} height={H} fill="#F2B544" opacity=".14" rx="1.5" />
          )}
          {data.map((d, i) => {
            const bh = (d.wind / wMax) * 22
            return <rect key={d.hour} x={x(i) - 1.4} y={H - bh} width={2.8} height={bh} rx={0.8} fill={i === sel ? '#102B3A' : '#102B3A'} opacity={i === sel ? 0.4 : 0.12} />
          })}
          <path d={area} fill="url(#hc-area)" />
          <path d={line} fill="none" stroke="#14A08D" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <line x1={x(sel)} x2={x(sel)} y1={0} y2={H} stroke="#102B3A" strokeOpacity=".25" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-600 shadow"
          style={{ left: `${x(sel)}%`, top: `${(y(cur.air) / H) * 100}%` }}
        />
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <button
              key={d.hour}
              className="h-full flex-1 focus-visible:bg-teal/10"
              aria-label={`${d.hour}h: ${Math.round(d.air)} graus, vento ${d.wind} km/h`}
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
              onClick={() => setSel(i)}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-subtle tnum">
        {data.filter((_, i) => i % 3 === 0).map((d) => (
          <span key={d.hour}>{String(d.hour).padStart(2, '0')}h</span>
        ))}
      </div>
    </div>
  )
}

export function SpeciesBars({ rows }: { rows: { id: SpeciesId; count: number; weightG: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const sp = speciesById[r.id]
        return (
          <li key={r.id}>
            <div className="mb-1 flex items-baseline justify-between text-[13px]">
              <span className="font-bold text-ink">{sp.name}</span>
              <span className="tnum text-muted">
                {r.count} · {formatKgShort(r.weightG)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-mist">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(r.count / max) * 100}%`, background: sp.color }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function Sparkbars({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values)
  return (
    <div className={cx('flex h-10 items-end gap-1', className)} aria-hidden>
      {values.map((v, i) => (
        <span key={i} className="flex-1 rounded-sm bg-teal/70" style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
      ))}
    </div>
  )
}
