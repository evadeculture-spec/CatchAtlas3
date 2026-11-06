import { Heart, List, Map as MapIcon, Search, SlidersHorizontal, X, MapPin, ArrowRight, Crosshair } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DamCard, FavButton, SkyIcon } from '../components/cards'
import { DamCover } from '../components/photo/DamCover'
import type { MapView } from '../components/map/IberiaMap'
import catalogWater from '../data/map/catalogWater.json'
import { ExploreTabs } from '../components/ExploreTabs'
import { ButtonLink, Chip, cx, EmptyState, Segmented, Tag } from '../components/ui'
import { damRegion, MODALITIES, SPECIES, speciesById } from '../data/catalog'
import { DAMS, damById } from '../data/dams'
import { ZONE_KIND, ZONES } from '../data/zones'
import type { CountryId, ModalityId, SpeciesId } from '../data/types'
import { simulateConditions } from '../lib/weather'
import { useApp } from '../state/AppState'

// O mapa real (MapLibre) só é descarregado quando é mostrado.
const IberiaMap = lazy(() => import('../components/map/IberiaMap'))
const WATER = catalogWater as unknown as Record<string, { areaKm2: number; name: string }>

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Explore() {
  const { state, allCatches } = useApp()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const species = (params.get('especie') as SpeciesId | null) ?? null
  const modality = (params.get('modalidade') as ModalityId | null) ?? null
  const favOnly = params.get('favoritas') === '1'
  const country = (params.get('pais') as CountryId | null) ?? null
  const view = params.get('vista') === 'mapa' ? 'mapa' : 'lista'
  const selected = params.get('sel') ?? undefined

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v === null || v === '') next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }

  const results = useMemo(
    () =>
      DAMS.filter((d) => {
        if (q && !norm(`${d.name} ${damRegion(d)} ${d.place} ${d.river}`).includes(norm(q))) return false
        if (species && !d.species.includes(species)) return false
        if (modality && !d.modalities.includes(modality)) return false
        if (favOnly && !state.favorites.includes(d.id)) return false
        if (country && d.country !== country) return false
        return true
      }),
    [q, species, modality, favOnly, country, state.favorites],
  )
  const activeFilters = [species, modality, favOnly ? '1' : null, country, q].filter(Boolean).length
  const mapView: MapView = (params.get('mapa') as MapView | null) ?? 'iberia'
  const sel = selected && results.some((r) => r.id === selected) ? damById[selected] : undefined
  const [focus, setFocus] = useState<{ damId: string; n: number } | undefined>()
  const showOnMap = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('sel', id)
    next.set('vista', 'mapa')
    setParams(next, { replace: true })
    setFocus((f) => ({ damId: id, n: (f?.n ?? 0) + 1 }))
  }
  // Seleção feita no mapa: o cartão correspondente fica visível na lista (computador).
  useEffect(() => {
    if (!sel) return
    document.getElementById(`dam-row-${sel.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [sel])
  const count = (id: string) => allCatches.filter((c) => c.damId === id && c.visibility === 'publica').length

  const list = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
      {results.map((d) => (
        <div key={d.id} id={`dam-row-${d.id}`} className={cx('relative rounded-[var(--radius-card)] transition-shadow', sel?.id === d.id && 'ring-2 ring-teal ring-offset-2 ring-offset-canvas')} data-selected={sel?.id === d.id || undefined}>
          <DamCard dam={d} layout="row" cond={simulateConditions(d, state.anchor)} catchCount={count(d.id)} />
          <button
            type="button"
            onClick={() => showOnMap(d.id)}
            className="press absolute bottom-2.5 right-2.5 inline-flex h-8 items-center gap-1 rounded-full bg-mist px-2.5 text-[12px] font-bold text-ink hover:bg-teal-50 hover:text-teal-700"
            aria-label={`Ver ${d.name} no mapa`}
          >
            <Crosshair className="h-3.5 w-3.5" aria-hidden /> Mapa
          </button>
        </div>
      ))}
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8">
      <header className="pt-safe pt-5 lg:pt-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Explorar</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="font-display text-[30px] font-semibold leading-tight text-ink sm:text-[36px]">Barragens</h1>
          <Segmented
            label="Vista"
            value={view}
            onChange={(v) => set('vista', v === 'mapa' ? 'mapa' : null)}
            options={[
              { id: 'lista', label: 'Lista', icon: List },
              { id: 'mapa', label: 'Mapa', icon: MapIcon },
            ]}
            className="lg:hidden"
          />
        </div>
        <div className="mt-4">
          <ExploreTabs />
        </div>
        <Link to={`/atlas${favOnly ? '?fav=1' : country ? `?pais=${country}` : ''}`} className="press mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13.5px] font-bold text-white hover:bg-ink-2">
          <MapIcon className="h-4 w-4 text-teal" aria-hidden /> Abrir no Atlas Ibérico 3D
        </Link>
      </header>

      <div className="sticky top-0 z-20 -mx-4 mt-3 bg-canvas/90 px-4 pb-3 pt-2 backdrop-blur-xl lg:-mx-8 lg:px-8">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Nome, região ou rio"
            aria-label="Procurar por nome, região ou rio"
            className="h-12 w-full rounded-full border border-line bg-white pl-11 pr-11 text-[15px] shadow-card outline-none placeholder:text-subtle focus:border-teal focus:ring-4 focus:ring-teal/15"
          />
          {q && (
            <button onClick={() => set('q', null)} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Limpar pesquisa">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 lg:-mx-8 lg:px-8">
          <Chip active={favOnly} icon={Heart} onClick={() => set('favoritas', favOnly ? null : '1')}>
            Favoritas
          </Chip>
          <span className="my-2 w-px shrink-0 bg-line" aria-hidden />
          <Chip active={country === 'PT'} onClick={() => set('pais', country === 'PT' ? null : 'PT')}>
            Portugal
          </Chip>
          <Chip active={country === 'ES'} onClick={() => set('pais', country === 'ES' ? null : 'ES')}>
            Espanha
          </Chip>
          <span className="my-2 w-px shrink-0 bg-line" aria-hidden />
          {SPECIES.map((s) => (
            <Chip key={s.id} active={species === s.id} onClick={() => set('especie', species === s.id ? null : s.id)}>
              {s.name}
            </Chip>
          ))}
          <span className="my-2 w-px shrink-0 bg-line" aria-hidden />
          {MODALITIES.map((m) => (
            <Chip key={m.id} active={modality === m.id} onClick={() => set('modalidade', modality === m.id ? null : m.id)}>
              {m.name}
            </Chip>
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[12.5px] font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            {results.length} {results.length === 1 ? 'barragem' : 'barragens'}
          </span>
          {activeFilters > 0 && (
            <button onClick={() => setParams(view === 'mapa' ? { vista: 'mapa' } : {}, { replace: true })} className="rounded-full px-2 py-1 font-bold text-teal-700 hover:bg-teal-50">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma barragem encontrada"
          text="Experimente outro nome ou retire alguns filtros. Experimente outro nome, rio ou região."
          action={<ButtonLink to="/explorar" variant="dark" size="sm">Ver todas</ButtonLink>}
        />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-6">
          <div className={cx(view === 'mapa' && 'hidden lg:block')}>{list}</div>
          <div className={cx(view === 'lista' && 'hidden lg:block')}>
            <div className="lg:sticky lg:top-[150px]">
              <Suspense fallback={<div className="grid h-[min(78dvh,680px)] place-items-center rounded-[var(--radius-card)] bg-[#cfe2ea] text-[13px] font-bold text-muted lg:h-[calc(100dvh-190px)]">A carregar o mapa…</div>}>
                <IberiaMap
                  dams={results}
                  selectedDamId={sel?.id}
                  focus={focus}
                  focusWaterId={params.get('agua') ?? undefined}
                  onSelectDam={(id) => set('sel', id)}
                  view={mapView}
                  onView={(v) => set('mapa', v === 'iberia' ? null : v)}
                  className="h-[min(78dvh,680px)] lg:h-[calc(100dvh-190px)] lg:min-h-[480px]"
                />
              </Suspense>
              {sel && <MapCard id={sel.id} />}
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                O zoom decide que albufeiras se veem; os filtros decidem as barragens do catálogo. Contornos de referência do OpenStreetMap (Portugal e Espanha, albufeiras ≥ 5 ha): não indicam o nível atual da água.
              </p>
            </div>
          </div>
        </div>
      )}
      <p className="mt-6 text-[12px] leading-relaxed text-muted">
        Nomes, rios e localidades são informação geral. Espécies, características e condições são ilustrativas e não foram verificadas. Confirme sempre licenças e regras locais junto das entidades competentes.
      </p>
    </div>
  )
}

function MapCard({ id }: { id: string }) {
  const { state } = useApp()
  const d = damById[id]
  const c = simulateConditions(d, state.anchor)
  return (
    <div key={id} className="page-in relative z-10 mt-3 overflow-hidden rounded-[var(--radius-card)] bg-white shadow-lift lg:mx-0 lg:mt-3">
      <div className="flex gap-3 p-3">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl">
          <DamCover dam={d} variant="thumb" sizes="96px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-extrabold text-ink">{d.name}</h3>
              <p className="flex items-center gap-1 truncate text-[12.5px] text-muted">
                <MapPin className="h-3 w-3" aria-hidden />
                {d.place}
              </p>
              {WATER[d.id] && <p className="truncate text-[12px] text-muted">{WATER[d.id].name} · {WATER[d.id].areaKm2.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} km² (contorno OSM)</p>}
            </div>
            <FavButton dam={d} tone="light" />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Tag>
              <SkyIcon sky={c.sky} className="h-3 w-3" /> {c.airMax}° · {c.wind} km/h
            </Tag>
            {d.species.slice(0, 2).map((s) => (
              <Tag key={s} tone="teal">
                {speciesById[s].short}
              </Tag>
            ))}
            {d.detail === 'basica' && <Tag>Ficha básica</Tag>}
            {ZONES.filter((z) => z.damId === d.id).map((z) => (
              <Tag key={z.id} tone="amber">{ZONE_KIND[z.kind]}</Tag>
            ))}
          </div>
        </div>
      </div>
      <Link to={`/barragens/${d.id}`} className="press flex items-center justify-between border-t border-line px-4 py-3 text-[13.5px] font-bold text-teal-700 hover:bg-mist/60">
        Abrir ficha da barragem <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  )
}
