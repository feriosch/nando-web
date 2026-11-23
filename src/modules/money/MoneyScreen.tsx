import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { GroupedList, ListRow, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { joinNames, monthName, yen, yenChange, type MoneyCard } from './money'

// The Money screen: for now, the latest Complete month in rows. Each month's breakdown and graphs
// come once a few months are in (feriosch/nando-server#216). The Money Assistant writes, in Telegram.
export function MoneyScreen() {
  const api = useApi()
  const card = useQuery({ queryKey: ['money', 'card'], queryFn: () => api.get<MoneyCard | null>('/api/money/card') })
  const id = useId()
  return (
    <>
      <ScreenHeader title="Money" />
      {card.isError && <LoadProblem message="Couldn't load Money." retry={() => card.refetch()} />}
      {card.data === null && <EmptyNote>Nothing here yet. Send your Statements to the Money Assistant in Telegram.</EmptyNote>}
      {card.data && (
        <section>
          <SectionHeader id={id}>{monthName(card.data.month)}</SectionHeader>
          <GroupedList as="ul" labelledBy={id} footer="Statements go to the Money Assistant, in the Money chat.">
            <Row label="Spending" value={yen(card.data.spending.total)} />
            {card.data.spending.average3 !== null && <Row label="3-month average" value={yen(card.data.spending.average3)} />}
            <Row label="Essential" value={yen(card.data.spending.essential)} />
            <Row label="Optional" value={yen(card.data.spending.optional)} />
            {card.data.spending.unmarked > 0 && <Row label="Not marked yet" value={yen(card.data.spending.unmarked)} />}
            <Row label="Net worth" value={yen(card.data.netWorth.total)} />
            {(card.data.netWorth.missing ?? []).length > 0 && (
              <Row label="Without" value={joinNames((card.data.netWorth.missing ?? []).map((a) => a.name))} />
            )}
            {card.data.netWorth.previous !== null && (card.data.netWorth.missing ?? []).length === 0 && (
              <Row label="Since the month before" value={yenChange(card.data.netWorth.total - card.data.netWorth.previous)} />
            )}
            {card.data.unconfirmed > 0 && <Row label="To confirm in the Money chat" value={String(card.data.unconfirmed)} />}
          </GroupedList>
        </section>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <ListRow>
        <span>{label}</span>
        <span className="text-sub tabular-nums">{value}</span>
      </ListRow>
    </li>
  )
}
