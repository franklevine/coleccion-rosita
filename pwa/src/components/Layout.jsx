import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Galería', icon: '▦' },
  { to: '/precios', label: 'Precios', icon: '$', roles: ['admin', 'editor', 'pricing'] },
  { to: '/artistas', label: 'Artistas', icon: '🎨' },
  { to: '/favoritos', label: 'Favoritos', icon: '♥', roles: ['admin', 'editor', 'viewer'] },
  { to: '/resumen', label: 'Resumen', icon: '◉' },
  { to: '/admin', label: 'Admin', icon: '⚙', roles: ['admin'] },
]

export default function Layout() {
  const { user, role, signOut } = useAuth()

  const visibleNav = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-lg font-semibold text-stone-800">
          Colección Rosita
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400 hidden sm:inline">
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-40">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 text-xs transition-colors ${
                  isActive
                    ? 'text-stone-900 font-medium'
                    : 'text-stone-400 hover:text-stone-600'
                }`
              }
            >
              <span className="text-lg mb-0.5">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
