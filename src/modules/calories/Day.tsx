import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { addDays, isDay } from '../../core/days'
import { ApiError } from '../../core/api/client'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import './calories.css'
import { Summary } from './Summary'
import { formatDay, kcal, parseWhole, type DaySummary, type DayView, type Entry, type Meal, type NewEntry } from './calories'

// The Day view: a Day's Entries and how it stands against its Daily Limit.
export function Day() {
  const api = useApi()
  const { today, settings } = useToday()
  // Today unless the address names another Day, as the picker (or the history) does.
  const [searchParams, setSearchParams] = useSearchParams()
  const asked = searchParams.get('day')
  const day = asked && isDay(asked) ? asked : today
  const editableFrom = today && addDays(today, -7)
  const editable = day !== undefined && today !== undefined && day >= editableFrom! && day <= today
  const view = useQuery({
    queryKey: ['calories', 'day', day],
    queryFn: () => api.get<DayView>(`/api/calories/days/${day}`),
    enabled: day !== undefined,
  })

  return (
    <>
      {day && <h1>{day === today ? `Today, ${formatDay(day)}` : formatDay(day)}</h1>}
      {day && today && (
        <label>
          Day
          <input
            type="date"
            value={day}
            min={editableFrom}
            max={today}
            onChange={(event) => {
              const picked = event.target.value
              if (picked >= editableFrom! && picked <= today) setSearchParams(picked === today ? {} : { day: picked })
            }}
          />
        </label>
      )}
      {day && today && !editable && <p>{day > today ? 'This Day hasn’t started yet.' : 'This Day can no longer be changed.'}</p>}
      {(settings.isError || view.isError) && (
        <LoadProblem
          message="Couldn't load the Day."
          retry={() => {
            if (settings.isError) settings.refetch()
            if (view.isError) view.refetch()
          }}
        />
      )}
      {view.data && (editable ? <EditableDay key={view.data.day} view={view.data} /> : <ReadOnlyDay view={view.data} />)}
      <p>
        <Link to="history">History</Link>
      </p>
      <p>
        <Link to="meals">Meals</Link>
      </p>
    </>
  )
}

function ReadOnlyDay({ view }: { view: DayView }) {
  return (
    <>
      <Summary view={view} />
      <h2 id="calories-entries">Entries</h2>
      <ul aria-labelledby="calories-entries">
        {view.entries.map((entry) => (
          <li key={entry.id}>{describeEntry(entry)}</li>
        ))}
      </ul>
    </>
  )
}

// A Day in the Editable Window: its Entries can be changed, and more logged. Every log or change
// is checked against the Daily Limit first.
function EditableDay({ view }: { view: DayView }) {
  const guard = useGuard(view.day)
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <>
      {guard.sheet}
      <Summary view={view} />
      <h2 id="calories-entries">Entries</h2>
      <ul aria-labelledby="calories-entries">
        {view.entries.map((entry) => (
          <li key={entry.id}>
            {editing === entry.id ? (
              <EditEntryForm entry={entry} guard={guard} done={() => setEditing(null)} />
            ) : (
              <>
                {describeEntry(entry)}{' '}
                <button type="button" onClick={() => setEditing(entry.id)}>
                  Edit
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <QuickList day={view.day} guard={guard} />
      <OneOffForm day={view.day} guard={guard} />
    </>
  )
}

// Such as "Sushi × 12: 540 kcal".
function describeEntry(entry: Entry): string {
  return `${entry.servings === 1 ? entry.name : `${entry.name} × ${entry.servings}`}: ${kcal(entry.kcal)} kcal`
}

// Changes or deletes one Entry.
function EditEntryForm({ entry, guard, done }: { entry: Entry; guard: Guard; done: () => void }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const headingId = useId()
  const [fields, setFields] = useState<EntryFields>({
    name: entry.name,
    kcalPerServing: String(entry.kcalPerServing),
    servings: String(entry.servings),
  })
  const [problem, setProblem] = useState<string | null>(null)
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['calories'] })
    done()
  }
  const save = useMutation({
    mutationFn: (values: { name: string; kcalPerServing: number; servings: number }) => api.put(`/api/calories/entries/${entry.id}`, values),
    onSuccess,
    onError: (error) => guard.fail(error, "Couldn't change the Entry."),
  })
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/calories/entries/${entry.id}`),
    onSuccess,
    onError: (error) => guard.fail(error, "Couldn't delete the Entry."),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseEntryFields(fields)
    if (!parsed) {
      setProblem(entryProblem)
      return
    }
    setProblem(null)
    guard.check(parsed.kcalPerServing * parsed.servings, () => save.mutateAsync(parsed), { replacing: entry.id })
  }

  return (
    <form aria-labelledby={headingId} onSubmit={submit}>
      <h3 id={headingId}>Edit Entry</h3>
      <EntryFieldInputs fields={fields} onChange={setFields} />
      <button type="submit">Save</button>
      <button type="button" onClick={() => remove.mutate()}>
        Delete
      </button>
      <button type="button" onClick={done}>
        Cancel
      </button>
      {problem && <p role="alert">{problem}</p>}
    </form>
  )
}

// Logs Entries on `day`, and has every list showing the Day load it again.
function useLog(day: string, guard: Guard) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entry: NewEntry) => api.post<{ id: string }>(`/api/calories/days/${day}/entries`, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calories'] })
    },
    onError: (error) => guard.fail(error, "Couldn't log the Entry."),
  })
}

// Asks the server what an Entry of `kcal` (or, with `replacing`, that Entry changed to `kcal`)
// would make of `day`, and goes ahead only if that stays within the Daily Limit. Otherwise it asks
// the Owner first. One log or change at a time: a second tap while one is under way does nothing.
// `sheet`, kept in view at the bottom of the screen, asks before going over and says why a log or
// change failed.
function useGuard(day: string) {
  const api = useApi()
  const busy = useRef(false)
  const [problem, setProblem] = useState<string | null>(null)
  const fail = (error: unknown, failed: string) => {
    // The Day left the Editable Window while the screen was open.
    const outside = error instanceof ApiError && error.status === 409
    setProblem(outside ? 'That Day can no longer be changed. Only today and the 7 Days before it can.' : failed)
  }
  type Proceed = () => Promise<unknown>
  const [pending, setPending] = useState<{ after: DaySummary; proceed: Proceed; replacing?: string } | null>(null)

  // Runs `proceed`, whose own failure is reported by its mutation, then takes the next tap.
  async function run(proceed: Proceed) {
    try {
      await proceed()
    } catch {
      // Already said in `problem`.
    } finally {
      busy.current = false
    }
  }

  async function check(entryKcal: number, proceed: Proceed, { replacing }: { replacing?: string } = {}) {
    if (busy.current) return
    busy.current = true
    const query = new URLSearchParams({ kcal: String(entryKcal) })
    if (replacing) query.set('replacing', replacing)
    setProblem(null)
    let after: DaySummary
    try {
      after = await api.get<DaySummary>(`/api/calories/days/${day}/preview?${query}`)
    } catch (error) {
      fail(error, replacing ? "Couldn't change the Entry." : "Couldn't log the Entry.")
      busy.current = false
      return
    }
    // Still busy while the Owner is asked.
    if (after.overLimit) setPending({ after, proceed, replacing })
    else await run(proceed)
  }

  const warning = pending && (
    <div role="alertdialog" aria-label="Over the Daily Limit" className="calories-sheet">
      <p>
        This takes you to {kcal(pending.after.consumedCalories!)} / {kcal(pending.after.dailyLimit!)} kcal.
      </p>
      <button
        type="button"
        onClick={() => {
          setPending(null)
          run(pending.proceed)
        }}
      >
        {pending.replacing ? 'Save anyway' : 'Log anyway'}
      </button>
      <button
        type="button"
        onClick={() => {
          setPending(null)
          busy.current = false
        }}
      >
        Cancel
      </button>
    </div>
  )

  const sheet =
    warning ||
    (problem && (
      <div className="calories-sheet">
        <p role="alert">{problem}</p>
        <button type="button" onClick={() => setProblem(null)}>
          OK
        </button>
      </div>
    ))

  return { check, sheet, fail }
}

type Guard = ReturnType<typeof useGuard>

// The Meals to log in one tap: pinned first, then the most logged.
function QuickList({ day, guard }: { day: string; guard: Guard }) {
  const api = useApi()
  const meals = useQuery({ queryKey: ['calories', 'meals', 'quick'], queryFn: () => api.get<Meal[]>('/api/calories/meals/quick') })
  const log = useLog(day, guard)

  return (
    <>
      <h2 id="calories-quick-list">Quick list</h2>
      {meals.isError && <LoadProblem message="Couldn't load your Meals." retry={() => meals.refetch()} />}
      <ul aria-labelledby="calories-quick-list">
        {meals.data?.map((meal) => (
          <QuickMeal
            key={meal.id}
            meal={meal}
            log={(servings, done) =>
              guard.check(meal.kcal * servings, () => log.mutateAsync({ mealId: meal.id, servings }).then(done))
            }
          />
        ))}
      </ul>
    </>
  )
}

function QuickMeal({ meal, log }: { meal: Meal; log: (servings: number, done: () => void) => void }) {
  const [servings, setServings] = useState(1)
  return (
    <li>
      <button type="button" onClick={() => log(servings, () => setServings(1))}>
        {meal.emoji && `${meal.emoji} `}
        {meal.name}
      </button>{' '}
      {kcal(meal.kcal)} kcal
      <ServingsStepper servings={servings} onChange={setServings} />
    </li>
  )
}

// Whole Servings from 1 to 100.
function ServingsStepper({ servings, onChange }: { servings: number; onChange: (servings: number) => void }) {
  return (
    <span className="calories-stepper">
      <button type="button" aria-label="Fewer servings" disabled={servings <= 1} onClick={() => onChange(servings - 1)}>
        −
      </button>
      <output aria-label="Servings">{servings}</output>
      <button type="button" aria-label="More servings" disabled={servings >= 100} onClick={() => onChange(servings + 1)}>
        +
      </button>
    </span>
  )
}

const entryProblem = 'Enter a name, kcal per serving as a whole number from 0 to 10,000, and Servings from 1 to 100.'

// Logs something that isn't a Meal (or not yet: "Save as Meal" saves it as one too).
function OneOffForm({ day, guard }: { day: string; guard: Guard }) {
  const headingId = useId()
  const log = useLog(day, guard)
  const [fields, setFields] = useState(emptyFields)
  const [saveAsMeal, setSaveAsMeal] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseEntryFields(fields)
    if (!parsed) {
      setProblem(entryProblem)
      return
    }
    setProblem(null)
    guard.check(parsed.kcalPerServing * parsed.servings, () =>
      log.mutateAsync({ ...parsed, saveAsMeal }).then(() => {
        setFields(emptyFields)
        setSaveAsMeal(false)
      }),
    )
  }

  return (
    <form aria-labelledby={headingId} onSubmit={submit}>
      <h2 id={headingId}>Something else</h2>
      <EntryFieldInputs fields={fields} onChange={setFields} />
      <label>
        <input type="checkbox" checked={saveAsMeal} onChange={(event) => setSaveAsMeal(event.target.checked)} />
        Save as Meal
      </label>
      <button type="submit">Log</button>
      {problem && <p role="alert">{problem}</p>}
    </form>
  )
}

// An Entry's three values as typed.
type EntryFields = { name: string; kcalPerServing: string; servings: string }

const emptyFields: EntryFields = { name: '', kcalPerServing: '', servings: '1' }

function EntryFieldInputs({ fields, onChange }: { fields: EntryFields; onChange: (fields: EntryFields) => void }) {
  return (
    <>
      <label>
        Name
        <input value={fields.name} onChange={(event) => onChange({ ...fields, name: event.target.value })} maxLength={100} />
      </label>
      <label>
        kcal per serving
        <input
          value={fields.kcalPerServing}
          onChange={(event) => onChange({ ...fields, kcalPerServing: event.target.value })}
          inputMode="numeric"
        />
      </label>
      <label>
        Servings
        <input value={fields.servings} onChange={(event) => onChange({ ...fields, servings: event.target.value })} inputMode="numeric" />
      </label>
    </>
  )
}

// The values the server takes for an Entry, or null if one isn't: a name of 1 to 100 characters,
// kcal per serving a whole number from 0 to 10,000 and Servings a whole number from 1 to 100.
function parseEntryFields(fields: EntryFields): { name: string; kcalPerServing: number; servings: number } | null {
  const name = fields.name.trim()
  const kcalPerServing = parseWhole(fields.kcalPerServing, 0, 10_000)
  const servings = parseWhole(fields.servings, 1, 100)
  if (name.length === 0 || name.length > 100 || kcalPerServing === null || servings === null) return null
  return { name, kcalPerServing, servings }
}
