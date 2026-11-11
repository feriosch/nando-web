import type { ReactNode } from 'react'

// A chip's colour: the accent, or one of the JLPT levels' (see src/index.css).
export type ChipTone = 'accent' | 'basic' | 'n3' | 'n2' | 'n1'

// Whole class names, so Tailwind finds them.
const tones: Record<ChipTone, string> = {
  accent: 'bg-accent/10 text-accent',
  basic: 'bg-level-basic/12 text-level-basic',
  n3: 'bg-level-n3/12 text-level-n3',
  n2: 'bg-level-n2/12 text-level-n2',
  n1: 'bg-level-n1/12 text-level-n1',
}

// A tag, such as a Group, a Word Tag or a Nuance Tag, as a small pill, in the accent colour unless
// given a `tone`.
export function Chip({ tone = 'accent', children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[13px] ${tones[tone]}`}>{children}</span>
}

// A row of chips, as a list named `label`; its items are `<li>`s holding a `Chip`.
export function Chips({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="mx-0 my-2 flex list-none flex-wrap gap-1.5 p-0">
      {children}
    </ul>
  )
}
