import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { GroupedList } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import type { RecruiterReply } from './career'
import { RecruiterReplyLink } from './CareerScreen'

// Late Replies, at /career/late: the Recruiters whose Suggested Reply is late, by how old their
// message is, oldest first, each opening their page. Kept apart so they never bury new ones.
export function LateReplies() {
  const api = useApi()
  const late = useQuery({ queryKey: ['career', 'late-replies'], queryFn: () => api.get<RecruiterReply[]>('/api/career/late-replies') })
  const titleId = useId()

  return (
    <>
      <ScreenHeader back={{ to: '/career', label: 'Career' }} title={<span id={titleId}>Late Replies</span>} />
      {late.isError && !late.data && <LoadProblem message="Couldn't load the Late Replies." retry={() => late.refetch()} />}
      {late.data &&
        (late.data.length === 0 ? (
          <EmptyNote>No Late Replies.</EmptyNote>
        ) : (
          <GroupedList as="ul" labelledBy={titleId}>
            {late.data.map((r) => (
              <li key={r.id} className="my-0">
                <RecruiterReplyLink reply={r} />
              </li>
            ))}
          </GroupedList>
        ))}
    </>
  )
}
