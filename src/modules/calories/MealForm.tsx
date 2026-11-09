import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '../../core/api/client'
import { useLoadedSinceMount } from '../../core/api/loaded'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { parseWhole, type Meal } from './calories'
import { useRestore } from './useRestore'

// A Meal as POST and PUT /api/calories/meals take it.
type MealValues = Omit<Meal, 'id' | 'archived'>

// The New Meal screen.
export function NewMeal() {
  const api = useApi()
  return <MealForm title="New Meal" save={(values) => api.post('/api/calories/meals', values)} />
}

// The Edit Meal screen, for a Meal in use or an archived one (which stays archived).
export function EditMeal() {
  const api = useApi()
  const { id } = useParams()
  const inUse = useQuery({ queryKey: ['calories', 'meals', 'in-use'], queryFn: () => api.get<Meal[]>('/api/calories/meals') })
  const archived = useQuery({
    queryKey: ['calories', 'meals', 'archived'],
    queryFn: () => api.get<Meal[]>('/api/calories/meals?archived=true'),
  })
  // The form starts from the Meal as the server has it now, not a cached copy.
  const inUseLoaded = useLoadedSinceMount(inUse)
  const archivedLoaded = useLoadedSinceMount(archived)
  if (inUse.isError || archived.isError) {
    return (
      <LoadProblem
        message="Couldn't load the Meal."
        retry={() => {
          if (inUse.isError) inUse.refetch()
          if (archived.isError) archived.refetch()
        }}
      />
    )
  }
  if (!inUseLoaded || !archivedLoaded) return null
  const meal = [...inUse.data!, ...archived.data!].find((meal) => meal.id === id)
  if (!meal) return <p>There is no such Meal.</p>
  return <MealForm title="Edit Meal" meal={meal} save={(values) => api.put(`/api/calories/meals/${meal.id}`, values)} />
}

// A Meal's values, as typed.
type MealFields = { name: string; kcal: string; store: string; emoji: string; tags: string; pinned: boolean }

// The form for a new Meal or a change to one, starting from `meal`. Back to the Meals screen once saved.
function MealForm({ title, meal, save }: { title: string; meal?: Meal; save: (values: MealValues) => Promise<unknown> }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const headingId = useId()
  const [fields, setFields] = useState<MealFields>({
    name: meal?.name ?? '',
    kcal: meal === undefined ? '' : String(meal.kcal),
    store: meal?.store ?? '',
    emoji: meal?.emoji ?? '',
    tags: meal?.tags.join(', ') ?? '',
    pinned: meal?.pinned ?? false,
  })
  const [problem, setProblem] = useState<string | null>(null)
  const api = useApi()
  const backToMeals = () => {
    queryClient.invalidateQueries({ queryKey: ['calories'] })
    navigate('/calories/meals')
  }
  const mutation = useMutation({ mutationFn: save, onSuccess: backToMeals })
  // Archiving leaves the Meal's Entries as they are; restoring puts it back in use.
  const archive = useMutation({ mutationFn: () => api.delete(`/api/calories/meals/${meal!.id}`), onSuccess: backToMeals })
  const restore = useRestore(backToMeals)

  function submit(event: FormEvent) {
    event.preventDefault()
    const name = fields.name.trim()
    const kcal = parseWhole(fields.kcal, 0, 10_000)
    if (name.length === 0 || kcal === null) {
      setProblem('Enter a name and kcal per serving as a whole number from 0 to 10,000.')
      mutation.reset()
      return
    }
    setProblem(null)
    mutation.mutate({
      name,
      kcal,
      store: fields.store.trim() || null,
      emoji: fields.emoji.trim() || null,
      imageUrl: meal?.imageUrl ?? null,
      tags: [...new Set(fields.tags.split(',').map((tag) => tag.trim()).filter((tag) => tag !== ''))],
      pinned: fields.pinned,
    })
  }

  const text = (field: 'name' | 'kcal' | 'store' | 'emoji' | 'tags') => ({
    value: fields[field],
    onChange: (event: { target: { value: string } }) => setFields({ ...fields, [field]: event.target.value }),
  })

  return (
    <form aria-labelledby={headingId} onSubmit={submit}>
      <h1 id={headingId}>{title}</h1>
      {meal?.archived && <p>Archived: it is not in the quick list and can’t be logged.</p>}
      {meal?.imageUrl && <img src={meal.imageUrl} alt={meal.name} style={{ display: 'block', maxWidth: '100%', borderRadius: 8 }} />}
      <label>
        Name
        <input {...text('name')} maxLength={100} />
      </label>
      <label>
        kcal per serving
        <input {...text('kcal')} inputMode="numeric" />
      </label>
      <label>
        Store
        <input {...text('store')} maxLength={100} />
      </label>
      <label>
        Emoji
        <input {...text('emoji')} />
      </label>
      <label>
        Tags
        <input {...text('tags')} placeholder="snack, conbini" />
      </label>
      <label>
        <input type="checkbox" checked={fields.pinned} onChange={(event) => setFields({ ...fields, pinned: event.target.checked })} />
        Pinned
      </label>
      <button type="submit">Save</button>
      {meal && !meal.archived && (
        <button type="button" onClick={() => archive.mutate()}>
          Archive
        </button>
      )}
      {meal?.archived && (
        <button type="button" onClick={() => restore.mutate(meal.id)}>
          Restore
        </button>
      )}
      {(problem || mutation.isError) && <p role="alert">{problem ?? describe(mutation.error)}</p>}
      {(archive.isError || restore.isError) && <p role="alert">{archive.isError ? "Couldn't archive the Meal." : "Couldn't restore the Meal."}</p>}
    </form>
  )
}

function describe(error: unknown): string {
  if (error instanceof ApiError && error.status === 400 && error.detail) return `Couldn't save the Meal: ${error.detail}`
  return "Couldn't save the Meal."
}

