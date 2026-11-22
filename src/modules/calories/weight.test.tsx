import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, noPush, renderApp, type Answer, type Answers } from '../../test/app'
import { calories } from '.'

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175 }

function renderCalories(path: string, answers: Answers) {
  const fake = fakeApi({ 'GET /api/settings': { status: 200, body: tokyo }, ...answers })
  const router = renderApp(path, fake.api, noPush, [calories])
  return { ...fake, router }
}

// The Weight Home Card on Home, found by its heading.
async function weightCard() {
  const heading = await screen.findByRole('heading', { name: 'Weight' })
  return heading.closest('article') as HTMLElement
}

beforeEach(() => {
  // Sunday 8 November 2026, 20:00 UTC: already Monday 9 November, 05:00, in Tokyo.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-08T20:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Weight Home Card', () => {
  it('shows the latest Weigh-in with its week, its BMI and the change since the week before, and opens Weigh-ins', async () => {
    const user = userEvent.setup()
    const { router } = renderCalories('/', {
      'GET /api/calories/weight-card': { status: 200, body: { latest: { week: '2026-10-19', kg: 72.4 }, bmi: 23.6, change: -0.4 } },
      'GET /api/calories/weigh-ins': { status: 200, body: [{ week: '2026-10-19', kg: 72.4 }] },
    })

    const card = await weightCard()
    expect(await within(card).findByText('72.4 kg')).toBeInTheDocument()
    // It can be weeks old, so the card says which week it is from.
    expect(within(card).getByText('Week of 19 Oct')).toBeInTheDocument()
    expect(within(card).getByText('BMI 23.6')).toBeInTheDocument()
    expect(within(card).getByText('−0.4 kg vs the week before')).toBeInTheDocument()

    await user.click(within(card).getByRole('link', { name: 'Weigh-ins' }))

    expect(router.state.location.pathname).toBe('/calories/weigh-ins')
    expect(await screen.findByRole('heading', { level: 1, name: 'Weigh-ins' })).toBeInTheDocument()
  })

  it('names the year of a latest Weigh-in from an earlier year in the Owner Time Zone', async () => {
    renderCalories('/', {
      'GET /api/calories/weight-card': { status: 200, body: { latest: { week: '2025-12-29', kg: 74.0 }, bmi: 24.2, change: null } },
    })

    const card = await weightCard()
    expect(await within(card).findByText('Week of 29 Dec 2025')).toBeInTheDocument()
  })

  it('says there are no Weigh-ins yet, and that the Calories Assistant logs them', async () => {
    renderCalories('/', {
      'GET /api/calories/weight-card': { status: 200, body: { latest: null, bmi: null, change: null } },
    })

    const card = await weightCard()
    expect(await within(card).findByText('No Weigh-ins yet.')).toBeInTheDocument()
    expect(within(card).getByText('Tell the Calories Assistant your weight in Telegram.')).toBeInTheDocument()
  })

  it("says when it couldn't load, and loads again when asked", async () => {
    const user = userEvent.setup()
    let answer: Answer = { status: 500 }
    renderCalories('/', { 'GET /api/calories/weight-card': () => answer })

    const card = await weightCard()
    expect(await within(card).findByRole('alert')).toHaveTextContent("Couldn't load your Weigh-ins.")

    answer = { status: 200, body: { latest: { week: '2026-10-19', kg: 72.4 }, bmi: 23.6, change: -0.4 } }
    await user.click(within(card).getByRole('button', { name: 'Try again' }))

    expect(await within(card).findByText('72.4 kg')).toBeInTheDocument()
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
  })

  it("asks for the Weight card only once the settings it is keyed by are loaded, and says when they couldn't be", async () => {
    const user = userEvent.setup()
    let settings: Answer = { status: 500 }
    const { sent } = renderCalories('/', {
      'GET /api/settings': () => settings,
      'GET /api/calories/weight-card': { status: 200, body: { latest: { week: '2026-10-19', kg: 72.4 }, bmi: 23.6, change: -0.4 } },
    })

    const card = await weightCard()
    expect(await within(card).findByRole('alert')).toHaveTextContent("Couldn't load your Weigh-ins.")
    expect(sent.filter((request) => request.path === '/api/calories/weight-card')).toEqual([])

    settings = { status: 200, body: tokyo }
    await user.click(within(card).getByRole('button', { name: 'Try again' }))

    expect(await within(card).findByText('72.4 kg')).toBeInTheDocument()
    expect(sent.filter((request) => request.path === '/api/calories/weight-card')).toHaveLength(1)
  })

  it('asks for the height, which BMI needs, in the settings', async () => {
    const user = userEvent.setup()
    const { router } = renderCalories('/', {
      'GET /api/calories/weight-card': { status: 200, body: { latest: { week: '2026-10-19', kg: 72.4 }, bmi: null, change: null } },
    })

    const card = await weightCard()
    expect(await within(card).findByText('72.4 kg')).toBeInTheDocument()
    expect(within(card).queryByText(/BMI \d/)).not.toBeInTheDocument()
    expect(within(card).queryByText(/vs the week before/)).not.toBeInTheDocument()

    await user.click(within(card).getByRole('link', { name: 'Set your height for BMI' }))

    expect(router.state.location.pathname).toBe('/settings')
  })

  it('shows the BMI for a height saved in the settings without reopening the app', async () => {
    const user = userEvent.setup()
    let heightCm: number | null = null
    renderCalories('/settings', {
      'GET /api/settings': () => ({ status: 200, body: { ...tokyo, heightCm } }),
      'PUT /api/settings': (body): Answer => {
        heightCm = (body as { heightCm: number }).heightCm
        return { status: 204 }
      },
      'GET /api/calories/weight-card': () => ({
        status: 200,
        body: { latest: { week: '2026-11-09', kg: 72.4 }, bmi: heightCm === null ? null : 23.6, change: null },
      }),
    })

    await user.type(await screen.findByLabelText('Height (cm)'), '175')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    await user.click(within(screen.getByRole('navigation', { name: 'Tabs' })).getByRole('link', { name: 'Home' }))

    expect(await within(await weightCard()).findByText('BMI 23.6')).toBeInTheDocument()
  })
})

describe('Weigh-ins', () => {
  it('lists every Weigh-in, newest first, naming this week and last week', async () => {
    renderCalories('/calories/weigh-ins', {
      'GET /api/calories/weigh-ins': {
        status: 200,
        body: [
          { week: '2026-11-09', kg: 72.4 },
          { week: '2026-11-02', kg: 72.8 },
          { week: '2026-10-26', kg: 73.1 },
          { week: '2025-12-29', kg: 74.0 },
        ],
      },
    })

    const list = await screen.findByRole('list', { name: 'History' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'This week72.4 kg',
      'Last week72.8 kg',
      'Week of 26 Oct73.1 kg',
      'Week of 29 Dec 202574.0 kg',
    ])
    // The web app only reads: the Calories Assistant logs them.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Tell the Calories Assistant your weight in Telegram.')).toBeInTheDocument()
  })

  it('says there are no Weigh-ins yet', async () => {
    renderCalories('/calories/weigh-ins', { 'GET /api/calories/weigh-ins': { status: 200, body: [] } })

    expect(await screen.findByText('No Weigh-ins yet.')).toBeInTheDocument()
  })

  it("says when they couldn't load, and loads them again when asked", async () => {
    const user = userEvent.setup()
    let answer: Answer = { status: 500 }
    renderCalories('/calories/weigh-ins', { 'GET /api/calories/weigh-ins': () => answer })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your Weigh-ins.")

    answer = { status: 200, body: [{ week: '2026-11-09', kg: 72.4 }] }
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('72.4 kg')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('goes back to the Day view', async () => {
    const user = userEvent.setup()
    const { router } = renderCalories('/calories/weigh-ins', {
      'GET /api/calories/weigh-ins': { status: 200, body: [] },
      'GET /api/calories/days/2026-11-09': {
        status: 200,
        body: { day: '2026-11-09', consumedCalories: null, dailyLimit: null, remaining: null, overLimit: null, entries: [] },
      },
      'GET /api/calories/meals': { status: 200, body: [] },
    })

    await user.click(await screen.findByRole('link', { name: 'Today' }))

    expect(router.state.location.pathname).toBe('/calories')
  })
})
