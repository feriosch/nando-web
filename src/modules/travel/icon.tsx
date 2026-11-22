import { Icon } from '../../core/ui/Icon'

// Travel's icon: a plane, seen from above.
export function PlaneIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 3c.9 0 1.5.8 1.5 2v4.5l7 4V16l-7-2v4l2 1.5V21L12 20l-3.5 1v-1.5l2-1.5v-4l-7 2v-2.5l7-4V5c0-1.2.6-2 1.5-2Z" />
    </Icon>
  )
}
