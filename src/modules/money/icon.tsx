import { Icon } from '../../core/ui/Icon'

// Money's icon: a banknote.
export function BanknoteIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v.01M18 14.5v.01" />
    </Icon>
  )
}
