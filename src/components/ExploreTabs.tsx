import { NavLink } from 'react-router'
import { cx } from './ui'

const TABS = [
  { to: '/explorar', label: 'Barragens' },
  { to: '/rios', label: 'Rios' },
  { to: '/zonas', label: 'Concessões e zonas' },
  { to: '/licencas', label: 'Licenças e lei' },
]

/** Separadores de topo da secção Explorar (cada um com URL próprio). */
export function ExploreTabs() {
  return (
    <nav aria-label="Secções de Explorar" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            cx('press inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13.5px] font-bold', isActive ? 'bg-ink text-white' : 'bg-white text-ink shadow-card hover:bg-mist')
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
