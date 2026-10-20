import { useState } from 'react'
import { Link, Outlet } from 'react-router'
import type { Module } from '../module'

export function Layout({ modules }: { modules: Module[] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <header>
        <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          Menu
        </button>
      </header>
      {menuOpen && (
        <nav>
          <Link to="/" onClick={closeMenu}>
            Home
          </Link>
          <ul>
            {modules.map((module) => (
              <li key={module.id}>
                <Link to={module.path} onClick={closeMenu}>
                  {module.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/settings" onClick={closeMenu}>
            Settings
          </Link>
        </nav>
      )}
      <main>
        <Outlet />
      </main>
    </>
  )
}
