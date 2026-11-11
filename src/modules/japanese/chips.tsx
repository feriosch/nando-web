import type { ReactNode } from 'react'

// A tag, such as a Group, a Word Tag or a Nuance Tag, as a small pill in the accent colour.
export function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-block shrink-0 rounded-full bg-accent/10 px-2.5 py-0.5 text-[13px] text-accent">{children}</span>
}

// A row of chips, as a list named `label`; its items are `<li>`s holding a `Chip`.
export function Chips({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="mx-0 my-2 flex list-none flex-wrap gap-1.5 p-0">
      {children}
    </ul>
  )
}
