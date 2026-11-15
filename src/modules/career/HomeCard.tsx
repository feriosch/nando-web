import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { CardHeader, CardLink, cardClasses } from '../../core/ui/HomeCard'
import { Switch } from '../../core/ui/Switch'
import { describeStep, stageName, type CareerHomeCard, type TopOpportunity } from './career'
import { BriefcaseIcon } from './icon'

const homeCardKey = ['career', 'home-card']

// The Career Home Card: whether the Owner is Looking, the only control in the Module, how many
// Recruiters are waiting, and the top 3 Opportunities, each opening its page. The whole card opens
// the Career screen.
export function CareerCard() {
  const api = useApi()
  const queryClient = useQueryClient()
  const card = useQuery({ queryKey: homeCardKey, queryFn: () => api.get<CareerHomeCard>('/api/career/home-card') })
  const setLooking = useMutation({
    mutationFn: (looking: boolean) => api.put('/api/career/settings', { looking }),
    // Shown at once, before the server answers, and put back if it fails.
    onMutate: async (looking) => {
      await queryClient.cancelQueries({ queryKey: homeCardKey })
      const before = queryClient.getQueryData<CareerHomeCard>(homeCardKey)
      queryClient.setQueryData<CareerHomeCard>(homeCardKey, (shown) => shown && { ...shown, looking })
      return { before }
    },
    onError: (_error, _looking, context) => {
      if (context?.before) queryClient.setQueryData(homeCardKey, context.before)
    },
  })

  return (
    <div className={`${cardClasses} bg-surface`}>
      <CardHeader icon={<BriefcaseIcon />}>Career</CardHeader>
      {card.isError && (
        // Above the card's link.
        <div className="relative z-10">
          <LoadProblem message="Couldn't load Career." retry={() => card.refetch()} />
        </div>
      )}
      {card.data && (
        // Above the card's link.
        <div className="relative z-10 mt-2 text-[17px]">
          <Switch isSelected={card.data.looking} onChange={(looking) => setLooking.mutate(looking)}>
            Looking
          </Switch>
          {setLooking.isError && (
            <p role="alert" className="mt-1 mb-0 text-[13px] text-sub">
              Couldn't change whether you're Looking. Try again.
            </p>
          )}
        </div>
      )}
      {/* The waiting line names the card's link; hidden at 0, when the link is just "Career". */}
      <CardLink to="/career" className="block">
        {card.data && card.data.waiting > 0 ? (
          <span className="mt-3 block text-[22px] font-semibold text-ink">{waitingLine(card.data.waiting)}</span>
        ) : (
          <span className="sr-only">Career</span>
        )}
      </CardLink>
      {card.data && card.data.waiting === 0 && card.data.top.length === 0 && (
        <p className="mt-3 mb-0 text-[15px] text-sub">Nothing waiting.</p>
      )}
      {card.data && card.data.top.length > 0 && (
        <ul aria-label="Top Opportunities" className="relative z-10 mt-3 mb-0 list-none divide-y divide-line p-0">
          {card.data.top.map((o) => (
            <li key={o.id} className="my-0">
              <OpportunityLink opportunity={o} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// One of the top Opportunities: its role, Company, Stage and next Step, opening its page.
function OpportunityLink({ opportunity: o }: { opportunity: TopOpportunity }) {
  return (
    <Link
      to={`/career/opportunities/${o.id}`}
      viewTransition
      className="flex min-h-11 flex-col gap-0.5 py-2.5 no-underline outline-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-accent active:opacity-70"
    >
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[17px] font-semibold text-ink">{o.role}</span>
        <span className="shrink-0 text-[13px] font-medium text-accent">{stageName(o.stage)}</span>
      </span>
      <span className="truncate text-[15px] text-sub">{o.company.name}</span>
      {o.nextStep && <span className="truncate text-[13px] text-sub">{describeStep(o.nextStep)}</span>}
    </Link>
  )
}

// How many Recruiters are waiting, such as "2 Recruiters waiting".
function waitingLine(n: number): string {
  return `${n} ${n === 1 ? 'Recruiter' : 'Recruiters'} waiting`
}
