import { Compass, FileText, Fish, Gift, House, LayoutDashboard, Map, Medal, MessageCircle, Radio, Scale, ShoppingBag, Trophy, User, Users } from 'lucide-react'

/** Itens de navegação partilhados pela barra lateral, pela barra inferior e pelo menu da página inicial. */
export const NAV = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/explorar', label: 'Explorar', icon: Compass },
  { to: '/capturas', label: 'Capturas', icon: Fish },
  { to: '/comunidade', label: 'Comunidade', icon: Users },
  { to: '/perfil', label: 'Perfil', icon: User },
]

export const SECONDARY = [
  { to: '/atlas', label: 'Atlas Ibérico 3D', icon: Map },
  { to: '/painel', label: 'Painel resumo', icon: LayoutDashboard },
  { to: '/zonas', label: 'Concessões e zonas', icon: FileText },
  { to: '/licencas', label: 'Licenças e lei', icon: Scale },
  { to: '/reports', label: 'Reports e pings', icon: Radio },
  { to: '/comunidade/chat', label: 'Chat global', icon: MessageCircle },
  { to: '/mercado', label: 'Marketplace', icon: ShoppingBag },
  { to: '/provas', label: 'Provas', icon: Trophy },
  { to: '/giveaway', label: 'Giveaway', icon: Gift },
  { to: '/rankings', label: 'Rankings', icon: Medal },
]
