import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router'

// Where each opened screen was opened from (its path and query), by its history entry
// (location.key), so a back link to exactly that screen can go back to it, scrolled as it was,
// rather than open it afresh. The shell provides it (src/core/shell/Layout.tsx).
export const CameFromContext = createContext<ReadonlyMap<string, string> | null>(null)

// Records, for every screen opened from another (a push), where it was opened from. A screen that
// replaces itself (a redirect) keeps where the one it replaced came from.
export function useRecordCameFrom(): ReadonlyMap<string, string> {
  const [cameFrom] = useState(() => new Map<string, string>())
  const location = useLocation()
  const type = useNavigationType()
  const last = useRef<{ key: string; at: string } | null>(null)
  useEffect(() => {
    const previous = last.current
    if (previous && previous.key !== location.key && !cameFrom.has(location.key)) {
      const from = type === 'PUSH' ? previous.at : type === 'REPLACE' ? cameFrom.get(previous.key) : undefined
      if (from !== undefined) cameFrom.set(location.key, from)
    }
    last.current = { key: location.key, at: location.pathname + location.search }
  }, [cameFrom, location, type])
  return cameFrom
}

// Where the screen on view was opened from (its path and query), if it was opened from another.
export function useCameFrom(): string | undefined {
  const cameFrom = useContext(CameFromContext)
  return cameFrom?.get(useLocation().key)
}
