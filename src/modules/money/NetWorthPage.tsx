import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useBackLink } from '../../core/ui/cameFrom'
import { GroupedList, ListRow, SectionHeader, footerClasses } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { NetWorthChart } from './charts'
import { inCurrency, joinNames, monthName, yen, yenChange, type NetWorthMonth } from './money'

// Net worth, at /money/net-worth: over the Complete months as a line, and the newest month's
// Accounts, each in its own currency and in yen, a card's balance as what it owes, and the Return of
// savings and investments.
export function NetWorthPage() {
  const api = useApi()
  const page = useQuery({ queryKey: ['money', 'net-worth'], queryFn: () => api.get<NetWorthMonth[]>('/api/money/net-worth') })
  const back = useBackLink({ to: '/money', label: 'Money' })
  const accountsId = useId()
  const returnsId = useId()

  const months = page.data ?? []
  const newest = months[0]
  return (
    <>
      <ScreenHeader back={back} title="Net worth" />
      {page.isError && <LoadProblem message="Couldn't load net worth." retry={() => page.refetch()} />}
      {page.data && months.length === 0 && <EmptyNote>Net worth fills in once a month's Statements are in.</EmptyNote>}
      {months.length > 1 && <NetWorthChart months={[...months].reverse()} />}
      {newest && (
        <>
          <SectionHeader id={accountsId}>{monthName(newest.month)}</SectionHeader>
          <GroupedList as="ul" labelledBy={accountsId}>
            {newest.accounts.map((a) => (
              <ListRow as="li" key={a.account} className="items-start">
                <span>{a.name}</span>
                <span className="text-right tabular-nums">
                  <span className="block">{a.yen < 0 ? `${yen(-a.yen)} owed` : yen(a.yen)}</span>
                  {a.currency !== 'JPY' && (
                    <span className="block text-[13px] text-sub">{a.balance < 0 ? `${inCurrency(-a.balance, a.currency)} owed` : inCurrency(a.balance, a.currency)}</span>
                  )}
                </span>
              </ListRow>
            ))}
            <ListRow as="li">
              <span className="font-semibold">Total</span>
              <span className="font-semibold tabular-nums">{yen(newest.total)}</span>
            </ListRow>
          </GroupedList>
          {newest.missing.length > 0 && (
            <p className={footerClasses}>Without {joinNames(newest.missing.map((a) => a.name))}: no balance at the month's end.</p>
          )}
          {newest.returns.length > 0 && (
            <>
              <SectionHeader id={returnsId}>Return</SectionHeader>
              <GroupedList as="ul" labelledBy={returnsId} footer="What savings and investments grew, less what was put in.">
                {newest.returns.map((r) => (
                  <ListRow as="li" key={r.account}>
                    <span>{r.name}</span>
                    <span className="text-sub tabular-nums">{yenChange(r.yen)}</span>
                  </ListRow>
                ))}
              </GroupedList>
            </>
          )}
        </>
      )}
    </>
  )
}
