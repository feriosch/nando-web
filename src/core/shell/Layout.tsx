import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'
import { useApi } from '../services'
import type { Module } from '../module'

export function Layout({ modules }: { modules: Module[] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  const api = useApi()
  const navigate = useNavigate()

  // Any 401 from the API means the Session is gone: back to sign-in.
  useEffect(() => api.onUnauthorized(() => navigate('/sign-in', { replace: true })), [api, navigate])

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
