import { GroupedList, ListRow } from '../ui/List'
import { SegmentedControl } from '../ui/SegmentedControl'
import { useAppearance, type Appearance } from './appearance'

const options: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

// Appearance, chosen on this device: System, Light or Dark. It switches at once.
export function AppearanceControl() {
  const [appearance, setAppearance] = useAppearance()
  return (
    <GroupedList footer="System follows your iPhone.">
      <ListRow>
        <span id="appearance-label" className="text-[17px]">
          Appearance
        </span>
        <div className="w-[220px]">
          <SegmentedControl labelledBy="appearance-label" options={options} value={appearance} onChange={setAppearance} />
        </div>
      </ListRow>
    </GroupedList>
  )
}
