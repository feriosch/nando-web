import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useApi } from '../services'
import type { CoreSettings } from '../settings/settings'
import type { WeighIn } from './body'
import { formatWeek, weekBefore, weekOf } from './weeks'

// The Weigh-ins screen: log or change this week's and last week's Weigh-in, and every Weigh-in so far.
export function WeighIns() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<CoreSettings>('/api/settings') })
  const weighIns = useQuery({ queryKey: ['weigh-ins'], queryFn: () => api.get<WeighIn[]>('/api/weigh-ins') })

  // Read once, when the screen opens; a save after the week ends is answered 409.
  const [openedAt] = useState(() => new Date())
  const thisWeek = settings.data && weekOf(openedAt, settings.data.timeZone)
  const kgOf = (week: string) => weighIns.data?.find((weighIn) => weighIn.week === week)?.kg

  return (
    <>
      <h1>Weigh-ins</h1>
      {thisWeek && weighIns.data && (
        <>
          <WeekForm name="This week" week={thisWeek} kg={kgOf(thisWeek)} />
          <WeekForm name="Last week" week={weekBefore(thisWeek)} kg={kgOf(weekBefore(thisWeek))} />
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

// The form to log or change one week's Weigh-in, starting from the one it has, if any.
function WeekForm({ name, week, kg: savedKg }: { name: string; week: string; kg: number | undefined }) {
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
    const parsed = parseKg(kg)
    if (parsed === null) {
      setProblem('Enter a weight in kg above 0 and up to 500, with at most 1 decimal.')
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
function parseKg(typed: string): number | null {
  if (!/^\d+(\.\d)?$/.test(typed.trim())) return null
  const kg = Number(typed)
  return kg > 0 && kg <= 500 ? kg : null
}

function describe(error: unknown): string {
  // The week ended while the screen was open, so it is now read-only.
  if (error instanceof ApiError && error.status === 409) {
    return 'This week can no longer be changed. Only this week and last week can.'
  }
  return "Couldn't save the Weigh-in."
}
