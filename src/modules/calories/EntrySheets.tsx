import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useApi } from '../../core/services'
import { Button } from '../../core/ui/Button'
import { GroupedList, ListRow } from '../../core/ui/List'
import { saveFooter } from '../../core/ui/saveFooter'
import { Switch } from '../../core/ui/Switch'
import { parseWhole, type Entry } from './calories'
import { useLog, type Guard } from './guard'

// What the Entry editor and "Something else" sheets show: forms, each named after its sheet.

const entryProblem = 'Enter a name, kcal per serving as a whole number from 0 to 10,000, and Servings from 1 to 100.'

// Changes or deletes one Entry. `done` closes the sheet.
export function EntryEditor({ entry, guard, done }: { entry: Entry; guard: Guard; done: () => void }) {
  const api = useApi()
  const queryClient = useQueryClient()
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
    onError: (error) => guard.fail(error, 'change'),
  })
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/calories/entries/${entry.id}`),
    onSuccess,
    onError: (error) => guard.fail(error, 'delete'),
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
    <form aria-label="Edit Entry" onSubmit={submit} className="my-0">
      <GroupedList footer={saveFooter(false, problem)}>
        <EntryFieldRows fields={fields} onChange={setFields} />
      </GroupedList>
      <div className="mt-4 flex flex-col gap-3">
        <Button type="submit" variant="accent" size="large">
          Save
        </Button>
        <div className="flex gap-3">
          <Button className="flex-1" onPress={() => remove.mutate()}>
            Delete
          </Button>
          <Button className="flex-1" onPress={done}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  )
}

// Logs something that isn't a Meal (or not yet: "Save as Meal" saves it as one too) on `day`.
// `done` closes the sheet once it is logged.
export function OneOffForm({ day, guard, done }: { day: string; guard: Guard; done: () => void }) {
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
    guard.check(parsed.kcalPerServing * parsed.servings, () => log.mutateAsync({ ...parsed, saveAsMeal }).then(done))
  }

  return (
    <form aria-label="Something else" onSubmit={submit} className="my-0">
      <GroupedList footer={saveFooter(false, problem)}>
        <EntryFieldRows fields={fields} onChange={setFields} />
      </GroupedList>
      <GroupedList>
        <ListRow>
          <Switch isSelected={saveAsMeal} onChange={setSaveAsMeal}>
            Save as Meal
          </Switch>
        </ListRow>
      </GroupedList>
      <Button type="submit" variant="accent" size="large" className="mt-4">
        Log
      </Button>
    </form>
  )
}

// An Entry's three values as typed.
type EntryFields = { name: string; kcalPerServing: string; servings: string }

const emptyFields: EntryFields = { name: '', kcalPerServing: '', servings: '1' }

function EntryFieldRows({ fields, onChange }: { fields: EntryFields; onChange: (fields: EntryFields) => void }) {
  return (
    <>
      <FieldRow label="Name" value={fields.name} onChange={(name) => onChange({ ...fields, name })} maxLength={100} lang="ja" />
      <FieldRow
        label="kcal per serving"
        value={fields.kcalPerServing}
        onChange={(kcalPerServing) => onChange({ ...fields, kcalPerServing })}
        inputMode="numeric"
        placeholder="0"
      />
      <FieldRow
        label="Servings"
        value={fields.servings}
        onChange={(servings) => onChange({ ...fields, servings })}
        inputMode="numeric"
      />
    </>
  )
}

// A row with its label on the left and the field, right-aligned, filling the rest.
function FieldRow({
  label,
  value,
  onChange,
  inputMode,
  maxLength,
  placeholder,
  lang,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  inputMode?: 'numeric'
  maxLength?: number
  placeholder?: string
  lang?: string
}) {
  const id = useId()
  return (
    <ListRow>
      <label htmlFor={id} className="my-0 shrink-0 text-[17px]">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        lang={lang}
        className="m-0 min-h-11 w-full min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-[17px] text-ink outline-none placeholder:text-sub/60"
      />
    </ListRow>
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
