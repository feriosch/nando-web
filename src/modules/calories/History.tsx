import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { addDays, dayOf } from '../../core/days'
import { useNow } from '../../core/now'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import type { CoreSettings } from '../../core/settings/settings'
import { formatDay, kcal, type DaySummary } from './calories'

// How many Days the list shows at first, and how many more each "Show older" adds.
const pageDays = 30

// History: past Days, newest first, each against the Daily Limit it had.
export function History() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<CoreSettings>('/api/settings') })
  const [now] = useNow()
  const today = settings.data ? dayOf(now, settings.data.timeZone) : undefined
  // Page n is the 30 Days ending n × 30 Days before today.
  const history = useInfiniteQuery({
    queryKey: ['calories', 'history', today],
    queryFn: ({ pageParam }) => {
      const to = addDays(today!, -pageParam * pageDays)
      const from = addDays(to, -(pageDays - 1))
      return api.get<DaySummary[]>(`/api/calories/history?from=${from}&to=${to}`)
    },
    initialPageParam: 0,
    getNextPageParam: (_last, _all, pageParam) => pageParam + 1,
    enabled: today !== undefined,
  })

  return (
    <>
      <h1>History</h1>
      {(settings.isError || history.isError) && (
        <LoadProblem
          message="Couldn't load the history."
          retry={() => {
            if (settings.isError) settings.refetch()
            if (history.isError) history.refetch()
          }}
        />
      )}
      {history.data && (
        <>
          <ul aria-label="Days">
            {history.data.pages.flat().map((day) => (
              <li key={day.day}>
                <Link to={`/calories?day=${day.day}`}>
                  {formatDay(day.day)}: {describe(day)}
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => history.fetchNextPage()}>
            Show older
          </button>
        </>
      )}
    </>
  )
}

// Such as "1,800 / 2,000 kcal", or "not logged" for an Unlogged Day.
function describe(day: DaySummary): string {
  if (day.consumedCalories === null) return 'not logged'
  if (day.dailyLimit === null) return `${kcal(day.consumedCalories)} kcal`
  return `${kcal(day.consumedCalories)} / ${kcal(day.dailyLimit)} kcal`
}
