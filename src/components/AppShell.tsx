import { Plus, TriangleAlert } from 'lucide-react'
import { NavLink, Outlet, ScrollRestoration, useLocation, Link } from 'react-router'
import { brand } from '../config/brand'
import { useApp } from '../state/AppState'
import { BrandLockup } from './BrandMark'
import { NAV, SECONDARY } from './nav'
import { cx } from './ui'

const COMMUNITY_PATHS = /^\/(comunidade|reports|mercado|provas|giveaway|rankings)/
const EXPLORE_PATHS = /^\/(explorar|rios|zonas|licencas|barragens)/
const sectionActive = (to: string, pathname: string) => (to === '/comunidade' && COMMUNITY_PATHS.test(pathname)) || (to === '/explorar' && EXPLORE_PATHS.test(pathname))

const HIDE_FAB = [/^\/capturas\/nova/, /\/editar$/, /^\/jornada/, /^\/barragens\//, /^\/provas\/./, /^\/comunidade\/chat/, /^\/reports\/novo/, /^\/mercado\/./]

export function AppShell() {
  const { pathname } = useLocation()
  const { storageWarning, state } = useApp()
  const showFab = !HIDE_FAB.some((r) => r.test(pathname))
  // Página inicial imersiva (ecrã dividido + histórias): sem barra lateral, barra inferior nem botão flutuante.
  // O menu completo continua acessível pelo botão de menu da própria página.
  const immersive = pathname === '/' && state.onboarded

  if (immersive)
    return (
      <div className="min-h-dvh bg-ink">
        {storageWarning && (
          <div className="fixed inset-x-0 top-0 z-[60] flex items-start gap-2 bg-amber-50 px-4 py-2.5 text-[13px] font-semibold text-amber-800" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {storageWarning}
          </div>
        )}
        <main id="conteudo">
          <Outlet />
        </main>
      </div>
    )

  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only z-[80] rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Saltar para o conteúdo
      </a>

      {/* Navegação lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col overflow-y-auto bg-ink px-5 py-6 text-white lg:flex">
        <Link to="/" className="rounded-xl px-1" aria-label={`${brand.name} — início`}>
          <BrandLockup light />
        </Link>
        <p className="mt-2 px-1 text-[12.5px] leading-snug text-white/55">{brand.tagline}</p>
        <Link
          to="/capturas/nova"
          className="press mt-7 flex h-12 items-center justify-center gap-2 rounded-full bg-teal text-[14px] font-extrabold text-ink hover:bg-[#2fcab4]"
        >
          <Plus className="h-5 w-5" aria-hidden /> Registar captura
        </Link>
        <nav className="mt-6 space-y-1" aria-label="Navegação principal">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'press flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-bold',
                  isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <n.icon className={cx('h-5 w-5', isActive && 'text-teal')} aria-hidden />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
          <p className="px-3 pb-1 pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">Informação e comunidade</p>
          {SECONDARY.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cx('press flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-bold', isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')
              }
            >
              <n.icon className="h-[18px] w-[18px]" aria-hidden /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-white/5 p-4 text-[12px] leading-relaxed text-white/60">
          <p className="mb-1 flex items-center gap-1.5 font-bold text-amber">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
            {brand.demoLabel}
          </p>
          Os dados são fictícios e as alterações ficam apenas neste navegador.
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        {storageWarning && (
          <div className="flex items-start gap-2 bg-amber-50 px-4 py-2.5 text-[13px] font-semibold text-amber-800" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {storageWarning}
          </div>
        )}
        <main id="conteudo" className="pb-[calc(var(--nav-h)+env(safe-area-inset-bottom)+92px)] lg:pb-12">
          <div key={pathname.split('/').slice(0, 2).join('/')} className="page-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Ação principal flutuante (telemóvel) */}
      {showFab && (
        <Link
          to="/capturas/nova"
          className="press fixed right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-teal pl-4 pr-5 text-[14px] font-extrabold text-ink shadow-[0_12px_28px_-8px_rgb(16_43_58/0.55)] hover:bg-[#2fcab4] bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+14px)] lg:hidden"
        >
          <Plus className="h-5 w-5" strokeWidth={2.6} aria-hidden />
          Registar captura
        </Link>
      )}

      {/* Navegação inferior (telemóvel) */}
      <nav
        aria-label="Navegação principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-white/92 backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex h-[var(--nav-h)] max-w-lg items-stretch">
          {NAV.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive: a }) =>
                  cx('press flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold', a || sectionActive(n.to, pathname) ? 'text-ink' : 'text-subtle hover:text-muted')
                }
              >
                {({ isActive: a }) => {
                  const isActive = a || sectionActive(n.to, pathname)
                  return (
                  <>
                    <span className={cx('grid h-8 w-12 place-items-center rounded-full transition', isActive && 'bg-teal-50')}>
                      <n.icon className={cx('h-[21px] w-[21px]', isActive && 'text-teal-700')} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                    </span>
                    {n.label}
                  </>
                  )
                }}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ScrollRestoration />
    </div>
  )
}
