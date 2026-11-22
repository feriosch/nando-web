import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { GroupedList, RowLink, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { partyName, route, statusName, yen, yenChange, type TripSummary } from './travel'

// The Travel screen: the Owner's Trips, Watching ones first, each Party with its best Fare now. The
// Travel Assistant sets Trips up and changes them, in Telegram.
export function TravelScreen() {
  const api = useApi()
  const trips = useQuery({ queryKey: ['travel', 'trips'], queryFn: () => api.get<{ trips: TripSummary[] }>('/api/travel/trips') })
  const watching = trips.data?.trips.filter((t) => t.status === 'watching') ?? []
  const others = trips.data?.trips.filter((t) => t.status !== 'watching') ?? []
  return (
    <>
      <ScreenHeader title="Travel" />
      {trips.isError && <LoadProblem message="Couldn't load your Trips." retry={() => trips.refetch()} />}
      {trips.data && trips.data.trips.length === 0 && <EmptyNote>No Trips yet. Ask the Travel Assistant in Telegram to watch one.</EmptyNote>}
      {watching.length > 0 && <TripList title="Watching" trips={watching} />}
      {others.length > 0 && <TripList title="Booked and dropped" trips={others} />}
    </>
  )
}

function TripList({ title, trips }: { title: string; trips: TripSummary[] }) {
  const id = useId()
  return (
    <section>
      <SectionHeader id={id}>{title}</SectionHeader>
      <GroupedList as="ul" labelledBy={id}>
        {trips.map((trip) => (
          <li key={trip.id}>
            <RowLink to={`/travel/trips/${trip.id}`}>
              <span className="block text-[17px]">{trip.name}</span>
              <span className="block text-[13px] text-sub">
                {route(trip)}
                {trip.status !== 'watching' && ` · ${statusName(trip.status)}`}
              </span>
              {trip.status === 'watching' &&
                trip.parties.map((p) => (
                  <span key={p.key} className="mt-0.5 block text-[15px] tabular-nums">
                    {partyName(p.key)} · {p.best ? yen(p.best.perPerson) : <span className="text-sub">no fares yet</span>}
                    {p.sinceLastWeek !== null && (
                      <span className={p.sinceLastWeek < 0 ? 'text-accent' : 'text-sub'}> {yenChange(p.sinceLastWeek)}</span>
                    )}
                  </span>
                ))}
            </RowLink>
          </li>
        ))}
      </GroupedList>
    </section>
  )
}
