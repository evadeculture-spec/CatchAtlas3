import { Plus, Search, ShoppingBag, X } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ListingVisual } from '../components/ListingVisual'
import { ButtonLink, Chip, cx, DemoTag, EmptyState, PageHeader, Tag } from '../components/ui'
import { DEMO_USER_ID } from '../data/anglers'
import { CONDITIONS, LISTING_CATEGORIES, regionName } from '../data/catalog'
import type { ListingCategory } from '../data/types'
import { relativeDay } from '../lib/format'
import { formatEur } from '../lib/money'
import { useApp } from '../state/AppState'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Market() {
  const { state, allListings } = useApp()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const cat = (params.get('categoria') as ListingCategory | null) ?? null
  const mine = params.get('meus') === '1'
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const items = useMemo(
    () =>
      allListings
        .filter((l) => (!cat || l.category === cat) && (!mine || l.sellerId === DEMO_USER_ID) && (!q || norm(`${l.title} ${l.description}`).includes(norm(q))))
        .sort((a, b) => Number(a.sold) - Number(b.sold) || b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [allListings, cat, mine, q],
  )

  return (
    <div>
      <PageHeader back="/comunidade" title="Marketplace" eyebrow="Comunidade" actions={<ButtonLink to="/mercado/novo" size="sm" icon={Plus}>Anunciar</ButtonLink>} />
      <div className="mx-auto max-w-6xl px-4 pt-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-[13.5px] text-muted">Material de pesca em segunda mão entre pescadores. Na demonstração, os anúncios são fictícios e não há pagamentos.</p>
          <DemoTag />
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" aria-hidden />
          <input type="search" value={q} onChange={(e) => set('q', e.target.value)} placeholder="Procurar material" aria-label="Procurar anúncios" className="h-12 w-full rounded-full border border-line bg-white pl-11 pr-11 text-[15px] shadow-card outline-none placeholder:text-subtle focus:border-teal focus:ring-4 focus:ring-teal/15" />
          {q && (
            <button type="button" onClick={() => set('q', null)} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Limpar pesquisa">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          <Chip active={mine} onClick={() => set('meus', mine ? null : '1')}>Os meus</Chip>
          <span className="my-2 w-px shrink-0 bg-line" aria-hidden />
          {LISTING_CATEGORIES.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => set('categoria', cat === c.id ? null : c.id)}>{c.name}</Chip>
          ))}
        </div>

        <div className="mt-4">
          {items.length === 0 ? (
            <EmptyState icon={ShoppingBag} title={mine ? 'Ainda não tem anúncios' : 'Nenhum anúncio encontrado'} text={mine ? 'Publique o primeiro anúncio de material que já não usa.' : 'Experimente outra categoria ou pesquisa.'} action={<ButtonLink to="/mercado/novo" icon={Plus}>Criar anúncio</ButtonLink>} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((l) => (
                <li key={l.id}>
                  <Link to={`/mercado/${l.id}`} className={cx('press group block overflow-hidden rounded-[var(--radius-card)] bg-white shadow-card hover:shadow-lift', l.sold && 'opacity-60')}>
                    <div className="relative aspect-square">
                      <ListingVisual l={l} />
                      {l.sold && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-extrabold text-white">Vendido</span>}
                      {l.sellerId === DEMO_USER_ID && !l.sold && <span className="absolute left-2 top-2 rounded-full bg-teal px-2 py-0.5 text-[11px] font-extrabold text-ink">O seu</span>}
                    </div>
                    <div className="p-3">
                      <p className="tnum text-[17px] font-extrabold text-ink">{formatEur(l.priceEur)}</p>
                      <p className="line-clamp-2 min-h-[2.5em] text-[13px] font-bold leading-tight text-ink">{l.title}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Tag>{CONDITIONS[l.condition]}</Tag>
                      </div>
                      <p className="mt-1.5 truncate text-[11.5px] text-muted">
                        {regionName(l.region)} · {relativeDay(l.date, state.anchor)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
