import { Camera, ChevronRight, Fish, MapPin, Star } from 'lucide-react'
import { Link } from 'react-router'
import { ENRICHMENT, pinCategory, pingKind } from '../../lib/lanca/labels'
import { formatDateTime } from '../../lib/lanca/time'
import type { Pin, PingFull } from '../../lib/lanca/types'
import { fmt, type Units } from '../../lib/lanca/units'
import { cx } from '../ui'
import { SignedImage } from './SignedImage'

export function CategoryDot({ category, className }: { category: Pin['category']; className?: string }) {
  return <span className={cx('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: pinCategory(category).color }} aria-hidden />
}

export function PinRow({ pin, extra, to }: { pin: Pin; extra?: string; to?: string }) {
  const cat = pinCategory(pin.category)
  return (
    <Link to={to ?? `/conta/pins/${pin.id}`} className="press flex items-center gap-3 rounded-[var(--radius-card)] bg-white p-3 shadow-card hover:shadow-lift">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${cat.color}22`, color: cat.color }}>
        <MapPin className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14.5px] font-extrabold text-ink">{pin.name}</span>
          {pin.is_favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-amber text-amber" aria-label="Favorito" />}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted">
          {cat.label}
          {pin.water_body_name ? ` · ${pin.water_body_name}` : ''}
          {pin.status === 'arquivado' ? ' · arquivado' : ''}
          {extra ? ` · ${extra}` : ''}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
    </Link>
  )
}

export function PingRow({ ping, units }: { ping: PingFull; units: Units }) {
  const k = pingKind(ping.kind)
  const media = ping.ping_media[0]
  const env = ping.ping_environment
  const c = ping.catches[0]
  return (
    <Link to={`/conta/pings/${ping.id}`} className="press flex items-center gap-3 rounded-[var(--radius-card)] bg-white p-3 shadow-card hover:shadow-lift">
      {media ? (
        <SignedImage path={media.thumb_path} fallbackPath={media.display_path} alt="" className="h-14 w-14 shrink-0 rounded-2xl" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-mist text-subtle">{ping.kind === 'captura' ? <Fish className="h-5 w-5" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em]" style={{ color: k.color }}>
            <span className="h-2 w-2 rounded-full" style={{ background: k.color }} aria-hidden />
            {k.label}
          </span>
          {ping.ping_media.length > 1 && <span className="text-[11.5px] font-bold text-subtle">{ping.ping_media.length} fotos</span>}
        </span>
        <span className="mt-0.5 block truncate text-[14px] font-bold text-ink">
          {c ? `${c.species}${c.length_cm ? ` · ${fmt.length(c.length_cm, units)}` : ''}${c.weight_g ? ` · ${fmt.weight(c.weight_g, units)}` : ''}` : ping.pin?.name ?? (ping.notes?.slice(0, 60) || 'Sem local associado')}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-muted">
          {formatDateTime(ping.occurred_at, ping.occurred_tz)}
          {c && ping.pin ? ` · ${ping.pin.name}` : ''}
          {env?.air_temp_c != null ? ` · ${fmt.temp(env.air_temp_c, units)}` : ping.enrichment_status !== 'concluido' ? ` · ${ENRICHMENT[ping.enrichment_status].label.toLowerCase()}` : ''}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
    </Link>
  )
}

export function StatTile({ label, value, sub, to }: { label: string; value: number | string; sub?: string; to?: string }) {
  const body = (
    <>
      <p className="text-[12px] font-bold text-muted">{label}</p>
      <p className="tnum mt-1 text-[26px] font-extrabold leading-none text-ink">{value}</p>
      {sub && <p className="mt-1 truncate text-[11.5px] text-subtle">{sub}</p>}
    </>
  )
  return to ? (
    <Link to={to} className="press block rounded-[var(--radius-card)] bg-white p-4 shadow-card hover:shadow-lift">
      {body}
    </Link>
  ) : (
    <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-card">{body}</div>
  )
}
