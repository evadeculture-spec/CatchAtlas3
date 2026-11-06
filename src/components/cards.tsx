import { CalendarDays, ChevronRight, Cloud, CloudRain, CloudSun, Droplets, Heart, MapPin, Sun, Thermometer, Wind } from 'lucide-react'
import { Link } from 'react-router'
import { damById } from '../data/dams'
import { damRegion, modalityName, speciesById } from '../data/catalog'
import type { Dam, DemoEvent } from '../data/types'
import { addDaysISO } from '../lib/dates'
import { formatDate, monthShort, relativeDay } from '../lib/format'
import type { Conditions, Sky } from '../lib/weather'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'
import { DamCover } from './photo/DamCover'
import { cx, Tag } from './ui'

const SKY_ICONS = { limpo: Sun, 'poucas-nuvens': CloudSun, nublado: Cloud, 'chuva-fraca': CloudRain }

export function SkyIcon({ sky, className }: { sky: Sky; className?: string }) {
  const I = SKY_ICONS[sky]
  return <I className={className} aria-hidden />
}

export function useFavoriteToggle() {
  const { toggleFavorite } = useApp()
  const toast = useToast()
  return (dam: Dam) => {
    const added = toggleFavorite(dam.id)
    toast(added ? `${dam.name} adicionada aos favoritos` : `${dam.name} removida dos favoritos`, { tone: added ? 'success' : 'info' })
  }
}

export function FavButton({ dam, tone = 'glass' }: { dam: Dam; tone?: 'glass' | 'light' }) {
  const { state } = useApp()
  const toggle = useFavoriteToggle()
  const fav = state.favorites.includes(dam.id)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(dam)
      }}
      aria-pressed={fav}
      aria-label={fav ? `Remover ${dam.name} dos favoritos` : `Adicionar ${dam.name} aos favoritos`}
      className={cx(
        'press grid h-10 w-10 place-items-center rounded-full',
        tone === 'glass' ? 'bg-black/25 text-white backdrop-blur-md hover:bg-black/40' : 'bg-white text-ink shadow-card hover:bg-mist',
      )}
    >
      <Heart className={cx('h-[18px] w-[18px] transition', fav && 'fill-[#F2B544] text-[#F2B544]')} aria-hidden />
    </button>
  )
}

export function DamCard({ dam, cond, layout = 'tall', catchCount }: { dam: Dam; cond?: Conditions; layout?: 'tall' | 'row'; catchCount?: number }) {
  if (layout === 'row')
    return (
      <Link to={`/barragens/${dam.id}`} className="press group flex gap-3 rounded-[var(--radius-card)] bg-white p-2.5 shadow-card hover:shadow-lift">
        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-2xl sm:w-36">
          <DamCover dam={dam} variant="thumb" sizes="144px" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col py-1 pr-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-extrabold text-ink">{dam.name}</h3>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                {damRegion(dam)} · {dam.river}
              </p>
            </div>
            <FavButton dam={dam} tone="light" />
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            {cond && (
              <Tag>
                <SkyIcon sky={cond.sky} className="h-3 w-3" /> {cond.airMax}° · {cond.wind} km/h
              </Tag>
            )}
            {dam.species.slice(0, 2).map((s) => (
              <Tag key={s} tone="teal">
                {speciesById[s].short}
              </Tag>
            ))}
            {dam.detail === 'basica' && <Tag>Ficha básica</Tag>}
            {catchCount !== undefined && catchCount > 0 && <Tag tone="amber">{catchCount} capturas</Tag>}
          </div>
        </div>
      </Link>
    )
  return (
    <Link to={`/barragens/${dam.id}`} className="press group relative block w-[248px] shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-ink shadow-card hover:shadow-lift sm:w-[272px]">
      <div className="relative h-[200px]">
        <DamCover dam={dam} variant="card" sizes="272px" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
        <div className="absolute right-3 top-3">
          <FavButton dam={dam} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className="font-display text-[22px] font-semibold leading-tight">{dam.name}</h3>
          <p className="mt-0.5 text-[12.5px] text-white/75">
            {damRegion(dam)} · {dam.river}
          </p>
          {cond && (
            <p className="tnum mt-2 flex items-center gap-3 text-[12.5px] font-semibold text-white/90">
              <span className="flex items-center gap-1">
                <SkyIcon sky={cond.sky} className="h-3.5 w-3.5" />
                {cond.airMax} °C
              </span>
              <span className="flex items-center gap-1">
                <Wind className="h-3.5 w-3.5" aria-hidden />
                {cond.wind} km/h
              </span>
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

export function ConditionsGrid({ c, dark }: { c: Conditions; dark?: boolean }) {
  const items = [
    { icon: SKY_ICONS[c.sky], label: c.skyLabel, value: `${c.airMin}° / ${c.airMax}°` },
    { icon: Droplets, label: 'Água (sim.)', value: `${c.water} °C` },
    { icon: Wind, label: `Vento ${c.windDir}`, value: `${c.wind} km/h` },
    { icon: Thermometer, label: `Pressão ${c.pressureTrend}`, value: `${c.pressure} hPa` },
  ]
  return (
    <div className="@container">
    <div className="grid grid-cols-2 gap-2.5 @lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className={cx('rounded-2xl px-3.5 py-3', dark ? 'bg-white/8' : 'bg-mist/70')}>
          <it.icon className={cx('h-[18px] w-[18px]', dark ? 'text-teal' : 'text-teal-700')} aria-hidden />
          <p className={cx('tnum mt-2 text-[17px] font-extrabold', dark ? 'text-white' : 'text-ink')}>{it.value}</p>
          <p className={cx('truncate text-[12px] font-semibold', dark ? 'text-white/60' : 'text-muted')}>{it.label}</p>
        </div>
      ))}
    </div>
    </div>
  )
}

export function EventCard({ ev, compact }: { ev: DemoEvent; compact?: boolean }) {
  const { state } = useApp()
  const dam = damById[ev.damId]
  const date = addDaysISO(state.anchor, ev.dayOffset)
  const d = new Date(date + 'T12:00')
  const past = ev.dayOffset < 0
  return (
    <Link
      to={`/provas/${ev.id}`}
      className={cx('press group flex items-stretch gap-3.5 rounded-[var(--radius-card)] bg-white p-3 shadow-card hover:shadow-lift', compact && 'p-2.5')}
    >
      <div className={cx('flex w-16 shrink-0 flex-col items-center justify-center rounded-2xl', past ? 'bg-mist text-muted' : 'bg-ink text-white')}>
        <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">{monthShort(date)}</span>
        <span className="tnum font-display text-[26px] font-semibold leading-none">{d.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <Tag tone={past ? 'neutral' : 'amber'}>{past ? 'Resultados' : 'Fictícia'}</Tag>
          <span className="truncate text-[12px] font-semibold text-muted">{modalityName(ev.modality)}</span>
        </div>
        <h3 className="mt-1.5 truncate text-[15px] font-extrabold text-ink">{ev.title}</h3>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden /> {dam.name}
          <span className="mx-0.5">·</span>
          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden /> {past ? formatDate(date) : relativeDay(date, state.anchor)}
        </p>
      </div>
      <ChevronRight className="mt-1 h-5 w-5 shrink-0 self-center text-subtle transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}
