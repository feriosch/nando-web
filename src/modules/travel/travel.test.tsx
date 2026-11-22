import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, renderAppWith, type Answers } from '../../test/app'
import { travel } from '.'

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175 }

type Leg = { flights: { carrier: string; number: string; from: string; to: string; departs: string; arrives: string }[]; stops: number; durationMinutes: number }

// A Fare as nando-server answers it, made up for tests.
function fare(fields: Record<string, unknown> = {}) {
  const leg = (from: string, to: string, day: string): Leg => ({
    flights: [{ carrier: 'XX', number: 'XX1', from, to, departs: `${day}T10:00`, arrives: `${day}T22:00` }],
    stops: 0,
    durationMinutes: 480,
  })
  return {
    id: 'f1', tripId: 't1', party: 'owner', checkId: 'c1', foundAt: '2026-11-22T12:00:00Z', source: 'kiwi',
    departDate: '2027-05-12', returnDate: '2027-05-19', nights: 7,
    outbound: leg('AAA', 'BBB', '2027-05-12'), inbound: leg('BBB', 'AAA', '2027-05-19'),
    separateTickets: false, cabin: 'economy', bagsIncluded: true, currency: 'JPY',
    total: 112000, perPerson: 112000, bookingUrl: 'https://fares.example.com/1', leaveNeeded: null,
    ...fields,
  }
}

const trip = {
  id: 't1', name: 'Beach week', origins: ['AAA'], destinations: ['BBB'], nights: { min: 6, max: 9 },
  windows: [{ from: '2027-05-10', to: '2027-06-30', note: '' }], avoid: [], cabin: 'economy', checkedBags: 1,
  maxStops: 1, separateTickets: true, parties: [{ key: 'owner', adults: 1 }, { key: 'with_companion', adults: 2 }],
  status: 'watching', statusChangedOn: '2026-11-22', notes: '', targetFares: [],
}

function renderTravel(path: string, answers: Answers) {
  const fake = fakeApi({ 'GET /api/settings': { status: 200, body: tokyo }, ...answers })
  renderAppWith(path, { api: fake.api, modules: [travel] })
  return fake
}

describe('Travel Home Cards', () => {
  it('shows each Watching Trip with its best Fare per person and trend, opening its page', async () => {
    renderTravel('/', {
      'GET /api/travel/cards': {
        status: 200,
        body: {
          cards: [
            { tripId: 't1', name: 'Beach week', party: 'with_companion', perPerson: 110231, trend: 'down' },
            { tripId: 't2', name: 'City break', party: null, perPerson: null, trend: null },
          ],
        },
      },
    })

    const beach = await screen.findByRole('link', { name: /Beach week/ })
    expect(beach).toHaveAttribute('href', '/travel/trips/t1')
    expect(beach).toHaveTextContent('¥110,231')
    expect(beach).toHaveTextContent('Together')
    expect(beach).toHaveTextContent('Down since last week')
    const city = screen.getByRole('link', { name: /City break/ })
    expect(city).toHaveTextContent('No fares yet')
  })

  it('opens the Travel screen when no Trip is watched', async () => {
    renderTravel('/', { 'GET /api/travel/cards': { status: 200, body: { cards: [] } } })

    const card = await screen.findByRole('link', { name: /No Trips watched/ })
    expect(card).toHaveAttribute('href', '/travel')
  })
})

describe('Travel screen', () => {
  it('lists Watching Trips first with each Party\'s best Fare, then the others', async () => {
    renderTravel('/travel', {
      'GET /api/travel/trips': {
        status: 200,
        body: {
          trips: [
            {
              id: 't1', name: 'Beach week', origins: ['AAA'], destinations: ['BBB'], status: 'watching',
              parties: [{ key: 'owner', adults: 1, best: fare(), sinceLastWeek: -10000, targetFare: 110000, verdictLevel: 'low' }],
            },
            { id: 't2', name: 'Alps', origins: ['AAA'], destinations: ['CCC'], status: 'booked', parties: [{ key: 'owner', adults: 1, best: null, sinceLastWeek: null, targetFare: null, verdictLevel: null }] },
          ],
        },
      },
    })

    const watching = await screen.findByRole('list', { name: 'Watching' })
    const beach = within(watching).getByRole('link', { name: /Beach week/ })
    expect(beach).toHaveAttribute('href', '/travel/trips/t1')
    expect(beach).toHaveTextContent('AAA → BBB')
    expect(beach).toHaveTextContent('Just you · ¥112,000')
    expect(beach).toHaveTextContent('−¥10,000')
    const closed = screen.getByRole('list', { name: 'Booked and dropped' })
    expect(within(closed).getByRole('link', { name: /Alps/ })).toHaveTextContent('Booked')
  })
})

describe('Trip page', () => {
  it('shows each Party\'s history, cheapest weeks and top Fares, with Separate Tickets beside the best on one ticket', async () => {
    renderTravel('/travel/trips/t1', {
      'GET /api/travel/trips/t1': {
        status: 200,
        body: {
          trip,
          parties: [
            {
              key: 'owner', adults: 1,
              history: [{ day: '2026-11-22', perPerson: 120000 }, { day: '2026-11-23', perPerson: 110000 }],
              byWeek: [{ week: '2027-05-10', fare: fare({ id: 'f2', perPerson: 125000, total: 125000 }) }, { week: '2027-05-17', fare: fare({ id: 'f3', perPerson: 110000, total: 110000 }) }],
              top: [fare({ id: 'f3', perPerson: 110000, total: 110000, separateTickets: true, bookingUrl: 'https://fares.example.com/3' }), fare({ id: 'f2', perPerson: 125000, total: 125000 })],
              bestSingleTicket: fare({ id: 'f2', perPerson: 125000, total: 125000 }),
              verdicts: [{ tripId: 't1', party: 'owner', departDate: '2027-05-12', returnDate: '2027-05-19', level: 'low', lowestPrice: 110000, typicalRange: [120000, 150000], history: [], cheapestPrice: 110000, cheapestAirlines: ['Air X'], fetchedAt: '2026-11-23T03:00:00Z' }],
              targetFare: 105000,
            },
            {
              key: 'with_companion', adults: 2, history: [], byWeek: [],
              top: [fare({ id: 'f4', party: 'with_companion', perPerson: 110231, total: 220461, leaveNeeded: { days: 5, withRemoteDays: 3 } })],
              bestSingleTicket: null, verdicts: [], targetFare: null,
            },
          ],
        },
      },
    })

    expect(await screen.findByRole('heading', { name: 'Beach week', level: 1 })).toBeInTheDocument()
    const owner = screen.getByRole('region', { name: 'Just you' })
    expect(within(owner).getByRole('img', { name: /Best per person.*¥120,000.*¥110,000/ })).toBeInTheDocument()
    expect(within(owner).getByRole('listitem', { name: /Week of 10 May.*¥125,000/ })).toBeInTheDocument()
    const top = within(owner).getByRole('list', { name: 'Top fares' })
    const best = within(top).getAllByRole('listitem')[0]
    expect(best).toHaveTextContent('Separate tickets')
    expect(within(best).getByRole('link', { name: /Open to book/ })).toHaveAttribute('href', 'https://fares.example.com/3')
    expect(within(owner).getByRole('region', { name: 'Best on one ticket' })).toHaveTextContent('¥125,000')
    expect(owner).toHaveTextContent('Target ¥105,000')
    expect(owner).toHaveTextContent('Google: low')

    const together = screen.getByRole('region', { name: 'Together' })
    expect(together).toHaveTextContent('¥110,231 each, ¥220,461 for 2')
    expect(together).toHaveTextContent('5 days off (3 with remote days)')
  })

  it('says when the Trip is gone', async () => {
    renderTravel('/travel/trips/gone', { 'GET /api/travel/trips/gone': { status: 404, body: 'no such Trip' } })

    expect(await screen.findByText(/This Trip is gone/)).toBeInTheDocument()
  })
})

describe('Travel Settings Section', () => {
  it('shows when the Fare Checks come and who the Companion is, changed in the Travel chat', async () => {
    renderTravel('/settings', {
      'GET /api/travel/settings': {
        status: 200,
        body: {
          home: ['AAA'],
          companion: { name: 'Sam', calendars: [], workWeekdays: ['monday'], holidayCalendar: '', usualLeaveDays: 7, remoteDaysAbroad: 2 },
          serpApiMonthlyLimit: 250,
          dailyFareCheck: { enabled: true, time: '08:30' },
          weeklyFareCheck: { enabled: false, weekday: 'sunday', time: '10:00' },
        },
      },
    })

    const section = (await screen.findByRole('heading', { name: 'Travel' })).closest('section') as HTMLElement
    expect((await within(section).findByText('Daily Fare Check')).closest('div')).toHaveTextContent('08:30')
    expect(within(section).getByText('Weekly Fare Check').closest('div')).toHaveTextContent('Off')
    expect(within(section).getByText('Companion').closest('div')).toHaveTextContent('Sam')
    expect(section).toHaveTextContent('Travel chat')
  })
})
