import type { Module } from '../../core/module'
import { Day } from './Day'
import { EditMeal, NewMeal } from './MealForm'
import { Meals } from './Meals'

export const calories: Module = {
  id: 'calories',
  name: 'Calories',
  path: '/calories',
  routes: [
    { index: true, element: <Day /> },
    { path: 'meals', element: <Meals /> },
    { path: 'meals/new', element: <NewMeal /> },
    { path: 'meals/:id', element: <EditMeal /> },
  ],
  homeCards: [],
  settingsSections: [],
}
