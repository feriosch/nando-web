import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useNow } from '../../core/now'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { lucideProps } from '../../core/ui/icons'
import { EmptyNote } from '../../core/ui/Notice'
import { GroupedList, rowLinkClasses, SectionHeader } from '../../core/ui/List'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { ago, type CareerScreen as Screen, type RecruiterReply } from './career'
import { OpportunityRowLink } from './rows'

// The Career screen, at /career: the Recruiters waiting for the Owner, each opening their page, the
// top Opportunities, each opening its page, and links to every open Opportunity and the Late Replies.
export function CareerScreen() {
  const api = useApi()
  const screen = useQuery({ queryKey: ['career', 'screen'], queryFn: () => api.get<Screen>('/api/career') })
  const waitingId = useId()
  const topId = useId()

  return (
    <>
      <ScreenHeader title="Career" />
      {screen.isError && !screen.data && <LoadProblem message="Couldn't load Career." retry={() => screen.refetch()} />}
      {screen.data && (
        <>
          <SectionHeader id={waitingId}>Waiting for you</SectionHeader>
          {screen.data.waiting.length === 0 ? (
            <EmptyNote>Nobody is waiting.</EmptyNote>
          ) : (
            <GroupedList as="ul" labelledBy={waitingId}>
              {screen.data.waiting.map((r) => (
                <li key={r.id} className="my-0">
                  <RecruiterReplyLink reply={r} />
                </li>
              ))}
            </GroupedList>
          )}
          {screen.data.top.length > 0 && (
            <>
              <SectionHeader id={topId}>Top Opportunities</SectionHeader>
              <GroupedList as="ul" labelledBy={topId}>
                {screen.data.top.map((o) => (
                  <li key={o.id} className="my-0">
                    <OpportunityRowLink opportunity={o} />
                  </li>
                ))}
              </GroupedList>
            </>
          )}
          <div className="mt-7">
            <GroupedList>
              <NavRow to="/career/opportunities">All open ({screen.data.open})</NavRow>
              <NavRow to="/career/late">Late Replies ({screen.data.lateReplies})</NavRow>
            </GroupedList>
          </div>
        </>
      )}
    </>
  )
}

// A grouped-list row opening another Career screen.
function NavRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} viewTransition className={rowLinkClasses}>
      <span className="flex-1 text-[17px]">{children}</span>
      <ChevronRight {...lucideProps} className="-mr-1.5 size-5 shrink-0 text-sub" />
    </Link>
  )
}

// A Recruiter with a Suggested Reply as a row opening their page: name and how long ago they wrote,
// their organisation, and the first line of the Suggested Reply.
export function RecruiterReplyLink({ reply: r }: { reply: RecruiterReply }) {
  const [now] = useNow()
  return (
    <Link to={`/career/recruiters/${r.id}`} viewTransition className={rowLinkClasses}>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span lang="ja" className="min-w-0 flex-1 truncate text-[17px] font-semibold">
            {r.name}
          </span>
          <span className="shrink-0 text-[13px] text-sub">{ago(r.lastMessageAt, now)}</span>
        </span>
        <span lang="ja" className="block truncate text-[15px] text-sub">
          {r.organisation}
        </span>
        <span className="block truncate text-[15px]">{r.firstLine}</span>
      </span>
      <ChevronRight {...lucideProps} className="-mr-1.5 size-5 shrink-0 text-sub" />
    </Link>
  )
}
