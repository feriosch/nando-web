import { useQuery } from '@tanstack/react-query'
import { useId, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { ApiError } from '../../core/api/client'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import { GroupedList, ListRow, RowLink, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import {
  interestName,
  langOf,
  salaryInMan,
  salaryInYen,
  standing,
  stepWhen,
  workingLanguageName,
  workName,
  type OpportunityDetails,
  type PageStep,
  type Salary,
} from './career'

// An Opportunity's page, at /career/opportunities/:id: everything about it, open or closed.
export function OpportunityPage() {
  const { id } = useParams()
  const api = useApi()
  const page = useQuery({
    queryKey: ['career', 'opportunities', id],
    queryFn: () => api.get<OpportunityDetails>(`/api/career/opportunities/${id}`),
  })
  const back = { to: '/career', label: 'Career' }

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
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[13px] font-semibold text-accent-ink">{standing(o)}</span>
        <span className="text-[13px] text-sub">{interestName(o.interest)}</span>
      </p>
      {o.steps.length > 0 && <Steps steps={o.steps} />}
      <PayAndConditions opportunity={o} />
      {o.perks.length > 0 && <Perks perks={o.perks} />}
      {o.fitNote && <TextSection title="Fit note" text={o.fitNote} />}
      {o.details && <TextSection title="Details" text={o.details} />}
      {o.recruiter && (
        <>
          <SectionHeader>Recruiter</SectionHeader>
          <GroupedList>
            <RowLink to={`/career/recruiters/${o.recruiter.id}`}>
              <span lang={langOf(o.recruiter.name)} className="text-[17px]">
                {o.recruiter.name}
              </span>
            </RowLink>
          </GroupedList>
        </>
      )}
      {o.company.brief && <TextSection title="Company Brief" text={o.company.brief} />}
    </>
  )
}

// The Steps by date: the next one highlighted, past ones dimmed.
function Steps({ steps }: { steps: PageStep[] }) {
  const headingId = useId()
  const { today } = useToday()
  return (
    <>
      <SectionHeader id={headingId}>Steps</SectionHeader>
      <GroupedList as="ul" labelledBy={headingId}>
        {steps.map((step) => {
          const past = today !== undefined && step.date < today
          return (
            <li
              key={step.id}
              aria-current={step.next ? 'step' : undefined}
              className={`my-0 flex flex-col gap-0.5 px-4 py-3 ${past ? 'opacity-50' : ''} ${step.next ? 'border-l-[3px] border-accent' : ''}`}
            >
              {step.next && <span className="text-[12px] font-semibold tracking-wide text-accent uppercase">Next</span>}
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
      </GroupedList>
    </>
  )
}

// Pay and working conditions: each salary in 万円 with the yen under it, the bonus, where the work
// is done, the office and the working language. Only what is known is shown, and nothing when none
// of it is.
function PayAndConditions({ opportunity: { pay, conditions } }: { opportunity: OpportunityDetails }) {
  const headingId = useId()
  const work = workName(conditions)
  const rows = [
    pay.firstStated && <Row key="first" label="First stated" value={<SalaryValue salary={pay.firstStated} />} />,
    pay.offered && <Row key="offered" label="Offered" value={<SalaryValue salary={pay.offered} />} />,
    pay.bonusIncluded !== null && <Row key="bonus" label="Bonus" value={pay.bonusIncluded ? 'Included' : 'Not included'} />,
    work && <Row key="work" label="Work" value={work} />,
    conditions.officeLocation && (
      <Row key="office" label="Office" value={<span lang={langOf(conditions.officeLocation)}>{conditions.officeLocation}</span>} />
    ),
    conditions.workingLanguage && <Row key="language" label="Working language" value={workingLanguageName(conditions.workingLanguage)} />,
  ].filter(Boolean)
  if (rows.length === 0) return null
  return (
    <section aria-labelledby={headingId}>
      <SectionHeader id={headingId}>Pay and conditions</SectionHeader>
      <GroupedList as="ul">{rows}</GroupedList>
    </section>
  )
}

// A label on the left and its value on the right.
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <ListRow as="li">
      <span className="shrink-0">{label}</span>
      <span className="text-right text-sub">{value}</span>
    </ListRow>
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

// The Perks, as a list.
function Perks({ perks }: { perks: string[] }) {
  const headingId = useId()
  return (
    <>
      <SectionHeader id={headingId}>Perks</SectionHeader>
      <GroupedList as="ul" labelledBy={headingId}>
        {perks.map((perk) => (
          <ListRow key={perk} as="li">
            <span lang={langOf(perk)}>{perk}</span>
          </ListRow>
        ))}
      </GroupedList>
    </>
  )
}

// A titled block of free text, such as the fit note or the Company Brief, its lines kept.
function TextSection({ title, text }: { title: string; text: string }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <SectionHeader id={headingId}>{title}</SectionHeader>
      <div className="my-2 rounded-[14px] bg-surface px-4 py-3">
        <p lang={langOf(text)} className="my-0 text-[17px] leading-relaxed whitespace-pre-line">
          {text}
        </p>
      </div>
    </section>
  )
}
