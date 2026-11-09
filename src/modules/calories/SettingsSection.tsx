import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../core/api/client'
import { useLoadedSinceMount } from '../../core/api/loaded'
import { useApi } from '../../core/services'
import { reminderTimeOptions } from '../../core/settings/settings'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { Button } from '../../core/ui/Button'
import { GroupedList, ListRow } from '../../core/ui/List'
import { Picker } from '../../core/ui/Picker'
import { saveFooter } from '../../core/ui/saveFooter'
import { Switch } from '../../core/ui/Switch'
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
  const fieldId = useId()
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
    <form aria-label="Daily Limit" onSubmit={submit} className="my-0">
      <GroupedList
        footer={saveFooter(
          save.isSuccess && 'Saved. It applies from today.',
          problem ?? (save.isError ? describe(save.error, 'the Daily Limit') : null),
        )}
      >
        <ListRow className="pr-2 text-[17px]">
          {/* Named "Daily Limit (kcal)"; the unit shows after the field instead. */}
          <label htmlFor={fieldId} className="my-0 flex min-h-11 flex-1 items-center">
            Daily Limit<span className="sr-only"> (kcal)</span>
          </label>
          <span className="flex items-center gap-1 text-sub">
            <input
              id={fieldId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              inputMode="numeric"
              placeholder="Not set"
              className="m-0 w-20 border-0 bg-transparent p-0 text-right text-[17px] text-sub tabular-nums outline-none placeholder:text-sub/60"
            />
            {/^\d+$/.test(typed.trim()) && <span aria-hidden="true">kcal</span>}
            <Button type="submit" variant="accent" className="ml-2">
              Save
            </Button>
          </span>
        </ListRow>
      </GroupedList>
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
    <form aria-label="Reminders" onSubmit={submit} className="my-0">
      <GroupedList footer={saveFooter(save.isSuccess && 'Saved.', save.isError ? describe(save.error, 'the reminders') : null)}>
        <ReminderRow
          label="Nothing logged yet"
          reminder={settings.noEntriesReminder}
          change={(noEntriesReminder) => setSettings({ ...settings, noEntriesReminder })}
        />
        <ReminderRow
          label="Evening summary"
          reminder={settings.eveningSummary}
          change={(eveningSummary) => setSettings({ ...settings, eveningSummary })}
        />
      </GroupedList>
      <div className="mt-3 flex justify-end">
        <Button type="submit" variant="accent">
          Save
        </Button>
      </div>
    </form>
  )
}

// One Calories Notification as a row: a switch for whether it is sent, and when, underneath.
function ReminderRow({ label, reminder, change }: { label: string; reminder: Reminder; change: (reminder: Reminder) => void }) {
  return (
    <div role="group" aria-label={label}>
      <ListRow className="flex-col items-stretch gap-0 pb-1.5 text-[17px]">
        <Switch isSelected={reminder.enabled} onChange={(enabled) => change({ ...reminder, enabled })}>
          {label}
        </Switch>
        <Picker
          label="Time"
          value={reminder.time}
          options={reminderTimeOptions}
          onChange={(time) => change({ ...reminder, time })}
          className="-mt-3 min-h-8 items-start self-start text-[15px] tabular-nums"
        />
      </ListRow>
    </div>
  )
}

function describe(error: unknown, what: string): string {
  // A 400's message says what the server refused.
  if (error instanceof ApiError && error.status === 400 && error.detail) return `Couldn't save ${what}: ${error.detail}`
  return `Couldn't save ${what}.`
}
