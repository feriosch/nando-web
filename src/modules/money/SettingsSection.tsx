import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { GroupedList, ListRow } from '../../core/ui/List'
import { joinNames, ordinal, pesos, yen, type MoneySettings } from './money'

// The Money Settings Section: each Statement Reminder with its day and Accounts, when they come, and
// above what the Money Assistant asks about a line it can't tell. It only shows them: the Owner
// changes them in the Money chat (ADR 0014).
export function MoneySettingsSection() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['money', 'settings'], queryFn: () => api.get<MoneySettings>('/api/money/settings') })
  if (settings.isError) return <LoadProblem message="Couldn't load the Money settings." retry={() => settings.refetch()} />
  if (!settings.data) return null
  const { reminders, reminderTime, askAbove } = settings.data
  return (
    <GroupedList footer="To change these, ask the Money Assistant in the Money chat.">
      {reminders.length === 0 && (
        <ListRow>
          <span>Statement Reminders</span>
          <span className="text-sub">None</span>
        </ListRow>
      )}
      {reminders.map((reminder) => (
        <ListRow key={reminder.name}>
          <span className="block">
            <span className="block">{reminder.name}</span>
            <span className="block text-[13px] text-sub">
              {ordinal(reminder.day)} · {joinNames(reminder.accounts)}
            </span>
          </span>
        </ListRow>
      ))}
      <ListRow>
        <span>Reminder time</span>
        <span className="text-sub tabular-nums">{reminderTime}</span>
      </ListRow>
      <ListRow>
        <span>Ask above</span>
        <span className="text-sub tabular-nums">
          {yen(askAbove.JPY)} · {pesos(askAbove.MXN)}
        </span>
      </ListRow>
    </GroupedList>
  )
}
