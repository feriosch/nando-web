import { useState } from 'react'

// What a sheet shows: `value` while there is one, else the last one, so a sheet whose value has just
// gone keeps its content while it slides away.
export function useLastShown<T>(value: T | null): T | null {
  const [last, setLast] = useState(value)
  if (value !== null && value !== last) setLast(value)
  return value ?? last
}
