import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { CardHeader, CardLink, cardClasses } from '../../core/ui/HomeCard'
import { PlaneIcon } from './icon'
import { partyName, yen, type TravelCard } from './travel'

const trendNames = { down: 'Down since last week', flat: 'Flat since last week', up: 'Up since last week' }

// Travel's Home Cards: one per Watching Trip, with the cheaper Party's best Fare per person now and
// its trend since last week, each opening the Trip's page. With no Trip watched, one card opens the
// Travel screen.
export function TravelCards() {
  const api = useApi()
  const cards = useQuery({ queryKey: ['travel', 'cards'], queryFn: () => api.get<{ cards: TravelCard[] }>('/api/travel/cards') })

  if (!cards.data) {
    return (
      <div className={`${cardClasses} bg-surface`}>
        <CardHeader icon={<PlaneIcon />}>Travel</CardHeader>
        {cards.isError && (
          <div className="relative z-10">
            <LoadProblem message="Couldn't load Travel." retry={() => cards.refetch()} />
          </div>
        )}
        <CardLink to="/travel">
          <span className="sr-only">Travel</span>
        </CardLink>
      </div>
    )
  }
  if (cards.data.cards.length === 0) {
    return (
      <div className={`${cardClasses} bg-surface`}>
        <CardHeader icon={<PlaneIcon />}>Travel</CardHeader>
        <CardLink to="/travel" className="mt-2 block text-[17px] text-sub">
          No Trips watched
        </CardLink>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {cards.data.cards.map((card) => (
        <TripCard key={card.tripId} card={card} />
      ))}
    </div>
  )
}

function TripCard({ card }: { card: TravelCard }) {
  return (
    <div className={`${cardClasses} bg-surface`}>
      <CardHeader icon={<PlaneIcon />}>Travel</CardHeader>
      <CardLink to={`/travel/trips/${card.tripId}`} className="mt-2 block text-ink">
        <span className="block text-[17px] font-semibold">{card.name}</span>
        {card.perPerson !== null && card.party !== null ? (
          <>
            <span className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-semibold tabular-nums">{yen(card.perPerson)}</span>
              <span className="text-[15px] text-sub">{partyName(card.party)}, per person</span>
            </span>
            {card.trend && <span className={`block text-[15px] ${card.trend === 'down' ? 'text-accent' : 'text-sub'}`}>{trendNames[card.trend]}</span>}
          </>
        ) : (
          <span className="mt-1 block text-[15px] text-sub">No fares yet</span>
        )}
      </CardLink>
    </div>
  )
}
