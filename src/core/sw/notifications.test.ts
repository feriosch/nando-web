import { describe, expect, it } from 'vitest'
import { registerNotificationHandlers } from './notifications'

type Shown = { title: string; options: NotificationOptions }

type FakeWindow = { url: string; focused: boolean }

const caloriesReminder = { title: 'Calories', body: 'Nothing logged today', url: '/calories' }

function fakeServiceWorker({
  existingWindowAt,
  navigateFails = false,
}: { existingWindowAt?: string; navigateFails?: boolean } = {}) {
  const listeners = new Map<string, (event: never) => void>()
  const shown: Shown[] = []
  const opened: string[] = []
  const windows: FakeWindow[] = existingWindowAt ? [{ url: existingWindowAt, focused: false }] : []

  const windowClient = (w: FakeWindow) => ({
    focus: async () => {
      w.focused = true
    },
    navigate: async (url: string) => {
      if (navigateFails) throw new TypeError('navigate failed')
      w.url = url
    },
  })

  const scope = {
    clients: {
      matchAll: async () => windows.map(windowClient),
      openWindow: async (url: string) => {
        opened.push(url)
        return null
      },
    },
    addEventListener: (type: string, listener: (event: never) => void) => {
      listeners.set(type, listener)
    },
    registration: {
      showNotification: async (title: string, options: NotificationOptions = {}) => {
        shown.push({ title, options })
      },
    },
  }

  // Runs the listener like the browser does, then waits for whatever it passed to waitUntil.
  async function dispatch(type: string, event: object) {
    const pending: Promise<unknown>[] = []
    listeners.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => pending.push(p) } as never)
    await Promise.all(pending)
  }

  function push(data: unknown) {
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    return dispatch('push', { data: { text: () => text } })
  }

  function pushEmpty() {
    return dispatch('push', { data: null })
  }

  // The browser hands the shown Notification back, data included, when the Owner taps it.
  function tap({ title, options }: Shown) {
    return dispatch('notificationclick', {
      notification: { title, body: options.body, data: options.data, close: () => {} },
    })
  }

  return { scope, shown, opened, windows, push, pushEmpty, tap }
}

describe('service worker Notifications', () => {
  it('shows the Notification Core sends with its title and body', async () => {
    const sw = fakeServiceWorker()
    registerNotificationHandlers(sw.scope)

    await sw.push(caloriesReminder)

    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0].title).toBe('Calories')
    expect(sw.shown[0].options.body).toBe('Nothing logged today')
  })

  // Safari revokes a Push Subscription whose push message doesn't show a Notification.
  it('still shows a Notification for a push message with no payload', async () => {
    const sw = fakeServiceWorker()
    registerNotificationHandlers(sw.scope)

    await sw.pushEmpty()

    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0].title).toBe('Nando')
  })

  it('still shows a Notification for a push message whose payload is not JSON', async () => {
    const sw = fakeServiceWorker()
    registerNotificationHandlers(sw.scope)

    await sw.push('not json')

    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0].title).toBe('Nando')
  })

  it('shows a Notification titled Nando that opens Home when the payload leaves its fields null', async () => {
    const sw = fakeServiceWorker()
    registerNotificationHandlers(sw.scope)
    await sw.push({ title: null, body: null, url: null })

    await sw.tap(sw.shown[0])

    expect(sw.shown[0].title).toBe('Nando')
    expect(sw.opened).toEqual(['/'])
  })

  it("opens Nando at the Notification's link when it is tapped", async () => {
    const sw = fakeServiceWorker()
    registerNotificationHandlers(sw.scope)
    await sw.push(caloriesReminder)

    await sw.tap(sw.shown[0])

    expect(sw.opened).toEqual(['/calories'])
  })

  it('brings an already open Nando to the front at the link instead of opening another', async () => {
    const sw = fakeServiceWorker({ existingWindowAt: '/settings' })
    registerNotificationHandlers(sw.scope)
    await sw.push(caloriesReminder)

    await sw.tap(sw.shown[0])

    expect(sw.opened).toEqual([])
    expect(sw.windows).toEqual([{ url: '/calories', focused: true }])
  })

  it('opens a new Nando window at the link when the open one cannot be moved there', async () => {
    const sw = fakeServiceWorker({ existingWindowAt: '/settings', navigateFails: true })
    registerNotificationHandlers(sw.scope)
    await sw.push(caloriesReminder)

    await sw.tap(sw.shown[0])

    expect(sw.opened).toEqual(['/calories'])
  })
})
