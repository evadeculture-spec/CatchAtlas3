import { lazy, Suspense, type ReactNode } from 'react'
import { useEffect } from 'react'
import { createBrowserRouter, createHashRouter, Navigate, Outlet, RouterProvider, useLocation, useNavigate } from 'react-router'
import { AppShell } from './components/AppShell'
import { useApp } from './state/AppState'
import { useAuth } from './state/Auth'
import Privacy from './screens/Privacy'
import PrivateLayout from './screens/conta/Layout'
import CatchDetail from './screens/CatchDetail'
import CatchForm from './screens/CatchForm'
import Catches from './screens/Catches'
import DamDetail from './screens/DamDetail'
import EventDetail from './screens/EventDetail'
import Events from './screens/Events'
import Explore from './screens/Explore'
import Home from './screens/Home'
import StoriesHome from './screens/home/StoriesHome'
import NotFound from './screens/NotFound'
import Onboarding from './screens/Onboarding'
import PlanTrip from './screens/PlanTrip'
import Profile from './screens/Profile'
import Rankings from './screens/Rankings'
import TripDetail from './screens/TripDetail'
import Community from './screens/Community'
import Reports from './screens/Reports'
import ReportForm from './screens/ReportForm'
import Market from './screens/Market'
import ListingDetail from './screens/ListingDetail'
import ListingForm from './screens/ListingForm'
import Chat from './screens/Chat'
import Giveaway from './screens/Giveaway'
import Licences from './screens/Licences'
import Zones from './screens/Zones'
import Rivers from './screens/Rivers'

// O Atlas (MapLibre + WebGL) só é descarregado quando é aberto.
const Atlas = lazy(() => import('./screens/Atlas'))
// Área privada e autenticação (Lança Lance): carregadas à parte, só quando abertas.
const SignIn = lazy(() => import('./screens/auth/SignIn'))
const SignUp = lazy(() => import('./screens/auth/SignUp'))
const ForgotPassword = lazy(() => import('./screens/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./screens/auth/ResetPassword'))
const Dashboard = lazy(() => import('./screens/conta/Dashboard'))
const MapScreen = lazy(() => import('./screens/conta/MapScreen'))
const Pins = lazy(() => import('./screens/conta/Pins'))
const PinForm = lazy(() => import('./screens/conta/PinForm'))
const PinDetail = lazy(() => import('./screens/conta/PinDetail'))
const Pings = lazy(() => import('./screens/conta/Pings'))
const PingNew = lazy(() => import('./screens/conta/PingNew'))
const PingDetail = lazy(() => import('./screens/conta/PingDetail'))
const Journeys = lazy(() => import('./screens/conta/Journeys'))
const JourneyForm = lazy(() => import('./screens/conta/JourneyForm'))
const JourneyDetail = lazy(() => import('./screens/conta/JourneyDetail'))
const History = lazy(() => import('./screens/conta/History'))
const Intelligence = lazy(() => import('./screens/conta/Intelligence'))
const Settings = lazy(() => import('./screens/conta/Settings'))
const PageFallback = <div className="grid min-h-[40vh] place-items-center text-[13px] font-bold text-muted" role="status">A carregar…</div>
const L = (el: ReactNode) => <Suspense fallback={PageFallback}>{el}</Suspense>
const AuthFallback = <div className="fixed inset-0 bg-ink" />
const A = (el: ReactNode) => <Suspense fallback={AuthFallback}>{el}</Suspense>

/** Raiz: depois de abrir um link de recuperação, leva o utilizador a definir a nova palavra-passe. */
function Root() {
  const { recovery } = useAuth()
  const nav = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (recovery && pathname !== '/nova-palavra-passe') nav('/nova-palavra-passe', { replace: true })
  }, [recovery, pathname, nav])
  return <Outlet />
}

const AtlasFallback = <div className="fixed inset-0 grid place-items-center bg-[#071923] text-[13px] font-bold text-[#b5c5cc]">A abrir o Atlas Ibérico…</div>

/** O onboarding aparece só na primeira visita ao Início; links diretos abrem sempre.
 * Depois de entrar, o Início é o ecrã dividido "Prepara a tua jornada | Gera a tua história". */
function HomeGate() {
  const { state } = useApp()
  return state.onboarded ? <StoriesHome /> : <Navigate to="/boas-vindas" replace />
}

const routes = [
  { path: '/boas-vindas', element: <Onboarding /> },
  { path: '/entrar', element: A(<SignIn />) },
  { path: '/registar', element: A(<SignUp />) },
  { path: '/recuperar', element: A(<ForgotPassword />) },
  { path: '/nova-palavra-passe', element: A(<ResetPassword />) },
  { path: '/atlas', element: <Suspense fallback={AtlasFallback}><Atlas /></Suspense> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeGate /> },
      { path: 'painel', element: <Home /> },
      { path: 'explorar', element: <Explore /> },
      { path: 'barragens/:id', element: <DamDetail /> },
      { path: 'jornada/nova', element: <PlanTrip /> },
      { path: 'jornadas/:id', element: <TripDetail /> },
      { path: 'capturas', element: <Catches /> },
      { path: 'capturas/nova', element: <CatchForm /> },
      { path: 'capturas/:id', element: <CatchDetail /> },
      { path: 'capturas/:id/editar', element: <CatchForm /> },
      { path: 'rankings', element: <Rankings /> },
      { path: 'provas', element: <Events /> },
      { path: 'provas/:id', element: <EventDetail /> },
      { path: 'perfil', element: <Profile /> },
      { path: 'comunidade', element: <Community /> },
      { path: 'comunidade/chat', element: <Chat /> },
      { path: 'reports', element: <Reports /> },
      { path: 'reports/novo', element: <ReportForm /> },
      { path: 'mercado', element: <Market /> },
      { path: 'mercado/novo', element: <ListingForm /> },
      { path: 'mercado/:id', element: <ListingDetail /> },
      { path: 'giveaway', element: <Giveaway /> },
      { path: 'licencas', element: <Licences /> },
      { path: 'zonas', element: <Zones /> },
      { path: 'rios', element: <Rivers /> },
      { path: 'privacidade', element: <Privacy /> },
      {
        path: 'conta',
        element: <PrivateLayout />,
        children: [
          { index: true, element: L(<Dashboard />) },
          { path: 'mapa', element: L(<MapScreen />) },
          { path: 'pins', element: L(<Pins />) },
          { path: 'pins/novo', element: L(<PinForm />) },
          { path: 'pins/:id', element: L(<PinDetail />) },
          { path: 'pins/:id/editar', element: L(<PinForm />) },
          { path: 'pings', element: L(<Pings />) },
          { path: 'pings/novo', element: L(<PingNew />) },
          { path: 'pings/:id', element: L(<PingDetail />) },
          { path: 'jornadas', element: L(<Journeys />) },
          { path: 'jornadas/nova', element: L(<JourneyForm />) },
          { path: 'jornadas/:id', element: L(<JourneyDetail />) },
          { path: 'jornadas/:id/editar', element: L(<JourneyForm />) },
          { path: 'historico', element: L(<History />) },
          { path: 'inteligencia', element: L(<Intelligence />) },
          { path: 'definicoes', element: L(<Settings />) },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '*', element: <Outlet /> },
]
const rootRoutes = [{ element: <Root />, children: routes }]

const router = import.meta.env.MODE === 'artifact' ? createHashRouter(rootRoutes) : createBrowserRouter(rootRoutes)

export default function App() {
  return <RouterProvider router={router} />
}
