import { ArrowRight, Crown, Gift, Medal, Radio, Route, Search, Sparkles } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar, CatchRow, useAnglerName } from '../components/bits'
import { ConditionsGrid, DamCard, EventCard, SkyIcon } from '../components/cards'
import { DamCover } from '../components/photo/DamCover'
import { useDamPhotos } from '../components/photo/useDamPhotos'
import { InstallTip } from '../components/InstallTip'
import { BrandLockup } from '../components/BrandMark'
import { ButtonLink, Card, cx, DemoTag, SectionHeader, Tag } from '../components/ui'
import { DEMO_USER_ID } from '../data/anglers'
import { damRegion, regionName, speciesById } from '../data/catalog'
import { DAMS, damById } from '../data/dams'
import { EVENTS } from '../data/events'
import { formatDateLong, formatKg, greeting } from '../lib/format'
import { computeRanking } from '../lib/ranking'
import { simulateConditions } from '../lib/weather'
import { useApp } from '../state/AppState'
import { brand } from '../config/brand'
import { ACTIVITY, periodName } from '../data/catalog'
import { diffDays } from '../lib/dates'
import { countEntries, currentPeriod, daysLeft } from '../lib/giveaway'

export default function Home() {
  const { state, allCatches, allReports } = useApp()
  const navigate = useNavigate()
  const anglerName = useAnglerName()
  const [q, setQ] = useState('')
  const { profile, favorites, anchor } = state

  const featured = useMemo(() => {
    const favInRegion = favorites.map((f) => damById[f]).find((d) => d?.region === profile.region)
    return favInRegion ?? damById[favorites[0]] ?? DAMS.find((d) => d.region === profile.region) ?? DAMS[0]
  }, [favorites, profile.region])
  const cond = simulateConditions(featured, anchor)
  const featuredPhotos = useDamPhotos(featured.id)

  const highlighted = useMemo(() => {
    const score = (d: (typeof DAMS)[number]) =>
      (favorites.includes(d.id) ? 3 : 0) + (d.region === profile.region ? 2 : 0) + d.species.filter((s) => profile.species.includes(s)).length
    return DAMS.filter((d) => d.id !== featured.id).sort((a, b) => score(b) - score(a)).slice(0, 6)
  }, [favorites, profile, featured.id])

  const nextEvent = [...EVENTS].filter((e) => e.dayOffset >= 0).sort((a, b) => a.dayOffset - b.dayOffset)[0]
  const recent = [...allCatches]
    .filter((c) => c.visibility === 'publica' || c.anglerId === DEMO_USER_ID)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 4)
  const rankSpecies = profile.species[0] ?? 'achiga'
  const ranking = computeRanking(allCatches, { species: rankSpecies, damId: 'todas', period: '90', mode: 'maior', ref: anchor })
  const myPos = ranking.findIndex((r) => r.anglerId === DEMO_USER_ID)
  const mine = state.myCatches
  const best = mine.reduce<(typeof mine)[number] | null>((b, c) => (!b || c.weightG > b.weightG ? c : b), null)

  const latestReports = [...allReports]
    .filter((r) => diffDays(anchor, r.date) >= 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 3)
  const gPeriod = currentPeriod(anchor)
  const gEntries = countEntries(gPeriod, state.myCatches, state.myReports, state.subscription.active)

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    navigate(`/explorar${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8">
      <header className="pt-safe flex items-center justify-between pt-4 lg:pt-8">
        <div className="lg:hidden">
          <BrandLockup compact />
        </div>
        <div className="hidden lg:block">
          <p className="text-[13px] font-semibold text-muted">{formatDateLong(anchor)}</p>
        </div>
        <DemoTag />
      </header>

      <div className="mt-5 flex flex-col gap-4 lg:mt-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-muted lg:hidden">{formatDateLong(anchor)}</p>
          <h1 className="font-display mt-0.5 text-[30px] font-semibold leading-tight text-ink sm:text-[36px]">
            {greeting()}, {profile.name}.
          </h1>
        </div>
        <form onSubmit={onSearch} role="search" className="relative lg:w-[360px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="Procurar barragem ou região"
            aria-label="Procurar barragem ou região"
            className="h-12 w-full rounded-full border border-line bg-white pl-11 pr-4 text-[15px] shadow-card outline-none placeholder:text-subtle focus:border-teal focus:ring-4 focus:ring-teal/15"
          />
        </form>
      </div>

      {/* Destaque */}
      <section className="mt-5 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-ink text-white shadow-lift">
          <div className="absolute inset-0 -z-10">
            <DamCover dam={featured} variant="hero" sizes="(min-width: 1024px) 60vw, 100vw" priority fallback={{ labelClass: "hidden", locatorClass: "right-[6%] top-[16%] w-[min(42%,300px)] opacity-60" }} />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-ink/5" />
          </div>
          <div className="flex min-h-[400px] flex-col p-5 sm:min-h-[440px] sm:p-7">
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag tone="glass">
                <Sparkles className="h-3 w-3" aria-hidden />
                {favorites.includes(featured.id) ? 'Favorita em destaque' : 'Barragem em destaque'}
              </Tag>
              {!featuredPhotos.cover && <Tag tone="glass">Fotografia ainda não disponível</Tag>}
            </div>
            <div className="mt-auto">
              <p className="text-[13px] font-semibold text-white/70">
                {damRegion(featured)} · {featured.river}
              </p>
              <h2 className="font-display mt-1 text-[44px] font-semibold leading-none sm:text-[56px]">{featured.name}</h2>
              <div className="tnum mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] font-semibold text-white/90">
                <span className="flex items-center gap-1.5">
                  <SkyIcon sky={cond.sky} className="h-4 w-4 text-teal" />
                  {cond.airMin}°–{cond.airMax} °C
                </span>
                <span>Água {cond.water} °C</span>
                <span>Vento {cond.wind} km/h</span>
              </div>
              <p className="mt-1 text-[11.5px] text-white/55">Condições simuladas para hoje. Não são dados meteorológicos reais.</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <ButtonLink to={`/jornada/nova?barragem=${featured.id}`} size="lg" icon={Route}>
                  Preparar jornada
                </ButtonLink>
                <ButtonLink to={`/barragens/${featured.id}`} size="lg" variant="ghost" className="bg-white/12 text-white hover:bg-white/20">
                  Ver barragem
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold text-ink">Condições em {featured.name}</h2>
              <Tag tone="amber">Simulado</Tag>
            </div>
            <div className="mt-3.5">
              <ConditionsGrid c={cond} />
            </div>
            <p className="tnum mt-3 text-[12.5px] text-muted">
              Nascer do sol {cond.sunrise} · Pôr do sol {cond.sunset}
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold text-ink">A tua época</h2>
              <Link to="/capturas" className="text-[13px] font-bold text-teal-700 hover:underline">
                Diário
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <p className="tnum text-[22px] font-extrabold text-ink">{mine.length}</p>
                <p className="text-[12px] font-semibold text-muted">Capturas</p>
              </div>
              <div>
                <p className="tnum text-[22px] font-extrabold text-ink">{(mine.reduce((s, c) => s + c.weightG, 0) / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}</p>
                <p className="text-[12px] font-semibold text-muted">kg registados</p>
              </div>
              <div>
                <p className="tnum text-[22px] font-extrabold text-ink">{state.trips.length}</p>
                <p className="text-[12px] font-semibold text-muted">Jornadas</p>
              </div>
            </div>
            {best && (
              <Link to={`/capturas/${best.id}`} className="press mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 p-3 hover:bg-[#fbebc6]">
                <Crown className="h-5 w-5 text-amber-800" aria-hidden />
                <span className="flex-1 text-[13px] font-semibold text-amber-800">
                  Melhor captura: <b>{speciesById[best.speciesId].name}</b> · {damById[best.damId].name}
                </span>
                <span className="tnum font-extrabold text-amber-800">{formatKg(best.weightG)}</span>
              </Link>
            )}
          </Card>
        </div>
      </section>

      <section className="mt-9">
        <SectionHeader kicker={profile.species.length ? `Para ${speciesById[rankSpecies].name.toLowerCase()} e ${regionName(profile.region)}` : undefined} title="Barragens para ti" to="/explorar" />
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
          {highlighted.map((d) => (
            <div key={d.id} className="snap-start">
              <DamCard dam={d} cond={simulateConditions(d, anchor)} />
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Link to="/giveaway" className="press group relative overflow-hidden rounded-[var(--radius-card)] bg-amber p-5 text-ink shadow-card hover:shadow-lift">
          <Gift className="absolute -right-3 -top-3 h-28 w-28 text-ink/10" aria-hidden />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Giveaway {brand.giveaway.frequency} · fictício</p>
          <p className="font-display mt-2 text-[22px] font-semibold leading-tight">{brand.giveaway.prize}</p>
          <p className="tnum mt-3 text-[13px] font-bold">
            Faltam {daysLeft(gPeriod, anchor)} dias · {gEntries.total} participações tuas
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-extrabold underline-offset-2 group-hover:underline">
            Ver giveaway <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </Link>
        <Card className="p-2">
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
              <Radio className="h-4 w-4 text-teal-700" aria-hidden /> Últimos reports
            </h2>
            <Link to="/reports" className="text-[13px] font-bold text-teal-700 hover:underline">
              Mapa de pings
            </Link>
          </div>
          {latestReports.map((r) => (
            <Link key={r.id} to={`/reports?sel=${r.id}`} className="press flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-mist/70">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ACTIVITY[r.activity].color }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-ink">
                  {speciesById[r.speciesId].name} · {damById[r.damId].name}
                </span>
                <span className="block truncate text-[12.5px] text-muted">
                  {ACTIVITY[r.activity].name} · {periodName(r.period).toLowerCase()} · {anglerName(r.anglerId)}
                </span>
              </span>
            </Link>
          ))}
        </Card>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeader title="Próxima prova" to="/provas" linkLabel="Todas as provas" />
          {nextEvent && <EventCard ev={nextEvent} />}
          <div className="h-6" />
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between bg-ink px-5 py-4 text-white">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal">Ranking de demonstração</p>
                <h2 className="mt-0.5 text-[16px] font-extrabold">Maior {speciesById[rankSpecies].name.toLowerCase()} · 90 dias</h2>
              </div>
              <Medal className="h-7 w-7 text-amber" aria-hidden />
            </div>
            <ol className="divide-y divide-line">
              {ranking.slice(0, 3).map((r, i) => (
                <li key={r.anglerId} className={cx('flex items-center gap-3 px-5 py-3', r.anglerId === DEMO_USER_ID && 'bg-teal-50/60')}>
                  <span className={cx('tnum w-5 text-center text-[15px] font-extrabold', i === 0 ? 'text-amber-800' : 'text-muted')}>{i + 1}</span>
                  <Avatar anglerId={r.anglerId} size={32} />
                  <span className="flex-1 truncate text-[14px] font-bold text-ink">
                    {anglerName(r.anglerId)}
                    {r.anglerId === DEMO_USER_ID && <span className="ml-1.5 text-[12px] font-semibold text-teal-700">(tu)</span>}
                  </span>
                  <span className="tnum text-[14px] font-extrabold text-ink">{formatKg(r.valueG)}</span>
                </li>
              ))}
              {ranking.length === 0 && <li className="px-5 py-4 text-sm text-muted">Ainda não há capturas elegíveis neste período.</li>}
            </ol>
            <Link to={`/rankings?especie=${rankSpecies}`} className="press flex items-center justify-between border-t border-line px-5 py-3.5 text-[13.5px] font-bold text-teal-700 hover:bg-mist/60">
              {myPos >= 0 ? `Estás em ${myPos + 1}.º lugar · ver ranking completo` : 'Ver ranking completo'}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Card>
        </section>

        <section>
          <SectionHeader title="Capturas recentes" to="/capturas" linkLabel="O meu diário" />
          <Card className="p-2">
            {recent.map((c) => (
              <CatchRow key={c.id} c={c} onClick={() => navigate(`/capturas/${c.id}`)} />
            ))}
          </Card>
          <p className="mt-2 px-1 text-[12px] text-muted">Inclui capturas públicas de perfis fictícios e as tuas.</p>
          <div className="mt-6">
            <InstallTip />
          </div>
        </section>
      </div>
    </div>
  )
}
