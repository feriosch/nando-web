import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '../../core/api/client'
import { useLoadedSinceMount } from '../../core/api/loaded'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { Button } from '../../core/ui/Button'
import { FieldRow } from '../../core/ui/FieldRow'
import { GroupedList, ListRow } from '../../core/ui/List'
import { EmptyNote, Notice } from '../../core/ui/Notice'
import { saveFooter } from '../../core/ui/saveFooter'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { Switch } from '../../core/ui/Switch'
import { parseWhole, type Meal } from './calories'
import { restoreProblem, useRestore } from './useRestore'

// A Meal as POST and PUT /api/calories/meals take it.
type MealValues = Omit<Meal, 'id' | 'archived'>

// The New Meal screen.
export function NewMeal() {
  const api = useApi()
  return (
    <MealScreen title="New Meal">
      <MealForm title="New Meal" save={(values) => api.post('/api/calories/meals', values)} />
    </MealScreen>
  )
}

// The Meal form's screen: back to the Meals screen, and `title` in large.
function MealScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <ScreenHeader title={title} back={{ to: '/calories/meals', label: 'Meals' }} />
      {children}
    </>
  )
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
  const meal = inUseLoaded && archivedLoaded ? [...inUse.data!, ...archived.data!].find((meal) => meal.id === id) : undefined
  return (
    <MealScreen title="Edit Meal">
      {inUse.isError || archived.isError ? (
        <LoadProblem
          message="Couldn't load the Meal."
          retry={() => {
            if (inUse.isError) inUse.refetch()
            if (archived.isError) archived.refetch()
          }}
        />
      ) : meal ? (
        <MealForm title="Edit Meal" meal={meal} save={(values) => api.put(`/api/calories/meals/${meal.id}`, values)} />
      ) : (
        inUseLoaded && archivedLoaded && <EmptyNote>There is no such Meal.</EmptyNote>
      )}
    </MealScreen>
  )
}

// A Meal's values, as typed.
type MealFields = { name: string; kcal: string; store: string; emoji: string; tags: string; pinned: boolean }

// The form for a new Meal or a change to one, starting from `meal`, named `title`. Back to the Meals
// screen once saved, archived or restored.
function MealForm({ title, meal, save }: { title: string; meal?: Meal; save: (values: MealValues) => Promise<unknown> }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
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
    navigate('/calories/meals', { viewTransition: true })
  }
  const mutation = useMutation({ mutationFn: save, onSuccess: backToMeals })
  // Archiving leaves the Meal's Entries as they are; restoring puts it back in use.
  const archive = useMutation({ mutationFn: () => api.delete(`/api/calories/meals/${meal!.id}`), onSuccess: backToMeals })
  const restore = useRestore(backToMeals)

  function submit(event: FormEvent) {
    event.preventDefault()
    // One save at a time: a second tap on Save while one is under way does nothing.
    if (mutation.isPending) return
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
    onChange: (value: string) => setFields({ ...fields, [field]: value }),
  })

  // A save, archive or restore that failed, said under the fields.
  const failure = mutation.isError
    ? describe(mutation.error)
    : archive.isError
      ? "Couldn't archive the Meal."
      : restore.isError
        ? restoreProblem
        : null

  return (
    <form aria-label={title} onSubmit={submit} className="my-0">
      {meal?.archived && <Notice>Archived: it is not in the quick list and can’t be logged.</Notice>}
      {meal?.imageUrl && (
        <img src={meal.imageUrl} alt={meal.name} className="my-2 block max-h-56 w-full rounded-2xl bg-fill object-cover" />
      )}
      <GroupedList footer={saveFooter(false, problem ?? failure)}>
        <FieldRow label="Name" {...text('name')} maxLength={100} placeholder="Required" lang="ja" />
        <FieldRow label="kcal per serving" {...text('kcal')} inputMode="numeric" placeholder="Required" />
        <FieldRow label="Store" {...text('store')} maxLength={100} placeholder="Optional" lang="ja" />
        <FieldRow label="Emoji" {...text('emoji')} placeholder="Optional" />
        <FieldRow label="Tags" {...text('tags')} placeholder="snack, conbini" lang="ja" />
      </GroupedList>
      <GroupedList footer="Pinned Meals come first in the quick list.">
        <ListRow className="text-[17px]">
          <Switch isSelected={fields.pinned} onChange={(pinned) => setFields({ ...fields, pinned })}>
            Pinned
          </Switch>
        </ListRow>
      </GroupedList>
      <div className="mt-4 flex flex-col gap-3">
        <Button type="submit" variant="accent" size="large" isDisabled={mutation.isPending}>
          Save
        </Button>
        {meal && !meal.archived && (
          <Button size="large" onPress={() => archive.mutate()}>
            Archive
          </Button>
        )}
        {meal?.archived && (
          <Button size="large" onPress={() => restore.mutate(meal.id)}>
            Restore
          </Button>
        )}
      </div>
    </form>
  )
}

function describe(error: unknown): string {
  if (error instanceof ApiError && error.status === 400 && error.detail) return `Couldn't save the Meal: ${error.detail}`
  return "Couldn't save the Meal."
}

