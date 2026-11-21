import { afterEach, describe, expect, it } from 'vitest'
import { browserPush } from './push'

// navigator.serviceWorker as each device has it: missing (no service worker support), with no
// registration (as under `bun run dev`), with a registration but no pushManager (Safari outside
// the Home Screen app), or holding a Push Subscription from before.
function serviceWorkerWith(registration: unknown) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration },
  })
}

afterEach(() => {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker
})

describe('browserPush', () => {
  it('does nothing on a device without service workers, or with none registered', async () => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
    await expect(browserPush.unsubscribe()).resolves.toBeUndefined()

    serviceWorkerWith(undefined)
    await expect(browserPush.unsubscribe()).resolves.toBeUndefined()

    serviceWorkerWith({})
    await expect(browserPush.unsubscribe()).resolves.toBeUndefined()

    serviceWorkerWith({ pushManager: { getSubscription: async () => null } })
    await expect(browserPush.unsubscribe()).resolves.toBeUndefined()
  })

  it('unsubscribes the Push Subscription this device holds', async () => {
    let unsubscribed = 0
    serviceWorkerWith({ pushManager: { getSubscription: async () => ({ unsubscribe: async () => (unsubscribed++, true) }) } })

    await browserPush.unsubscribe()

    expect(unsubscribed).toBe(1)
  })
})
