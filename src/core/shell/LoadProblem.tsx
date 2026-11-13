import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { Button } from '../ui/Button'

// What a screen or card shows when what it needs couldn't be loaded, such as on a weak connection:
// `message`, centred, and a quiet pill to load it again. Offline, it also says so, and that it loads
// again by itself once the connection is back (src/core/queries.ts).
export function LoadProblem({ message, retry }: { message: string; retry: () => void }) {
  const online = useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline())
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-5 text-center">
      <p role="alert" className="my-0 text-[15px] text-sub">
        {message}
      </p>
      {!online && <p className="-mt-2 mb-0 text-[13px] text-balance text-sub">You're offline. This loads again once you're back online.</p>}
      <Button onPress={retry}>Try again</Button>
    </div>
  )
}
