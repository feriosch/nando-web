import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createApiClient } from '../core/api/client'
import { core } from '../core/core'
import { CoreProvider } from '../core/CoreProvider'
import type { Passkeys } from '../core/identity/passkeys'
import type { Registry } from '../core/module'
import type { Push, PushSubscriptionJSON } from '../core/notifications/push'
import { createRoutes } from '../core/shell/routes'

export type Answer = { status: number; body?: unknown }
export type Sent = { method: string; path: string; body: unknown }

// The API, faked at fetch: each "METHOD /path" answers as given (or as a function of the request's
// body, read when the request arrives), and every request is recorded.
export function fakeApi(answers: Record<string, Answer | ((body: unknown) => Answer)>) {
  const sent: Sent[] = []
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname
    const method = init.method ?? 'GET'
    const body = init.body === undefined ? undefined : JSON.parse(String(init.body))
    sent.push({ method, path, body })
    const answer = answers[`${method} ${path}`] ?? { status: 404 }
    const { status, body: answerBody } = typeof answer === 'function' ? answer(body) : answer
    if (answerBody === undefined) {
      return new Response(null, { status })
    }
    // The server sends its error messages as plain text.
    if (typeof answerBody === 'string') {
      return new Response(answerBody, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    return new Response(JSON.stringify(answerBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { api: createApiClient({ baseUrl: 'https://api.example.com', fetch }), sent }
}

const noPasskeys: Passkeys = {
  get: () => Promise.reject(new Error('no Passkeys in these tests')),
  create: () => Promise.reject(new Error('no Passkeys in these tests')),
}

// This device's Notification permission and Push Subscription, faked: `subscribe` hands back
// `subscribed` once the permission is granted. Records each permission request and the VAPID key
// each subscribe was given.
export function fakePush({
  supported = true,
  permission = 'default',
  subscription = null,
  answerPermission = 'granted',
  subscribed = { endpoint: 'https://web.push.apple.com/QGxt', expirationTime: null, keys: { p256dh: 'BOrK', auth: 'Ys5w' } },
}: {
  supported?: boolean
  permission?: NotificationPermission
  subscription?: PushSubscriptionJSON | null
  // What the Owner answers when asked for the permission.
  answerPermission?: NotificationPermission
  subscribed?: PushSubscriptionJSON
} = {}) {
  const calls = { permissionRequests: 0, subscribedWith: [] as string[] }
  let current = subscription
  const push: Push = {
    supported: () => supported,
    permission: () => permission,
    requestPermission: async () => {
      calls.permissionRequests++
      if (permission === 'default') permission = answerPermission
      return permission
    },
    subscription: async () => current,
    subscribe: async (vapidPublicKey) => {
      calls.subscribedWith.push(vapidPublicKey)
      if (permission !== 'granted') throw new DOMException('Permission not granted.', 'NotAllowedError')
      current = subscribed
      return subscribed
    },
  }
  // The Owner changes the permission in the device's settings, outside Nando.
  const setPermission = (changed: NotificationPermission) => {
    permission = changed
  }
  return { push, calls, setPermission }
}

// A browser that can't receive Notifications, so screens that don't test them leave them alone.
export const noPush = fakePush({ supported: false }).push

// The whole app as main.tsx builds it, with Core's real Home Cards, Settings Sections and screens
// and no Modules, opened at `path`.
export function renderApp(path: string, api: ReturnType<typeof fakeApi>['api'], push: Push = noPush) {
  const registry: Registry = { core, modules: [] }
  const router = createMemoryRouter(createRoutes(registry), { initialEntries: [path] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <CoreProvider api={api} passkeys={noPasskeys} push={push}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </CoreProvider>,
  )
  return router
}
