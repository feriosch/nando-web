import { describe, expect, it } from 'vitest'
import { registerNotificationHandlers } from './notifications'

type Shown = { title: string; options: NotificationOptions }

type Window = { url: string; focused: boolean }

// openAt: where an already open Nando window is, if there is one.
function fakeServiceWorker({ openAt }: { openAt?: string } = {}) {
  const listeners = new Map<string, (event: never) => void>()
  const shown: Shown[] = []
  const opened: string[] = []
  const windows: Window[] = openAt ? [{ url: openAt, focused: false }] : []

  const windowClient = (w: Window) => ({
    focus: async () => {
      w.focused = true
    },
    navigate: async (url: string) => {
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
  it('shows a pushed Notification with its title and body', async () => {
    const sw = fakeServiceWorker()
    registerNotificationHandlers(sw.scope)

    await sw.push({ title: 'Calories', body: 'Nothing logged today', url: '/calories' })

    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0].title).toBe('Calories')
    expect(sw.shown[0].options.body).toBe('Nothing logged today')
  })

  // Safari revokes a Push Subscription whose push doesn't show a Notification.
  it('still shows a Notification for a push with no payload', async () => {
    const sw = fakeServiceWorker()
    registerNotificationHandlers(sw.scope)

    await sw.pushEmpty()

    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0].title).toBe('Nando')
  })

  it('still shows a Notification for a push whose payload is not JSON', async () => {
    const sw = fakeServiceWorker()
    registerNotificationHandlers(sw.scope)

    await sw.push('not json')

    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0].title).toBe('Nando')
  })

  it("opens Nando at the Notification's link when it is tapped", async () => {
    const sw = fakeServiceWorker()
    registerNotificationHandlers(sw.scope)
    await sw.push({ title: 'Calories', body: 'Nothing logged today', url: '/calories' })

    await sw.tap(sw.shown[0])

    expect(sw.opened).toEqual(['/calories'])
  })

  it('brings an already open Nando to the front at the link instead of opening another', async () => {
    const sw = fakeServiceWorker({ openAt: '/settings' })
    registerNotificationHandlers(sw.scope)
    await sw.push({ title: 'Calories', body: 'Nothing logged today', url: '/calories' })

    await sw.tap(sw.shown[0])

    expect(sw.opened).toEqual([])
    expect(sw.windows).toEqual([{ url: '/calories', focused: true }])
  })
})
