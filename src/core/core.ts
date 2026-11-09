import { BodyCard } from './body/BodyCard'
import { NotificationsSettingsSection } from './notifications/NotificationsSettingsSection'
import { CoreSettingsSection } from './settings/CoreSettingsSection'
import type { Contributions } from './module'

// Core's own Home Cards and Settings Sections.
export const core: Contributions = {
  homeCards: [{ id: 'body', Component: BodyCard }],
  settingsSections: [
    { id: 'core', title: 'General', Component: CoreSettingsSection },
    { id: 'notifications', title: 'Notifications', Component: NotificationsSettingsSection },
  ],
}
