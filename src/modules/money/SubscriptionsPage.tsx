import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { lucideProps } from '../../core/ui/icons'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useBackLink } from '../../core/ui/cameFrom'
import { GroupedList, ListRow, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { inCurrency, langOf, yen, type Subscription, type SubscriptionsPage as SubscriptionsData } from './money'

// The Subscriptions, at /money/subscriptions: the active ones, late ones first, each costed a month in
// yen, their monthly total, and the stopped ones in a closed section below.
export function SubscriptionsPage() {
  const api = useApi()
  const page = useQuery({ queryKey: ['money', 'subscriptions'], queryFn: () => api.get<SubscriptionsData>('/api/money/subscriptions') })
  const back = useBackLink({ to: '/money', label: 'Money' })
  const activeId = useId()

  const data = page.data
  const active = data ? data.subscriptions.filter((s) => s.active).sort((a, b) => Number(b.late) - Number(a.late)) : []
  const stopped = data ? data.subscriptions.filter((s) => !s.active) : []
  return (
    <>
      <ScreenHeader back={back} title="Subscriptions" />
      {page.isError && <LoadProblem message="Couldn't load the Subscriptions." retry={() => page.refetch()} />}
      {data && data.subscriptions.length === 0 && <EmptyNote>No Subscriptions yet. The Money Assistant finds them in your Statements.</EmptyNote>}
      {data && active.length > 0 && (
        <>
          <GroupedList>
            <ListRow>
              <span>A month</span>
              <span className="text-sub tabular-nums">{yen(data.monthlyTotal)}</span>
            </ListRow>
          </GroupedList>
          <SectionHeader id={activeId}>Active</SectionHeader>
          <GroupedList as="ul" labelledBy={activeId} footer="Late: its charge didn't come when expected in the Statements that are in. Cancelled? Tell the Money Assistant.">
            {active.map((s) => (
              <SubscriptionRow key={s.id} subscription={s} />
            ))}
          </GroupedList>
        </>
      )}
      {stopped.length > 0 && (
        <details className="group mt-7 [&_summary::-webkit-details-marker]:hidden">
          <summary className="mx-4 mb-1.5 flex min-h-11 cursor-pointer list-none items-center gap-1 text-[13px] tracking-wide text-sub uppercase">
            <span>Stopped ({stopped.length})</span>
            <ChevronRight {...lucideProps} className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <GroupedList as="ul">
            {stopped.map((s) => (
              <SubscriptionRow key={s.id} subscription={s} />
            ))}
          </GroupedList>
        </details>
      )}
    </>
  )
}

function SubscriptionRow({ subscription: s }: { subscription: Subscription }) {
  return (
    <ListRow as="li" className="items-start">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span lang={langOf(s.merchantName)} className="truncate">{s.merchantName}</span>
          {s.late && <span className="rounded-full bg-optional px-2 py-px text-[12px] font-semibold text-optional-ink">Late</span>}
        </span>
        <span className="block text-[13px] text-sub tabular-nums">
          {inCurrency(s.amount, s.currency)} {s.every === 'yearly' ? 'a year' : 'a month'}
        </span>
      </span>
      {s.monthlyYen !== null && <span className="shrink-0 text-sub tabular-nums">{yen(s.monthlyYen)}</span>}
    </ListRow>
  )
}
