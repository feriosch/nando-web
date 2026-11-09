import { useQuery } from '@tanstack/react-query'
import { dayOf } from './days'
import { useNow } from './now'
import { useApi } from './services'
import type { CoreSettings } from './settings/settings'

// Today in the Owner Time Zone, moving on at midnight (see useNow), and the settings query it is
// read from, so a screen can say when they couldn't load. `today` is undefined until they have.
export function useToday() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<CoreSettings>('/api/settings') })
  const [now] = useNow()
  const today = settings.data ? dayOf(now, settings.data.timeZone) : undefined
  return { today, settings }
}
