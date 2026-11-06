import { ChevronLeft, Loader2, Search, TriangleAlert, X } from 'lucide-react'
import type { FeatureCollection } from 'geojson'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AtlasControls } from '../components/atlas/AtlasControls'
import { AtlasDetails } from '../components/atlas/AtlasDetails'
import { AtlasFilters } from '../components/atlas/AtlasFilters'
import { AtlasMap, type AtlasMapHandle, type AtlasPick, type AtlasSelection, type AtlasStatus, type ViewInfo } from '../components/atlas/AtlasMap'
import { AtlasIntro, Chooser, RegistryError, ResultList, SearchResults } from '../components/atlas/AtlasResults'
import { BottomSheet, sheetHeight, useMediaQuery, type SheetSnap } from '../components/atlas/BottomSheet'
import { SourcesDialog } from '../components/atlas/SourcesDialog'
import { cx } from '../components/ui'
import catalogWater from '../data/map/catalogWater.json'
import { DAMS } from '../data/dams'
import type { CountryId } from '../data/types'
import { ATLAS_CONFIG } from '../lib/atlas/config'
import type { AtlasFeature, AtlasType } from '../lib/atlas/model'
import { atlasIdForCatalog, linkByCatalog, registryIdForStructure, useRegistry, ZONE_WATER } from '../lib/atlas/registry'
import { itemsInView, matchesFilters, searchAtlas } from '../lib/atlas/search'
import { cameraParam, parseAtlasUrl, patchParams } from '../lib/atlas/urlState'
import { readJSON, writeJSON } from '../lib/storage'
import { useApp } from '../state/AppState'

const CATALOG_LABEL = catalogWater as unknown as Record<string, { waterId: string; label: [number, number] }>
const HINT_KEY = 'catchatlas-atlas-hint'
const PEEK = 104

/** Tipo de seleção a partir do ID (antes de o registo estar carregado). */
function inferKind(id: string): AtlasSelection['kind'] {
  if (id.startsWith('ne-rio-')) return 'river'
  if (id.startsWith('ficha-')) return 'catalog'
  if (id.endsWith('-estrutura')) return 'structure'
  return 'unknown'
}
function kindOf(f: AtlasFeature): AtlasSelection['kind'] {
  if (f.type === 'rio') return 'river'
  if (f.type === 'barragem' || f.type === 'acude') return 'structure'
  return f.approximate ? 'catalog' : 'water'
}

/**
 * Atlas Ibérico: a exploração principal de "Prepara a tua jornada".
 * Península com volume → região/bacia → massa de água → ficha → preparar jornada ou registar captura.
 * O estado (seleção, filtros, câmara, modo) vive no URL; a lista e a pesquisa partilham a mesma seleção do mapa.
 */
export default function Atlas() {
  const [params, setParams] = useSearchParams()
  const url = useMemo(() => parseAtlasUrl(params), [params])
  // Escritas no URL: acumulam sobre o último estado conhecido (não sobre o do render em que um
  // temporizador ou evento do mapa foi criado), para alterações seguidas não se apagarem umas às outras.
  const paramsRef = useRef(params)
  useEffect(() => {
    paramsRef.current = params
  }, [params])
  const updateUrl = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = patchParams(paramsRef.current, patch)
      paramsRef.current = next
      setParams(next, { replace: true, preventScrollReset: true })
    },
    [setParams],
  )
  const { state, toggleFavorite, toggleFavoriteWater } = useApp()
  const desktop = useMediaQuery('(min-width: 900px)')
  const mapHandle = useRef<AtlasMapHandle>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<AtlasStatus>({ map: 'loading', dem: ATLAS_CONFIG.dem.enabled ? 'loading' : 'off', basemap: 'ok', water: 'ok', detailLoading: false })
  const [view, setView] = useState<ViewInfo | null>(null)
  const [pick, setPick] = useState<AtlasPick | null>(null)
  const [chooser, setChooser] = useState<AtlasPick[] | null>(null)
  const [query, setQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [listOpen, setListOpen] = useState(url.list)
  const [sheet, setSheet] = useState<SheetSnap>(url.list || url.sel ? 'half' : 'peek')
  const [panelOpen, setPanelOpen] = useState(true)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [hint, setHint] = useState(() => !readJSON<boolean>(HINT_KEY) && !url.sel && !url.camera)
  const [locating, setLocating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [mapKey, setMapKey] = useState(0)
  const [initialCamera] = useState(() => url.camera ?? undefined)

  // ---------- entradas a partir de outras páginas (?ficha=, ?agua=) ----------
  // Elemento a enquadrar quando o registo chegar (seleção vinda do URL, sem câmara guardada).
  const [pendingFrame, setPendingFrame] = useState<string | null>(() => {
    const ficha = params.get('ficha')
    const agua = params.get('agua')
    if (ficha) return atlasIdForCatalog(ficha)
    if (agua) return agua
    return url.sel && !url.camera ? url.sel : null
  })
  useEffect(() => {
    if (params.get('ficha') || params.get('agua')) updateUrl({ ficha: null, agua: null, sel: pendingFrame })
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtersActive = url.favOnly || url.countries.length > 0 || url.types.length > 0
  const needRegistry = !!url.sel || searchActive || query.trim().length >= 2 || listOpen || filtersActive || !!pendingFrame || status.map === 'webgl-error'
  const { reg, error: regError, retry } = useRegistry(needRegistry)

  // ---------- favoritas ----------
  const favAtlasIds = useMemo(() => new Set([...state.favorites.map(atlasIdForCatalog), ...state.favoriteWaters]), [state.favorites, state.favoriteWaters])
  const favoriteMapIds = useMemo(() => [...favAtlasIds].filter((id) => !id.startsWith('ficha-')), [favAtlasIds])

  // ---------- seleção ----------
  const selection: AtlasSelection | null = useMemo(() => {
    if (!url.sel) return pick && (pick.kind === 'basemap-water' || pick.kind === 'basemap-river') ? { id: pick.mapId, kind: 'basemap', mapId: pick.mapId } : null
    const f = reg?.byId.get(url.sel)
    const kind = f ? kindOf(f) : inferKind(url.sel)
    return { id: url.sel, kind, mapId: kind === 'structure' ? url.sel.replace(/-estrutura$/, '') : url.sel, ...(url.section ? { sectionId: url.section } : {}) }
  }, [url.sel, url.section, reg, pick])
  const feature = url.sel ? reg?.byId.get(url.sel) ?? null : null

  const frameFeature = useCallback((f: AtlasFeature, section?: string | null) => {
    const sct = section ? f.sections?.find((s) => s.id === section) : undefined
    mapHandle.current?.frame({
      bbox: sct?.bbox ?? f.bbox,
      kind: f.type === 'rio' ? 'river' : f.type === 'barragem' || f.type === 'acude' ? 'structure' : f.approximate ? 'point' : 'water',
      tier: f.tier,
    })
  }, [])

  const select = useCallback(
    (id: string | null, opts: { section?: string | null; frame?: AtlasFeature } = {}) => {
      setChooser(null)
      if (!id) setPick(null)
      updateUrl({ sel: id, troco: opts.section ?? null })
      if (opts.frame) frameFeature(opts.frame, opts.section)
      if (id && !desktop) setSheet((s) => (s === 'peek' ? 'half' : s))
    },
    [updateUrl, frameFeature, desktop],
  )

  // Enquadra a seleção pedida pelo URL quando o registo chega (sem câmara guardada).
  useEffect(() => {
    if (!reg || !pendingFrame) return
    const f = reg.byId.get(pendingFrame)
    // Sincroniza com um sistema externo (câmara do mapa) depois de o registo chegar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingFrame(null)
    if (f) frameFeature(f, url.section)
  }, [reg, pendingFrame, frameFeature, url.section])
  // Estrutura cujo ID coincide com a albufeira: corrige para o ID do registo.
  useEffect(() => {
    if (!reg || !url.sel || reg.byId.has(url.sel)) return
    const fixed = registryIdForStructure(reg, url.sel)
    if (fixed !== url.sel) updateUrl({ sel: fixed })
  }, [reg, url.sel, updateUrl])

  const choosePick = (p: AtlasPick) => {
    setChooser(null)
    setPick(p)
    if (p.kind === 'basemap-water' || p.kind === 'basemap-river') {
      updateUrl({ sel: null, troco: null })
      if (!desktop) setSheet((s) => (s === 'peek' ? 'half' : s))
      return
    }
    select(p.kind === 'structure' ? registryIdForStructure(reg, p.mapId) : p.mapId, { section: p.sectionId ?? null })
  }
  const onPick = (picks: AtlasPick[]) => {
    setHint(false)
    if (!picks.length) {
      if (url.sel || pick) select(null)
      setChooser(null)
      return
    }
    if (picks.length === 1) return choosePick(picks[0])
    setChooser(picks)
    if (!desktop) setSheet((s) => (s === 'peek' ? 'half' : s))
  }
  const selectItem = (it: AtlasFeature) => {
    setPick(null)
    setSearchActive(false)
    // Rio longo: enquadra o troço mais próximo da vista atual (os outros ficam na ficha), não a extensão total.
    if (it.type === 'rio' && it.sections && it.sections.length > 3) {
      const c = mapHandle.current?.getView()?.center ?? it.point
      const d = (b: number[]) => ((b[0] + b[2]) / 2 - c[0]) ** 2 + ((b[1] + b[3]) / 2 - c[1]) ** 2
      const near = it.sections.reduce((a, b) => (d(b.bbox) < d(a.bbox) ? b : a))
      return select(it.id, { frame: it, section: near.id })
    }
    select(it.id, { frame: it, section: null })
  }

  // ---------- câmara no URL (partilhável; restaura a vista ao voltar de uma ficha) ----------
  const viewTimer = useRef<number | undefined>(undefined)
  const onView = (v: ViewInfo) => {
    setView(v)
    window.clearTimeout(viewTimer.current)
    viewTimer.current = window.setTimeout(() => updateUrl({ v: cameraParam(v) }), 450)
  }
  useEffect(() => () => window.clearTimeout(viewTimer.current), [])

  // ---------- estado do mapa e recuperação ----------
  const demFailedOnce = useRef(false)
  const onStatus = (s: AtlasStatus) => {
    setStatus(s)
    if (s.dem === 'failed' && !demFailedOnce.current) {
      demFailedOnce.current = true
      setNotice('Relevo indisponível de momento: o Atlas continua em 2D com a cartografia completa.')
      if (url.mode === '3d') updateUrl({ modo: '2d' })
    }
  }

  // ---------- filtros ----------
  const filters = useMemo(() => ({ countries: url.countries, types: url.types, favOnly: url.favOnly }), [url.countries, url.types, url.favOnly])
  const searchFilters = useMemo(() => ({ countries: url.countries, types: url.types, favorites: url.favOnly ? favAtlasIds : null }), [url.countries, url.types, url.favOnly, favAtlasIds])
  const setCountry = (c: CountryId | null) => updateUrl({ pais: c })
  const toggleType = (t: AtlasType) => {
    const next = url.types.includes(t) ? url.types.filter((x) => x !== t) : [...url.types, t]
    updateUrl({ tipo: next.join(',') || null })
  }
  const toggleFav = () => updateUrl({ fav: url.favOnly ? null : '1' })

  // ---------- dados de apresentação ----------
  const catalogFC: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: DAMS.map((d) => {
        const link = linkByCatalog.get(d.id)
        const w = CATALOG_LABEL[d.id]
        return {
          type: 'Feature' as const,
          properties: { id: atlasIdForCatalog(d.id), catalog: d.id, water: link?.atlasId ?? '', name: d.name, country: d.country, fav: state.favorites.includes(d.id) },
          geometry: { type: 'Point' as const, coordinates: w ? w.label : [d.approx.lon, d.approx.lat] },
        }
      }),
    }),
    [state.favorites],
  )
  const zonesFC: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: Object.entries(ZONE_WATER).flatMap(([zid, ws]) => ws.map((w) => ({ type: 'Feature' as const, properties: { zone: zid, water: w.waterId }, geometry: { type: 'Point' as const, coordinates: w.label } }))),
    }),
    [],
  )

  const hits = useMemo(() => (reg && query.trim().length >= 2 ? searchAtlas(reg.items, query, searchFilters) : []), [reg, query, searchFilters])
  const inView = useMemo(() => {
    if (!reg) return []
    // Favoritas: são poucas, por isso a lista mostra-as todas (mesmo as que ainda não estão desenhadas neste zoom).
    if (url.favOnly) return reg.items.filter((it) => matchesFilters(it, searchFilters)).sort((a, b) => (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0))
    if (status.map === 'webgl-error' || !view) return reg.items.filter((it) => it.peninsular && (it.name || it.catalogId) && matchesFilters(it, searchFilters)).sort((a, b) => (b.catalogId ? 1 : 0) - (a.catalogId ? 1 : 0) || (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0))
    return itemsInView(reg.items, view.bounds, view.zoom - view.fit, searchFilters, favAtlasIds)
  }, [reg, view, searchFilters, favAtlasIds, status.map, url.favOnly])

  // ---------- ações ----------
  const isFavorite = feature?.catalogId ? state.favorites.includes(feature.catalogId) : selection ? state.favoriteWaters.includes(selection.id) : false
  const onFavorite =
    selection && selection.kind !== 'basemap'
      ? () => {
          const cid = feature?.catalogId ?? (pick?.props.catalog ? String(pick.props.catalog) : undefined)
          if (cid) toggleFavorite(cid)
          else toggleFavoriteWater(selection.id)
        }
      : null
  const locate = () => {
    if (!('geolocation' in navigator)) return setNotice('Este navegador não disponibiliza a localização.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false)
        mapHandle.current?.showMe({ lng: p.coords.longitude, lat: p.coords.latitude })
      },
      (e) => {
        setLocating(false)
        setNotice(e.code === 1 ? 'Localização recusada. Pode continuar a explorar pelo mapa, pela pesquisa ou pela lista.' : 'Não foi possível obter a localização.')
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 },
    )
  }
  const dismissHint = () => {
    setHint(false)
    writeJSON(HINT_KEY, true)
  }
  const openList = () => {
    setListOpen(true)
    setSearchActive(false)
    setChooser(null)
    if (desktop) setPanelOpen(true)
    else setSheet('half')
  }
  const closeDetails = () => select(null)

  // Escape fecha o seletor, a ficha ou a pesquisa.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || sourcesOpen) return
      if (chooser) setChooser(null)
      else if (url.sel || pick) select(null)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [chooser, url.sel, pick, select, sourcesOpen])

  // ---------- conteúdo do painel (lateral ou inferior) ----------
  const showingSearch = query.trim().length >= 2
  const hasSelection = !!(url.sel || (pick && selection?.kind === 'basemap'))
  let body: ReactNode
  if (chooser) body = <Chooser picks={chooser} onChoose={choosePick} onCancel={() => setChooser(null)} />
  else if (hasSelection)
    body = (
      <AtlasDetails
        key={selection?.id}
        feature={feature}
        pick={pick && (pick.mapId === selection?.mapId || pick.mapId === selection?.id) ? pick : null}
        sectionId={url.section ?? undefined}
        sources={reg?.sources ?? null}
        isFavorite={isFavorite}
        onFavorite={onFavorite}
        onClose={closeDetails}
        onSection={(sid) => feature && select(feature.id, { section: sid, frame: feature })}
        onRelated={(rid) => {
          setPick(null)
          const f = reg?.byId.get(rid)
          select(rid, f ? { frame: f } : {})
        }}
        onFrame={() => feature && frameFeature(feature, url.section)}
        loadingRegistry={!reg && !regError}
      />
    )
  else if (showingSearch)
    body = <SearchResults hits={hits} query={query} loading={!reg && !regError} error={regError} onRetry={retry} selectedId={url.sel} favorites={favAtlasIds} onSelect={selectItem} />
  else if (listOpen || filtersActive || status.map === 'webgl-error')
    body = regError ? (
      <RegistryError onRetry={retry} />
    ) : !reg ? (
      <p className="flex items-center gap-2 py-4 text-[13px] text-[#b5c5cc]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar a lista…
      </p>
    ) : (
      <>
        <p className="mb-2 text-[12px] font-semibold text-[#b5c5cc]" aria-live="polite">
          {url.favOnly ? `${inView.length} ${inView.length === 1 ? 'favorita' : 'favoritas'}` : status.map === 'webgl-error' ? `${inView.length} águas com nome ou ficha` : `${inView.length} ${inView.length === 1 ? 'elemento' : 'elementos'} nesta vista`}
          {filtersActive ? ' · com filtros' : ''}
        </p>
        <ResultList
          items={inView}
          selectedId={url.sel}
          favorites={favAtlasIds}
          label={status.map === 'webgl-error' ? 'Águas do Atlas' : 'Águas nesta vista do mapa'}
          onSelect={selectItem}
          empty={<p className="rounded-2xl border border-white/10 p-4 text-[13px] text-[#b5c5cc]">{url.favOnly ? 'Sem favoritas nesta vista. Afaste o mapa ou retire o filtro.' : 'Nada desenhado nesta vista com estes filtros. Aproxime ou afaste o mapa.'}</p>}
        />
      </>
    )
  else body = <AtlasIntro onList={openList} onFocusSearch={() => searchRef.current?.focus()} />

  const searchBox = (
    <div className="relative" role="search">
      <input
        ref={searchRef}
        type="search"
        value={query}
        onFocus={() => {
          setSearchActive(true)
          dismissHint()
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setChooser(null)
          if (e.target.value.trim().length >= 2) {
            if (url.sel || pick) select(null)
            if (!desktop) setSheet((s) => (s === 'peek' ? 'half' : s))
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) {
            selectItem(hits[0].item)
            searchRef.current?.blur()
          }
          if (e.key === 'Escape') setQuery('')
        }}
        placeholder="Pesquisar barragem, lagoa ou rio"
        aria-label="Pesquisar barragem, lagoa ou rio"
        enterKeyHint="search"
        className="h-12 w-full rounded-full border border-white/12 bg-[#0a2230]/92 pl-11 pr-11 text-[15px] text-[#f4f7f8] shadow-[0_8px_24px_-10px_rgb(0_0_0/0.7)] outline-none backdrop-blur-md placeholder:text-[#b5c5cc]/80 focus:border-[#83e5ef]/70 focus:ring-4 focus:ring-[#83e5ef]/15"
        data-no-swipe
      />
      <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#b5c5cc]" aria-hidden />
      {query && (
        <button type="button" onClick={() => setQuery('')} aria-label="Limpar pesquisa" className="press absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-[#b5c5cc] hover:bg-white/10">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
  const filtersBar = <AtlasFilters countries={url.countries} types={url.types} favOnly={url.favOnly} onCountry={setCountry} onType={toggleType} onFav={toggleFav} className={desktop ? 'flex-wrap overflow-visible' : undefined} />

  const sheetTitle = chooser ? 'Escolher elemento' : hasSelection ? (feature?.name || pick?.name || 'Elemento selecionado') : showingSearch ? `${hits.length} resultados` : listOpen ? `${inView.length} nesta vista` : 'Explorar águas'
  // No telemóvel, com o painel a meio, o centro do mapa sobe para a seleção não ficar tapada.
  const padding = desktop ? { top: 84, right: 76, bottom: 16, left: panelOpen ? 432 : 16 } : { top: 196, right: 60, bottom: sheet === 'half' ? sheetHeight('half', window.innerHeight, PEEK) : PEEK, left: 0 }
  const webglFailed = status.map === 'webgl-error'

  return (
    <div
      className="atlas-root fixed inset-0 overflow-hidden bg-[#071923] text-[#f4f7f8]"
      // A atribuição e a escala do mapa ficam sempre acima do painel inferior (nunca escondidas).
      style={{ height: '100dvh', ['--atlas-bottom' as string]: desktop ? '0px' : `${sheet === 'peek' ? PEEK : sheetHeight('half', window.innerHeight, PEEK)}px` }} data-atlas-status={status.map} data-atlas-sel={url.sel ?? ''}>
      {!webglFailed && (
        <AtlasMap
          key={mapKey}
          handle={mapHandle}
          mode={url.mode}
          initialCamera={initialCamera}
          selection={selection}
          favoriteIds={favoriteMapIds}
          filters={filters}
          catalog={catalogFC}
          zones={zonesFC}
          padding={padding}
          attribution={desktop ? 'bottom-right' : 'bottom-left'}
          onPick={onPick}
          onView={onView}
          onStatus={onStatus}
          onInteract={dismissHint}
          className="absolute inset-0"
        />
      )}
      {/* Vinheta: profundidade sem efeitos pesados. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_45%,transparent_55%,rgb(7_25_35/0.55)_100%)]" aria-hidden />

      {/* Cabeçalho: voltar e mudança de percurso em controlos explícitos, fora da área do mapa. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-[#071923]/90 via-[#071923]/55 to-transparent px-3 pb-8 pt-[calc(env(safe-area-inset-top)+10px)] sm:px-4">
        <div className="flex items-center gap-2">
          <Link to="/?ver=jornada" aria-label="Voltar a Prepara a tua jornada" className="press pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/15">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#83e5ef]">
              <span className="hidden sm:inline">01 · </span>Prepara a tua jornada
            </p>
            <h1 className="font-display truncate text-[21px] font-semibold leading-tight sm:text-[24px]">Atlas Ibérico</h1>
          </div>
          <nav aria-label="Percursos" className="pointer-events-auto flex shrink-0 rounded-full border border-white/10 bg-[#0a2230]/85 p-1 backdrop-blur-md">
            <span aria-current="page" className="inline-flex h-9 items-center rounded-full bg-[#f4f7f8] px-3 text-[12.5px] font-extrabold text-[#071923]">
              <span className="sm:hidden">Jornada</span>
              <span className="hidden sm:inline">Prepara a tua jornada</span>
            </span>
            <Link to="/?ver=historia" className="press inline-flex h-9 items-center rounded-full px-3 text-[12.5px] font-bold text-[#b5c5cc] hover:bg-white/10" aria-label="Mudar para Gera a tua história">
              <span className="sm:hidden">História</span>
              <span className="hidden sm:inline">Gera a tua história</span>
            </Link>
          </nav>
        </div>
        {!desktop && (
          <div className="pointer-events-auto mt-3 grid gap-2">
            {searchBox}
            {filtersBar}
          </div>
        )}
      </header>

      {/* Avisos (sem bloquear o mapa). */}
      <div className={cx('pointer-events-none absolute inset-x-3 z-20 flex flex-col items-center gap-1.5', desktop ? 'top-[86px] pl-[420px] pr-[64px]' : 'bottom-[164px] pr-[56px]')} aria-live="polite">
        {notice && (
          <p className="pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-2 text-[12.5px] font-semibold text-amber-900 shadow-lg" role="status">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="press -m-1 grid h-8 w-8 place-items-center rounded-full hover:bg-amber-100">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </p>
        )}
        {status.basemap === 'failed' && !webglFailed && (
          <p className="rounded-full bg-[#0a2230]/90 px-3 py-1 text-[11.5px] font-semibold text-[#b5c5cc] backdrop-blur">Mapa base detalhado indisponível · base simplificada Natural Earth</p>
        )}
        {status.water === 'failed' && (
          <p className="pointer-events-auto rounded-2xl bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-900" role="alert">
            Não foi possível carregar parte das albufeiras. Mova o mapa para tentar de novo.
          </p>
        )}
        {status.detailLoading && (
          <p className="flex items-center gap-1.5 rounded-full bg-[#0a2230]/90 px-3 py-1 text-[11.5px] font-bold text-[#b5c5cc]">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> A carregar detalhe…
          </p>
        )}
      </div>

      {!webglFailed && (
        <div className={cx('pointer-events-none absolute right-3 z-20 sm:right-4', desktop ? 'top-[92px]' : 'top-[188px]')}>
          <AtlasControls
            mode={url.mode}
            bearing={view?.bearing ?? 0}
            pitch={view?.pitch ?? 0}
            locating={locating}
            compact={!desktop}
            onZoom={(d) => mapHandle.current?.zoomBy(d)}
            onNorth={() => mapHandle.current?.north()}
            onRotate={(d) => mapHandle.current?.rotateBy(d)}
            onTilt={(d) => mapHandle.current?.tiltBy(d)}
            onMode={(m) => updateUrl({ modo: m === '2d' ? '2d' : null })}
            onPeninsula={() => mapHandle.current?.peninsula()}
            onLocate={locate}
            onList={openList}
            onSources={() => setSourcesOpen(true)}
          />
        </div>
      )}

      {hint && !webglFailed && status.map === 'ready' && (
        <div className={cx('pointer-events-none absolute inset-x-0 z-20 flex justify-center', desktop ? 'bottom-8 pl-[420px]' : 'bottom-[120px]')}>
          <p className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#0a2230]/90 py-1.5 pl-4 pr-1.5 text-[13px] font-semibold text-[#f4f7f8] shadow-lg backdrop-blur-md">
            Aproxima para descobrir águas
            <button type="button" onClick={dismissHint} aria-label="Dispensar dica" className="press grid h-8 w-8 place-items-center rounded-full hover:bg-white/10">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </p>
        </div>
      )}

      {status.map === 'context-lost' && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#071923]/80 p-6 text-center" role="alert">
          <div>
            <p className="text-[15px] font-bold">O mapa perdeu o contexto gráfico (WebGL).</p>
            <p className="mt-1 text-[13px] text-[#b5c5cc]">A pesquisa e a lista continuam disponíveis.</p>
            <button type="button" onClick={() => setMapKey((k) => k + 1)} className="press mt-3 h-11 rounded-full bg-[#38c9d5] px-5 text-[14px] font-extrabold text-[#071923]">
              Recarregar mapa
            </button>
          </div>
        </div>
      )}

      {webglFailed && (
        <div className={cx('absolute inset-x-0 z-10 px-4', desktop ? 'top-[96px] pl-[452px]' : 'top-[176px]')} role="note">
          <div className="max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[14px] font-bold">O mapa 3D precisa de WebGL, que não está disponível neste navegador ou dispositivo.</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#b5c5cc]">Pode pesquisar, filtrar e abrir as fichas pela lista. As fontes e a cobertura estão no botão Fontes.</p>
            <button type="button" onClick={() => setSourcesOpen(true)} className="press mt-2 h-10 rounded-full bg-white/10 px-4 text-[13px] font-bold hover:bg-white/15">
              Fontes e cobertura
            </button>
          </div>
        </div>
      )}

      {desktop ? (
        panelOpen ? (
          <aside className="absolute bottom-4 left-4 top-[84px] z-30 flex w-[400px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a2230]/94 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl" aria-label="Painel do Atlas" data-no-swipe>
            <div className="shrink-0 space-y-2.5 border-b border-white/10 p-3">
              {searchBox}
              {filtersBar}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{body}</div>
            <button type="button" onClick={() => setPanelOpen(false)} className="press shrink-0 border-t border-white/10 py-2.5 text-[12.5px] font-bold text-[#b5c5cc] hover:bg-white/5">
              Esconder painel
            </button>
          </aside>
        ) : (
          <button type="button" onClick={() => setPanelOpen(true)} className="press absolute left-4 top-[84px] z-30 h-11 rounded-full border border-white/10 bg-[#0a2230]/92 px-4 text-[13px] font-bold shadow-lg backdrop-blur" data-no-swipe>
            Mostrar painel
          </button>
        )
      ) : (
        <BottomSheet
          snap={sheet}
          onSnap={setSheet}
          peek={PEEK}
          label="Painel do Atlas"
          header={
            <div className="flex items-center justify-between gap-3 px-4 pb-2">
              <p className="min-w-0 truncate text-[15px] font-bold">{sheetTitle}</p>
              {!hasSelection && !chooser && !showingSearch && !listOpen && (
                <button type="button" onClick={openList} className="press h-10 shrink-0 rounded-full bg-white/10 px-4 text-[13px] font-bold hover:bg-white/15">
                  Lista
                </button>
              )}
            </div>
          }
        >
          {body}
        </BottomSheet>
      )}

      <SourcesDialog open={sourcesOpen} onClose={() => setSourcesOpen(false)} sources={reg?.sources ?? null} />
    </div>
  )
}
