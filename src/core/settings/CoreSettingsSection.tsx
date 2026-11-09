import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useLoadedSinceMount } from '../api/loaded'
import { useApi } from '../services'
import { LoadProblem } from '../shell/LoadProblem'
import type { CoreSettings, Weekday } from './settings'

const weekdays: { value: Weekday; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

// "00:00" to "23:30": the reminder goes out on the hour or half hour, when the scheduler ticks.
const times = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

// Core's Settings Section: the Owner Time Zone, height and the Weigh-in reminder.
export function CoreSettingsSection() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<CoreSettings>('/api/settings') })
  // The form starts from the saved settings and Save sends all of them back, so it waits for ones
  // loaded since the section opened: a cached copy could undo a change made on another device.
  const loaded = useLoadedSinceMount(settings)
  if (loaded && settings.data) return <SettingsForm saved={settings.data} />
  if (settings.isError) return <LoadProblem message="Couldn't load the settings." retry={() => settings.refetch()} />
  return null
}

function SettingsForm({ saved }: { saved: CoreSettings }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [timeZone, setTimeZone] = useState(saved.timeZone)
  const [height, setHeight] = useState(saved.heightCm === null ? '' : String(saved.heightCm))
  const [reminder, setReminder] = useState(saved.weighInReminder)
  const [problem, setProblem] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (settings: CoreSettings) => api.put('/api/settings', settings),
    onSuccess: () => {
      // BMI needs the height, and which week is this week depends on the Owner Time Zone.
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['body'] })
    },
  })

  // Every IANA time zone, plus the saved one in case this browser doesn't list it (such as "UTC").
  const timeZones = Intl.supportedValuesOf('timeZone')
  if (!timeZones.includes(timeZone)) timeZones.unshift(timeZone)

  function submit(event: FormEvent) {
    event.preventDefault()
    const heightCm = parseHeight(height)
    if (heightCm === undefined) {
      setProblem('Enter your height as a whole number of cm from 1 to 300, or leave it empty.')
      save.reset()
      return
    }
    setProblem(null)
    save.mutate({ timeZone, heightCm, weighInReminder: reminder })
  }

  return (
    <form onSubmit={submit}>
      <label>
        Time zone
        <select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
      <label>
        Height (cm)
        <input value={height} onChange={(event) => setHeight(event.target.value)} inputMode="numeric" />
      </label>
      <fieldset>
        <legend>Weigh-in reminder</legend>
        <label>
          <input
            type="checkbox"
            checked={reminder.enabled}
            onChange={(event) => setReminder({ ...reminder, enabled: event.target.checked })}
          />
          Remind me to weigh in
        </label>
        <label>
          Weekday
          <select
            value={reminder.weekday}
            onChange={(event) => setReminder({ ...reminder, weekday: event.target.value as Weekday })}
          >
            {weekdays.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Time
          <select value={reminder.time} onChange={(event) => setReminder({ ...reminder, time: event.target.value })}>
            {times.map((time) => (
              <option key={time}>{time}</option>
            ))}
          </select>
        </label>
      </fieldset>
      <button type="submit">Save</button>
      {save.isSuccess && <p role="status">Saved.</p>}
      {(problem || save.isError) && <p role="alert">{problem ?? describe(save.error)}</p>}
    </form>
  )
}

// A height the server takes: a whole number of cm from 1 to 300, or null when left empty.
// Anything else is undefined.
function parseHeight(typed: string): number | null | undefined {
  const trimmed = typed.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return undefined
  const cm = Number(trimmed)
  return cm >= 1 && cm <= 300 ? cm : undefined
}

function describe(error: unknown): string {
  // A 400's message says which setting the server refused.
  if (error instanceof ApiError && error.status === 400 && error.detail) {
    return `Couldn't save the settings: ${error.detail}`
  }
  return "Couldn't save the settings."
}
