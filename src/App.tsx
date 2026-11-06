import { createBrowserRouter, createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { AppShell } from './components/AppShell'
import { useApp } from './state/AppState'
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

/** O onboarding aparece só na primeira visita ao Início; links diretos abrem sempre.
 * Depois de entrar, o Início é o ecrã dividido "Prepara a tua jornada | Gera a tua história". */
function HomeGate() {
  const { state } = useApp()
  return state.onboarded ? <StoriesHome /> : <Navigate to="/boas-vindas" replace />
}

const routes = [
  { path: '/boas-vindas', element: <Onboarding /> },
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
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '*', element: <Outlet /> },
]

const router = import.meta.env.MODE === 'artifact' ? createHashRouter(routes) : createBrowserRouter(routes)

export default function App() {
  return <RouterProvider router={router} />
}
