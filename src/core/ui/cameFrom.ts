import { createContext, useContext, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router'

// Where each opened screen was opened from (its path and query), by its history entry
// (location.key), so a back link to exactly that screen can go back to it, scrolled as it was,
// rather than open it afresh. The shell provides it (src/core/shell/Layout.tsx).
export const CameFromContext = createContext<ReadonlyMap<string, string> | null>(null)

// Records, for every screen opened from another (a push), where it was opened from. A screen that
// replaces itself (a redirect) keeps where the one it replaced came from.
//
// It's recorded as the shell renders the new screen, before the screen itself renders, so the
// screen knows on its first render where it came from: a screen whose data is already cached, and
// so renders once, would otherwise keep the back link it had before it was recorded.
export function useRecordCameFrom(): ReadonlyMap<string, string> {
  const [cameFrom] = useState(() => new Map<string, string>())
  const location = useLocation()
  const type = useNavigationType()
  const [last, setLast] = useState<{ key: string; at: string } | null>(null)
  if (last?.key !== location.key) {
    if (last && !cameFrom.has(location.key)) {
      const from = type === 'PUSH' ? last.at : type === 'REPLACE' ? cameFrom.get(last.key) : undefined
      if (from !== undefined) cameFrom.set(location.key, from)
    }
    setLast({ key: location.key, at: location.pathname + location.search })
  }
  return cameFrom
}

// Where the screen on view was opened from (its path and query), if it was opened from another.
export function useCameFrom(): string | undefined {
  const cameFrom = useContext(CameFromContext)
  return cameFrom?.get(useLocation().key)
}

// The back link of a screen opened from several: to the screen it was opened from when that's one
// of `origins` (each path with its screen's name), and to `fallback` otherwise.
export function useBackLink(origins: Readonly<Record<string, string>>, fallback: { to: string; label: string }): { to: string; label: string } {
  const cameFrom = useCameFrom()
  const label = cameFrom === undefined ? undefined : origins[cameFrom]
  return cameFrom !== undefined && label !== undefined ? { to: cameFrom, label } : fallback
}
