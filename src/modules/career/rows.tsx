import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useToday } from '../../core/today'
import { lucideProps } from '../../core/ui/icons'
import { rowLinkClasses } from '../../core/ui/List'
import { describeStep, opportunityLabel, stageName, type TopOpportunity } from './career'

// An open Opportunity's lines, as the Home Card and the Career screen's lists show it: its role and
// Stage, its Company, and its next Step.
export function OpportunityLines({ opportunity: o, step }: { opportunity: TopOpportunity; step: string | null }) {
  return (
    <>
      <span className="flex items-baseline gap-2">
        {/* A Japanese Company's role and name are often in Japanese. */}
        <span lang="ja" className="min-w-0 flex-1 truncate text-[17px] font-semibold text-ink">
          {o.role}
        </span>
        <span className="shrink-0 text-[13px] font-medium text-accent">{stageName(o.stage)}</span>
      </span>
      <span lang="ja" className="block truncate text-[15px] text-sub">
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
    <Link to={`/career/opportunities/${o.id}`} viewTransition aria-label={opportunityLabel(o, step)} className={rowLinkClasses}>
      <span className="min-w-0 flex-1">
        <OpportunityLines opportunity={o} step={step} />
      </span>
      <ChevronRight {...lucideProps} className="-mr-1.5 size-5 shrink-0 text-sub" />
    </Link>
  )
}
