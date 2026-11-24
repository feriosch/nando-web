import { ConnectorsSettingsSection } from './connectors/ConnectorsSettingsSection'
import { CoreSettingsSection } from './settings/CoreSettingsSection'
import { SyncKeysSettingsSection } from './syncKeys/SyncKeysSettingsSection'
import type { Contributions } from './module'

// Core's own Home Cards and Settings Sections.
export const core: Contributions = {
  homeCards: [],
  settingsSections: [
    { id: 'core', title: 'General', Component: CoreSettingsSection },
    { id: 'connectors', title: 'Connectors', Component: ConnectorsSettingsSection },
    { id: 'sync-keys', title: 'Sync Keys', Component: SyncKeysSettingsSection },
  ],
}
