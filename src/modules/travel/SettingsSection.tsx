import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { GroupedList, ListRow } from '../../core/ui/List'
import type { TravelSettings } from './travel'

// The Travel Settings Section: when Nando asks the Travel Assistant for the Fare Checks, and who the
// Companion is. It only shows them: the Owner changes them in the Travel chat (ADR 0013).
export function TravelSettingsSection() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['travel', 'settings'], queryFn: () => api.get<TravelSettings>('/api/travel/settings') })
  if (settings.isError) return <LoadProblem message="Couldn't load the Travel settings." retry={() => settings.refetch()} />
  if (!settings.data) return null
  const { dailyFareCheck: daily, weeklyFareCheck: weekly, companion } = settings.data
  return (
    <GroupedList footer="To change these, ask the Travel Assistant in the Travel chat.">
      <ListRow>
        <span>Daily Fare Check</span>
        <span className="text-sub tabular-nums">{daily?.enabled ? daily.time : 'Off'}</span>
      </ListRow>
      <ListRow>
        <span>Weekly Fare Check</span>
        <span className="text-sub tabular-nums">{weekly?.enabled ? `${capitalized(weekly.weekday)} ${weekly.time}` : 'Off'}</span>
      </ListRow>
      <ListRow>
        <span>Companion</span>
        <span className="text-sub">{companion.name || 'None'}</span>
      </ListRow>
    </GroupedList>
  )
}

// A weekday's API name for the Owner to read: "sunday" → "Sunday".
function capitalized(weekday: string): string {
  return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}
