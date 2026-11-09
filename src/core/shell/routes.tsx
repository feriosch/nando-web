import type { RouteObject } from 'react-router'
import { Enroll } from '../identity/Enroll'
import { SignIn } from '../identity/SignIn'
import type { Registry } from '../module'
import { Home } from './Home'
import { Layout } from './Layout'
import { Settings } from './Settings'

export function createRoutes(registry: Registry): RouteObject[] {
  const contributors = [registry.core, ...registry.modules]
  const homeCards = contributors.flatMap((contributor) => contributor.homeCards)
  const settingsSections = contributors.flatMap((contributor) => contributor.settingsSections)

  return [
    { path: '/sign-in', element: <SignIn /> },
    { path: '/enroll', element: <Enroll /> },
    {
      path: '/',
      element: <Layout modules={registry.modules} />,
      children: [
        { index: true, element: <Home cards={homeCards} /> },
        { path: 'settings', element: <Settings sections={settingsSections} /> },
        ...registry.modules.map((module) => ({ path: module.path, children: module.routes })),
      ],
    },
  ]
}
