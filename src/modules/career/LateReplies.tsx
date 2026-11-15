import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import type { WaitingRecruiter } from './career'
import { WaitingRecruiterList } from './rows'

// Late Replies, at /career/late: the Recruiters whose Suggested Reply is late, by how old their
// message is, oldest first, each opening their page. Kept apart so they never bury new ones.
export function LateReplies() {
  const api = useApi()
  const late = useQuery({ queryKey: ['career', 'late-replies'], queryFn: () => api.get<WaitingRecruiter[]>('/api/career/late-replies') })
  const titleId = useId()

  return (
    <>
      <ScreenHeader back={{ to: '/career', label: 'Career' }} title={<span id={titleId}>Late Replies</span>} />
      {late.isError && !late.data && <LoadProblem message="Couldn't load the Late Replies." retry={() => late.refetch()} />}
      {late.data &&
        (late.data.length === 0 ? (
          <EmptyNote>No Late Replies.</EmptyNote>
        ) : (
          <WaitingRecruiterList recruiters={late.data} labelledBy={titleId} />
        ))}
    </>
  )
}
