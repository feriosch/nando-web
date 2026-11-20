import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, fakePush, renderApp } from '../test/app'

// Nando's Notifications come through Telegram now, in each Assistant's chat (nando-server's
// ADR 0008), so the app no longer offers them, and Web Push is being retired.
describe('Web Push, retired', () => {
  it("leaves Notifications out of Settings, and never registers this device's Push Subscription", async () => {
    const { api, sent } = fakeApi({
      'GET /api/settings': {
        status: 200,
        body: { timeZone: 'UTC', heightCm: null, weighInReminder: { enabled: false, weekday: 'monday', time: '08:00' } },
      },
    })
    renderApp('/settings', api)

    expect(await screen.findByRole('region', { name: 'General' })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Connectors' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
    expect(sent.filter(({ path }) => path.startsWith('/api/push-subscriptions'))).toEqual([])
  })

  it('drops the Push Subscription this device still holds when Nando opens, so it gets no more push', async () => {
    const { api } = fakeApi({})
    const { push, calls } = fakePush({ subscription: true })
    renderApp('/settings', api, push)

    await waitFor(() => expect(calls.unsubscribed).toBe(1))
  })

  it('still opens normally when the device has no service worker to drop it from', async () => {
    const { api } = fakeApi({})
    const { push } = fakePush({ failing: true })
    renderApp('/settings', api, push)

    expect(await screen.findByRole('region', { name: 'Connectors' })).toBeInTheDocument()
  })
})
