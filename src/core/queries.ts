import { onlineManager, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api/client'

// Nando's query cache, for the app (main.tsx) and its tests alike.
//
// Queries and mutations always run, rather than pausing while the device is offline: offline they
// fail at once, and every screen shows its load problem (which says the device is offline) instead
// of an empty screen. Failed queries are made again once the connection is back (React Query's
// refetchOnReconnect, which 'always' turns off unless asked for, and which CoreProvider makes work
// even when Nando opened offline).
//
// A 4xx says what the server will say again, such as an expired request: said at once, not retried.
// Offline, nothing is retried either: it can only fail again until the connection is back.
export function createQueryClient({ retry = true }: { retry?: boolean } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        refetchOnReconnect: true,
        retry: (failures, error) =>
          retry && onlineManager.isOnline() && !(error instanceof ApiError && error.status < 500) && failures < 3,
      },
      mutations: { networkMode: 'always' },
    },
  })
}
