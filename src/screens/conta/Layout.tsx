import { BarChart3, BookOpen, CalendarRange, LayoutDashboard, Map, MapPin, MapPinned, Radio, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { cx } from '../../components/ui'
import { ListSkeleton } from '../../components/lanca/primitives'
import { useAuth } from '../../state/Auth'

export const PRIVATE_NAV = [
  { to: '/conta', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/conta/meus-pins', label: 'Os meus pins', icon: MapPinned },
  { to: '/conta/mapa', label: 'Mapa', icon: Map },
  { to: '/conta/pins', label: 'Pins', icon: MapPin },
  { to: '/conta/pings', label: 'Pings', icon: Radio },
  { to: '/conta/jornadas', label: 'Jornadas', icon: CalendarRange },
  { to: '/conta/historico', label: 'Histórico', icon: BookOpen },
  { to: '/conta/inteligencia', label: 'Inteligência', icon: BarChart3 },
  { to: '/conta/definicoes', label: 'Definições', icon: Settings },
]

export function BackendMissing() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-extrabold text-ink">Contas indisponíveis neste ambiente</h1>
      <p className="mt-2 text-[14px] text-muted">
        O servidor de contas não está configurado (variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY). A demonstração continua disponível.
      </p>
    </div>
  )
}

/** Protege as rotas privadas: sem sessão, envia para o login e regressa depois. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { configured, loading, session } = useAuth()
  const loc = useLocation()
  if (!configured) return <BackendMissing />
  if (loading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ListSkeleton />
      </div>
    )
  if (!session) return <Navigate to={`/entrar?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <>{children}</>
}

export default function PrivateLayout() {
  const { pathname } = useLocation()
  const fullBleed = pathname === '/conta/mapa' || pathname === '/conta/meus-pins'
  return (
    <RequireAuth>
      <div className={cx('sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur-xl', 'pt-safe')}>
        <nav aria-label="Área privada" className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 lg:px-8">
          {PRIVATE_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cx('press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold', isActive ? 'bg-ink text-white' : 'text-muted hover:bg-ink/5 hover:text-ink')}
            >
              <n.icon className="h-4 w-4" aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className={fullBleed ? '' : 'mx-auto max-w-6xl px-4 pb-10 pt-5 lg:px-8'}>
        <Outlet />
      </div>
    </RequireAuth>
  )
}
