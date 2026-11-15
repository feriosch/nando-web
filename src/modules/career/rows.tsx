import { useNow } from '../../core/now'
import { useToday } from '../../core/today'
import { GroupedList, RowLink } from '../../core/ui/List'
import { ago, describeStep, langOf, opportunityLabel, stageName, type TopOpportunity, type WaitingRecruiter } from './career'

// An open Opportunity's lines, as the Home Card and the Career screen's lists show it: its role and
// Stage, its Company, and its next Step.
export function OpportunityLines({ opportunity: o, step }: { opportunity: TopOpportunity; step: string | null }) {
  return (
    <>
      <span className="flex items-baseline gap-2">
        <span lang={langOf(o.role)} className="min-w-0 flex-1 truncate text-[17px] font-semibold text-ink">
          {o.role}
        </span>
        <span className="shrink-0 text-[13px] font-medium text-accent">{stageName(o.stage)}</span>
      </span>
      <span lang={langOf(o.company.name)} className="block truncate text-[15px] text-sub">
        {o.company.name}
      </span>
      {step && <span className="block truncate text-[13px] text-sub">{step}</span>}
    </>
  )
}

// An open Opportunity as a grouped-list row opening its page.
export function OpportunityRowLink({ opportunity: o }: { opportunity: TopOpportunity }) {
  const { today } = useToday()
  const step = o.nextStep && describeStep(o.nextStep, today)
  return (
    <RowLink to={`/career/opportunities/${o.id}`} label={opportunityLabel(o, step)}>
      <OpportunityLines opportunity={o} step={step} />
    </RowLink>
  )
}

// Open Opportunities as a grouped list, named by the element `labelledBy`, each row opening its page.
export function OpportunityList({ opportunities, labelledBy }: { opportunities: TopOpportunity[]; labelledBy: string }) {
  return (
    <GroupedList as="ul" labelledBy={labelledBy}>
      {opportunities.map((o) => (
        <li key={o.id} className="my-0">
          <OpportunityRowLink opportunity={o} />
        </li>
      ))}
    </GroupedList>
  )
}

// Recruiters waiting for the Owner as a grouped list, named by the element `labelledBy`, each row
// opening their page.
export function WaitingRecruiterList({ recruiters, labelledBy }: { recruiters: WaitingRecruiter[]; labelledBy: string }) {
  return (
    <GroupedList as="ul" labelledBy={labelledBy}>
      {recruiters.map((r) => (
        <li key={r.id} className="my-0">
          <WaitingRecruiterLink recruiter={r} />
        </li>
      ))}
    </GroupedList>
  )
}

// A Recruiter waiting for the Owner as a row opening their page: name and how long ago they wrote,
// their organisation, and the first line of the Suggested Reply.
function WaitingRecruiterLink({ recruiter: r }: { recruiter: WaitingRecruiter }) {
  const [now] = useNow()
  return (
    <RowLink to={`/career/recruiters/${r.id}`}>
      <span className="flex items-baseline gap-2">
        <span lang={langOf(r.name)} className="min-w-0 flex-1 truncate text-[17px] font-semibold">
          {r.name}
        </span>
        <span className="shrink-0 text-[13px] text-sub">{ago(r.lastMessageAt, now)}</span>
      </span>
      <span lang={langOf(r.organisation)} className="block truncate text-[15px] text-sub">
        {r.organisation}
      </span>
      <span lang={langOf(r.firstLine)} className="block truncate text-[15px]">
        {r.firstLine}
      </span>
    </RowLink>
  )
}
