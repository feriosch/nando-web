import type { Module } from '../../core/module'

export const calories: Module = {
  id: 'calories',
  name: 'Calories',
  path: '/calories',
  routes: [{ index: true, element: <h1>Calories</h1> }],
  homeCards: [],
  settingsSections: [],
}
