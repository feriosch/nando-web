import { Outlet, type RouteObject } from 'react-router'
import { AppearanceProvider } from '../appearance/AppearanceProvider'
import { Consent } from '../connectors/Consent'
import { Enroll } from '../identity/Enroll'
import { SignIn } from '../identity/SignIn'
import type { Registry } from '../module'
import { Home } from './Home'
import { Layout, SignedOut } from './Layout'
import { Modules } from './Modules'
import { Settings, type TintedSettingsSection } from './Settings'
import { coreTheme } from './theme'

export function createRoutes(registry: Registry): RouteObject[] {
  // Each Home Card takes the theme of whoever contributed it.
  const homeCards = [
    ...registry.core.homeCards.map((card) => ({ ...card, theme: coreTheme })),
    ...registry.modules.flatMap((module) => module.homeCards.map((card) => ({ ...card, theme: module.theme }))),
  ]
  // Each Module's Settings Section is tinted with its Module's theme and icon.
  const settingsSections: TintedSettingsSection[] = [
    ...registry.core.settingsSections,
    ...registry.modules.flatMap((module) =>
      module.settingsSections.map((section) => ({ ...section, tint: { theme: module.theme, icon: module.icon } })),
    ),
  ]
  const screens: RouteObject[] = [
    { path: '/sign-in', element: <SignedOut><SignIn /></SignedOut> },
    { path: '/enroll', element: <SignedOut><Enroll /></SignedOut> },
    // Approving a Connector, often in a browser with no Session: no tab bar, like sign-in.
    { path: '/connect', element: <SignedOut><Consent /></SignedOut> },
    {
      path: '/',
      element: <Layout modules={registry.modules} />,
      children: [
        { index: true, element: <Home cards={homeCards} /> },
        { path: 'settings', element: <Settings sections={settingsSections} /> },
        { path: 'modules', element: <Modules modules={registry.modules} /> },
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
