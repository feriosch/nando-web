// The slice of a service worker's global scope these handlers use. Declared here rather than
// taken from the WebWorker lib so the app's DOM-typed build and tests can import this file.
type ExtendableEvent = { waitUntil(promise: Promise<unknown>): void }

type PushEvent = ExtendableEvent & { data: { text(): string } | null }

type NotificationEvent = ExtendableEvent & {
  notification: { data: unknown; close(): void }
}

type WindowClient = { focus(): Promise<unknown>; navigate(url: string): Promise<unknown> }

export type NotificationScope = {
  addEventListener(type: 'push', listener: (event: PushEvent) => void): void
  addEventListener(type: 'notificationclick', listener: (event: NotificationEvent) => void): void
  registration: {
    showNotification(title: string, options?: NotificationOptions): Promise<void>
  }
  clients: {
    matchAll(options: { type: 'window' }): Promise<readonly WindowClient[]>
    openWindow(url: string): Promise<unknown>
  }
}

// What Core sends in each push.
type Payload = { title: string; body: string; url: string }

// Every push must show something, or Safari revokes the Push Subscription; a push we can't
// read still shows a plain Notification.
const fallback: Payload = { title: 'Nando', body: '', url: '/' }

function readPayload(data: PushEvent['data']): Payload {
  try {
    return { ...fallback, ...JSON.parse(data!.text()) }
  } catch {
    return fallback
  }
}

export function registerNotificationHandlers(scope: NotificationScope) {
  scope.addEventListener('push', (event) => {
    const payload = readPayload(event.data)
    event.waitUntil(
      scope.registration.showNotification(payload.title, {
        body: payload.body,
        data: { url: payload.url },
      }),
    )
  })

  scope.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const { url } = event.notification.data as Pick<Payload, 'url'>
    event.waitUntil(openAt(scope, url))
  })
}

// Reuses an open Nando window if there is one. Only windows this service worker controls are
// listed, and only those can be navigated. Focus comes first, while the tap still counts as
// user activation.
async function openAt(scope: NotificationScope, url: string) {
  const [open] = await scope.clients.matchAll({ type: 'window' })
  if (!open) return scope.clients.openWindow(url)
  await open.focus()
  await open.navigate(url)
}
