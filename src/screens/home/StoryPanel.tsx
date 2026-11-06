import { ArrowRight, BookOpen, Medal, MessageCircle, Trophy, User, Users } from 'lucide-react'
import { Link } from 'react-router'
import { CatchVisual } from '../../components/bits'
import { speciesById } from '../../data/catalog'
import { damById } from '../../data/dams'
import { NIGHT_ART } from '../../data/storyArt'
import { formatDate, formatKg } from '../../lib/format'
import { useApp } from '../../state/AppState'
import { Credit, Glass, ToolList } from './parts'

/** Universo 2 — depois da pesca: registar, recordar e partilhar. */
export function StoryPanel() {
  const { state } = useApp()
  const mine = [...state.myCatches].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const totalG = mine.reduce((s, c) => s + c.weightG, 0)
  const best = mine.reduce<(typeof mine)[number] | null>((b, c) => (!b || c.weightG > b.weightG ? c : b), null)
  const hasSeeded = mine.some((c) => c.seeded)

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex min-h-[52dvh] flex-col justify-end">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#9fd8ff] [text-shadow:0_1px_10px_rgb(0_0_0/0.6)]">02 · Depois de voltar</p>
        <h2 id="story-historia-title" className="font-display mt-3 text-[clamp(2.4rem,10vw,4.25rem)] font-semibold leading-[1.0] tracking-[-0.01em] [text-wrap:balance]">
          Cada jornada merece uma história.
        </h2>
        <Link
          to="/capturas/nova"
          className="welcome-btn mt-7 inline-flex h-14 items-center justify-center gap-2 self-start rounded-2xl bg-white px-7 text-[16px] font-extrabold text-ink shadow-[0_10px_24px_-12px_rgb(255_255_255/0.5)] hover:bg-white/90"
        >
          Contar história <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
        <p className="mt-3 text-[12.5px] text-white/55">Regista a captura com fotografia, espécie, peso e local.</p>
      </div>

      {mine.length > 0 ? (
        <>
          <section className="mt-10" aria-labelledby="season-h">
            <h3 id="season-h" className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/55">A tua época</h3>
            <dl className="tnum mt-3 grid grid-cols-3 gap-3">
              <div>
                <dt className="text-[12px] text-white/55">Capturas</dt>
                <dd className="font-display text-[30px] font-semibold leading-tight">{mine.length}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-white/55">Peso total</dt>
                <dd className="font-display text-[30px] font-semibold leading-tight">{formatKg(totalG).replace(' kg', '')}<span className="text-[15px] text-white/60"> kg</span></dd>
              </div>
              <div>
                <dt className="text-[12px] text-white/55">Melhor</dt>
                <dd className="font-display text-[30px] font-semibold leading-tight">{best ? formatKg(best.weightG).replace(' kg', '') : '—'}<span className="text-[15px] text-white/60"> kg</span></dd>
              </div>
            </dl>
            {hasSeeded && <p className="mt-2 text-[11.5px] text-white/45">Inclui capturas de exemplo da demonstração.</p>}
          </section>

          <section className="mt-8" aria-labelledby="memories-h">
            <div className="flex items-baseline justify-between">
              <h3 id="memories-h" className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/55">Recordações</h3>
              <Link to="/capturas" className="text-[13px] font-bold text-white/80 hover:text-white">Ver diário</Link>
            </div>
            <ul data-no-swipe className="no-scrollbar -mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
              {mine.slice(0, 8).map((c) => (
                <li key={c.id} className="snap-start">
                  <Link to={`/capturas/${c.id}`} className="group block w-[148px]">
                    <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-white/10">
                      <CatchVisual c={c} className="transition-transform duration-500 group-hover:scale-105" />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2.5 pt-8">
                        <span className="block text-[13px] font-extrabold">{speciesById[c.speciesId].name}</span>
                        <span className="tnum block text-[11.5px] text-white/75">{formatKg(c.weightG)}</span>
                      </span>
                    </span>
                    <span className="mt-1.5 block truncate text-[12px] text-white/60">
                      {formatDate(c.date)} · {damById[c.damId]?.name ?? 'Barragem'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <Glass className="mt-10">
          <p className="text-[15px] font-bold">Ainda não registaste capturas.</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-white/70">A primeira captura abre o teu diário: fotografia, espécie, peso e a barragem onde aconteceu.</p>
          <Link to="/capturas/nova" className="mt-3 inline-flex items-center gap-1 text-[14px] font-bold text-[#9fd8ff] hover:underline">
            Registar a primeira captura <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Glass>
      )}

      <ToolList
        title="As tuas histórias"
        items={[
          { to: '/capturas', label: 'Diário de capturas', hint: 'Histórico, fotografias e notas', icon: BookOpen },
          { to: '/rankings', label: 'Rankings', hint: 'Por espécie, barragem e período', icon: Medal },
          { to: '/comunidade', label: 'Comunidade', icon: Users },
          { to: '/comunidade/chat', label: 'Chat global', icon: MessageCircle },
          { to: '/provas', label: 'Provas', icon: Trophy },
          { to: '/perfil', label: 'Perfil de pescador', icon: User },
        ]}
      />
      <Credit art={NIGHT_ART} label="Imagem ilustrativa" />
    </div>
  )
}
