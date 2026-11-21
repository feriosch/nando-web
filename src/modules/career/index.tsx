import type { Module } from '../../core/module'
import { CareerScreen } from './CareerScreen'
import { CareerCard } from './HomeCard'
import { BriefcaseIcon } from './icon'
import { LateReplies } from './LateReplies'
import { OpenOpportunities } from './OpenOpportunities'
import { OpportunityPage } from './OpportunityPage'
import { RecruiterPage } from './RecruiterPage'
import { CareerSettingsSection } from './SettingsSection'

export const career: Module = {
  id: 'career',
  name: 'Career',
  path: '/career',
  // Slate (src/index.css).
  theme: 'theme-career',
  icon: BriefcaseIcon,
  routes: [
    { index: true, element: <CareerScreen /> },
    { path: 'recruiters/:id', element: <RecruiterPage /> },
    { path: 'late', element: <LateReplies /> },
    { path: 'opportunities', element: <OpenOpportunities /> },
    { path: 'opportunities/:id', element: <OpportunityPage /> },
  ],
  homeCards: [{ id: 'career', Component: CareerCard }],
  settingsSections: [{ id: 'career', title: 'Career', Component: CareerSettingsSection }],
}
