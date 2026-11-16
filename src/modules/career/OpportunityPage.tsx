import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { ApiError } from '../../core/api/client'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import { useBackLink } from '../../core/ui/cameFrom'
import { GroupedList, ListRow, RowLink } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { Detail, Section, TextBlock } from '../../core/ui/Section'
import {
  interestName,
  langOf,
  salaryInMan,
  salaryInYen,
  stageWithOutcome,
  stepWhen,
  workingLanguageName,
  workplaceName,
  type Conditions,
  type OpportunityDetails,
  type Pay,
  type Salary,
  type Step,
} from './career'

// An Opportunity's page, at /career/opportunities/:id: everything about it, open or closed. Only what
// is known is shown.
export function OpportunityPage() {
  const { id } = useParams()
  const api = useApi()
  const page = useQuery({
    queryKey: ['career', 'opportunities', id],
    queryFn: () => api.get<OpportunityDetails>(`/api/career/opportunities/${id}`),
  })
  // Back to the open Opportunities or Home when it was opened from there, and to the Career screen
  // otherwise, such as from a Notification.
  const back = useBackLink({ '/career/opportunities': 'Open Opportunities', '/': 'Home' }, { to: '/career', label: 'Career' })

  if (!page.data) {
    return (
      <>
        <ScreenHeader back={back} />
        {page.isError &&
          (page.error instanceof ApiError && page.error.status === 404 ? (
            <EmptyNote>This Opportunity isn't in Nando.</EmptyNote>
          ) : (
            <LoadProblem message="Couldn't load this Opportunity." retry={() => page.refetch()} />
          ))}
      </>
    )
  }
  const o = page.data
  return (
    <>
      <ScreenHeader
        back={back}
        title={<span lang={langOf(o.role)}>{o.role}</span>}
        subtitle={<span lang={langOf(o.company.name)}>{o.company.name}</span>}
      />
      <p className="mx-0 my-1 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[13px] font-semibold text-accent-ink">{stageWithOutcome(o)}</span>
        <span className="text-[13px] text-sub">{interestName(o.interest)}</span>
      </p>
      {/* A closed one has no next Step. */}
      {o.steps.length > 0 && <Steps steps={o.steps} closed={o.stage === 'closed'} />}
      <PayAndConditions pay={o.pay} conditions={o.conditions} />
      {o.perks.length > 0 && (
        <Section title="Perks" list>
          {o.perks.map((perk, i) => (
            <ListRow key={i} as="li">
              <span lang={langOf(perk)}>{perk}</span>
            </ListRow>
          ))}
        </Section>
      )}
      <Text title="Fit note" text={o.fitNote} />
      <Text title="Details" text={o.details} />
      {o.recruiter && (
        <Section title="Recruiter">
          <GroupedList>
            <RowLink to={`/career/recruiters/${o.recruiter.id}`}>
              <span lang={langOf(o.recruiter.name)} className="text-[17px]">
                {o.recruiter.name}
              </span>
            </RowLink>
          </GroupedList>
        </Section>
      )}
      <Text title="Company Brief" text={o.company.brief} />
    </>
  )
}

// The Steps by date: the next one highlighted, unless the Opportunity is closed, and past ones
// dimmed.
function Steps({ steps, closed }: { steps: Step[]; closed: boolean }) {
  const { today } = useToday()
  return (
    <Section title="Steps" list>
      {steps.map((step) => {
        const next = step.next && !closed
        const past = !next && today !== undefined && step.date < today
        return (
          <li
            key={step.id}
            aria-current={next ? 'step' : undefined}
            className={`my-0 flex flex-col gap-0.5 px-4 py-3 ${past ? 'opacity-50' : ''} ${next ? 'border-l-[3px] border-accent' : ''}`}
          >
            {next && <span className="text-[12px] font-semibold tracking-wide text-accent uppercase">Next</span>}
            <span lang={langOf(step.kind)} className="text-[17px] font-semibold">
              {step.kind}
            </span>
            <span className="text-[15px] text-sub">{stepWhen(step.date, step.time, today)}</span>
            {step.notes && (
              <span lang={langOf(step.notes)} className="text-[15px] whitespace-pre-line">
                {step.notes}
              </span>
            )}
          </li>
        )
      })}
    </Section>
  )
}

// Pay and working conditions: each salary in 万円 with the yen under it, the bonus, where the work
// is done, the office and the working language. Only what is known is shown, and nothing when none
// of it is.
function PayAndConditions({ pay, conditions }: { pay: Pay; conditions: Conditions }) {
  const workplace = workplaceName(conditions)
  const rows = [
    pay.firstStated && (
      <Detail key="first" label="First stated">
        <SalaryValue salary={pay.firstStated} />
      </Detail>
    ),
    pay.offered && (
      <Detail key="offered" label="Offered">
        <SalaryValue salary={pay.offered} />
      </Detail>
    ),
    pay.bonusIncluded !== null && (
      <Detail key="bonus" label="Bonus">
        {pay.bonusIncluded ? 'Included' : 'Not included'}
      </Detail>
    ),
    workplace && (
      <Detail key="work" label="Work">
        {workplace}
      </Detail>
    ),
    conditions.officeLocation.trim() && (
      <Detail key="office" label="Office" lang={langOf(conditions.officeLocation)}>
        {conditions.officeLocation}
      </Detail>
    ),
    conditions.workingLanguage && (
      <Detail key="language" label="Working language">
        {workingLanguageName(conditions.workingLanguage)}
      </Detail>
    ),
  ].filter(Boolean)
  if (rows.length === 0) return null
  return (
    <Section title="Pay and working conditions" list>
      {rows}
    </Section>
  )
}

// A salary in 万円, with the yen under it in the secondary colour.
function SalaryValue({ salary }: { salary: Salary }) {
  return (
    <span className="flex flex-col items-end">
      <span className="text-ink">{salaryInMan(salary)}</span>
      <span className="text-[13px]">{salaryInYen(salary)}</span>
    </span>
  )
}

// A titled block of free text, such as the fit note or the Company Brief, left out when it is blank.
function Text({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null
  return (
    <Section title={title}>
      <TextBlock lang={langOf(text)}>{text}</TextBlock>
    </Section>
  )
}
