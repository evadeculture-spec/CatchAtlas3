import { Fish, Info, MapPin, Route, Sunrise, Sunset, Trophy, Waves, Droplets, Gauge, Images } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { CatchRow, SpeciesDot } from '../components/bits'
import { HourlyChart } from '../components/charts'
import { ConditionsGrid, EventCard, FavButton } from '../components/cards'
import { PhotoImage } from '../components/photo/PhotoImage'
import { PhotoCredits } from '../components/photo/PhotoCredits'
import { PhotoGallery } from '../components/photo/PhotoGallery'
import { PhotoInsights } from '../components/photo/PhotoInsights'
import { useDamPhotos } from '../components/photo/useDamPhotos'
import { isStock, shortCredit, stockLabel } from '../lib/photos/rules'
import { ButtonLink, Card, cx, EmptyState, PageHeader, Tag } from '../components/ui'
import { DEMO_USER_ID } from '../data/anglers'
import { damRegion, modalityName, speciesById } from '../data/catalog'
import { damById } from '../data/dams'
import { EVENTS } from '../data/events'
import { addDaysISO } from '../lib/dates'
import { capFirst, formatDate, formatKg, relativeDay } from '../lib/format'
import { simulateConditions } from '../lib/weather'
import { useApp } from '../state/AppState'
import NotFound from './NotFound'
import { ZoneCard } from './Zones'
import { ZONES } from '../data/zones'
import { LEGAL } from '../data/legal'
import { riverForDam } from '../data/rivers'
import { ConfidenceTag } from '../components/SourceLink'

const TABS = [
  { id: 'geral', label: 'Visão geral' },
  { id: 'condicoes', label: 'Condições' },
  { id: 'capturas', label: 'Capturas' },
  { id: 'provas', label: 'Provas' },
  { id: 'regras', label: 'Regras e licenças' },
] as const
type TabId = (typeof TABS)[number]['id']

export default function DamDetail() {
  const { id = '' } = useParams()
  const dam = damById[id]
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'geral') as TabId
  const { state, allCatches } = useApp()
  const navigate = useNavigate()
  const [dayIdx, setDayIdx] = useState(0)
  const { cover, all: photos } = useDamPhotos(id)
  const [credits, setCredits] = useState(false)
  const [gallery, setGallery] = useState<number | null>(null)
  if (!dam) return <NotFound />

  const days = Array.from({ length: 5 }, (_, i) => addDaysISO(state.anchor, i))
  const cond = simulateConditions(dam, days[dayIdx])
  const today = simulateConditions(dam, state.anchor)
  const catches = allCatches
    .filter((c) => c.damId === dam.id && (c.visibility === 'publica' || c.anglerId === DEMO_USER_ID))
    .sort((a, b) => b.weightG - a.weightG)
  const events = EVENTS.filter((e) => e.damId === dam.id).sort((a, b) => a.dayOffset - b.dayOffset)
  const damZones = ZONES.filter((z) => z.damId === dam.id)
  const bestBySpecies = dam.species
    .map((s) => ({ s, best: catches.filter((c) => c.speciesId === s)[0] }))
    .filter((x) => x.best)

  const setTab = (t: TabId) => {
    const next = new URLSearchParams(params)
    if (t === 'geral') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true, preventScrollReset: true })
  }

  return (
    <div className="relative">
      <PageHeader back="/explorar" transparent actions={<FavButton dam={dam} />} />
      <div className="relative h-[64dvh] max-h-[640px] min-h-[400px] overflow-hidden bg-[#0b2236] lg:mx-8 lg:mt-6 lg:h-[min(66vh,620px)] lg:min-h-[460px] lg:rounded-[32px] lg:shadow-lift [@media(max-height:520px)]:h-[calc(100dvh-var(--nav-h))] [@media(max-height:520px)]:min-h-[300px]">
        <PhotoImage dam={dam} photo={cover} variant="hero" sizes="(min-width: 1024px) calc(100vw - 330px), 100vw" priority />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/30 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#0b2236]/95 via-[#0b2236]/45 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 text-white sm:px-8 lg:px-12 lg:pb-9">
          <h1 className="font-display break-words text-[clamp(2.5rem,min(11vw,11dvh),5rem)] font-semibold leading-[0.95] tracking-[-0.01em] [text-wrap:balance] [text-shadow:0_2px_18px_rgb(0_0_0/0.35)]">{dam.name}</h1>
          <p className="mt-3 flex items-start gap-2 text-[15px] font-semibold text-white/95 lg:text-[17px]">
            <MapPin className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="min-w-0">{dam.place} · {damRegion(dam)}</span>
          </p>
          <div className="tnum mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] font-semibold text-white/95 lg:mt-5 lg:text-[16px]">
            <span className="flex items-center gap-2"><Waves className="h-[18px] w-[18px] text-teal" aria-hidden />{dam.river}</span>
            <span className="flex items-center gap-2"><Droplets className="h-[18px] w-[18px] text-teal" aria-hidden />Água {today.water} °C</span>
            <span className="flex items-center gap-2"><Fish className="h-[18px] w-[18px] text-teal" aria-hidden />{catches.length} capturas registadas</span>
            <Tag tone="glass">Dados de demonstração · temperatura simulada</Tag>
          </div>
          {cover && (
            <div className="mt-4 flex min-w-0 items-center gap-1 text-[11.5px] font-semibold text-white/70 lg:absolute lg:right-8 lg:top-[-2.25rem] lg:mt-0 lg:max-w-[46%]">
              <button
                type="button"
                onClick={() => setCredits(true)}
                className="press inline-flex min-w-0 items-center gap-1.5 rounded-full py-1 pr-2 hover:text-white"
                aria-label={`Créditos da fotografia: ${stockLabel(cover.asset) ? `${stockLabel(cover.asset)}, ` : ''}${shortCredit(cover.asset)}`}
              >
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {stockLabel(cover.asset) ? `${stockLabel(cover.asset)} · ` : '© '}
                  {shortCredit(cover.asset)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGallery(0)}
                className="press inline-flex shrink-0 items-center gap-1 rounded-full py-1 pl-1 hover:text-white"
                aria-label={photos.length > 1 ? `${photos.length} fotografias` : 'Ver fotografia'}
              >
                <Images className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{photos.length > 1 ? `${photos.length} fotografias` : 'Ampliar'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {cover && <PhotoCredits asset={cover.asset} open={credits} onClose={() => setCredits(false)} />}
      {gallery !== null && photos.length > 0 && <PhotoGallery dam={dam} photos={photos} start={gallery} onClose={() => setGallery(null)} />}

      <div className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-xl lg:mx-8 lg:mt-2 lg:rounded-full lg:border-0">
        <div role="tablist" aria-label="Secções da barragem" className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 lg:px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'relative h-13 shrink-0 px-3.5 text-[14px] font-bold transition-colors',
                tab === t.id ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {t.label}
              {t.id === 'capturas' && <span className="ml-1 text-subtle">{catches.length}</span>}
              {t.id === 'provas' && <span className="ml-1 text-subtle">{events.length}</span>}
              {t.id === 'regras' && damZones.length > 0 && <span className="ml-1 text-subtle">{damZones.length}</span>}
              <span className={cx('absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-teal transition-opacity', tab === t.id ? 'opacity-100' : 'opacity-0')} />
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-5 lg:px-8" role="tabpanel">
        {tab === 'geral' && (
          <div className="page-in grid gap-4 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
            <div className="space-y-4">
              {cover && !isStock(cover.asset) && <PhotoInsights cover={cover} onExplore={() => setGallery(0)} />}
              <Card className="p-5">
                <p className="text-[15.5px] leading-relaxed text-text">{dam.summary}</p>
                {dam.traits.length > 0 && <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
                  {dam.traits.map((t) => (
                    <div key={t.label}>
                      <dt className="text-[11.5px] font-bold uppercase tracking-wider text-subtle">{t.label}</dt>
                      <dd className="mt-1 text-[13.5px] font-bold leading-snug text-ink">{t.value}</dd>
                    </div>
                  ))}
                </dl>}
                <p className="mt-4 text-[12px] text-muted">
                  {dam.detail === 'basica' ? 'Ficha básica: nome, rio e localidade são informação geral. Coordenadas aproximadas.' : 'Características descritivas de demonstração, não verificadas.'}
                </p>
                {riverForDam(dam.river) && (
                  <p className="mt-2 text-[12.5px] text-muted">
                    Bacia do {riverForDam(dam.river)!.basin} ·{' '}
                    <Link to="/rios" className="font-bold text-teal-700 hover:underline">ver rios</Link>
                  </p>
                )}
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-extrabold text-ink">Espécies de exemplo</h2>
                  <Tag tone="amber">Não verificadas</Tag>
                </div>
                {dam.species.length === 0 && <p className="mt-3 text-[13.5px] text-muted">Espécies ainda não compiladas para esta barragem. Consulte o edital local.</p>}
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {dam.species.map((s) => {
                    const best = bestBySpecies.find((b) => b.s === s)?.best
                    return (
                      <li key={s} className="rounded-2xl bg-mist/70 px-3.5 py-3">
                        <p className="flex items-center gap-2 text-[14px] font-extrabold text-ink">
                          <SpeciesDot id={s} />
                          {speciesById[s].name}
                        </p>
                        <p className="tnum mt-0.5 text-[12px] text-muted">{best ? `Maior registo: ${formatKg(best.weightG)}` : 'Sem registos'}</p>
                      </li>
                    )
                  })}
                </ul>
                <h3 className="mt-5 text-[13px] font-bold text-ink">Modalidades de exemplo</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dam.modalities.map((m) => (
                    <Tag key={m}>{modalityName(m)}</Tag>
                  ))}
                  {dam.modalities.length === 0 && <span className="text-[13px] text-muted">Por confirmar</span>}
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <div className="rounded-[var(--radius-card)] bg-ink p-5 text-white shadow-card">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-extrabold">Hoje, simulado</h2>
                  <button onClick={() => setTab('condicoes')} className="text-[13px] font-bold text-teal hover:underline">
                    Ver detalhe
                  </button>
                </div>
                <div className="mt-3.5">
                  <ConditionsGrid c={today} dark />
                </div>
              </div>
              <div className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden />
                <p className="text-[13px] leading-relaxed text-muted">
                  <b className="text-ink">Antes de pescar:</b> confirme licença, épocas, espécies permitidas, zonas de acesso e navegação junto das entidades competentes. Esta demonstração não contém regras de pesca.
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'condicoes' && (
          <div className="page-in grid gap-4 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
            <Card className="p-5">
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Dia">
                {days.map((d, i) => {
                  const c = simulateConditions(dam, d)
                  return (
                    <button
                      key={d}
                      role="radio"
                      aria-checked={dayIdx === i}
                      onClick={() => setDayIdx(i)}
                      className={cx('press min-w-[72px] flex-1 rounded-2xl px-3 py-2.5 text-left', dayIdx === i ? 'bg-ink text-white' : 'bg-mist/70 text-ink hover:bg-mist')}
                    >
                      <span className="block whitespace-nowrap text-[12px] font-bold opacity-75">{i < 2 ? relativeDay(d, state.anchor) : capFirst(formatDate(d, { weekday: 'short', day: 'numeric' }))}</span>
                      <span className="tnum block text-[16px] font-extrabold">{c.airMax}°</span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-5">
                <ConditionsGrid c={cond} />
              </div>
              <div className="mt-6">
                <HourlyChart key={cond.date} data={cond.hourly} />
              </div>
            </Card>
            <div className="space-y-4">
              <Card className="p-5">
                <h2 className="text-[15px] font-extrabold text-ink">Luz e ar</h2>
                <ul className="tnum mt-3 space-y-3 text-[14px]">
                  <li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted"><Sunrise className="h-4 w-4" aria-hidden />Nascer do sol</span><b className="text-ink">{cond.sunrise}</b></li>
                  <li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted"><Sunset className="h-4 w-4" aria-hidden />Pôr do sol</span><b className="text-ink">{cond.sunset}</b></li>
                  <li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted"><Gauge className="h-4 w-4" aria-hidden />Rajadas</span><b className="text-ink">{cond.gust} km/h</b></li>
                  <li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted"><Droplets className="h-4 w-4" aria-hidden />Humidade</span><b className="text-ink">{cond.humidity} %</b></li>
                </ul>
              </Card>
              <p className="rounded-2xl bg-amber-50 p-4 text-[12.5px] leading-relaxed text-amber-800">
                <b>Condições simuladas.</b> Gerados a partir da época do ano para demonstrar a experiência. No produto real, estes valores viriam de fontes meteorológicas e hidrológicas oficiais.
              </p>
            </div>
          </div>
        )}

        {tab === 'capturas' && (
          <div className="page-in grid gap-4 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
            {catches.length ? (
              <Card className="p-2">
                {catches.map((c) => (
                  <CatchRow key={c.id} c={c} onClick={() => navigate(`/capturas/${c.id}`)} />
                ))}
              </Card>
            ) : (
              <EmptyState icon={Fish} title="Ainda sem capturas aqui" text="Seja o primeiro a registar uma captura nesta barragem." action={<ButtonLink to={`/capturas/nova?barragem=${dam.id}`} size="sm">Registar captura</ButtonLink>} />
            )}
            <p className="text-[12.5px] text-muted lg:pt-2">Capturas públicas de perfis fictícios e as tuas. Ordenadas por peso.</p>
          </div>
        )}

        {tab === 'provas' && (
          <div className="page-in grid gap-3 lg:grid-cols-2">
            {events.length ? (
              events.map((e) => <EventCard key={e.id} ev={e} />)
            ) : (
              <EmptyState icon={Trophy} title="Sem provas nesta barragem" text="Veja o calendário completo de provas de demonstração." action={<ButtonLink to="/provas" size="sm" variant="dark">Ver provas</ButtonLink>} />
            )}
            {events.some((e) => e.dayOffset >= 0) && (
              <p className="text-[12.5px] text-muted lg:col-span-2">
                Eventos fictícios. Próxima data: {formatDate(addDaysISO(state.anchor, events.find((e) => e.dayOffset >= 0)!.dayOffset))}.
              </p>
            )}
          </div>
        )}
        {tab === 'regras' && (
          <div className="page-in grid gap-4 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
            <div className="space-y-3">
              {damZones.length > 0 ? (
                damZones.map((z) => <ZoneCard key={z.id} z={z} showDam={false} />)
              ) : (
                <Card className="p-5">
                  <h2 className="text-[15px] font-extrabold text-ink">Sem concessão ou zona identificada</h2>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                    Não encontrámos documento de concessão, zona de pesca ou coto para esta {dam.country === 'PT' ? 'albufeira' : 'embalse'}. Isso não significa que não exista: confirme {dam.country === 'PT' ? 'no geocatálogo e nos editais do ICNF' : 'na ordem de pesca da comunidade autónoma'}.
                  </p>
                </Card>
              )}
            </div>
            <Card className="p-5">
              <h2 className="text-[15px] font-extrabold text-ink">Regras gerais · {dam.country === 'PT' ? 'Portugal' : 'Espanha'}</h2>
              <ul className="mt-3 space-y-3">
                {LEGAL[dam.country].flatMap((sec) => sec.items).filter((it) => /Licen|Períodos|interautonómica|invasoras/.test(it.title)).slice(0, 4).map((it) => (
                  <li key={it.title}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-extrabold text-ink">{it.title}</p>
                      <ConfidenceTag c={it.confidence} />
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{it.text}</p>
                  </li>
                ))}
              </ul>
              <Link to={`/licencas${dam.country === 'ES' ? '?pais=ES' : ''}`} className="press mt-4 inline-flex h-10 items-center rounded-full bg-ink px-4 text-[13px] font-bold text-white hover:bg-ink-2">
                Licenças e legislação completas
              </Link>
            </Card>
          </div>
        )}
      </div>

      <div className="pointer-events-none sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+14px)] z-30 mt-8 flex justify-center px-4 lg:bottom-6 [@media(max-height:520px)]:static">
        <ButtonLink to={`/jornada/nova?barragem=${dam.id}`} size="lg" variant="dark" icon={Route} className="pointer-events-auto shadow-lift">
          Preparar jornada aqui
        </ButtonLink>
      </div>
    </div>
  )
}
