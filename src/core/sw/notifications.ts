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

// The Notification Core sends in each push message.
type NotificationPayload = { title: string; body: string; url: string }

// Every push message must show a Notification, or Safari revokes the Push Subscription; one we
// can't read still shows a plain one.
const fallback: NotificationPayload = { title: 'Nando', body: '', url: '/' }

function readPayload(data: PushEvent['data']): NotificationPayload {
  if (!data) return fallback
  let sent: Partial<NotificationPayload> | null
  try {
    sent = JSON.parse(data.text())
  } catch {
    return fallback
  }
  return {
    title: sent?.title ?? fallback.title,
    body: sent?.body ?? fallback.body,
    url: sent?.url ?? fallback.url,
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
    const { url } = event.notification.data as Pick<NotificationPayload, 'url'>
    event.waitUntil(openAt(scope, url))
  })
}

// Reuses an open Nando window if there is one, and opens a new one if that window can't be
// moved to the link. Only windows this service worker controls are listed, and only those can
// be navigated. Focus comes first, while the tap still counts as user activation.
async function openAt(scope: NotificationScope, url: string) {
  const [open] = await scope.clients.matchAll({ type: 'window' })
  if (open) {
    try {
      await open.focus()
      await open.navigate(url)
      return
    } catch {
      // Fall through to a new window.
    }
  }
  await scope.clients.openWindow(url)
}
