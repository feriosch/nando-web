import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { addDays } from '../../core/days'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import { consumedAgainstLimit, formatDay, type DaySummary } from './calories'

// How many Days the list shows at first, and how many more each "Show older" adds.
const pageDays = 30

// History: past Days, newest first, each against the Daily Limit it had.
export function History() {
  const api = useApi()
  const { today, settings } = useToday()
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
            // A failed "Show older" is asked for again; refetching would only reload the Days shown.
            if (history.isFetchNextPageError) history.fetchNextPage()
            else if (history.isError) history.refetch()
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
          <button type="button" onClick={() => history.fetchNextPage()} disabled={history.isFetchingNextPage}>
            Show older
          </button>
        </>
      )}
    </>
  )
}

// Such as "1,800 / 2,000 kcal", or "not logged" for an Unlogged Day.
function describe(day: DaySummary): string {
  return day.consumedCalories === null ? 'not logged' : consumedAgainstLimit(day.consumedCalories, day.dailyLimit)
}
