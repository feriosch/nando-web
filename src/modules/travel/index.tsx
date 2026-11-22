import type { Module } from '../../core/module'
import { TravelCards } from './HomeCard'
import { PlaneIcon } from './icon'
import { TravelSettingsSection } from './SettingsSection'
import { TravelScreen } from './TravelScreen'
import { TripPage } from './TripPage'

// The Travel Module: the flight prices the Travel Assistant watches for the Owner's Trips
// (feriosch/nando-server ADR 0013). The app only reads it: the Travel Assistant writes, in Telegram.
export const travel: Module = {
  id: 'travel',
  name: 'Travel',
  path: '/travel',
  // Horizon (src/index.css).
  theme: 'theme-travel',
  icon: PlaneIcon,
  routes: [
    { index: true, element: <TravelScreen /> },
    { path: 'trips/:id', element: <TripPage /> },
  ],
  homeCards: [{ id: 'travel', Component: TravelCards }],
  settingsSections: [{ id: 'travel', title: 'Travel', Component: TravelSettingsSection }],
}
