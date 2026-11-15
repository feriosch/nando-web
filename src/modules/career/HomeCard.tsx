import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import { CardHeader, CardLink, cardClasses } from '../../core/ui/HomeCard'
import { Switch } from '../../core/ui/Switch'
import { describeStep, opportunityLabel, type CareerHomeCard, type TopOpportunity } from './career'
import { BriefcaseIcon } from './icon'
import { OpportunityLines } from './rows'

const homeCardKey = ['career', 'home-card']

// The Career Home Card: whether the Owner is Looking, the only control in the Module, how many
// Recruiters are waiting, and the top 3 Opportunities, each opening its page. The whole card opens
// the Career screen.
export function CareerCard() {
  const api = useApi()
  const card = useQuery({ queryKey: homeCardKey, queryFn: () => api.get<CareerHomeCard>('/api/career/home-card') })

  return (
    <div className={`${cardClasses} bg-surface`}>
      <CardHeader icon={<BriefcaseIcon />}>Career</CardHeader>
      {card.isError && !card.data && (
        // Above the card's link.
        <div className="relative z-10">
          <LoadProblem message="Couldn't load Career." retry={() => card.refetch()} />
        </div>
      )}
      {card.data ? (
        <LoadedCard card={card.data} />
      ) : (
        <CardLink to="/career">
          <span className="sr-only">Career</span>
        </CardLink>
      )}
    </div>
  )
}

// The card once loaded: the Looking switch, the waiting line, which names the card's link (hidden at
// 0, when the link is just "Career"), and the top Opportunities, or that nothing is waiting.
function LoadedCard({ card: { looking, waiting, top } }: { card: CareerHomeCard }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const { today } = useToday()
  const setLooking = useMutation({
    mutationFn: (looking: boolean) => api.put('/api/career/settings', { looking }),
    // One save at a time, in the order tapped, so the server ends on the last one.
    scope: { id: 'career-looking' },
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
    // Then read what the server holds.
    onSettled: () => queryClient.invalidateQueries({ queryKey: homeCardKey }),
  })

  return (
    <>
      {/* Above the card's link. */}
      <div className="relative z-10 mt-2 text-[17px]">
        <Switch isSelected={looking} onChange={(looking) => setLooking.mutate(looking)}>
          Looking
        </Switch>
        {setLooking.isError && (
          <p role="alert" className="mt-1 mb-0 text-[13px] text-sub">
            Couldn't change whether you're Looking. Try again.
          </p>
        )}
      </div>
      <CardLink to="/career" className="block">
        {waiting > 0 ? (
          <span className="mt-3 block text-[22px] font-semibold text-ink">{waitingLine(waiting)}</span>
        ) : (
          <span className="sr-only">Career</span>
        )}
      </CardLink>
      {waiting === 0 && top.length === 0 && <p className="mt-3 mb-0 text-[15px] text-sub">Nothing waiting.</p>}
      {top.length > 0 && (
        <ul aria-label="Top Opportunities" className="mt-3 mb-0 list-none divide-y divide-line p-0">
          {top.map((o) => (
            <li key={o.id} className="my-0">
              <OpportunityLink opportunity={o} today={today} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// One of the top Opportunities, opening its page. Above the card's link; the gaps between them stay
// on it.
function OpportunityLink({ opportunity: o, today }: { opportunity: TopOpportunity; today: string | undefined }) {
  const step = o.nextStep && describeStep(o.nextStep, today)
  return (
    <Link
      to={`/career/opportunities/${o.id}`}
      viewTransition
      aria-label={opportunityLabel(o, step)}
      className="relative z-10 flex min-h-11 flex-col gap-0.5 py-2.5 no-underline outline-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-accent active:opacity-70"
    >
      <OpportunityLines opportunity={o} step={step} />
    </Link>
  )
}

// How many Recruiters are waiting, such as "2 Recruiters waiting".
function waitingLine(n: number): string {
  return `${n} ${n === 1 ? 'Recruiter' : 'Recruiters'} waiting`
}
