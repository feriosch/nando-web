import { createContext, useContext, useLayoutEffect, useState, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router'

// The screen an opened screen was opened from: its path and query, and its history entry.
type Origin = { at: string; key: string }

// A screen's title as plain text, with its language when it isn't the app's (such as "ja").
export type ScreenTitle = { text: string; lang?: string }

// What the shell records as the Owner moves between screens, by history entry (location.key): where
// each opened screen was opened from, and each screen's title. So a back link to exactly that screen
// can go back to it, scrolled as it was, rather than open it afresh, and name it. The shell provides
// it (src/core/shell/Layout.tsx). Only this file writes them: the shell where a screen came from,
// a screen's header its title.
export type Journey = { cameFrom: Map<string, Origin>; titles: Map<string, ScreenTitle> }

export const JourneyContext = createContext<Journey | null>(null)

// Records, for every screen opened from another (a push), where it was opened from. A screen that
// replaces itself (a redirect) keeps where the one it replaced came from. Screens record their own
// titles (`useRecordTitle`).
//
// Where it came from is recorded as the shell renders the new screen, before the screen itself
// renders, so the screen knows on its first render where it came from: a screen whose data is
// already cached, and so renders once, would otherwise keep the back link it had before it was
// recorded.
export function useRecordJourney(): Journey {
  const [journey] = useState<Journey>(() => ({ cameFrom: new Map(), titles: new Map() }))
  const { cameFrom } = journey
  const location = useLocation()
  const type = useNavigationType()
  const [last, setLast] = useState<Origin | null>(null)
  if (last?.key !== location.key) {
    if (last && !cameFrom.has(location.key)) {
      const from = type === 'PUSH' ? last : type === 'REPLACE' ? cameFrom.get(last.key) : undefined
      if (from !== undefined) cameFrom.set(location.key, from)
    }
    setLast({ key: location.key, at: location.pathname + location.search })
  }
  return journey
}

// Records the title of the screen on view, as its header `title` shows it: its text, and the
// language of the element holding it, if any. A screen whose title is still loading records none.
export function useRecordTitle(title: RefObject<HTMLElement | null>) {
  const journey = useContext(JourneyContext)
  const { key } = useLocation()
  useLayoutEffect(() => {
    if (!journey) return
    const text = title.current?.textContent?.trim()
    if (!text) {
      journey.titles.delete(key)
      return
    }
    const lang = title.current?.getAttribute('lang') ?? title.current?.querySelector('[lang]')?.getAttribute('lang') ?? undefined
    journey.titles.set(key, { text, lang })
  })
}

// The screen the one on view was opened from, if it was opened from another.
function useOrigin(): Origin | undefined {
  return useContext(JourneyContext)?.cameFrom.get(useLocation().key)
}

// Where the screen on view was opened from (its path and query), if it was opened from another.
export function useCameFrom(): string | undefined {
  return useOrigin()?.at
}

// A back link: where it goes, what it says, and in what language when that isn't the app's.
export type BackLink = { to: string; label: string; lang?: string }

// The back link of a screen: `usual` when the screen was opened from there, or opened directly (such
// as from a Notification); otherwise back to the screen it was opened from, named by that screen's
// title, or "Back" if it had none.
export function useBackLink(usual: BackLink): BackLink {
  const journey = useContext(JourneyContext)
  const origin = useOrigin()
  if (!journey || !origin || origin.at === usual.to) return usual
  const title = journey.titles.get(origin.key)
  return title ? { to: origin.at, label: title.text, lang: title.lang } : { to: origin.at, label: 'Back' }
}
