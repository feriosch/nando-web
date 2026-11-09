import { useId, type ReactNode } from 'react'
import { ListRow } from './List'

export type PickerOption = { value: string; label: string }

// A value in the secondary colour that opens the native picker when tapped (the wheel on iPhone):
// a transparent <select> lies over it and takes the tap, named by `label`. `display` is what shows,
// the picked option's label by default.
export function Picker({
  label,
  value,
  options,
  onChange,
  display,
  className = '',
}: {
  label: string
  value: string
  options: PickerOption[]
  onChange: (value: string) => void
  display?: ReactNode
  className?: string
}) {
  return (
    <span className={`relative inline-flex min-h-11 min-w-0 items-center text-sub ${className}`}>
      <span className="truncate">{display ?? options.find((option) => option.value === value)?.label ?? value}</span>
      <NativeSelect label={label} value={value} options={options} onChange={onChange} />
    </span>
  )
}

// A grouped-list row with `label` on the left and its value on the right, in the secondary colour.
// Tapping anywhere on the row opens the picker.
export function PickerRow({
  label,
  value,
  options,
  onChange,
  display,
}: {
  label: string
  value: string
  options: PickerOption[]
  onChange: (value: string) => void
  display?: ReactNode
}) {
  const id = useId()
  return (
    <ListRow className="relative text-[17px]">
      <label htmlFor={id} className="my-0 shrink-0">
        {label}
      </label>
      <span className="min-w-0 truncate text-sub">
        {display ?? options.find((option) => option.value === value)?.label ?? value}
      </span>
      <NativeSelect id={id} value={value} options={options} onChange={onChange} />
    </ListRow>
  )
}

// The select itself: invisible, covering the nearest positioned ancestor. It keeps 16px text so iOS
// doesn't zoom when it opens.
function NativeSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id?: string
  label?: string
  value: string
  options: PickerOption[]
  onChange: (value: string) => void
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="absolute inset-0 m-0 h-full min-h-0 w-full cursor-pointer appearance-none border-0 p-0 text-[16px] opacity-0"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
