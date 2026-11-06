import { Heart } from 'lucide-react'
import type { CountryId } from '../../data/types'
import { FILTER_TYPES, type AtlasType } from '../../lib/atlas/model'
import { cx } from '../ui'

const chip = (on: boolean) =>
  cx('press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold', on ? 'border-[#f4f7f8] bg-[#f4f7f8] text-[#071923]' : 'border-white/15 bg-[#0a2230]/80 text-[#f4f7f8] hover:bg-white/10')

/** Filtros compactos: país, tipo e favoritas (sem espécies: não há dados verificados que os sustentem). */
export function AtlasFilters({ countries, types, favOnly, onCountry, onType, onFav, className }: { countries: CountryId[]; types: AtlasType[]; favOnly: boolean; onCountry: (c: CountryId | null) => void; onType: (t: AtlasType) => void; onFav: () => void; className?: string }) {
  return (
    <div className={cx('no-scrollbar flex gap-2 overflow-x-auto', className)} role="group" aria-label="Filtros" data-no-swipe>
      <button type="button" className={cx(chip(favOnly), favOnly && 'border-[#e6b65a] bg-[#e6b65a] text-[#071923]')} aria-pressed={favOnly} onClick={onFav}>
        <Heart className={cx('h-4 w-4', favOnly && 'fill-[#071923]')} aria-hidden /> Favoritas
      </button>
      {(['PT', 'ES'] as const).map((c) => (
        <button key={c} type="button" className={chip(countries.includes(c))} aria-pressed={countries.includes(c)} onClick={() => onCountry(countries.includes(c) ? null : c)}>
          {c === 'PT' ? 'Portugal' : 'Espanha'}
        </button>
      ))}
      <span className="my-2 w-px shrink-0 bg-white/15" aria-hidden />
      {FILTER_TYPES.map((t) => (
        <button key={t.id} type="button" className={chip(types.includes(t.id))} aria-pressed={types.includes(t.id)} onClick={() => onType(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
