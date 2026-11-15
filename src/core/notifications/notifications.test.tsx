import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, fakePush, renderApp, type Answer, type Answers } from '../../test/app'

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

  describe('Send a test Notification', () => {
    const subscription = { endpoint: 'https://web.push.apple.com/Zk9a', expirationTime: null, keys: { p256dh: 'BPq2', auth: 'Mn4x' } }

    // Settings opened on a device that gets Notifications, with Core answering the test as `answer`.
    async function subscribedDevice(answer: Answers[string]) {
      const { api, sent } = fakeApi({
        'POST /api/push-subscriptions': { status: 204 },
        'POST /api/push-subscriptions/test': answer,
      })
      const { push } = fakePush({ permission: 'granted', subscription })
      renderApp('/settings', api, push)
      const section = await notificationsSection()
      await deviceStatus(section)
      return { section, sent }
    }

    // The result under the button, once Core has answered: the live region is there before it fills in.
    async function resultOf(section: HTMLElement) {
      await within(section).findByText(/^Sent to /)
      return within(section).getByRole('status')
    }

    it('sends the test Notification to every device and says how many got it', async () => {
      const user = userEvent.setup()
      const { section, sent } = await subscribedDevice({ status: 200, body: { sent: 2, removed: 0, failed: [] } })

      await user.click(within(section).getByRole('button', { name: 'Send a test Notification' }))

      expect(await resultOf(section)).toHaveTextContent('Sent to 2 devices.')
      expect(sent.filter((request) => request.path === '/api/push-subscriptions/test')).toEqual([
        { method: 'POST', path: '/api/push-subscriptions/test', body: undefined },
      ])
    })

    it('has its result read out: the live region is there, empty, before the first send', async () => {
      const user = userEvent.setup()
      const { section } = await subscribedDevice({ status: 200, body: { sent: 1, removed: 0, failed: [] } })
      const result = within(section).getByRole('status')
      expect(result).toBeEmptyDOMElement()

      await user.click(within(section).getByRole('button', { name: 'Send a test Notification' }))

      await expect.poll(() => result.textContent).toBe('Sent to 1 device.')
    })

    it('replaces the last result with the next one', async () => {
      const user = userEvent.setup()
      let answer: Answer = { status: 200, body: { sent: 2, removed: 1, failed: [] } }
      const { section } = await subscribedDevice(() => answer)
      const button = within(section).getByRole('button', { name: 'Send a test Notification' })

      await user.click(button)
      await within(section).findByText('Sent to 2 devices.')
      answer = { status: 200, body: { sent: 1, removed: 0, failed: [] } }
      await user.click(button)

      await within(section).findByText('Sent to 1 device.')
      expect(within(section).getByRole('status')).toHaveTextContent(/^Sent to 1 device\.$/)
    })

    it("says when a push service no longer knows a device that couldn't be removed yet", async () => {
      const user = userEvent.setup()
      const { section } = await subscribedDevice({
        status: 200,
        body: {
          sent: 1,
          removed: 0,
          failed: [{ pushService: 'web.push.apple.com', status: 410, reason: "push service no longer knows it, and it couldn't be removed" }],
        },
      })

      await user.click(within(section).getByRole('button', { name: 'Send a test Notification' }))

      const result = await within(section).findByText(/Apple's push service/)
      expect(result).toHaveTextContent("Apple's push service no longer knows 1 device. Nando removes it next time.")
      expect(within(section).getByRole('status')).not.toHaveTextContent("Couldn't reach")
    })

    it('says how many devices were removed because they no longer get Notifications', async () => {
      const user = userEvent.setup()
      const { section } = await subscribedDevice({ status: 200, body: { sent: 1, removed: 2, failed: [] } })

      await user.click(within(section).getByRole('button', { name: 'Send a test Notification' }))

      const result = await resultOf(section)
      expect(result).toHaveTextContent('Sent to 1 device.')
      expect(result).toHaveTextContent('Removed 2 devices that no longer get Notifications.')
    })

    it('says which push services it couldn\'t reach, by name, and what they answered', async () => {
      const user = userEvent.setup()
      const { section } = await subscribedDevice({
        status: 200,
        body: {
          sent: 0,
          removed: 1,
          failed: [
            { pushService: 'web.push.apple.com', status: 403, reason: 'push service answered 403 Forbidden' },
            { pushService: 'fcm.googleapis.com', reason: "push service didn't answer within 10s" },
            { pushService: 'push.example.com', status: 500, reason: 'push service answered 500 Internal Server Error' },
          ],
        },
      })

      await user.click(within(section).getByRole('button', { name: 'Send a test Notification' }))

      const result = await resultOf(section)
      expect(result).toHaveTextContent('Sent to 0 devices.')
      expect(result).toHaveTextContent('Removed 1 device that no longer gets Notifications.')
      expect(result).toHaveTextContent("Couldn't reach Apple's push service (403).")
      expect(result).toHaveTextContent("Couldn't reach Google's push service.")
      expect(result).toHaveTextContent("Couldn't reach push.example.com (500).")
      expect(result).not.toHaveTextContent('10s')
    })

    it("says when the test Notification couldn't be sent, and sends it when asked to try again", async () => {
      const user = userEvent.setup()
      let fails = true
      const { section } = await subscribedDevice(() =>
        fails ? { status: 500 } : { status: 200, body: { sent: 1, removed: 0, failed: [] } },
      )

      await user.click(within(section).getByRole('button', { name: 'Send a test Notification' }))

      expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't send the test Notification.")

      fails = false
      await user.click(within(section).getByRole('button', { name: 'Try again' }))

      expect(await resultOf(section)).toHaveTextContent('Sent to 1 device.')
      expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
    })

    it('says Sending… while it waits, and sends once when tapped twice', async () => {
      let answer: (value: Answer) => void = () => {}
      const { section, sent } = await subscribedDevice(() => new Promise<Answer>((resolve) => (answer = resolve)))
      const button = within(section).getByRole('button', { name: 'Send a test Notification' })

      // A quick double tap: the second lands before Core has answered the first.
      fireEvent.click(button)
      fireEvent.click(button)

      expect(await within(section).findByRole('button', { name: 'Sending…' })).toBeDisabled()
      answer({ status: 200, body: { sent: 1, removed: 0, failed: [] } })
      expect(await resultOf(section)).toHaveTextContent('Sent to 1 device.')
      expect(within(section).getByRole('button', { name: 'Send a test Notification' })).toBeEnabled()
      expect(sent.filter((request) => request.path === '/api/push-subscriptions/test')).toHaveLength(1)
    })

    it.each([
      ['Notifications are off', { permission: 'default', subscription: null }],
      ['Notifications were refused', { permission: 'denied', subscription: null }],
      ["the browser can't get them", { supported: false }],
    ] as const)("isn't offered while %s", async (_, device) => {
      const { api } = fakeApi({})
      const { push } = fakePush(device)
      renderApp('/settings', api, push)

      const section = await notificationsSection()
      await within(section).findAllByText(/This device|add Nando to the Home Screen/)
      expect(within(section).queryByRole('button', { name: 'Send a test Notification' })).not.toBeInTheDocument()
    })
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
