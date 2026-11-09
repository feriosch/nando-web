import { Icon } from '../../core/ui/Icon'

// Calories' icon: a steaming bowl.
export function BowlIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M3 11h18a9 9 0 0 1-18 0Z" />
      <path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" />
    </Icon>
  )
}
