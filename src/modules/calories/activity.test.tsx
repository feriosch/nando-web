import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, noPush, renderApp, type Answers } from '../../test/app'
import { calories } from '.'

// Steps and Burned Calories (ADR 0015): the web app only shows them. The iPhone's Health Sync sends
// them, and the Calories Assistant logs Treadmill Walks.

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175 }

type Walk = { id: string; day: string; km: number; steps: number | null; kcal: number; kcalEstimated: boolean; loggedAt: string }
type HealthSync = { steps: number; activeKcal: number; syncedAt: string; corrected: boolean }

function walk(fields: Partial<Walk> & Pick<Walk, 'id' | 'km' | 'kcal'>): Walk {
  return { day: '2026-11-09', steps: null, kcalEstimated: false, loggedAt: '2026-11-09T03:00:00Z', ...fields }
}

// A Day as the Calories API answers it, with no Entries, and the Steps and Burned Calories that its
// Health Sync and walks add up to.
function activeDay(day: string, healthSync: HealthSync | null, walks: Walk[] = []) {
  const stepsFrom = [healthSync?.steps, ...walks.map((w) => w.steps)].filter((n): n is number => typeof n === 'number')
  const nothing = healthSync === null && walks.length === 0
  return {
    day,
    consumedCalories: null,
    dailyLimit: 2000,
    remaining: null,
    overLimit: null,
    steps: stepsFrom.length === 0 ? null : stepsFrom.reduce((a, b) => a + b, 0),
    burnedCalories: nothing ? null : (healthSync?.activeKcal ?? 0) + walks.reduce((sum, w) => sum + w.kcal, 0),
    entries: [],
    activity: { healthSync, walks },
  }
}

function renderCalories(path: string, answers: Answers) {
  const fake = fakeApi({ 'GET /api/settings': { status: 200, body: tokyo }, 'GET /api/calories/meals': { status: 200, body: [] }, ...answers })
  renderApp(path, fake.api, noPush, [calories])
  return fake
}

async function caloriesCard() {
  const heading = await screen.findByRole('heading', { name: 'Calories' })
  return heading.closest('article') as HTMLElement
}

beforeEach(() => {
  // Monday 9 November 2026, 05:00 in Tokyo.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-08T20:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Calories Home Card', () => {
  it("shows today's Steps and Burned Calories, as an estimate", async () => {
    const { steps, burnedCalories, ...rest } = activeDay('2026-11-09', { steps: 9812, activeKcal: 312, syncedAt: '2026-11-08T19:30:00Z', corrected: false }, [
      walk({ id: 'w1', km: 3.2, kcal: 210 }),
    ])
    renderCalories('/', { 'GET /api/calories/home-card': { status: 200, body: { ...rest, steps, burnedCalories } } })

    const card = await caloriesCard()
    await waitFor(() => expect(card).toHaveTextContent('9,812 steps · 522 kcal burned (est.)'))
  })

  it('shows no Steps for a Day with none synced or logged, never 0', async () => {
    renderCalories('/', { 'GET /api/calories/home-card': { status: 200, body: activeDay('2026-11-09', null) } })

    const card = await caloriesCard()
    await waitFor(() => expect(card).toHaveTextContent('— steps · — kcal burned'))
    expect(card).not.toHaveTextContent(/\b0 steps/)
  })
})

describe('Day view', () => {
  it('shows what the Day’s Steps and Burned Calories come from: the Health Sync and each Treadmill Walk', async () => {
    renderCalories('/calories', {
      'GET /api/calories/days/2026-11-09': {
        status: 200,
        body: activeDay('2026-11-09', { steps: 9812, activeKcal: 312, syncedAt: '2026-11-08T19:30:00Z', corrected: false }, [
          walk({ id: 'w1', km: 3.2, steps: 4406, kcal: 210 }),
          walk({ id: 'w2', km: 2, steps: null, kcal: 72, kcalEstimated: true }),
        ]),
      },
    })

    const summary = await screen.findByRole('region', { name: 'Summary' })
    await waitFor(() => expect(summary).toHaveTextContent('14,218 steps · 594 kcal burned (est.)'))
    const rows = within(screen.getByRole('list', { name: 'Activity' })).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    // Synced at 04:30 in Tokyo.
    expect(rows[0]).toHaveTextContent('iPhone, Synced 04:30: 9,812 steps · 312 kcal')
    expect(rows[1]).toHaveTextContent('Treadmill, 3.2 km: 4,406 steps · 210 kcal')
    expect(rows[2]).toHaveTextContent('Treadmill, 2 km: — steps · 72 kcal (est.)')
    expect(screen.getByText('Burned Calories are an estimate, and never change the Daily Limit.')).toBeInTheDocument()
  })

  it('dates the Health Sync of a Day last synced on a later Day', async () => {
    renderCalories('/calories?day=2026-11-08', {
      'GET /api/calories/days/2026-11-08': {
        status: 200,
        // Synced on 9 November at 04:30 in Tokyo.
        body: activeDay('2026-11-08', { steps: 11402, activeKcal: 380, syncedAt: '2026-11-08T19:30:00Z', corrected: false }),
      },
    })

    const rows = within(await screen.findByRole('list', { name: 'Activity' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('iPhone, Synced 9 Nov, 04:30: 11,402 steps · 380 kcal')
  })

  it('says the iPhone hasn’t synced the Day, and has no Steps rather than 0', async () => {
    renderCalories('/calories', { 'GET /api/calories/days/2026-11-09': { status: 200, body: activeDay('2026-11-09', null) } })

    const list = await screen.findByRole('list', { name: 'Activity' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('iPhone, Not synced')
    expect(screen.getByRole('region', { name: 'Summary' })).toHaveTextContent('— steps · — kcal burned')
  })
})

describe('History', () => {
  it('shows each Day’s Steps and Burned Calories under what it ate, and nothing for a Day with neither', async () => {
    const days = []
    for (let i = 0; i < 30; i++) {
      const day = new Date(Date.UTC(2026, 10, 9 - i)).toISOString().slice(0, 10)
      const synced = day === '2026-11-08'
      days.push({
        day,
        consumedCalories: day === '2026-11-09' ? 460 : null,
        dailyLimit: 2000,
        remaining: day === '2026-11-09' ? 1540 : null,
        overLimit: day === '2026-11-09' ? false : null,
        steps: synced ? 11402 : null,
        burnedCalories: synced ? 380 : null,
      })
    }
    renderCalories('/calories/history', { 'GET /api/calories/history': { status: 200, body: days } })

    const rows = await waitFor(() => {
      const items = within(screen.getByRole('main')).getAllByRole('listitem')
      expect(items).toHaveLength(30)
      return items
    })
    expect(rows[0]).toHaveTextContent(/^Mon 9 Nov: 460 \/ 2,000 kcal$/)
    expect(rows[1]).toHaveTextContent(/^Sun 8 Nov: not logged, 11,402 steps · 380 kcal burned \(est\.\)$/)
  })
})

describe('A corrected Health Sync', () => {
  it('says the Day was corrected, not synced by the iPhone', async () => {
    renderCalories('/calories?day=2026-11-08', {
      'GET /api/calories/days/2026-11-08': {
        status: 200,
        // Corrected through the Calories Assistant at 09:10 on 9 November in Tokyo.
        body: activeDay('2026-11-08', { steps: 12400, activeKcal: 410, syncedAt: '2026-11-09T00:10:00Z', corrected: true }),
      },
    })

    const rows = within(await screen.findByRole('list', { name: 'Activity' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('iPhone, Corrected 9 Nov, 09:10: 12,400 steps · 410 kcal')
  })
})
