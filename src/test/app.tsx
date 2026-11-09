import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createApiClient } from '../core/api/client'
import { core } from '../core/core'
import { CoreProvider } from '../core/CoreProvider'
import type { Passkeys } from '../core/identity/passkeys'
import type { Registry } from '../core/module'
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

// The whole app as main.tsx builds it, with Core's real Home Cards, Settings Sections and screens
// and no Modules, opened at `path`.
export function renderApp(path: string, api: ReturnType<typeof fakeApi>['api']) {
  const registry: Registry = { core, modules: [] }
  const router = createMemoryRouter(createRoutes(registry), { initialEntries: [path] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <CoreProvider api={api} passkeys={noPasskeys}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </CoreProvider>,
  )
  return router
}
