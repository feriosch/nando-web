import { Button as AriaButton, type ButtonProps } from 'react-aria-components'
import { pillClasses, type Size, type Variant } from './pill'

// A pill button: `accent` for the one main action on a screen, `quiet` (the fill colour) for the rest.
// `size="large"` makes it full width, for the main action at the end of a screen or sheet.
export function Button({
  variant = 'quiet',
  size = 'regular',
  className = '',
  ...props
}: ButtonProps & { variant?: Variant; size?: Size; className?: string }) {
  return <AriaButton {...props} className={`${pillClasses(variant, size)} data-[pressed]:opacity-70 ${className}`} />
}
