import { Button as AriaButton, type ButtonProps } from 'react-aria-components'

// A pill button: `accent` for the one main action on a screen, `quiet` (the fill colour) for the rest.
export function Button({ variant = 'quiet', className = '', ...props }: ButtonProps & { variant?: 'accent' | 'quiet'; className?: string }) {
  const colours = variant === 'accent' ? 'bg-accent text-accent-ink' : 'bg-fill text-ink'
  return (
    <AriaButton
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[16px] font-semibold ${colours} transition-opacity data-[disabled]:opacity-50 data-[pressed]:opacity-70 ${className}`}
    />
  )
}
