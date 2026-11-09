import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, renderApp, type Answer } from '../../test/app'

// The Body Home Card on Home, found by its heading.
async function bodyCard() {
  const heading = await screen.findByRole('heading', { name: 'Body' })
  return heading.closest('article') as HTMLElement
}

describe('Body Home Card', () => {
  it('shows the latest Weigh-in, its BMI and the change since the week before', async () => {
    const { api } = fakeApi({
      'GET /api/body': { status: 200, body: { latest: { week: '2026-10-19', kg: 72.4 }, bmi: 23.6, change: -0.4 } },
    })
    renderApp('/', api)

    const card = await bodyCard()
    expect(await within(card).findByText('72.4 kg')).toBeInTheDocument()
    expect(within(card).getByText('BMI 23.6')).toBeInTheDocument()
    expect(within(card).getByText('−0.4 kg vs the week before')).toBeInTheDocument()
  })

  it('says there are no Weigh-ins yet, and its link opens the Weigh-ins screen', async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'GET /api/body': { status: 200, body: { latest: null, bmi: null, change: null } },
    })
    const router = renderApp('/', api)

    const card = await bodyCard()
    expect(await within(card).findByText('No Weigh-ins yet.')).toBeInTheDocument()
    await user.click(within(card).getByRole('link', { name: 'Log a Weigh-in' }))

    expect(router.state.location.pathname).toBe('/weigh-ins')
    expect(await screen.findByRole('heading', { level: 1, name: 'Weigh-ins' })).toBeInTheDocument()
  })

  it('asks for the height, which BMI needs, and links to the Weigh-ins screen once there is a Weigh-in', async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'GET /api/body': { status: 200, body: { latest: { week: '2026-10-19', kg: 72.4 }, bmi: null, change: null } },
    })
    const router = renderApp('/', api)

    const card = await bodyCard()
    expect(await within(card).findByText('72.4 kg')).toBeInTheDocument()
    expect(within(card).queryByText(/BMI \d/)).not.toBeInTheDocument()
    expect(within(card).queryByText(/vs the week before/)).not.toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Weigh-ins' })).toHaveAttribute('href', '/weigh-ins')

    await user.click(within(card).getByRole('link', { name: 'Set your height for BMI' }))

    expect(router.state.location.pathname).toBe('/settings')
  })
})

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175, weighInReminder: { enabled: false, weekday: 'monday', time: '08:00' } }

// The Weigh-in form for one week on the Weigh-ins screen, found by its name ("This week", "Last week").
async function weekForm(name: string) {
  return await screen.findByRole('form', { name })
}

describe('Weigh-ins', () => {
  beforeEach(() => {
    // Sunday 8 November 2026, 20:00 UTC: already Monday 9 November, 05:00, in Tokyo.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-08T20:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("logs this week's Weigh-in for the week that has started in the Owner Time Zone", async () => {
    const user = userEvent.setup()
    const weighIns: { week: string; kg: number }[] = []
    const { api, sent } = fakeApi({
      'GET /api/settings': { status: 200, body: tokyo },
      'GET /api/weigh-ins': () => ({ status: 200, body: weighIns }),
      'PUT /api/weigh-ins/2026-11-09': (body): Answer => {
        weighIns.unshift({ week: '2026-11-09', ...(body as { kg: number }) })
        return { status: 204 }
      },
    })
    renderApp('/weigh-ins', api)

    const thisWeek = await weekForm('This week')
    await user.type(within(thisWeek).getByLabelText('Weight (kg)'), '72.4')
    await user.click(within(thisWeek).getByRole('button', { name: 'Save' }))

    expect(await within(thisWeek).findByText('Saved.')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([
      { method: 'PUT', path: '/api/weigh-ins/2026-11-09', body: { kg: 72.4 } },
    ])
  })

  it("changes last week's Weigh-in, and lists every Weigh-in newest first with older weeks read-only", async () => {
    const user = userEvent.setup()
    let weighIns = [
      { week: '2026-11-02', kg: 72.8 },
      { week: '2026-10-26', kg: 73.1 },
      { week: '2026-10-19', kg: 73.5 },
    ]
    const { api, sent } = fakeApi({
      'GET /api/settings': { status: 200, body: tokyo },
      'GET /api/weigh-ins': () => ({ status: 200, body: weighIns }),
      'PUT /api/weigh-ins/2026-11-02': (body): Answer => {
        weighIns = [{ week: '2026-11-02', ...(body as { kg: number }) }, ...weighIns.slice(1)]
        return { status: 204 }
      },
    })
    renderApp('/weigh-ins', api)

    const lastWeek = await weekForm('Last week')
    const weight = within(lastWeek).getByLabelText('Weight (kg)')
    expect(weight).toHaveValue('72.8')
    expect(within(await weekForm('This week')).getByLabelText('Weight (kg)')).toHaveValue('')

    await user.clear(weight)
    await user.type(weight, '72.6')
    await user.click(within(lastWeek).getByRole('button', { name: 'Save' }))

    expect(await within(lastWeek).findByText('Saved.')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([
      { method: 'PUT', path: '/api/weigh-ins/2026-11-02', body: { kg: 72.6 } },
    ])
    const history = screen.getByRole('list', { name: 'History' })
    await waitFor(() =>
      expect(within(history).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Week of 2 Nov 2026: 72.6 kg',
        'Week of 26 Oct 2026: 73.1 kg',
        'Week of 19 Oct 2026: 73.5 kg',
      ]),
    )
    expect(within(history).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it.each(['72.45', '0', '501', 'heavy'])("doesn't send %s kg, and says what a weight must be", async (typed) => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({
      'GET /api/settings': { status: 200, body: tokyo },
      'GET /api/weigh-ins': { status: 200, body: [] },
    })
    renderApp('/weigh-ins', api)

    const thisWeek = await weekForm('This week')
    await user.type(within(thisWeek).getByLabelText('Weight (kg)'), typed)
    await user.click(within(thisWeek).getByRole('button', { name: 'Save' }))

    expect(await within(thisWeek).findByRole('alert')).toHaveTextContent(
      'Enter a weight in kg above 0 and up to 500, with at most 1 decimal.',
    )
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([])
  })

  it('says the week can no longer be changed when it went read-only while the screen was open', async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'GET /api/settings': { status: 200, body: tokyo },
      'GET /api/weigh-ins': { status: 200, body: [] },
      'PUT /api/weigh-ins/2026-11-02': { status: 409, body: 'week is read-only' },
    })
    renderApp('/weigh-ins', api)

    const lastWeek = await weekForm('Last week')
    await user.type(within(lastWeek).getByLabelText('Weight (kg)'), '72.6')
    await user.click(within(lastWeek).getByRole('button', { name: 'Save' }))

    expect(await within(lastWeek).findByRole('alert')).toHaveTextContent(
      'This week can no longer be changed. Only this week and last week can.',
    )
    expect(within(lastWeek).queryByText('Saved.')).not.toBeInTheDocument()
  })
})
