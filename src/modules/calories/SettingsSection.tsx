import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../../core/api/client'
import { useLoadedSinceMount } from '../../core/api/loaded'
import { useApi } from '../../core/services'
import { reminderTimes } from '../../core/settings/settings'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { parseWhole } from './calories'

// The Daily Limit in force now, as GET /api/calories/daily-limit answers it (null until one is set).
type DailyLimit = { kcal: number; effectiveFrom: string } | null

// When each Calories Notification is sent, as GET /api/calories/settings answers them and PUT takes
// them. `time` is "HH:MM" on the hour or half hour, in the Owner Time Zone.
type Reminder = { enabled: boolean; time: string }
type CaloriesSettings = { noEntriesReminder: Reminder; eveningSummary: Reminder }

// The Calories Settings Section: the Daily Limit and the Calories Notifications. Each saves on its
// own, since a new Daily Limit applies from today.
export function CaloriesSettingsSection() {
  return (
    <>
      <DailyLimitSettings />
      <ReminderSettings />
    </>
  )
}

function DailyLimitSettings() {
  const api = useApi()
  const limit = useQuery({ queryKey: ['calories', 'daily-limit'], queryFn: () => api.get<DailyLimit>('/api/calories/daily-limit') })
  const loaded = useLoadedSinceMount(limit)
  return (
    <>
      {limit.isError && <LoadProblem message="Couldn't load the Daily Limit." retry={() => limit.refetch()} />}
      {loaded && limit.data !== undefined && <DailyLimitForm saved={limit.data} />}
    </>
  )
}

function DailyLimitForm({ saved }: { saved: DailyLimit }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState(saved === null ? '' : String(saved.kcal))
  const [problem, setProblem] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (kcal: number) => api.put('/api/calories/daily-limit', { kcal }),
    // Today, and so the Home Card and the Day view, is judged against the new limit.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calories'] }),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const kcal = parseWhole(typed, 1, 10_000)
    if (kcal === null) {
      setProblem('Enter the Daily Limit as a whole number of kcal from 1 to 10,000.')
      save.reset()
      return
    }
    setProblem(null)
    save.mutate(kcal)
  }

  return (
    <form aria-label="Daily Limit" onSubmit={submit}>
      <label>
        Daily Limit (kcal)
        <input value={typed} onChange={(event) => setTyped(event.target.value)} inputMode="numeric" />
      </label>
      <button type="submit">Save</button>
      {save.isSuccess && <p role="status">Saved. It applies from today.</p>}
      {(problem || save.isError) && <p role="alert">{problem ?? describe(save.error, 'the Daily Limit')}</p>}
    </form>
  )
}

function ReminderSettings() {
  const api = useApi()
  const settings = useQuery({
    queryKey: ['calories', 'settings'],
    queryFn: () => api.get<CaloriesSettings>('/api/calories/settings'),
  })
  // Save sends all of them back, so the form starts from what the server has now.
  const loaded = useLoadedSinceMount(settings)
  return (
    <>
      {settings.isError && <LoadProblem message="Couldn't load the reminders." retry={() => settings.refetch()} />}
      {loaded && settings.data && <ReminderForm saved={settings.data} />}
    </>
  )
}

function ReminderForm({ saved }: { saved: CaloriesSettings }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState(saved)
  const save = useMutation({
    mutationFn: (settings: CaloriesSettings) => api.put('/api/calories/settings', settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calories', 'settings'] }),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate(settings)
  }

  return (
    <form aria-label="Reminders" onSubmit={submit}>
      <ReminderFields
        legend="Nothing logged yet"
        reminder={settings.noEntriesReminder}
        change={(noEntriesReminder) => setSettings({ ...settings, noEntriesReminder })}
      />
      <ReminderFields
        legend="Evening summary"
        reminder={settings.eveningSummary}
        change={(eveningSummary) => setSettings({ ...settings, eveningSummary })}
      />
      <button type="submit">Save</button>
      {save.isSuccess && <p role="status">Saved.</p>}
      {save.isError && <p role="alert">{describe(save.error, 'the reminders')}</p>}
    </form>
  )
}

// One Calories Notification: whether it is sent, and when.
function ReminderFields({ legend, reminder, change }: { legend: string; reminder: Reminder; change: (reminder: Reminder) => void }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <label>
        <input
          type="checkbox"
          role="switch"
          checked={reminder.enabled}
          onChange={(event) => change({ ...reminder, enabled: event.target.checked })}
        />
        Send it
      </label>
      <label>
        Time
        <select value={reminder.time} onChange={(event) => change({ ...reminder, time: event.target.value })}>
          {reminderTimes.map((time) => (
            <option key={time}>{time}</option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

function describe(error: unknown, what: string): string {
  // A 400's message says what the server refused.
  if (error instanceof ApiError && error.status === 400 && error.detail) return `Couldn't save ${what}: ${error.detail}`
  return `Couldn't save ${what}.`
}
