import { Icon } from '../../core/ui/Icon'

// Japanese's icon: a brush over an ink stroke.
export function BrushIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M14.5 4.5 19.5 9.5" />
      <path d="M18 3l3 3-8.5 8.5-3-3Z" />
      <path d="M9.5 11.5c-2 0-3.5 1.5-3.5 3.5 0 1.5-1 3-3 3.5 3 1.5 7.5.5 8.5-2.5" />
    </Icon>
  )
}
