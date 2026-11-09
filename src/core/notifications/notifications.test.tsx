import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, fakePush, renderApp } from '../../test/app'

const vapidKey = { 'GET /api/push-subscriptions/vapid-public-key': { status: 200, body: { publicKey: 'BNcV' } } }

const blocked = "Notifications are turned off for Nando in this device's settings. Turn them on there first."

// The Notifications Settings Section on the Settings screen, found by its heading.
async function notificationsSection() {
  return await screen.findByRole('region', { name: 'Notifications' })
}

// The row saying whether this device gets Notifications: "This device", then "On" or "Off".
async function deviceStatus(section: HTMLElement) {
  return (await within(section).findByText('This device')).parentElement
}

describe('Notifications Settings Section', () => {
  it("says Notifications are off on a device that isn't subscribed, and offers to enable them", async () => {
    const { api } = fakeApi({})
    const { push } = fakePush({ permission: 'default', subscription: null })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    expect(await deviceStatus(section)).toHaveTextContent('This deviceOff')
    expect(within(section).getByRole('button', { name: 'Enable Notifications' })).toBeInTheDocument()
  })

  it('asks for permission when tapped, subscribes with the VAPID public key and registers the Push Subscription', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({ ...vapidKey, 'POST /api/push-subscriptions': { status: 204 } })
    const subscribed = {
      endpoint: 'https://web.push.apple.com/QGxt',
      expirationTime: null,
      keys: { p256dh: 'BOrK', auth: 'Ys5w' },
    }
    const { push, calls } = fakePush({ permission: 'default', subscription: null, subscribed })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    await user.click(await within(section).findByRole('button', { name: 'Enable Notifications' }))

    expect(await deviceStatus(section)).toHaveTextContent('This deviceOn')
    expect(within(section).queryByRole('button', { name: 'Enable Notifications' })).not.toBeInTheDocument()
    expect(calls.permissionRequests).toBe(1)
    expect(calls.subscribedWith).toEqual(['BNcV'])
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      { method: 'POST', path: '/api/push-subscriptions', body: subscribed },
    ])
  })

  it('says Notifications are on for a device that is already subscribed, and registers its Push Subscription again', async () => {
    const { api, sent } = fakeApi({ 'POST /api/push-subscriptions': { status: 204 } })
    // Core may have deleted it after a push service stopped knowing it; registering again brings it back.
    const subscription = {
      endpoint: 'https://web.push.apple.com/Zk9a',
      expirationTime: null,
      keys: { p256dh: 'BPq2', auth: 'Mn4x' },
    }
    const { push, calls } = fakePush({ permission: 'granted', subscription })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    expect(await deviceStatus(section)).toHaveTextContent('This deviceOn')
    expect(within(section).queryByRole('button', { name: 'Enable Notifications' })).not.toBeInTheDocument()
    expect(calls.permissionRequests).toBe(0)
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      { method: 'POST', path: '/api/push-subscriptions', body: subscription },
    ])
  })

  it("says where to turn Notifications back on when the Owner doesn't allow them, and subscribes nothing", async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({ ...vapidKey, 'POST /api/push-subscriptions': { status: 204 } })
    const { push, calls } = fakePush({ permission: 'default', subscription: null, answerPermission: 'denied' })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    await user.click(await within(section).findByRole('button', { name: 'Enable Notifications' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent(blocked)
    expect(within(section).queryByRole('button', { name: 'Enable Notifications' })).not.toBeInTheDocument()
    expect(calls.subscribedWith).toEqual([])
    expect(sent.filter((request) => request.method === 'POST')).toEqual([])
  })

  it('says where to turn Notifications back on when they were refused before Settings opened', async () => {
    const { api } = fakeApi({})
    const { push } = fakePush({ permission: 'denied', subscription: null })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    expect(await within(section).findByRole('alert')).toHaveTextContent(blocked)
    expect(within(section).queryByRole('button', { name: 'Enable Notifications' })).not.toBeInTheDocument()
  })

  it("says to add Nando to the Home Screen first where this browser can't get Notifications", async () => {
    const { api, sent } = fakeApi({})
    const { push } = fakePush({ supported: false })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    expect(
      await within(section).findByText('To get Notifications, add Nando to the Home Screen and open it from there.'),
    ).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Enable Notifications' })).not.toBeInTheDocument()
    expect(sent.filter((request) => request.path.startsWith('/api/push-subscriptions'))).toEqual([])
  })

  it("says when Core couldn't register the Push Subscription, and offers to try again", async () => {
    const user = userEvent.setup()
    let fails = true
    const { api } = fakeApi({
      ...vapidKey,
      'POST /api/push-subscriptions': () => (fails ? { status: 500 } : { status: 204 }),
    })
    const { push } = fakePush({ permission: 'default', subscription: null })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    await user.click(await within(section).findByRole('button', { name: 'Enable Notifications' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't enable Notifications.")
    expect(await deviceStatus(section)).toHaveTextContent('This deviceOff')

    fails = false
    await user.click(within(section).getByRole('button', { name: 'Enable Notifications' }))

    expect(await deviceStatus(section)).toHaveTextContent('This deviceOn')
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
  })

  it("says when a subscribed device's Push Subscription couldn't be registered again, and tries again when asked", async () => {
    const user = userEvent.setup()
    let fails = true
    const { api } = fakeApi({ 'POST /api/push-subscriptions': () => (fails ? { status: 500 } : { status: 204 }) })
    const subscription = { endpoint: 'https://web.push.apple.com/Zk9a', expirationTime: null, keys: { p256dh: 'BPq2', auth: 'Mn4x' } }
    const { push } = fakePush({ permission: 'granted', subscription })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't check Notifications on this device.")

    fails = false
    await user.click(within(section).getByRole('button', { name: 'Try again' }))

    expect(await deviceStatus(section)).toHaveTextContent('This deviceOn')
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
  })

  it("says Notifications are turned off, and doesn't register, when they were refused after subscribing", async () => {
    const { api, sent } = fakeApi({ 'POST /api/push-subscriptions': { status: 204 } })
    const subscription = { endpoint: 'https://web.push.apple.com/Zk9a', expirationTime: null, keys: { p256dh: 'BPq2', auth: 'Mn4x' } }
    const { push } = fakePush({ permission: 'denied', subscription })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    expect(await within(section).findByRole('alert')).toHaveTextContent(blocked)
    expect(await deviceStatus(section)).toHaveTextContent('This deviceOff')
    expect(sent.filter((request) => request.method === 'POST')).toEqual([])
  })

  it('offers to enable Notifications once the Owner allows them in the device settings and comes back', async () => {
    const { api } = fakeApi({})
    const { push, setPermission } = fakePush({ permission: 'denied', subscription: null })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    await within(section).findByRole('alert')

    // Allowed in the device's settings; then the Owner comes back to the app.
    setPermission('default')
    fireEvent(window, new Event('visibilitychange'))

    expect(await within(section).findByRole('button', { name: 'Enable Notifications' })).toBeInTheDocument()
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('subscribes once when Enable Notifications is tapped twice', async () => {
    const { api, sent } = fakeApi({ ...vapidKey, 'POST /api/push-subscriptions': { status: 204 } })
    const { push, calls } = fakePush({ permission: 'default', subscription: null })
    renderApp('/settings', api, push)

    const section = await notificationsSection()
    const enable = await within(section).findByRole('button', { name: 'Enable Notifications' })
    // A quick double tap: the second lands before the first has finished.
    fireEvent.click(enable)
    fireEvent.click(enable)

    expect(await deviceStatus(section)).toHaveTextContent('This deviceOn')
    expect(calls.subscribedWith).toHaveLength(1)
    expect(sent.filter((request) => request.method === 'POST')).toHaveLength(1)
  })
})
