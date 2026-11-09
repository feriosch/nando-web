import type { ReactNode } from 'react'
import { Switch as AriaSwitch, type SwitchProps } from 'react-aria-components'

// An on/off switch with its label on the left, as a grouped-list row. Renders a native checkbox with
// role="switch", so it is found by its label.
export function Switch({ children, ...props }: Omit<SwitchProps, 'children' | 'className'> & { children: ReactNode }) {
  return (
    <AriaSwitch {...props} className="group my-0 flex min-h-11 w-full items-center justify-between gap-3">
      <span>{children}</span>
      <span className="relative h-[31px] w-[51px] shrink-0 rounded-full bg-fill transition-colors duration-200 group-data-[selected]:bg-accent">
        <span className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform duration-200 group-data-[selected]:translate-x-5" />
      </span>
    </AriaSwitch>
  )
}
