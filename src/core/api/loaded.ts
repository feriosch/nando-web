import { useState } from 'react'

// Whether `query` has loaded successfully since the component using it mounted, so a form can start
// from what the server has now rather than a cached copy, or nothing at all after a failed load.
// Once true it stays true, so a failed refetch later doesn't take away a form being filled in.
export function useLoadedSinceMount(query: { isFetchedAfterMount: boolean; isSuccess: boolean }): boolean {
  const loadedNow = query.isFetchedAfterMount && query.isSuccess
  const [loaded, setLoaded] = useState(loadedNow)
  if (loadedNow && !loaded) setLoaded(true)
  return loaded || loadedNow
}
