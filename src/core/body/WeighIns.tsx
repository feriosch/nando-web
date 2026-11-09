import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useLoadedSinceMount } from '../api/loaded'
import { useApi } from '../services'
import { LoadProblem } from '../shell/LoadProblem'
import type { CoreSettings } from '../settings/settings'
import type { WeighIn } from './body'
import { formatWeek, weekBefore, weekOf } from './weeks'

// The Weigh-ins screen: log or change this week's and last week's Weigh-in, and every Weigh-in so far.
export function WeighIns() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<CoreSettings>('/api/settings') })
  const weighIns = useQuery({ queryKey: ['weigh-ins'], queryFn: () => api.get<WeighIn[]>('/api/weigh-ins') })
  const weighInsLoaded = useLoadedSinceMount(weighIns)

  const [thisWeek, recheckThisWeek] = useThisWeek(settings.data?.timeZone)
  // Set when a Save was stopped because the week moved on since the forms were filled in.
  const [weekMovedOn, setWeekMovedOn] = useState(false)
  // Whether `thisWeek` is still this week as a form is submitted. If not, the forms move on.
  const stillThisWeek = () => {
    const movedOn = recheckThisWeek() !== thisWeek
    setWeekMovedOn(movedOn)
    return !movedOn
  }
  const kgOf = (week: string) => weighIns.data?.find((weighIn) => weighIn.week === week)?.kg

  return (
    <>
      <h1>Weigh-ins</h1>
      {(settings.isError || weighIns.isError) && (
        <LoadProblem
          message="Couldn't load your Weigh-ins."
          retry={() => {
            if (settings.isError) settings.refetch()
            if (weighIns.isError) weighIns.refetch()
          }}
        />
      )}
      {weekMovedOn && (
        <p role="alert">A new week has started, so nothing was saved. Enter the weight again for the week it belongs to.</p>
      )}
      {/* The forms start from the saved Weigh-ins, so they wait for ones loaded since the screen
          opened rather than a cached copy. Keyed by form and week, so each form starts over when the
          week moves on, rather than "Last week" taking over a weight typed into "This week". */}
      {thisWeek && weighInsLoaded && (
        <>
          <WeekForm
            key={`this-week-${thisWeek}`}
            name="This week"
            week={thisWeek}
            kg={kgOf(thisWeek)}
            stillThisWeek={stillThisWeek}
          />
          <WeekForm
            key={`last-week-${weekBefore(thisWeek)}`}
            name="Last week"
            week={weekBefore(thisWeek)}
            kg={kgOf(weekBefore(thisWeek))}
            stillThisWeek={stillThisWeek}
          />
        </>
      )}
      {weighIns.data && (
        <>
          <h2 id="weigh-ins-history">History</h2>
          <ul aria-labelledby="weigh-ins-history">
            {weighIns.data.map((weighIn) => (
              <li key={weighIn.week}>
                Week of {formatWeek(weighIn.week)}: {weighIn.kg.toFixed(1)} kg
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

// This week in `timeZone`, checked again every minute and whenever the Owner comes back to the
// app: a Home Screen app can stay open for days, and this week moves on every Monday. The second
// value checks it right away and answers this week as it is now.
function useThisWeek(timeZone: string | undefined): [string | undefined, () => string | undefined] {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    const interval = setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
    }
  }, [])
  const recheck = () => {
    const now = new Date()
    setNow(now)
    return timeZone === undefined ? undefined : weekOf(now, timeZone)
  }
  return [timeZone === undefined ? undefined : weekOf(now, timeZone), recheck]
}

// The form to log or change one week's Weigh-in, starting from the one it has, if any.
function WeekForm({
  name,
  week,
  kg: savedKg,
  stillThisWeek,
}: {
  name: string
  week: string
  kg: number | undefined
  stillThisWeek: () => boolean
}) {
  const api = useApi()
  const queryClient = useQueryClient()
  const headingId = useId()
  const [kg, setKg] = useState(savedKg === undefined ? '' : savedKg.toFixed(1))
  const [problem, setProblem] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (kg: number) => api.put(`/api/weigh-ins/${week}`, { kg }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weigh-ins'] })
      queryClient.invalidateQueries({ queryKey: ['body'] })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    // Monday may have started since the forms were filled in; then this form is for the wrong week.
    if (!stillThisWeek()) return
    const parsed = parseKg(kg)
    if (parsed === null) {
      setProblem('Enter a weight in kg above 0 and up to 500, with at most 1 decimal.')
      save.reset()
      return
    }
    setProblem(null)
    save.mutate(parsed)
  }

  return (
    <form aria-labelledby={headingId} onSubmit={submit}>
      <h2 id={headingId}>{name}</h2>
      <label>
        Weight (kg)
        <input value={kg} onChange={(event) => setKg(event.target.value)} inputMode="decimal" />
      </label>
      <button type="submit">Save</button>
      {save.isSuccess && <p role="status">Saved.</p>}
      {(problem || save.isError) && <p role="alert">{problem ?? describe(save.error)}</p>}
    </form>
  )
}

// A weight the server takes: more than 0 and at most 500 kg, to at most 1 decimal; otherwise null.
// A decimal comma counts as a decimal point: the iPhone's decimal keypad types one in some regions.
function parseKg(typed: string): number | null {
  const normalized = typed.trim().replace(',', '.')
  // Trailing zeros, as in 72.40, add no decimal.
  if (!/^\d+(\.\d0*)?$/.test(normalized)) return null
  const kg = Number(normalized)
  return kg > 0 && kg <= 500 ? kg : null
}

function describe(error: unknown): string {
  // The week ended while the screen was open, so it is now read-only.
  if (error instanceof ApiError && error.status === 409) {
    return 'That week can no longer be changed. Only this week and last week can.'
  }
  return "Couldn't save the Weigh-in."
}
