import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useParams } from 'react-router'
import { ApiError } from '../../core/api/client'
import { formatDayAs } from '../../core/days'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useBackLink } from '../../core/ui/cameFrom'
import { GroupedList, ListRow, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { MonthBars } from './charts'
import { againstAverage, inCurrency, monthName, yen, type CategoryPage as CategoryPageData, type ScreenTransaction } from './money'

// A Category's page for a Complete month, at /money/:month/:category: its total against the average,
// its last 12 months as bars, its Subcategories when it has any, and its Transactions by Day.
export function CategoryPage() {
  const { month = '', category = '' } = useParams()
  const api = useApi()
  const page = useQuery({
    queryKey: ['money', 'months', month, 'categories', category],
    queryFn: () => api.get<CategoryPageData>(`/api/money/months/${month}/categories/${category}`),
  })
  const back = useBackLink({ to: `/money/${month}`, label: 'Money' })
  const subcategoriesId = useId()
  const transactionsId = useId()

  if (!page.data) {
    return (
      <>
        <ScreenHeader back={back} />
        {page.isError &&
          (page.error instanceof ApiError && page.error.status === 404 ? (
            <EmptyNote>Nothing to show for this month and Category.</EmptyNote>
          ) : (
            <LoadProblem message="Couldn't load this Category." retry={() => page.refetch()} />
          ))}
      </>
    )
  }
  const data = page.data
  const comparison = againstAverage(data.total, data.average3)
  return (
    <>
      <ScreenHeader back={back} title={data.name} subtitle={monthName(data.month)} />
      <GroupedList>
        <div className="px-4 py-3">
          <p className="m-0 text-[28px] font-semibold tabular-nums">{yen(data.total)}</p>
          {comparison && <p className="m-0 text-[15px] text-sub">{comparison}</p>}
        </div>
      </GroupedList>
      {data.history.length > 1 && <MonthBars months={data.history} current={data.month} what={data.name} />}
      {data.subcategories.length > 0 && (
        <>
          <SectionHeader id={subcategoriesId}>Subcategories</SectionHeader>
          <GroupedList as="ul" labelledBy={subcategoriesId}>
            {data.subcategories.map((s) => (
              <ListRow as="li" key={s.subcategory}>
                <span className={s.subcategory === '' ? 'text-sub' : ''}>{s.subcategory === '' ? 'No Subcategory' : s.name}</span>
                <span className="text-sub tabular-nums">{yen(s.total)}</span>
              </ListRow>
            ))}
          </GroupedList>
        </>
      )}
      <SectionHeader id={transactionsId}>Transactions</SectionHeader>
      {data.transactions.length === 0 ? (
        <EmptyNote>Nothing in this Category this month.</EmptyNote>
      ) : (
        <GroupedList as="ul" labelledBy={transactionsId} footer="To change one, ask the Money Assistant in the Money chat.">
          {data.transactions.map((t) => (
            <TransactionRow key={t.id} transaction={t} />
          ))}
        </GroupedList>
      )}
    </>
  )
}

// A Transaction: its Merchant, Day, Account and Subcategory, and its amount, pesos with their yen
// under them. A Refund is money back.
function TransactionRow({ transaction: t }: { transaction: ScreenTransaction }) {
  const refund = t.amount < 0
  const details = [formatDayAs(t.day, { day: 'numeric', month: 'short' }), t.account, t.subcategory].filter(Boolean).join(' · ')
  return (
    <ListRow as="li" className="items-start">
      <span className="min-w-0 flex-1">
        <span className="block truncate">{t.merchant}</span>
        <span className="block text-[13px] text-sub">{details}</span>
        {t.note && <span className="block text-[13px] text-sub">{t.note}</span>}
        <span className="mt-0.5 flex gap-1.5">
          {refund && <Tag>Refund</Tag>}
          {t.unconfirmed && <Tag>Unconfirmed</Tag>}
        </span>
      </span>
      <span className="shrink-0 text-right tabular-nums">
        <span className={`block ${refund ? 'text-accent' : ''}`}>{refund ? `+${yen(-t.yen)}` : yen(t.yen)}</span>
        {t.currency !== 'JPY' && (
          <span className="block text-[13px] text-sub">{refund ? `+${inCurrency(-t.amount, t.currency)}` : inCurrency(t.amount, t.currency)}</span>
        )}
      </span>
    </ListRow>
  )
}

function Tag({ children }: { children: string }) {
  return <span className="rounded-full bg-fill px-2 py-px text-[12px] font-semibold text-sub">{children}</span>
}
