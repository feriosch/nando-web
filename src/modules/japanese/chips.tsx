import type { ReactNode } from 'react'

// A tag, such as a Word Tag or a Nuance Tag, as a small pill on the fill colour.
export function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-full bg-fill px-2.5 py-0.5 text-[13px] text-sub">{children}</span>
}

// A row of chips, as a list named `label`; its items are `<li>`s holding a `Chip`.
export function Chips({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="mx-0 my-2 flex list-none flex-wrap gap-1.5 p-0">
      {children}
    </ul>
  )
}
