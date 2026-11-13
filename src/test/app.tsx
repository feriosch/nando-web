import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createApiClient } from '../core/api/client'
import { core } from '../core/core'
import { CoreProvider } from '../core/CoreProvider'
import { createQueryClient } from '../core/queries'
import type { Passkeys } from '../core/identity/passkeys'
import type { Leave } from '../core/leave'
import type { Module, Registry } from '../core/module'
import type { Push, PushSubscriptionJSON } from '../core/notifications/push'
import type { Share } from '../core/share/share'
import { createRoutes } from '../core/shell/routes'

// A body given with its own headers, such as a CSV with its Content-Type and Content-Disposition, is
// sent as it is.
export type Answer = { status: number; body?: unknown; headers?: Record<string, string> }
export type Sent = { method: string; path: string; body: unknown }

// The API, faked at fetch: each "METHOD /path" answers as given (or as a function of the request's
// body and query, read when the request arrives, which may answer later with a promise), and every
// request is recorded. While the device is offline (fakeConnection), fetch fails, as Safari's does.
export type Answers = Record<string, Answer | ((body: unknown, query: URLSearchParams) => Answer | Promise<Answer>)>

export function fakeApi(answers: Answers) {
  const sent: Sent[] = []
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const path = url.pathname
    const method = init.method ?? 'GET'
    const body = init.body === undefined ? undefined : JSON.parse(String(init.body))
    sent.push({ method, path, body })
    if (!navigator.onLine) throw new TypeError('Load failed')
    const answer = answers[`${method} ${path}`] ?? { status: 404 }
    const { status, body: answerBody, headers } = typeof answer === 'function' ? await answer(body, url.searchParams) : answer
    if (answerBody === undefined) {
      return new Response(null, { status, headers })
    }
    if (headers) {
      return new Response(typeof answerBody === 'string' ? answerBody : JSON.stringify(answerBody), { status, headers })
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

// This device's share sheet, faked: every file shared or downloaded is recorded. `canShareFiles` is
// false on a desktop, which gets a download instead. `answers` says how each share sheet ends, in
// turn: shared (`'shared'`, and once they run out), closed by the Owner (`'cancelled'`), refused
// by Safari because the tap was too long ago (`'not-allowed'`), or failed for any other reason
// (`'failed'`, such as a file the share sheet won't take).
export function fakeShare({
  canShareFiles = true,
  answers = [],
}: { canShareFiles?: boolean; answers?: ('shared' | 'cancelled' | 'not-allowed' | 'failed')[] } = {}) {
  const shared: File[] = []
  const downloaded: File[] = []
  const pending = [...answers]
  const share: Share = {
    canShareFiles: () => canShareFiles,
    shareFiles: async (files) => {
      const answer = pending.shift() ?? 'shared'
      if (answer === 'cancelled') throw new DOMException('Share canceled', 'AbortError')
      if (answer === 'not-allowed') throw new DOMException('The request is not allowed by the user agent.', 'NotAllowedError')
      if (answer === 'failed') throw new TypeError('Not shareable')
      shared.push(...files)
    },
    download: (file) => {
      downloaded.push(file)
    },
  }
  return { share, shared, downloaded }
}

// A device whose share sheet screens that don't test it leave alone.
export const noShare = fakeShare().share

// Screens that don't leave Nando: leaving goes nowhere.
const stay: Leave = () => {}

// `app` wrapped as main.tsx wraps it: Core's services, and a new query cache that doesn't retry.
export function withProviders(
  app: ReactNode,
  {
    api,
    passkeys = noPasskeys,
    push = noPush,
    share = noShare,
    leave = stay,
  }: { api: ReturnType<typeof fakeApi>['api']; passkeys?: Passkeys; push?: Push; share?: Share; leave?: Leave },
) {
  const queryClient = createQueryClient({ retry: false })
  return (
    <CoreProvider api={api} passkeys={passkeys} push={push} share={share} leave={leave}>
      <QueryClientProvider client={queryClient}>{app}</QueryClientProvider>
    </CoreProvider>
  )
}

// The whole app as main.tsx builds it, with Core's real Home Cards, Settings Sections and screens
// and the given Modules (none by default), opened at `path`.
export function renderApp(
  path: string,
  api: ReturnType<typeof fakeApi>['api'],
  push: Push = noPush,
  modules: Module[] = [],
  share: Share = noShare,
) {
  return renderAppWith(path, { api, push, modules, share })
}

// The same, with each of Core's services given by name; those left out are fakes that do nothing.
export function renderAppWith(
  path: string,
  {
    modules = [],
    ...services
  }: { api: ReturnType<typeof fakeApi>['api']; passkeys?: Passkeys; push?: Push; share?: Share; leave?: Leave; modules?: Module[] },
) {
  const registry: Registry = { core, modules }
  const router = createMemoryRouter(createRoutes(registry), { initialEntries: [path] })
  render(withProviders(<RouterProvider router={router} />, services))
  return router
}

// This device's connection, faked: `navigator.onLine` reads it, and going on or off line fires the
// browser's 'online' or 'offline' event, as the iPhone does. The fake API's answers decide what a
// request does meanwhile; restored after each test (src/test/setup.ts).
export function fakeConnection({ online }: { online: boolean }) {
  let isOnline = online
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => isOnline })
  const set = (next: boolean) => {
    isOnline = next
    window.dispatchEvent(new Event(next ? 'online' : 'offline'))
  }
  return {
    goOnline: () => set(true),
    goOffline: () => set(false),
    // Back online while Nando was in the background, suspended: no 'online' event, only Nando
    // coming back to the foreground.
    goOnlineWhileAway: () => {
      isOnline = true
      document.dispatchEvent(new Event('visibilitychange'))
    },
  }
}
