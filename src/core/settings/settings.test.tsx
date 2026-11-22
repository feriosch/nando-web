import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, renderApp } from '../../test/app'

// What GET /api/settings answers until the Owner first saves them.
const defaults = {
  timeZone: 'UTC',
  heightCm: null,
  gmailDigest: { enabled: false, time: '08:00' },
}

// Opens Home, which reads the settings, so that they are cached by the time Settings opens.
async function openHomeFirst(api: ReturnType<typeof fakeApi>['api']) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-09T03:00:00Z'))
  const router = renderApp('/', api)
  expect(await screen.findByText('Monday, 9 November')).toBeInTheDocument()
  return router
}

afterEach(() => {
  vi.useRealTimers()
})

// Core's Settings Section on the Settings screen, found by its heading.
async function coreSection() {
  return await screen.findByRole('region', { name: 'General' })
}

describe('Core Settings Section', () => {
  it('shows the saved settings and saves the Owner Time Zone and height', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({
      'GET /api/settings': { status: 200, body: defaults },
      'PUT /api/settings': { status: 204 },
    })
    renderApp('/settings', api)

    const section = await coreSection()
    const timeZone = await within(section).findByLabelText('Time zone')
    expect(timeZone).toHaveValue('UTC')
    expect(within(section).getByLabelText('Height (cm)')).toHaveValue('')
    // The Weigh-in reminder is Calories', set by its Assistant (ADR 0012).
    expect(within(section).queryByRole('switch', { name: 'Weigh-in reminder' })).not.toBeInTheDocument()

    await user.selectOptions(timeZone, 'Asia/Tokyo')
    await user.type(within(section).getByLabelText('Height (cm)'), '175')
    await user.click(within(section).getByRole('button', { name: 'Save' }))

    expect(await within(section).findByText('Saved.')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([
      {
        method: 'PUT',
        path: '/api/settings',
        body: {
          timeZone: 'Asia/Tokyo',
          heightCm: 175,
          gmailDigest: { enabled: false, time: '08:00' },
        },
      },
    ])
  })

  it('turns the Gmail Digest on and saves its time', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({
      'GET /api/settings': { status: 200, body: defaults },
      'PUT /api/settings': { status: 204 },
    })
    renderApp('/settings', api)

    const section = await coreSection()
    const digest = await within(section).findByRole('switch', { name: 'Gmail Digest' })
    expect(digest).not.toBeChecked()
    // Its time shows only while it is on.
    expect(within(section).queryByLabelText('Every day at')).not.toBeInTheDocument()

    await user.click(digest)
    expect(within(section).getByLabelText('Every day at')).toHaveValue('08:00')
    await user.selectOptions(within(section).getByLabelText('Every day at'), '07:00')
    await user.click(within(section).getByRole('button', { name: 'Save' }))

    expect(await within(section).findByText('Saved.')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([
      { method: 'PUT', path: '/api/settings', body: { ...defaults, gmailDigest: { enabled: true, time: '07:00' } } },
    ])
  })

  it("leaves the Gmail Digest out when the server doesn't have one yet", async () => {
    const user = userEvent.setup()
    const { gmailDigest: _, ...withoutDigest } = defaults
    const { api, sent } = fakeApi({
      'GET /api/settings': { status: 200, body: withoutDigest },
      'PUT /api/settings': { status: 204 },
    })
    renderApp('/settings', api)

    const section = await coreSection()
    await user.click(await within(section).findByRole('button', { name: 'Save' }))

    expect(await within(section).findByText('Saved.')).toBeInTheDocument()
    expect(within(section).queryByRole('switch', { name: 'Gmail Digest' })).not.toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([{ method: 'PUT', path: '/api/settings', body: withoutDigest }])
  })

  it.each(['0', '301', '175.5', 'tall'])("doesn't save a height of %s, and says what a height must be", async (typed) => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({
      'GET /api/settings': { status: 200, body: defaults },
      'PUT /api/settings': { status: 204 },
    })
    renderApp('/settings', api)

    const section = await coreSection()
    await user.type(await within(section).findByLabelText('Height (cm)'), typed)
    await user.click(within(section).getByRole('button', { name: 'Save' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'Enter your height as a whole number of cm from 1 to 300, or leave it empty.',
    )
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([])
  })

  it('stops saying "Saved." once the Owner submits a height that is refused', async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'GET /api/settings': { status: 200, body: defaults },
      'PUT /api/settings': { status: 204 },
    })
    renderApp('/settings', api)

    const section = await coreSection()
    await user.click(await within(section).findByRole('button', { name: 'Save' }))
    await within(section).findByText('Saved.')

    await user.type(within(section).getByLabelText('Height (cm)'), '175.5')
    await user.click(within(section).getByRole('button', { name: 'Save' }))

    expect(await within(section).findByRole('alert')).toBeInTheDocument()
    expect(within(section).queryByText('Saved.')).not.toBeInTheDocument()
  })

  it("says which setting the server refused, such as a time zone it doesn't know", async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'GET /api/settings': { status: 200, body: defaults },
      // As nando-server's http.Error sends it: plain text and a newline.
      'PUT /api/settings': { status: 400, body: 'timeZone must be an IANA time zone such as Asia/Tokyo\n' },
    })
    renderApp('/settings', api)

    const section = await coreSection()
    await user.click(await within(section).findByRole('button', { name: 'Save' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent(
      "Couldn't save the settings: timeZone must be an IANA time zone such as Asia/Tokyo",
    )
    expect(within(section).queryByText('Saved.')).not.toBeInTheDocument()
  })

  it('fills the form from the saved settings, not a copy cached before they changed elsewhere', async () => {
    const user = userEvent.setup()
    let settings = { ...defaults, heightCm: 170 }
    const { api, sent } = fakeApi({
      'GET /api/settings': () => ({ status: 200, body: settings }),
      'PUT /api/settings': { status: 204 },
    })
    const router = await openHomeFirst(api)

    // Changed from another device in the meantime.
    settings = { ...settings, heightCm: 180 }
    await router.navigate('/settings')

    const section = await coreSection()
    expect(await within(section).findByLabelText('Height (cm)')).toHaveValue('180')
    await user.click(within(section).getByRole('button', { name: 'Save' }))

    expect(await within(section).findByText('Saved.')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([
      { method: 'PUT', path: '/api/settings', body: { ...defaults, heightCm: 180 } },
    ])
  })

  it("says when it couldn't load the settings, and loads them again when asked", async () => {
    const user = userEvent.setup()
    let fails = true
    const { api } = fakeApi({
      'GET /api/settings': () => (fails ? { status: 500 } : { status: 200, body: { ...defaults, heightCm: 175 } }),
    })
    renderApp('/settings', api)

    const section = await coreSection()
    expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't load the settings.")
    expect(within(section).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    fails = false
    await user.click(within(section).getByRole('button', { name: 'Try again' }))

    expect(await within(section).findByLabelText('Height (cm)')).toHaveValue('175')
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
  })

  it("doesn't offer a cached copy of the settings to save when they couldn't be loaded again", async () => {
    let fails = false
    const { api } = fakeApi({
      'GET /api/settings': () => (fails ? { status: 500 } : { status: 200, body: defaults }),
    })
    const router = await openHomeFirst(api)

    fails = true
    await router.navigate('/settings')

    const section = await coreSection()
    expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't load the settings.")
    expect(within(section).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it("says when the settings couldn't be loaded again, and keeps the form being filled in", async () => {
    const user = userEvent.setup()
    let fails = false
    const { api } = fakeApi({
      'GET /api/settings': () => (fails ? { status: 500 } : { status: 200, body: defaults }),
    })
    renderApp('/settings', api)

    const section = await coreSection()
    const height = await within(section).findByLabelText('Height (cm)')
    await user.type(height, '175')

    // The Owner comes back to the app, which loads the settings again, and that fails.
    fails = true
    fireEvent(window, new Event('visibilitychange'))

    expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't load the settings.")
    expect(within(section).getByLabelText('Height (cm)')).toHaveValue('175')
    expect(within(section).getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('offers Gmail Digest times only on the hour or half hour, from 00:00 to 23:30', async () => {
    const { api } = fakeApi({
      'GET /api/settings': { status: 200, body: { ...defaults, gmailDigest: { enabled: true, time: '08:00' } } },
    })
    renderApp('/settings', api)

    const section = await coreSection()
    const times = within(await within(section).findByLabelText('Every day at')).getAllByRole('option')
    const labels = times.map((option) => option.textContent)
    expect(labels).toHaveLength(48)
    expect(labels.slice(0, 3)).toEqual(['00:00', '00:30', '01:00'])
    expect(labels.at(-1)).toBe('23:30')
  })
})
