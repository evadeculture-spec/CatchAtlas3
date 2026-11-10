import { BarChart3, BookOpen, CalendarPlus, CalendarRange, Map, MapPin, MapPinPlus, Radio, Star } from 'lucide-react'
import { Link } from 'react-router'
import { ButtonLink, EmptyState } from '../../components/ui'
import { PingRow, PinRow, StatTile } from '../../components/lanca/cards'
import { PrivateMap } from '../../components/lanca/PrivateMap'
import { ErrorBox, Notice, Panel, Skeleton, useLoad } from '../../components/lanca/primitives'
import { SignedImage } from '../../components/lanca/SignedImage'
import { anglerSummary, enrichSweep, listJourneys, listPings, listPins } from '../../lib/lanca/api'
import { analyse } from '../../lib/lanca/intelligence'
import { modalityLabel, plural } from '../../lib/lanca/labels'
import { AVATAR_BUCKET } from '../../lib/lanca/supabase'
import { formatDay, todayIn } from '../../lib/lanca/time'
import { useAuth } from '../../state/Auth'
import { useEffect } from 'react'

function greeting() {
  const h = new Date().getHours()
  return h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite'
}

export default function Dashboard() {
  const { profile, user, units, isGuest } = useAuth()
  const { data, error, loading, reload } = useLoad(async () => {
    const [summary, pins, pings, journeys] = await Promise.all([anglerSummary(), listPins(), listPings({ limit: 300 }), listJourneys()])
    return { summary, pins, pings, journeys }
  }, [])
  // Retoma enriquecimentos pendentes (ex.: Ping guardado sem rede para o fornecedor).
  const pending = data?.pings.some((p) => p.enrichment_status === 'pendente' || p.enrichment_status === 'falhou')
  useEffect(() => {
    if (pending) void enrichSweep().catch(() => undefined)
  }, [pending])

  const today = todayIn('Europe/Lisbon')
  const next = data?.journeys.filter((j) => j.status !== 'arquivada' && j.status !== 'concluida' && j.journey_date >= today).sort((a, b) => a.journey_date.localeCompare(b.journey_date))[0]
  const favorites = (data?.pins ?? []).filter((p) => p.is_favorite && p.status === 'ativo').slice(0, 4)
  const photos = (data?.pings ?? []).flatMap((p) => p.ping_media.map((m) => ({ m, p }))).slice(0, 8)
  const report = data ? analyse(data.pings) : null
  const name = profile?.display_name || user?.email?.split('@')[0] || 'pescador'
  const s = data?.summary

  return (
    <div className="space-y-5">
      {isGuest && (
        <Notice>
          Está numa <strong className="text-ink">sessão de teste</strong>: os dados são reais e privados, mas ficam ligados só a este navegador. Para os apagar, use{' '}
          <Link to="/conta/definicoes" className="font-bold text-teal-700 underline">
            Definições → Terminar sessão de teste
          </Link>
          .
        </Notice>
      )}
      {/* Resumo superior */}
      <section className="overflow-hidden rounded-[28px] bg-ink p-5 text-white shadow-lift sm:p-6">
        <div className="flex items-center gap-4">
          {profile?.avatar_path ? (
            <SignedImage path={profile.avatar_path} bucket={AVATAR_BUCKET} alt="" className="h-14 w-14 shrink-0 rounded-full ring-2 ring-white/20" />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10 text-[20px] font-extrabold">{name[0]?.toUpperCase()}</span>
          )}
          <div className="min-w-0">
            <p className="text-[13px] text-white/60">{greeting()},</p>
            <h1 className="truncate font-display text-[26px] font-semibold leading-tight">{name}</h1>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="rounded-2xl bg-white/[0.07] p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal">Próxima jornada</p>
            {loading ? (
              <Skeleton className="mt-2 h-4 w-40 bg-white/10" />
            ) : next ? (
              <Link to={`/conta/jornadas/${next.id}`} className="mt-1 block">
                <span className="block truncate text-[15px] font-extrabold">{next.title}</span>
                <span className="block text-[12.5px] first-letter:uppercase text-white/60">
                  {formatDay(next.journey_date)}
                  {next.start_time ? ` · ${next.start_time.slice(0, 5)}` : ''}
                  {next.modality ? ` · ${modalityLabel(next.modality)}` : ''}
                </span>
              </Link>
            ) : (
              <p className="mt-1 text-[13.5px] text-white/70">
                Nenhuma planeada. <Link to="/conta/jornadas/nova" className="font-bold text-teal">Planear</Link>
              </p>
            )}
          </div>
          <ButtonLink to="/conta/pings/novo" size="lg" icon={Radio} className="w-full sm:w-auto">
            Criar Ping
          </ButtonLink>
        </div>
      </section>

      {error && <ErrorBox message={error} onRetry={reload} />}

      {/* Indicadores */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Indicadores">
        {loading || !s ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatTile label="Pins guardados" value={s.pins} sub={s.pins_archived ? `${s.pins_archived} arquivados` : undefined} to="/conta/pins" />
            <StatTile label="Pings registados" value={s.pings} sub={s.photos ? `${s.photos} fotografias` : undefined} to="/conta/pings" />
            <StatTile label="Jornadas realizadas" value={s.journeys_done} sub={`${s.journeys} no total`} to="/conta/jornadas" />
            <StatTile label="Capturas registadas" value={s.catches} sub={s.species ? `${s.species} espécies` : undefined} to="/conta/historico" />
          </>
        )}
      </section>

      {/* Ações rápidas */}
      <section className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Ações rápidas">
        {[
          { to: '/conta/pings/novo', label: 'Criar Ping', icon: Radio },
          { to: '/conta/pins/novo', label: 'Criar Pin', icon: MapPinPlus },
          { to: '/conta/jornadas/nova', label: 'Planear jornada', icon: CalendarPlus },
          { to: '/conta/mapa', label: 'Mapa', icon: Map },
          { to: '/conta/historico', label: 'Histórico', icon: BookOpen },
          { to: '/conta/inteligencia', label: 'Inteligência', icon: BarChart3 },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-white px-4 text-[13.5px] font-bold text-ink hover:border-ink/30">
            <a.icon className="h-4 w-4 text-teal-700" aria-hidden /> {a.label}
          </Link>
        ))}
      </section>

      {pending && <Notice>Há Pings à espera das condições do momento. Estão a ser obtidas em segundo plano.</Notice>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Panel title="Atividade recente" actions={<Link to="/conta/pings" className="text-[13px] font-bold text-teal-700">Ver todos</Link>}>
            {loading ? (
              <Skeleton className="h-40" />
            ) : !data?.pings.length ? (
              <EmptyState icon={Radio} title="Comece pelo primeiro Ping" text="Uma fotografia, o tipo de experiência e o local. As condições do momento são juntas automaticamente." action={<ButtonLink to="/conta/pings/novo" icon={Radio}>Criar Ping</ButtonLink>} />
            ) : (
              <ul className="space-y-2">
                {data.pings.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <PingRow ping={p} units={units} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {photos.length > 0 && (
            <Panel title="Fotografias">
              <ul className="grid grid-cols-4 gap-1.5">
                {photos.map(({ m, p }) => (
                  <li key={m.id}>
                    <Link to={`/conta/pings/${p.id}`} className="block overflow-hidden rounded-xl">
                      <SignedImage path={m.thumb_path} fallbackPath={m.display_path} alt="" className="aspect-square w-full" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Mapa pessoal" actions={<Link to="/conta/mapa" className="text-[13px] font-bold text-teal-700">Abrir</Link>}>
            <div className="relative h-56 overflow-hidden rounded-2xl">
              {data && <PrivateMap pins={data.pins.filter((p) => p.status === 'ativo')} showPings={false} className="absolute inset-0" label="Mapa resumido dos Pins" onSelect={() => undefined} />}
            </div>
            {favorites.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted">
                  <Star className="h-3.5 w-3.5 text-amber" aria-hidden /> Favoritos
                </p>
                <ul className="space-y-2">
                  {favorites.map((p) => (
                    <li key={p.id}>
                      <PinRow pin={p} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data && !data.pins.length && (
              <p className="mt-3 text-[13px] text-muted">
                <MapPin className="mr-1 inline h-4 w-4" aria-hidden />
                Sem Pins ainda. <Link to="/conta/pins/novo" className="font-bold text-teal-700">Guardar o primeiro local</Link>
              </p>
            )}
          </Panel>
          <Panel title="Inteligência" actions={<Link to="/conta/inteligencia" className="text-[13px] font-bold text-teal-700">Detalhe</Link>}>
            {!report || report.sessions === 0 ? (
              <p className="text-[13px] text-muted">As estatísticas aparecem quando registar sessões de pesca.</p>
            ) : (
              <div className="space-y-2 text-[13px] text-text">
                <p>
                  {plural(report.sessions, 'sessão registada', 'sessões registadas')}, {report.successes} com captura; {report.withConditions} com condições obtidas.
                </p>
                {report.highlights[0] ? <p className="rounded-2xl bg-teal-50 p-3 text-teal-700">{report.highlights[0]}</p> : <p className="text-muted">Ainda sem grupos com amostra suficiente para destaques.</p>}
              </div>
            )}
          </Panel>
          {next && (
            <Panel title="Jornadas" actions={<Link to="/conta/jornadas" className="text-[13px] font-bold text-teal-700">Ver todas</Link>}>
              <ul className="space-y-1.5">
                {(data?.journeys ?? []).slice(0, 3).map((j) => (
                  <li key={j.id}>
                    <Link to={`/conta/jornadas/${j.id}`} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-mist">
                      <CalendarRange className="h-4 w-4 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink">{j.title}</span>
                      <span className="text-[12px] text-muted">{j.journey_date.split('-').reverse().join('/')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
