import type { Module } from '../../core/module'
import { Day } from './Day'
import { History } from './History'
import { BowlIcon } from './icon'
import { CaloriesCard } from './HomeCard'
import { EditMeal, NewMeal } from './MealForm'
import { Meals } from './Meals'
import { CaloriesSettingsSection } from './SettingsSection'

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
    { path: 'meals/new', element: <NewMeal /> },
    { path: 'meals/:id', element: <EditMeal /> },
  ],
  homeCards: [{ id: 'calories', Component: CaloriesCard }],
  settingsSections: [{ id: 'calories', title: 'Calories', Component: CaloriesSettingsSection }],
}
