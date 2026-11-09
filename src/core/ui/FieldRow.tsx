import { useId } from 'react'
import { ListRow } from './List'

// A text field as a grouped-list row: its label on the left and the field, right-aligned, filling the
// rest. `lang="ja"` for a field that takes Japanese, such as a Meal's name or store.
export function FieldRow({
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
