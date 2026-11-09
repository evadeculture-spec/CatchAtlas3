import { ArrowRight, CalendarDays, Compass, FileText, Map, Radio, Scale, Search, Waves } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { damRegion, speciesById } from '../../data/catalog'
import { DAMS, damById } from '../../data/dams'
import { DAY_ART } from '../../data/storyArt'
import { formatDate, relativeDay } from '../../lib/format'
import { simulateConditions } from '../../lib/weather'
import { useApp } from '../../state/AppState'
import { Credit, Glass, ToolList } from './parts'
import { AtlasTeaser } from '../../components/atlas/AtlasTeaser'

/** Universo 1 — antes da pesca: planear, explorar, condições (simuladas) e próxima jornada. */
export function PreparePanel() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { profile, favorites, anchor, trips } = state

  const featured = useMemo(() => {
    const favInRegion = favorites.map((f) => damById[f]).find((d) => d?.region === profile.region)
    return favInRegion ?? damById[favorites[0]] ?? DAMS.find((d) => d.region === profile.region) ?? DAMS[0]
  }, [favorites, profile.region])
  const cond = simulateConditions(featured, anchor)
  const next = [...trips].filter((t) => t.date >= anchor).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)[0]
  const nextDam = next ? damById[next.damId] : null

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    navigate(`/explorar${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex min-h-[52dvh] flex-col justify-end">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-teal [text-shadow:0_1px_10px_rgb(0_0_0/0.6)]">01 · Antes de sair</p>
        <h2 id="story-jornada-title" className="font-display mt-3 text-[clamp(2.4rem,10vw,4.25rem)] font-semibold leading-[1.0] tracking-[-0.01em] [text-wrap:balance]">
          A próxima grande história começa aqui.
        </h2>
        <Link
          to="/jornada/nova"
          className="welcome-btn mt-7 inline-flex h-14 items-center justify-center gap-2 self-start rounded-2xl bg-teal px-7 text-[16px] font-extrabold text-ink shadow-[0_10px_24px_-10px_rgb(32_191_169/0.75)] hover:bg-[#2fcab4]"
        >
          Planear jornada <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      <AtlasTeaser />

      <section className="mt-10" aria-labelledby="next-trip-h">
        <h3 id="next-trip-h" className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/55">Próxima jornada</h3>
        {next && nextDam ? (
          <Link to={`/jornadas/${next.id}`} className="mt-2 block rounded-3xl bg-black/25 p-4 ring-1 ring-white/10 backdrop-blur-md transition hover:bg-black/35">
            <span className="flex items-center gap-2 text-[13px] font-bold text-teal">
              <CalendarDays className="h-4 w-4" aria-hidden /> {relativeDay(next.date, anchor)} · {formatDate(next.date)}
            </span>
            <span className="font-display mt-1 block text-[24px] font-semibold leading-tight">{nextDam.name}</span>
            <span className="mt-0.5 block text-[13.5px] text-white/70">
              {speciesById[next.speciesId].name} · {damRegion(nextDam)}
            </span>
          </Link>
        ) : (
          <Glass className="mt-2">
            <p className="text-[15px] font-bold">Ainda não tens jornadas planeadas.</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-white/70">Escolhe a barragem, a data e a espécie: preparamos a lista de material e as sugestões para o dia.</p>
            <Link to="/jornada/nova" className="mt-3 inline-flex items-center gap-1 text-[14px] font-bold text-teal hover:underline">
              Planear a primeira jornada <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Glass>
        )}
      </section>

      <form onSubmit={onSearch} role="search" className="mt-8">
        <label htmlFor="story-search" className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/55">
          Procurar barragens
        </label>
        <div className="mt-2 flex h-13 items-center gap-2 rounded-2xl bg-white/10 px-4 ring-1 ring-white/15 focus-within:ring-teal">
          <Search className="h-5 w-5 shrink-0 text-white/60" aria-hidden />
          <input
            id="story-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, rio ou região"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/45 focus:outline-none"
          />
        </div>
      </form>

      <section className="mt-8" aria-labelledby="cond-h">
        <div className="flex items-center justify-between gap-3">
          <h3 id="cond-h" className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/55">Condições hoje</h3>
          <span className="rounded-full bg-amber/20 px-2.5 py-0.5 text-[11px] font-bold text-amber">Simulado</span>
        </div>
        <Link to={`/barragens/${featured.id}?tab=condicoes`} className="mt-2 block rounded-3xl bg-black/25 p-4 ring-1 ring-white/10 backdrop-blur-md transition hover:bg-black/35">
          <span className="block text-[17px] font-extrabold">{featured.name}</span>
          <span className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-white/85">
            <span>{cond.airMin}°–{cond.airMax} °C</span>
            <span>Água {cond.water} °C</span>
            <span>Vento {cond.wind} km/h</span>
          </span>
          <span className="mt-2 block text-[11.5px] text-white/50">Valores simulados para a demonstração. Não são dados meteorológicos reais.</span>
        </Link>
      </section>

      <ToolList
        title="Ferramentas"
        items={[
          // Ambos abrem o Atlas Ibérico 3D: o mapa na vista da Península; "Explorar barragens" com a lista aberta.
          { to: '/atlas?painel=lista', label: 'Explorar barragens', hint: 'Atlas com lista, pesquisa, filtros e favoritas', icon: Compass },
          { to: '/atlas', label: 'Mapa', hint: 'Atlas Ibérico 3D · Portugal e Espanha', icon: Map },
          { to: '/rios', label: 'Rios e bacias', icon: Waves },
          { to: '/zonas', label: 'Concessões e zonas', icon: FileText },
          { to: '/licencas', label: 'Licenças e lei', icon: Scale },
          { to: '/?camada=comunidade', label: 'Reports e pings', hint: 'Camada comunitária no Atlas', icon: Radio },
        ]}
      />
      <Credit art={DAY_ART} label="Embalse de El Atazar" />
    </div>
  )
}
