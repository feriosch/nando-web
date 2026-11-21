import type { Module } from '../../core/module'
import { Day } from './Day'
import { History } from './History'
import { BowlIcon } from './icon'
import { CaloriesCard } from './HomeCard'
import { Meals } from './Meals'

export const calories: Module = {
  id: 'calories',
  name: 'Calories',
  path: '/calories',
  // Kitchen wood (src/index.css).
  theme: 'theme-calories',
  icon: BowlIcon,
  routes: [
    { index: true, element: <Day /> },
    { path: 'history', element: <History /> },
    { path: 'meals', element: <Meals /> },
  ],
  homeCards: [{ id: 'calories', Component: CaloriesCard }],
  // The Calories Assistant sets the Daily Limit and the reminders.
  settingsSections: [],
}
