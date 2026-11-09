import type { ReactNode } from 'react'
import { BowlIcon } from './icon'

// The 36px tile at the start of an Entry or Meal row: its emoji, or the Calories bowl without one.
export function Tile({ children }: { children?: ReactNode }) {
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-fill text-[20px] text-sub">
      {children ?? <BowlIcon className="size-5" />}
    </span>
  )
}

// A grouped-list row laid out as a tile, then its text, then what's on its right.
export const rowClasses = 'flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left text-[17px]'

// The same row as one button: tapping anywhere on it opens what it's for.
export const rowButtonClasses = `${rowClasses} m-0 rounded-none bg-transparent font-normal text-ink active:bg-fill focus-visible:-outline-offset-2`
