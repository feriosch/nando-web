import { Outlet, type RouteObject } from 'react-router'
import { AppearanceProvider } from '../appearance/AppearanceProvider'
import { WeighIns } from '../body/WeighIns'
import { Enroll } from '../identity/Enroll'
import { SignIn } from '../identity/SignIn'
import type { Registry } from '../module'
import { Home } from './Home'
import { Layout, SignedOut } from './Layout'
import { More } from './More'
import { Settings } from './Settings'
import { splitTabs } from './tabs'
import { coreTheme } from './theme'

export function createRoutes(registry: Registry): RouteObject[] {
  const contributors = [registry.core, ...registry.modules]
  // Each Home Card takes the theme of whoever contributed it.
  const homeCards = [
    ...registry.core.homeCards.map((card) => ({ ...card, theme: coreTheme })),
    ...registry.modules.flatMap((module) => module.homeCards.map((card) => ({ ...card, theme: module.theme }))),
  ]
  const settingsSections = contributors.flatMap((contributor) => contributor.settingsSections)
  const { more } = splitTabs(registry.modules)

  const screens: RouteObject[] = [
    { path: '/sign-in', element: <SignedOut><SignIn /></SignedOut> },
    { path: '/enroll', element: <SignedOut><Enroll /></SignedOut> },
    {
      path: '/',
      element: <Layout modules={registry.modules} />,
      children: [
        { index: true, element: <Home cards={homeCards} /> },
        { path: 'settings', element: <Settings sections={settingsSections} /> },
        ...(more.length > 0 ? [{ path: 'more', element: <More modules={more} /> }] : []),
        // Core's own screen, opened from the Body Home Card; it has no tab.
        { path: 'weigh-ins', element: <WeighIns /> },
        ...registry.modules.map((module) => ({ path: module.path, children: module.routes })),
      ],
    },
  ]

  // Every screen, sign-in included, shows the Appearance picked on this device.
  return [
    {
      element: (
        <AppearanceProvider>
          <Outlet />
        </AppearanceProvider>
      ),
      children: screens,
    },
  ]
}
