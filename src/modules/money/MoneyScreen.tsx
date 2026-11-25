import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../core/api/client'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { lucideProps } from '../../core/ui/icons'
import { GroupedList, ListRow, RowLink, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { SpendingChart } from './charts'
import {
  againstAverage,
  categoryPath,
  isMonth,
  joinNames,
  monthName,
  oneOffLine,
  monthsBefore,
  percent,
  yen,
  yenChange,
  withoutOneOffs,
  type CategoryTotal,
  type MonthSummary,
  type MonthTotals,
} from './money'

// How many months the spending chart shows, ending with the month on screen.
const chartMonths = 12

// The Money screen, at /money for the latest Complete month and /money/:month for any other: the
// month's spending against the average, Essential against Optional, income, its Categories largest
// first, spending over time, and the way to Subscriptions and Net worth. Only Complete months:
// Statements arrive a month late (feriosch/nando-server ADR 0014). The Money Assistant writes, in
// Telegram.
export function MoneyScreen() {
  const params = useParams()
  const api = useApi()
  const list = useQuery({ queryKey: ['money', 'months'], queryFn: () => api.get<MonthSummary[]>('/api/money/months') })
  const month = params.month ?? list.data?.[0]?.month
  // A month in the path that isn't one, such as /money/2026-13, has no name to show.
  const valid = month === undefined || isMonth(month)
  const totals = useQuery({
    queryKey: ['money', 'months', month],
    queryFn: () => api.get<MonthTotals>(`/api/money/months/${month}`),
    enabled: month !== undefined && valid,
  })

  if (!valid) {
    return (
      <>
        <ScreenHeader title="Money" />
        <EmptyNote>There's no such month.</EmptyNote>
      </>
    )
  }
  if (list.isError) {
    return (
      <>
        <ScreenHeader title="Money" />
        <LoadProblem message="Couldn't load Money." retry={() => list.refetch()} />
      </>
    )
  }
  if (list.data?.length === 0) {
    return (
      <>
        <ScreenHeader title="Money" />
        <EmptyNote>Money fills in once a month's Statements are in. Send them to the Money Assistant in Telegram.</EmptyNote>
      </>
    )
  }
  if (!list.data || month === undefined) return <ScreenHeader title="Money" />

  const months = list.data
  const at = months.findIndex((m) => m.month === month)
  const older = at === -1 ? months.find((m) => m.month < month) : months[at + 1]
  const newer = at === -1 ? [...months].reverse().find((m) => m.month > month) : months[at - 1]
  const notComplete = totals.error instanceof ApiError && totals.error.status === 404
  return (
    <>
      <ScreenHeader title="Money" />
      <MonthSwitcher month={month} older={older?.month} newer={newer?.month} />
      {notComplete && <EmptyNote>{monthName(month)} isn't Complete: its Statements aren't all in yet.</EmptyNote>}
      {totals.isError && !notComplete && <LoadProblem message="Couldn't load this month." retry={() => totals.refetch()} />}
      {totals.data && (
        <Month
          totals={totals.data}
          summary={months[at]}
          chart={months.filter((m) => m.month <= month && m.month > monthsBefore(month, chartMonths)).reverse()}
        />
      )}
    </>
  )
}

// The month's name, with arrows to the Complete months before and after it.
function MonthSwitcher({ month, older, newer }: { month: string; older?: string; newer?: string }) {
  const arrow = 'flex size-11 items-center justify-center rounded-full text-accent active:bg-fill'
  return (
    <div className="mt-1 flex items-center justify-between">
      {older ? (
        <Link to={`/money/${older}`} viewTransition aria-label={monthName(older)} className={arrow}>
          <ChevronLeft {...lucideProps} />
        </Link>
      ) : (
        <span className="size-11" />
      )}
      <h2 className="m-0 font-display text-[22px] font-bold">{monthName(month)}</h2>
      {newer ? (
        <Link to={`/money/${newer}`} viewTransition aria-label={monthName(newer)} className={arrow}>
          <ChevronRight {...lucideProps} />
        </Link>
      ) : (
        <span className="size-11" />
      )}
    </div>
  )
}

function Month({ totals, summary, chart }: { totals: MonthTotals; summary?: MonthSummary; chart: MonthSummary[] }) {
  const id = useId()
  const { spending } = totals
  const comparison = againstAverage(withoutOneOffs(spending.total, spending.oneOff), spending.average3)
  const oneOffs = oneOffLine(spending.oneOff)
  const categories = [...spending.byCategory].sort((a, b) => b.total - a.total)
  return (
    <>
      <section aria-label={monthName(totals.month)}>
        <GroupedList>
          <div className="px-4 py-3">
            <p className="m-0 text-[28px] font-semibold tabular-nums">{yen(spending.total)}</p>
            {oneOffs && <p className="m-0 text-[13px] text-sub">{oneOffs}</p>}
            {comparison && <p className="m-0 text-[15px] text-sub">{comparison}</p>}
            <Split essential={spending.essential} optional={spending.optional} unmarked={spending.unmarked} />
          </div>
          <ListRow>
            <span>Income</span>
            <span className="text-sub tabular-nums">{yen(totals.income.total)}</span>
          </ListRow>
          {totals.savingRate !== null && (
            <ListRow>
              <span>Saving rate</span>
              <span className="text-sub tabular-nums">{percent(totals.savingRate)}</span>
            </ListRow>
          )}
          {totals.unconfirmed.count > 0 && (
            <ListRow>
              <span className="text-accent">{totals.unconfirmed.count} to confirm in the Money chat</span>
            </ListRow>
          )}
        </GroupedList>
      </section>
      {categories.length > 0 && (
        <>
          <SectionHeader id={id}>Categories</SectionHeader>
          <GroupedList as="ul" labelledBy={id}>
            {categories.map((c) => (
              <li key={c.category}>
                <CategoryRow month={totals.month} category={c} largest={categories[0].total} />
              </li>
            ))}
          </GroupedList>
        </>
      )}
      {chart.length > 1 && (
        <>
          <SectionHeader>Over time</SectionHeader>
          <SpendingChart months={chart} current={totals.month} />
        </>
      )}
      <GroupedList>
        <RowLink to="/money/subscriptions">Subscriptions</RowLink>
        <RowLink to="/money/net-worth">
          <span className="flex justify-between gap-3">
            <span>Net worth</span>
            {summary && <span className="text-sub tabular-nums">{yen(summary.netWorth.total)}</span>}
          </span>
          {/* A total with an Account left out would read as a drop that never happened. */}
          {summary && summary.netWorth.missing.length > 0 && (
            <span className="block text-[13px] text-sub">
              Without {joinNames(summary.netWorth.missing.map((a) => a.name))}: no balance at the month's end
            </span>
          )}
        </RowLink>
      </GroupedList>
    </>
  )
}

// Essential against Optional against not marked, as one bar with its amounts under it.
function Split({ essential, optional, unmarked }: { essential: number; optional: number; unmarked: number }) {
  // A part below 0 (more refunded than spent) takes no room, so the others never overflow the bar.
  const whole = Math.max(0, essential) + Math.max(0, optional) + Math.max(0, unmarked)
  if (whole <= 0) return null
  const share = (amount: number) => `${(Math.max(0, amount) / whole) * 100}%`
  return (
    <>
      <div aria-hidden className="mt-3 flex h-2 overflow-hidden rounded-full bg-fill">
        <span className="bg-accent" style={{ width: share(essential) }} />
        <span className="bg-optional" style={{ width: share(optional) }} />
      </div>
      <p className="m-0 mt-1.5 flex flex-wrap justify-between gap-x-3 text-[13px] text-sub tabular-nums">
        <span>Essential {yen(essential)}</span>
        <span>Optional {yen(optional)}</span>
        {unmarked !== 0 && <span>Not marked {yen(unmarked)}</span>}
      </p>
    </>
  )
}

// A Category's row: its name and total, a bar against the largest, and its change against the
// average of the months before.
function CategoryRow({ month, category, largest }: { month: string; category: CategoryTotal; largest: number }) {
  const average = category.average3 ?? null
  return (
    <RowLink to={categoryPath(month, category.category)}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate">{category.name}</span>
        <span className="shrink-0 tabular-nums">{yen(category.total)}</span>
      </span>
      <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-fill">
        <span className="block h-full bg-accent" style={{ width: `${(Math.max(0, category.total) / Math.max(1, largest)) * 100}%` }} />
      </span>
      {oneOffLine(category.oneOff) && <span className="mt-0.5 block text-[13px] text-sub tabular-nums">{oneOffLine(category.oneOff)}</span>}
      {average !== null && (
        <span className="mt-0.5 block text-[13px] text-sub tabular-nums">
          {yenChange(withoutOneOffs(category.total, category.oneOff) - average)} against the average
        </span>
      )}
    </RowLink>
  )
}
