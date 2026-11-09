import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'

// A segmented control: pick one of a few options. Renders a radio group, one radio per option.
export function SegmentedControl<T extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
}: {
  label?: string
  labelledBy?: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      aria-labelledby={labelledBy}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const [picked] = keys
        if (picked !== undefined) onChange(picked as T)
      }}
      className="flex rounded-[9px] bg-fill p-0.5"
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          id={option.value}
          className="min-h-8 flex-1 rounded-[7px] bg-transparent px-3 text-[14px] font-medium text-ink transition-colors data-[selected]:bg-surface data-[selected]:shadow-sm dark:data-[selected]:bg-ink/20"
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
