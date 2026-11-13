import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router'

// The path of the screen each opened screen was opened from, by its history entry (location.key),
// so a back link to that screen can go back to it, scrolled as it was, rather than open it afresh.
// The shell provides it (src/core/shell/Layout.tsx).
export const CameFromContext = createContext<ReadonlyMap<string, string> | null>(null)

// Records, for every screen opened from another (a push), the path it was opened from.
export function useRecordCameFrom(): ReadonlyMap<string, string> {
  const [cameFrom] = useState(() => new Map<string, string>())
  const location = useLocation()
  const type = useNavigationType()
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (type === 'PUSH' && last.current !== null && !cameFrom.has(location.key)) cameFrom.set(location.key, last.current)
    last.current = location.pathname
  }, [cameFrom, location, type])
  return cameFrom
}

// Whether the screen on view was opened from `path`: going back then returns to it as it was.
export function useOpenedFrom(): (path: string) => boolean {
  const cameFrom = useContext(CameFromContext)
  const { key } = useLocation()
  return (path) => cameFrom?.get(key) === path
}
