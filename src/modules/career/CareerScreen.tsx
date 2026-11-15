import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { GroupedList, RowLink, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import type { CareerOverview } from './career'
import { OpportunityList, WaitingRecruiterList } from './rows'

// The Career screen, at /career: the Recruiters waiting for the Owner, each opening their page, the
// top Opportunities, each opening its page, and links to every open Opportunity and the Late Replies.
export function CareerScreen() {
  const api = useApi()
  const overview = useQuery({ queryKey: ['career', 'screen'], queryFn: () => api.get<CareerOverview>('/api/career') })
  const waitingId = useId()
  const topId = useId()

  return (
    <>
      <ScreenHeader title="Career" />
      {overview.isError && !overview.data && <LoadProblem message="Couldn't load Career." retry={() => overview.refetch()} />}
      {overview.data && (
        <>
          <SectionHeader id={waitingId}>Waiting for you</SectionHeader>
          {overview.data.waiting.length === 0 ? (
            <EmptyNote>Nobody is waiting.</EmptyNote>
          ) : (
            <WaitingRecruiterList recruiters={overview.data.waiting} labelledBy={waitingId} />
          )}
          {overview.data.top.length > 0 && (
            <>
              <SectionHeader id={topId}>Top Opportunities</SectionHeader>
              <OpportunityList opportunities={overview.data.top} labelledBy={topId} />
            </>
          )}
          <div className="mt-7">
            <GroupedList>
              <RowLink to="/career/opportunities">
                <span className="text-[17px]">All open ({overview.data.open})</span>
              </RowLink>
              <RowLink to="/career/late">
                <span className="text-[17px]">Late Replies ({overview.data.lateReplies})</span>
              </RowLink>
            </GroupedList>
          </div>
        </>
      )}
    </>
  )
}
