import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { addDays, formatDayAs, mondayOf } from '../../core/days'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import { Button } from '../../core/ui/Button'
import { lucideProps } from '../../core/ui/icons'
import { GroupedList, SectionHeader } from '../../core/ui/List'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { Bar } from './Board'
import { consumedAgainstLimit, formatDay, usedOf, type DaySummary } from './calories'
import { rowLinkClasses } from './rows'

// How many Days the list shows at first, and how many more each "Show older" adds.
const pageDays = 30

// History: past Days, newest first and grouped by week, each against the Daily Limit it had and
// opening in the Day view.
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

  // A failed "Show older" is said at the bottom, where it was asked for, in place of the button.
  const olderFailed = history.isFetchNextPageError && !settings.isError
  const problem = (
    <LoadProblem
      message="Couldn't load the history."
      retry={() => {
        if (settings.isError) settings.refetch()
        // A failed "Show older" is asked for again; refetching would only reload the Days shown.
        if (history.isFetchNextPageError) history.fetchNextPage()
        else if (history.isError) history.refetch()
      }}
    />
  )

  return (
    <>
      <ScreenHeader title="History" back={{ to: '/calories', label: 'Today' }} />
      {(settings.isError || history.isError) && !olderFailed && problem}
      {history.data && today && (
        <>
          {byWeek(history.data.pages.flat()).map(({ monday, days }) => (
            <Week key={monday} monday={monday} today={today} days={days} />
          ))}
          <div className="mt-6 mb-2">
            {olderFailed ? (
              problem
            ) : (
              <Button size="large" onPress={() => history.fetchNextPage()} isDisabled={history.isFetchingNextPage}>
                Show older
              </Button>
            )}
          </div>
        </>
      )}
    </>
  )
}

// `days`, newest first, in runs of the same week, each named by its Monday.
function byWeek(days: DaySummary[]): { monday: string; days: DaySummary[] }[] {
  const weeks: { monday: string; days: DaySummary[] }[] = []
  for (const day of days) {
    const monday = mondayOf(day.day)
    const last = weeks.at(-1)
    if (last?.monday === monday) last.days.push(day)
    else weeks.push({ monday, days: [day] })
  }
  return weeks
}

// One week's Days, under "This week", "Last week" or "Week of 26 Oct".
function Week({ monday, today, days }: { monday: string; today: string; days: DaySummary[] }) {
  const headingId = `calories-week-${monday}`
  return (
    <>
      <SectionHeader id={headingId}>{weekName(monday, today)}</SectionHeader>
      <GroupedList as="ul" labelledBy={headingId}>
        {days.map((day) => (
          <li key={day.day}>
            <Link to={`/calories?day=${day.day}`} viewTransition className={rowLinkClasses}>
              <DayLine day={day} />
              <ChevronRight {...lucideProps} className="-mr-1.5 size-5 shrink-0 text-sub" />
            </Link>
          </li>
        ))}
      </GroupedList>
    </>
  )
}

// The week starting on `monday` as the Owner thinks of it from `today`, with its year only when it
// isn't this year's.
function weekName(monday: string, today: string): string {
  const thisWeek = mondayOf(today)
  if (monday === thisWeek) return 'This week'
  if (monday === addDays(thisWeek, -7)) return 'Last week'
  const otherYear = monday.slice(0, 4) !== today.slice(0, 4)
  return `Week of ${formatDayAs(monday, { day: 'numeric', month: 'short', ...(otherYear && { year: 'numeric' }) })}`
}

// Such as "Mon 9 Nov: 1,620 / 2,000 kcal" over a bar of how much of the Daily Limit it used, or
// "not logged" with no bar for an Unlogged Day. The colon is for screen readers only.
function DayLine({ day }: { day: DaySummary }) {
  const { consumedCalories, dailyLimit } = day
  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className="shrink-0">{formatDay(day.day)}</span>
        <span className="sr-only">: </span>
        {consumedCalories === null ? (
          <span className="text-[15px] text-sub">not logged</span>
        ) : (
          <span className="text-[15px] tabular-nums">{consumedAgainstLimit(consumedCalories, dailyLimit)}</span>
        )}
      </span>
      {consumedCalories !== null && dailyLimit !== null && (
        <Bar
          used={usedOf(consumedCalories, dailyLimit)}
          over={consumedCalories > dailyLimit}
          className="mt-1.5 h-1 bg-fill"
          fill="bg-accent"
        />
      )}
    </span>
  )
}
