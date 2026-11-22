import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useId } from 'react'
import { useParams } from 'react-router'
import { ApiError } from '../../core/api/client'
import { formatDayAs } from '../../core/days'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useBackLink } from '../../core/ui/cameFrom'
import { lucideProps } from '../../core/ui/icons'
import { GroupedList, ListRow, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import {
  carriers,
  fareDates,
  farePrice,
  leaveLine,
  legLine,
  partyName,
  route,
  statusName,
  stayLine,
  yen,
  type Fare,
  type PartyPage,
  type TripPage as TripPageData,
} from './travel'

// A Trip's page, at /travel/trips/:id: for each Party, the best per person over time, the cheapest
// Fare per departure week, and the top Fares, each opening its seller to book. The Owner books;
// the app never does.
export function TripPage() {
  const { id } = useParams()
  const api = useApi()
  const page = useQuery({ queryKey: ['travel', 'trips', id], queryFn: () => api.get<TripPageData>(`/api/travel/trips/${id}`) })
  const back = useBackLink({ to: '/travel', label: 'Travel' })

  if (!page.data) {
    return (
      <>
        <ScreenHeader back={back} />
        {page.isError &&
          (page.error instanceof ApiError && page.error.status === 404 ? (
            <EmptyNote>This Trip is gone from Nando.</EmptyNote>
          ) : (
            <LoadProblem message="Couldn't load this Trip." retry={() => page.refetch()} />
          ))}
      </>
    )
  }
  const { trip, parties } = page.data
  return (
    <>
      <ScreenHeader back={back} title={trip.name} subtitle={`${route(trip)} · ${stayLine(trip.nights)}`} />
      {trip.status !== 'watching' && (
        <p className="my-1">
          <span className="rounded-full bg-fill px-2.5 py-0.5 text-[13px] font-semibold text-sub">{statusName(trip.status)}</span>
        </p>
      )}
      {parties.map((party) => (
        <Party key={party.key} party={party} />
      ))}
    </>
  )
}

function Party({ party }: { party: PartyPage }) {
  const id = useId()
  const verdict = party.verdicts[0]
  return (
    <section aria-labelledby={id} className="mt-6">
      <h2 id={id} className="mx-0 my-0 font-display text-[22px] font-bold">
        {partyName(party.key)}
      </h2>
      <p className="my-1 flex flex-wrap gap-x-3 text-[13px] text-sub">
        {party.targetFare !== null && <span>Target {yen(party.targetFare)}</span>}
        {verdict && <span>Google: {verdict.level}</span>}
        {party.adults > 1 && <span>{party.adults} adults</span>}
      </p>
      {party.top.length === 0 && party.history.length === 0 ? (
        <EmptyNote>No fares yet. The next Fare Check looks.</EmptyNote>
      ) : (
        <>
          {party.history.length > 0 && <PriceChart history={party.history} target={party.targetFare} />}
          {party.byWeek.length > 0 && <WeekMap weeks={party.byWeek} />}
          {party.top.length > 0 && <TopFares fares={party.top} />}
          {party.top[0]?.separateTickets && party.bestSingleTicket && <SingleTicket fare={party.bestSingleTicket} />}
        </>
      )}
    </section>
  )
}

// The best per person on each Day Fares were found, as a line, with the Target Fare dashed.
function PriceChart({ history, target }: { history: { day: string; perPerson: number }[]; target: number | null }) {
  const width = 340
  const height = 120
  const prices = history.map((h) => h.perPerson).concat(target === null ? [] : [target])
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const span = high - low || 1
  const x = (i: number) => (history.length === 1 ? width / 2 : 8 + (i * (width - 16)) / (history.length - 1))
  const y = (price: number) => 12 + ((high - price) * (height - 24)) / span
  const points = history.map((h, i) => `${x(i)},${y(h.perPerson)}`).join(' ')
  const first = history[0]
  const last = history[history.length - 1]
  const label = `Best per person by day: ${yen(first.perPerson)} on ${formatDayAs(first.day, { day: 'numeric', month: 'short' })}, ${yen(last.perPerson)} on ${formatDayAs(last.day, { day: 'numeric', month: 'short' })}`
  return (
    <GroupedList>
      <div className="px-4 py-3">
        <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
          {target !== null && <line x1={0} x2={width} y1={y(target)} y2={y(target)} className="stroke-sub" strokeDasharray="4 4" strokeWidth={1} />}
          <polyline points={points} fill="none" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {history.map((h, i) => (
            <circle key={h.day} cx={x(i)} cy={y(h.perPerson)} r={3} className="fill-accent" />
          ))}
        </svg>
        <p aria-hidden className="m-0 mt-1 flex justify-between text-[13px] text-sub tabular-nums">
          <span>{yen(first.perPerson)}</span>
          <span>{yen(last.perPerson)}</span>
        </p>
      </div>
    </GroupedList>
  )
}

// The cheapest Fare departing in each week: the cheaper, the stronger its colour. The strongest stays
// light enough for the ink on it to read, in dark too.
function WeekMap({ weeks }: { weeks: { week: string; fare: Fare }[] }) {
  const id = useId()
  const prices = weeks.map((w) => w.fare.perPerson)
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  return (
    <>
      <SectionHeader id={id}>Cheapest by departure week</SectionHeader>
      <ul aria-labelledby={id} className="m-0 grid list-none grid-cols-4 gap-1.5 p-0">
        {weeks.map(({ week, fare }) => {
          const strength = high === low ? 1 : 1 - (fare.perPerson - low) / (high - low)
          const day = formatDayAs(week, { day: 'numeric', month: 'short' })
          return (
            <li
              key={week}
              aria-label={`Week of ${day}: ${yen(fare.perPerson)}`}
              className="relative overflow-hidden rounded-[10px] bg-surface px-2 py-1.5 text-center"
            >
              <span aria-hidden className="absolute inset-0 bg-accent" style={{ opacity: 0.08 + 0.37 * strength }} />
              <span aria-hidden className="relative block text-[11px] text-ink">{day}</span>
              <span aria-hidden className="relative block text-[13px] font-semibold text-ink tabular-nums">{`¥${Math.round(fare.perPerson / 1000)}k`}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function TopFares({ fares }: { fares: Fare[] }) {
  const id = useId()
  return (
    <>
      <SectionHeader id={id}>Top fares</SectionHeader>
      <GroupedList as="ul" labelledBy={id}>
        {fares.map((fare) => (
          <FareRow key={fare.id} fare={fare} />
        ))}
      </GroupedList>
    </>
  )
}

// The best current Fare on one ticket, beside a cheapest one on Separate Tickets.
function SingleTicket({ fare }: { fare: Fare }) {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <SectionHeader id={id}>Best on one ticket</SectionHeader>
      <GroupedList as="ul" labelledBy={id}>
        <FareRow fare={fare} />
      </GroupedList>
    </section>
  )
}

function FareRow({ fare }: { fare: Fare }) {
  return (
    <ListRow as="li" className="flex-col items-stretch gap-1 py-3">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[17px] font-semibold tabular-nums">{farePrice(fare)}</span>
        {fare.bookingUrl && (
          <a href={fare.bookingUrl} target="_blank" rel="noopener noreferrer" className="-my-3 flex min-h-11 shrink-0 items-center gap-1 text-[15px] whitespace-nowrap text-accent no-underline">
            Open to book
            <ExternalLink {...lucideProps} className="size-4" />
          </a>
        )}
      </span>
      <span className="text-[15px]">{fareDates(fare)}</span>
      <span className="text-[13px] text-sub">
        {carriers(fare)} · out {legLine(fare.outbound)} · back {legLine(fare.inbound)}
      </span>
      <span className="flex flex-wrap gap-1.5 text-[13px]">
        {fare.separateTickets && <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-ink">Separate tickets</span>}
        {!fare.bagsIncluded && <span className="rounded-full bg-fill px-2 py-0.5 text-sub">Bags not priced</span>}
        {fare.leaveNeeded && <span className="rounded-full bg-fill px-2 py-0.5 text-sub">{leaveLine(fare.leaveNeeded)}</span>}
      </span>
    </ListRow>
  )
}
