import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import type { TopOpportunity } from './career'
import { OpportunityList } from './rows'

// Open Opportunities, at /career/opportunities: every open Opportunity, top first, each opening its
// page. The Career screen links to it as "All open".
export function OpenOpportunities() {
  const api = useApi()
  const open = useQuery({ queryKey: ['career', 'opportunities'], queryFn: () => api.get<TopOpportunity[]>('/api/career/opportunities') })
  const titleId = useId()

  return (
    <>
      <ScreenHeader back={{ to: '/career', label: 'Career' }} title={<span id={titleId}>Open Opportunities</span>} />
      {open.isError && !open.data && <LoadProblem message="Couldn't load the open Opportunities." retry={() => open.refetch()} />}
      {open.data &&
        (open.data.length === 0 ? (
          <EmptyNote>No open Opportunities.</EmptyNote>
        ) : (
          <OpportunityList opportunities={open.data} labelledBy={titleId} />
        ))}
    </>
  )
}
