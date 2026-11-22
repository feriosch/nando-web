import { formatDayAs } from '../../core/days'

// The types below mirror nando-server's internal/travel/API.md.

export type PartyKey = 'owner' | 'with_companion'

// One flight of a Fare's way; departs and arrives are local times, "YYYY-MM-DDTHH:MM".
export type Flight = { carrier: string; number: string; from: string; to: string; departs: string; arrives: string }

// One way of a Fare.
export type Leg = { flights: Flight[]; stops: number; durationMinutes: number }

// One priced round trip found for a Trip and Party. Prices are JPY.
export type Fare = {
  id: string
  tripId: string
  party: PartyKey
  source: string
  departDate: string
  returnDate: string
  nights: number
  outbound: Leg
  inbound: Leg
  separateTickets: boolean
  cabin: string
  bagsIncluded: boolean
  total: number
  perPerson: number
  bookingUrl: string
  leaveNeeded: { days: number; withRemoteDays: number } | null
}

export type TripStatus = 'watching' | 'booked' | 'dropped'

// A Party's line in GET /api/travel/trips.
export type PartySummary = {
  key: PartyKey
  adults: number
  best: Fare | null
  sinceLastWeek: number | null
  targetFare: number | null
  verdictLevel: string | null
}

// A Trip in GET /api/travel/trips.
export type TripSummary = {
  id: string
  name: string
  origins: string[]
  destinations: string[]
  status: TripStatus
  parties: PartySummary[]
}

// A Trip as the Tools answer it, the part the app shows.
export type Trip = {
  id: string
  name: string
  origins: string[]
  destinations: string[]
  nights: { min: number; max: number }
  windows: { from: string; to: string; note: string }[]
  status: TripStatus
}

// A Price Verdict, the part the app shows.
export type PriceVerdict = { level: string; departDate: string; returnDate: string; typicalRange: number[] }

// A Party on GET /api/travel/trips/{id}.
export type PartyPage = {
  key: PartyKey
  adults: number
  history: { day: string; perPerson: number }[]
  byWeek: { week: string; fare: Fare }[]
  top: Fare[]
  bestSingleTicket: Fare | null
  verdicts: PriceVerdict[]
  targetFare: number | null
}

export type TripPage = { trip: Trip; parties: PartyPage[] }

// A Watching Trip's Home Card, from GET /api/travel/cards.
export type TravelCard = {
  tripId: string
  name: string
  party: PartyKey | null
  perPerson: number | null
  trend: 'down' | 'flat' | 'up' | null
}

// Travel's settings, from GET /api/travel/settings: the part the Settings Section shows.
export type TravelSettings = {
  companion: { name: string }
  dailyFareCheck?: { enabled: boolean; time: string }
  weeklyFareCheck?: { enabled: boolean; weekday: string; time: string }
}

// A price in yen for the Owner to read, such as "¥112,000".
export function yen(amount: number): string {
  return `¥${amount.toLocaleString('en-US')}`
}

// A change in yen, signed, such as "−¥10,000" or "+¥5,000".
export function yenChange(amount: number): string {
  if (amount === 0) return '±¥0'
  return `${amount < 0 ? '−' : '+'}${yen(Math.abs(amount))}`
}

const partyNames: Record<PartyKey, string> = { owner: 'Just you', with_companion: 'Together' }

// A Party for the Owner to read: "Just you" or "Together".
export function partyName(party: PartyKey): string {
  return partyNames[party]
}

// A Trip's route, such as "AAA → BBB".
export function route({ origins, destinations }: { origins: string[]; destinations: string[] }): string {
  return `${origins.join('/')} → ${destinations.join('/')}`
}

// A short day, such as "Wed 12 May".
export function shortDay(day: string): string {
  return `${formatDayAs(day, { weekday: 'short' })} ${formatDayAs(day, { day: 'numeric', month: 'short' })}`
}

// A number of nights, such as "1 night" or "7 nights".
export function nightsLine(nights: number): string {
  return `${nights} night${nights === 1 ? '' : 's'}`
}

// A Trip's stay, such as "6–9 nights", or "7 nights" when it can only be one length.
export function stayLine({ min, max }: { min: number; max: number }): string {
  return min === max ? nightsLine(min) : `${min}–${max} nights`
}

// A Fare's dates, such as "Wed 12 May → Wed 19 May · 7 nights".
export function fareDates(fare: Pick<Fare, 'departDate' | 'returnDate' | 'nights'>): string {
  return `${shortDay(fare.departDate)} → ${shortDay(fare.returnDate)} · ${nightsLine(fare.nights)}`
}

// How a way flies, such as "Nonstop, 8h" or "1 stop, 21h 30m".
export function legLine(leg: Leg): string {
  const stops = leg.stops === 0 ? 'Nonstop' : `${leg.stops} stop${leg.stops === 1 ? '' : 's'}`
  const hours = Math.floor(leg.durationMinutes / 60)
  const minutes = leg.durationMinutes % 60
  return `${stops}, ${hours}h${minutes ? ` ${minutes}m` : ''}`
}

// The airlines a Fare flies, by their codes, each once: "XX, YY".
export function carriers(fare: Fare): string {
  return [...new Set([...fare.outbound.flights, ...fare.inbound.flights].map((f) => f.carrier))].join(', ')
}

// A Fare's price for the Owner to read: "¥112,000", or "¥110,231 each, ¥220,461 for 2". The adults
// are the Fare's own, as it was priced (Nando rounds perPerson from total), not the Party's now,
// which may have changed since.
export function farePrice(fare: Pick<Fare, 'total' | 'perPerson'>): string {
  const adults = Math.round(fare.total / fare.perPerson)
  return adults > 1 ? `${yen(fare.perPerson)} each, ${yen(fare.total)} for ${adults}` : yen(fare.total)
}

// The Companion's days off for a Fare, such as "5 days off (3 with remote days)".
export function leaveLine({ days, withRemoteDays }: { days: number; withRemoteDays: number }): string {
  const off = `${days} day${days === 1 ? '' : 's'} off`
  return withRemoteDays < days ? `${off} (${withRemoteDays} with remote days)` : off
}

const statusNames: Record<TripStatus, string> = { watching: 'Watching', booked: 'Booked', dropped: 'Dropped' }

// A Trip's status for the Owner to read.
export function statusName(status: TripStatus): string {
  return statusNames[status]
}
