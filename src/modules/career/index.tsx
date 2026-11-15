import type { Module } from '../../core/module'
import { CareerScreen } from './CareerScreen'
import { CareerCard } from './HomeCard'
import { BriefcaseIcon } from './icon'

export const career: Module = {
  id: 'career',
  name: 'Career',
  path: '/career',
  // Slate (src/index.css).
  theme: 'theme-career',
  icon: BriefcaseIcon,
  routes: [{ index: true, element: <CareerScreen /> }],
  homeCards: [{ id: 'career', Component: CareerCard }],
  settingsSections: [],
}
