import { Button as AriaButton, type ButtonProps } from 'react-aria-components'
import { pillClasses, type Variant } from './pill'

// A pill button: `accent` for the one main action on a screen, `quiet` (the fill colour) for the rest.
export function Button({ variant = 'quiet', className = '', ...props }: ButtonProps & { variant?: Variant; className?: string }) {
  return <AriaButton {...props} className={`${pillClasses(variant)} data-[pressed]:opacity-70 ${className}`} />
}
