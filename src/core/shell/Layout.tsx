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

  // Any 401 from the API means the Session is gone: back to sign-in.
  useEffect(() => api.onUnauthorized(() => navigate('/sign-in', { replace: true })), [api, navigate])

  return (
    // Room at the bottom for the tab bar, which sits over the end of the screen.
    <ScreenFrame theme={themeAt(pathname, modules)} bottom="pb-[calc(76px+env(safe-area-inset-bottom))]">
      <main>
        <Outlet />
      </main>
      <TabBar modules={modules} />
    </ScreenFrame>
  )
}

// Sign-in and enrolment: Core's theme, with no tab bar.
export function SignedOut({ children }: { children: ReactNode }) {
  return (
    <ScreenFrame theme={coreTheme} bottom="pb-[env(safe-area-inset-bottom)]">
      {children}
    </ScreenFrame>
  )
}

// A screen in `theme`, clear of the safe areas, with 16px side margins. <body> takes the same theme,
// so iOS's rubber-band overscroll shows the screen's own background, and so does the browser's chrome.
function ScreenFrame({ theme, bottom, children }: { theme: string; bottom: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.body.className = theme
    syncThemeColor(frame.current)
  }, [theme])
  return (
    <div ref={frame} data-screen className={`${theme} min-h-dvh bg-bg px-4 pt-[env(safe-area-inset-top)] ${bottom} font-sans text-ink`}>
      {children}
    </div>
  )
}
