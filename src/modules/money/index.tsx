import type { Module } from '../../core/module'
import { MoneyHomeCard } from './HomeCard'
import { BanknoteIcon } from './icon'
import { CategoryPage } from './CategoryPage'
import { MoneyScreen } from './MoneyScreen'
import { NetWorthPage } from './NetWorthPage'
import { SubscriptionsPage } from './SubscriptionsPage'
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
  routes: [
    { index: true, element: <MoneyScreen /> },
    { path: 'subscriptions', element: <SubscriptionsPage /> },
    { path: 'net-worth', element: <NetWorthPage /> },
    { path: ':month', element: <MoneyScreen /> },
    { path: ':month/:category', element: <CategoryPage /> },
  ],
  homeCards: [{ id: 'money', Component: MoneyHomeCard }],
  settingsSections: [{ id: 'money', title: 'Money', Component: MoneySettingsSection }],
}
