import type { Module } from '../../core/module'
import { MoneyHomeCard } from './HomeCard'
import { BanknoteIcon } from './icon'
import { MoneyScreen } from './MoneyScreen'
import { MoneySettingsSection } from './SettingsSection'

// The Money Module: the Owner's money across Japan and Mexico, from the Statements they send the
// Money Assistant (feriosch/nando-server ADR 0014). The app only reads it: the Money Assistant writes,
// in Telegram.
export const money: Module = {
  id: 'money',
  name: 'Money',
  path: '/money',
  // Ledger (src/index.css).
  theme: 'theme-money',
  icon: BanknoteIcon,
  routes: [{ index: true, element: <MoneyScreen /> }],
  homeCards: [{ id: 'money', Component: MoneyHomeCard }],
  settingsSections: [{ id: 'money', title: 'Money', Component: MoneySettingsSection }],
}
