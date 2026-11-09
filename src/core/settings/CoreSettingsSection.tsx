import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useLoadedSinceMount } from '../api/loaded'
import { useApi } from '../services'
import { LoadProblem } from '../shell/LoadProblem'
import { AppearanceControl } from '../appearance/AppearanceControl'
import { Button } from '../ui/Button'
import { GroupedList, ListRow } from '../ui/List'
import { Picker, PickerRow } from '../ui/Picker'
import { saveFooter } from '../ui/saveFooter'
import { Switch } from '../ui/Switch'
import { reminderTimes, type CoreSettings, type Weekday } from './settings'

const weekdays: { value: Weekday; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

// Core's Settings Section, "General": Appearance, then the Owner Time Zone, height and the Weigh-in
// reminder, which save together.
export function CoreSettingsSection() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<CoreSettings>('/api/settings') })
  // The form starts from the saved settings and Save sends all of them back, so it waits for ones
  // loaded since the section opened: a cached copy could undo a change made on another device.
  const loaded = useLoadedSinceMount(settings)
  // Once the form is up, a failed reload says so above it but leaves what the Owner typed.
  return (
    <>
      <AppearanceControl />
      {settings.isError && <LoadProblem message="Couldn't load the settings." retry={() => settings.refetch()} />}
      {loaded && settings.data && <SettingsForm saved={settings.data} />}
    </>
  )
}

function SettingsForm({ saved }: { saved: CoreSettings }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [timeZone, setTimeZone] = useState(saved.timeZone)
  const [height, setHeight] = useState(saved.heightCm === null ? '' : String(saved.heightCm))
  const [reminder, setReminder] = useState(saved.weighInReminder)
  const [problem, setProblem] = useState<string | null>(null)
  const heightId = useId()
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
    <form onSubmit={submit} className="my-0">
      <GroupedList footer={saveFooter(save.isSuccess && 'Saved.', problem ?? (save.isError ? describe(save.error) : null))}>
        <PickerRow
          label="Time zone"
          value={timeZone}
          options={timeZones.map((zone) => ({ value: zone, label: zone }))}
          onChange={setTimeZone}
        />
        <ListRow className="text-[17px]">
          {/* Named "Height (cm)"; the unit shows after the field instead. */}
          <label htmlFor={heightId} className="my-0 flex min-h-11 flex-1 items-center">
            Height<span className="sr-only"> (cm)</span>
          </label>
          <span className="flex items-center gap-1 text-sub">
            <input
              id={heightId}
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              inputMode="numeric"
              placeholder="Not set"
              className="m-0 w-24 border-0 bg-transparent p-0 text-right text-[17px] text-sub tabular-nums outline-none placeholder:text-sub/60"
            />
            {height.trim() !== '' && <span aria-hidden="true">cm</span>}
          </span>
        </ListRow>
        <ListRow className="text-[17px]">
          <Switch isSelected={reminder.enabled} onChange={(enabled) => setReminder({ ...reminder, enabled })}>
            Weigh-in reminder
          </Switch>
        </ListRow>
        {reminder.enabled && (
          <ListRow className="text-[17px]">
            <span>When</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <Picker
                label="Weekday"
                value={reminder.weekday}
                options={weekdays}
                onChange={(weekday) => setReminder({ ...reminder, weekday: weekday as Weekday })}
                display={`${weekdays.find(({ value }) => value === reminder.weekday)?.label}s,`}
              />
              <Picker
                label="Time"
                value={reminder.time}
                options={reminderTimes.map((time) => ({ value: time, label: time }))}
                onChange={(time) => setReminder({ ...reminder, time })}
                className="tabular-nums"
              />
            </span>
          </ListRow>
        )}
      </GroupedList>
      <div className="mt-3 flex justify-end">
        <Button type="submit" variant="accent">
          Save
        </Button>
      </div>
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
