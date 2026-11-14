import { Clock, Layers, MapPin, MapPinPlus, Navigation, Radio, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Sheet } from '../../components/Dialog'
import { Button, ButtonLink, cx, inputCls, Toggle } from '../../components/ui'
import { PrivateMap, type Selection } from '../../components/lanca/PrivateMap'
import { ErrorBox, useLoad } from '../../components/lanca/primitives'
import { SignedImage } from '../../components/lanca/SignedImage'
import { listJourneys, listPings, listPins } from '../../lib/lanca/api'
import { formatCoords, parseCoords } from '../../lib/lanca/geo'
import { isSuccess, speciesSummary } from '../../lib/lanca/intelligence'
import { pinCategory, pingKind } from '../../lib/lanca/labels'
import { formatDateTime } from '../../lib/lanca/time'
import { fmt, weatherLabel } from '../../lib/lanca/units'
import { useAuth } from '../../state/Auth'
import { PingFilterBar } from './PingFilterBar'
import { applyFilter, DEFAULT_FILTER } from './pingFilters'

export default function MapScreen() {
  const nav = useNavigate()
  const { units } = useAuth()
  const { data, error, reload } = useLoad(async () => {
    const [pins, pings, journeys] = await Promise.all([listPins(), listPings({ limit: 3000 }), listJourneys()])
    return { pins, pings, journeys }
  }, [])
  const [showPins, setShowPins] = useState(true)
  const [showPings, setShowPings] = useState(true)
  const [archived, setArchived] = useState(false)
  const [f, setF] = useState(DEFAULT_FILTER)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sel, setSel] = useState<Selection>(null)
  const [q, setQ] = useState('')
  const [fly, setFly] = useState<{ lat: number; lng: number; zoom?: number; key: number } | null>(null)
  const [createAt, setCreateAt] = useState<{ lat: number; lng: number } | null>(null)

  const pins = useMemo(() => (data?.pins ?? []).filter((p) => archived || p.status === 'ativo'), [data, archived])
  const pings = useMemo(() => applyFilter(data?.pings ?? [], f).filter((p) => p.lat != null && p.lng != null), [data, f])
  const points = useMemo(() => pings.map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, kind: p.kind, occurred_at: p.occurred_at })), [pings])
  const species = useMemo(() => speciesSummary(data?.pings ?? []).map((s) => s.species), [data])
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return (data?.pins ?? []).filter((p) => [p.name, p.water_body_name, ...p.tags].some((v) => v?.toLowerCase().includes(t))).slice(0, 6)
  }, [q, data])
  const coords = parseCoords(q)
  const activeFilters = f.kinds.length + (f.species ? 1 : 0) + (f.modality ? 1 : 0) + (f.period !== 'tudo' ? 1 : 0)

  const selPin = sel?.type === 'pin' ? data?.pins.find((p) => p.id === sel.id) : null
  const selPing = sel?.type === 'ping' ? data?.pings.find((p) => p.id === sel.id) : null
  const pinPings = selPin ? (data?.pings ?? []).filter((p) => p.pin_id === selPin.id) : []
  const pinJourneys = selPin ? (data?.journeys ?? []).filter((j) => j.journey_pins.some((jp) => jp.pin_id === selPin.id)) : []

  return (
    <div className="relative h-[calc(100dvh-var(--nav-h)-env(safe-area-inset-bottom)-53px)] lg:h-[calc(100dvh-53px)]">
      <PrivateMap pins={showPins ? pins : []} pings={points} showPins={showPins} showPings={showPings} selected={sel} onSelect={setSel} onCreateAt={setCreateAt} flyTo={fly} className="absolute inset-0" label="Mapa privado de Pins e Pings" controlsClassName="right-3 top-[128px] sm:top-3" />

      {/* Pesquisa e camadas */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2 sm:right-auto sm:w-[380px]">
        <div className="pointer-events-auto relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar nos meus Pins ou escrever coordenadas" className={`${inputCls} pl-10 pr-10 shadow-lift`} aria-label="Procurar no mapa" />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted" aria-label="Limpar pesquisa">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
          {(results.length > 0 || coords) && (
            <ul className="absolute inset-x-0 top-[52px] overflow-hidden rounded-2xl bg-white shadow-lift">
              {coords && (
                <li>
                  <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left text-[14px] font-bold hover:bg-mist" onClick={() => (setFly({ ...coords, zoom: 14, key: Date.now() }), setQ(''))}>
                    <Navigation className="h-4 w-4" aria-hidden /> Ir para {formatCoords(coords.lat, coords.lng, 4)}
                  </button>
                </li>
              )}
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-mist" onClick={() => (setFly({ lat: p.lat, lng: p.lng, zoom: 15, key: Date.now() }), setSel({ type: 'pin', id: p.id }), setQ(''))}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: pinCategory(p.category).color }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{p.name}</span>
                    <span className="text-[12px] text-muted">{p.water_body_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button type="button" aria-pressed={showPins} onClick={() => setShowPins((v) => !v)} className={cx('press inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold shadow-card', showPins ? 'bg-ink text-white' : 'bg-white text-muted')}>
            <MapPin className="h-4 w-4" aria-hidden /> Pins {data ? `(${pins.length})` : ''}
          </button>
          <button type="button" aria-pressed={showPings} onClick={() => setShowPings((v) => !v)} className={cx('press inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold shadow-card', showPings ? 'bg-ink text-white' : 'bg-white text-muted')}>
            <Radio className="h-4 w-4" aria-hidden /> Pings {data ? `(${points.length})` : ''}
          </button>
          <button type="button" onClick={() => setFiltersOpen(true)} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-bold text-ink shadow-card">
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtros{activeFilters ? ` · ${activeFilters}` : ''}
          </button>
        </div>
        {error && (
          <div className="pointer-events-auto">
            <ErrorBox message={error} onRetry={reload} />
          </div>
        )}
      </div>

      <div className="absolute bottom-10 right-3 z-10 flex flex-col gap-2">
        <ButtonLink to="/conta/pings/novo" icon={Radio} className="shadow-lift">
          Novo Ping
        </ButtonLink>
      </div>
      <p className="pointer-events-none absolute bottom-10 left-3 z-10 hidden rounded-full bg-white/90 px-3 py-1 text-[11.5px] font-semibold text-muted shadow-card sm:block">Toque longo ou botão direito: criar aqui</p>

      {/* Seleção */}
      {(selPin || selPing) && (
        <div className="absolute inset-x-0 bottom-0 z-20 sm:bottom-6 sm:left-4 sm:right-auto sm:w-[380px]">
          <div className="sheet-in relative rounded-t-[28px] bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-lift sm:rounded-[28px] sm:pb-4">
            <button type="button" onClick={() => setSel(null)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full hover:bg-mist" aria-label="Fechar">
              <X className="h-4 w-4" aria-hidden />
            </button>
            {selPin && (
              <>
                <p className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: pinCategory(selPin.category).color }}>
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {pinCategory(selPin.category).label}
                </p>
                <h2 className="mt-1 pr-10 text-[18px] font-extrabold text-ink">{selPin.name}</h2>
                <p className="tnum text-[12.5px] text-muted">{formatCoords(selPin.lat, selPin.lng)}{selPin.water_body_name ? ` · ${selPin.water_body_name}` : ''}</p>
                <p className="mt-2 text-[13px] text-text">
                  {pinPings.length} pings · {pinPings.filter((p) => isSuccess(p)).length} com captura · {pinPings.reduce((s, p) => s + p.catches.length, 0)} capturas registadas · {pinJourneys.length} jornadas
                </p>
                {speciesSummary(pinPings).length > 0 && <p className="mt-1 text-[12.5px] text-muted">Espécies: {speciesSummary(pinPings).map((s) => s.species).join(', ')}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink to={`/conta/pins/${selPin.id}`} size="sm" variant="dark">
                    Abrir Pin
                  </ButtonLink>
                  <ButtonLink to={`/conta/pings/novo?pin=${selPin.id}`} size="sm" variant="outline" icon={Radio}>
                    Ping aqui
                  </ButtonLink>
                  <ButtonLink to={`/conta/jornadas/nova?pin=${selPin.id}`} size="sm" variant="outline">
                    Planear
                  </ButtonLink>
                </div>
              </>
            )}
            {selPing && (
              <Link to={`/conta/pings/${selPing.id}`} className="flex gap-3">
                {selPing.ping_media[0] && <SignedImage path={selPing.ping_media[0].thumb_path} fallbackPath={selPing.ping_media[0].display_path} alt="" className="h-20 w-20 shrink-0 rounded-2xl" />}
                <div className="min-w-0 pr-8">
                  <p className="text-[11.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: pingKind(selPing.kind).color }}>
                    {pingKind(selPing.kind).label}
                  </p>
                  <p className="mt-0.5 truncate text-[16px] font-extrabold text-ink">{selPing.catches[0]?.species ?? selPing.pin?.name ?? 'Ping'}</p>
                  <p className="flex items-center gap-1 text-[12.5px] text-muted">
                    <Clock className="h-3.5 w-3.5" aria-hidden /> {formatDateTime(selPing.occurred_at, selPing.occurred_tz)}
                  </p>
                  <p className="mt-1 text-[12.5px] text-text">
                    {selPing.ping_environment?.air_temp_c != null
                      ? `${fmt.temp(selPing.ping_environment.air_temp_c, units)} · ${weatherLabel(selPing.ping_environment.weather_code) ?? ''} · vento ${fmt.wind(selPing.ping_environment.wind_kmh, units) ?? '—'}`
                      : 'Condições indisponíveis'}
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros do mapa" footer={<Button className="w-full" onClick={() => setFiltersOpen(false)}>Ver {points.length} pings</Button>}>
        <div className="space-y-4">
          <PingFilterBar value={f} onChange={setF} species={species} />
          <Toggle label="Mostrar Pins arquivados" checked={archived} onChange={setArchived} />
          <Button variant="ghost" size="sm" icon={Layers} onClick={() => (setF(DEFAULT_FILTER), setArchived(false))}>
            Limpar filtros
          </Button>
        </div>
      </Sheet>
      <Sheet open={!!createAt} onClose={() => setCreateAt(null)} title="Criar neste local">
        {createAt && (
          <div className="space-y-3">
            <p className="tnum text-[13px] text-muted">{formatCoords(createAt.lat, createAt.lng)}</p>
            <Button className="w-full" icon={MapPinPlus} onClick={() => nav(`/conta/pins/novo?lat=${createAt.lat}&lng=${createAt.lng}`)}>
              Novo Pin aqui
            </Button>
            <Button className="w-full" variant="outline" icon={Radio} onClick={() => nav(`/conta/pings/novo?lat=${createAt.lat}&lng=${createAt.lng}`)}>
              Novo Ping aqui
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
