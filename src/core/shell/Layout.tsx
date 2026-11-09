import { useEffect, useRef, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { syncThemeColor } from '../appearance/appearance'
import type { Module } from '../module'
import { useApi } from '../services'
import { TabBar } from './TabBar'
import { coreTheme, themeAt } from './theme'

// Every signed-in screen: the screen on view, in its theme, over the tab bar, which takes the same theme.
export function Layout({ modules }: { modules: Module[] }) {
  const api = useApi()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const theme = themeAt(pathname, modules)
  const frame = useRef<HTMLDivElement>(null)

  // Any 401 from the API means the Session is gone: back to sign-in.
  useEffect(() => api.onUnauthorized(() => navigate('/sign-in', { replace: true })), [api, navigate])

  // The browser's own chrome follows the background of the screen on view.
  useEffect(() => syncThemeColor(frame.current), [theme])

  return (
    <div ref={frame} data-screen className={`${theme} min-h-dvh bg-bg font-sans text-ink`}>
      <main className="px-4 pt-[env(safe-area-inset-top)] pb-[calc(76px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <TabBar modules={modules} />
    </div>
  )
}

// Sign-in and enrolment: Core's theme, with no tab bar.
export function SignedOut({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => syncThemeColor(frame.current), [])
  return (
    <div ref={frame} data-screen className={`${coreTheme} min-h-dvh bg-bg px-4 pt-[env(safe-area-inset-top)] font-sans text-ink`}>
      {children}
    </div>
  )
}
