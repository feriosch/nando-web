import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { CardHeader, CardLink, cardClasses } from '../../core/ui/HomeCard'
import { BanknoteIcon } from './icon'
import { againstAverage, joinNames, monthName, yen, yenChange, type MoneyCard } from './money'

// Money's Home Card: the latest Complete month's spending against the average of the months
// before, Essential against Optional, net worth, and how many Transactions wait to be confirmed.
// Never the month under way: Statements arrive after a month ends (ADR 0014).
export function MoneyHomeCard() {
  const api = useApi()
  const card = useQuery({ queryKey: ['money', 'card'], queryFn: () => api.get<MoneyCard | null>('/api/money/card') })

  if (card.data === undefined) {
    return (
      <div className={`${cardClasses} bg-surface`}>
        <CardHeader icon={<BanknoteIcon />}>Money</CardHeader>
        {card.isError && (
          <div className="relative z-10">
            <LoadProblem message="Couldn't load Money." retry={() => card.refetch()} />
          </div>
        )}
        <CardLink to="/money">
          <span className="sr-only">Money</span>
        </CardLink>
      </div>
    )
  }
  if (card.data === null) {
    return (
      <div className={`${cardClasses} bg-surface`}>
        <CardHeader icon={<BanknoteIcon />}>Money</CardHeader>
        <CardLink to="/money" className="mt-2 block text-[17px] text-sub">
          Money fills in once a month's Statements are in.
        </CardLink>
      </div>
    )
  }
  const { month, spending, netWorth, unconfirmed } = card.data
  const comparison = againstAverage(spending.total, spending.average3)
  const shown = spending.essential + spending.optional
  // A change with an Account left out would read as a drop that never happened.
  const missing = netWorth.missing ?? []
  return (
    <div className={`${cardClasses} bg-surface`}>
      <CardHeader icon={<BanknoteIcon />}>Money</CardHeader>
      <CardLink to="/money" className="mt-2 block text-ink">
        <span className="block text-[15px] text-sub">{monthName(month)}</span>
        <span className="block text-[28px] font-semibold tabular-nums">{yen(spending.total)}</span>
        {comparison && <span className="block text-[15px] text-sub">{comparison}</span>}
        {shown > 0 && (
          <span className="mt-3 block" aria-hidden="true">
            <span className="flex h-2 overflow-hidden rounded-full bg-fill">
              <span className="bg-accent" style={{ width: `${(spending.essential / shown) * 100}%` }} />
            </span>
          </span>
        )}
        <span className="mt-1.5 flex justify-between text-[13px] text-sub tabular-nums">
          <span>Essential {yen(spending.essential)}</span>
          <span>Optional {yen(spending.optional)}</span>
        </span>
        <span className="mt-3 flex items-baseline justify-between text-[15px] tabular-nums">
          <span>Net worth {yen(netWorth.total)}</span>
          {netWorth.previous !== null && missing.length === 0 && (
            <span className="text-sub">{yenChange(netWorth.total - netWorth.previous)}</span>
          )}
        </span>
        {missing.length > 0 && (
          <span className="block text-[13px] text-sub">Without {joinNames(missing.map((a) => a.name))}: no balance at the month's end</span>
        )}
        {unconfirmed > 0 && <span className="mt-2 block text-[15px] text-accent">{unconfirmed} to confirm in the Money chat</span>}
      </CardLink>
    </div>
  )
}
