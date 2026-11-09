import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { createApiClient } from '../api/client'
import { CoreProvider } from '../CoreProvider'
import { useApi } from '../services'
import type { Registry } from '../module'
import { noPush } from '../../test/app'
import { createRoutes } from '../shell/routes'
import type { Passkeys } from './passkeys'

type Answer = { status: number; body?: unknown }
type Sent = { method: string; path: string; body: unknown }

// The API, faked at fetch: each "METHOD /path" answers as given, and every request is recorded.
function fakeApi(answers: Record<string, Answer>) {
  const sent: Sent[] = []
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname
    const method = init.method ?? 'GET'
    sent.push({ method, path, body: init.body === undefined ? undefined : JSON.parse(String(init.body)) })
    const answer = answers[`${method} ${path}`] ?? { status: 404 }
    if (answer.body === undefined) {
      return new Response(null, { status: answer.status })
    }
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { api: createApiClient({ baseUrl: 'https://api.example.com', fetch }), sent }
}

const requestOptions = { challenge: 'c2lnbi1pbg', rpId: 'nanders.app', userVerification: 'required' }
const assertion = { id: 'q1w2', rawId: 'q1w2', type: 'public-key', response: { signature: 'c2ln' } }
const creationOptions = {
  challenge: 'cmVnaXN0ZXI',
  rp: { id: 'nanders.app', name: 'Nando' },
  user: { id: 'b3duZXI', name: 'owner', displayName: 'Owner' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
}
const attestation = { id: 'e5r6', rawId: 'e5r6', type: 'public-key', response: { attestationObject: 'YXR0' } }

// The device's Face ID, faked: `get` answers with `assertion` and `create` with `attestation`, and
// both record the options they were given.
function fakePasskeys(overrides: Partial<Passkeys> = {}) {
  const asked: unknown[] = []
  const passkeys: Passkeys = {
    get: async (options) => {
      asked.push(options)
      return assertion
    },
    create: async (options) => {
      asked.push(options)
      return attestation
    },
    ...overrides,
  }
  return { passkeys, asked }
}

const registry: Registry = {
  core: {
    homeCards: [{ id: 'body', Component: () => <p>Latest Weigh-in: 72 kg</p> }],
    settingsSections: [],
  },
  modules: [
    {
      id: 'calories',
      name: 'Calories',
      path: '/calories',
      theme: 'theme-calories',
      icon: () => <svg />,
      routes: [{ index: true, Component: TodaysEntries }],
      homeCards: [],
      settingsSections: [],
    },
  ],
}

// A Module screen that loads from the API as soon as it opens.
function TodaysEntries() {
  const api = useApi()
  useEffect(() => {
    api.get('/api/calories/days/today').catch(() => {})
  }, [api])
  return <h1>Today's Entries</h1>
}

function renderApp(path: string, api: ReturnType<typeof fakeApi>['api'], passkeys: Passkeys) {
  const router = createMemoryRouter(createRoutes(registry), { initialEntries: [path] })
  render(
    <CoreProvider api={api} passkeys={passkeys} push={noPush}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </CoreProvider>,
  )
  return router
}

describe('Sign in', () => {
  it('signs in with a Passkey when the Owner taps "Sign in with Face ID", then opens Home', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({
      'POST /auth/signin/begin': { status: 200, body: { publicKey: requestOptions } },
      'POST /auth/signin/finish': { status: 204 },
    })
    const { passkeys, asked } = fakePasskeys()
    const router = renderApp('/sign-in', api, passkeys)

    await user.click(screen.getByRole('button', { name: 'Sign in with Face ID' }))

    expect(await screen.findByText('Latest Weigh-in: 72 kg')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(asked).toEqual([requestOptions])
    // Home then loads what it shows; the last sign-in request is the one that finished it.
    expect(sent.filter((request) => request.path.startsWith('/auth/')).at(-1)).toEqual({
      method: 'POST',
      path: '/auth/signin/finish',
      body: assertion,
    })
  })

  it("doesn't ask for a Passkey until the Owner taps, since WebAuthn must start from a tap", async () => {
    const { api, sent } = fakeApi({})
    const { passkeys, asked } = fakePasskeys()
    renderApp('/sign-in', api, passkeys)

    expect(await screen.findByRole('button', { name: 'Sign in with Face ID' })).toBeInTheDocument()
    expect(sent).toEqual([])
    expect(asked).toEqual([])
  })

  it('says sign-in was cancelled when the Owner cancels Face ID, and lets them try again', async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'POST /auth/signin/begin': { status: 200, body: { publicKey: requestOptions } },
      'POST /auth/signin/finish': { status: 204 },
    })
    let cancel = true
    const { passkeys } = fakePasskeys({
      get: async () => {
        if (cancel) throw new DOMException('The operation was cancelled.', 'NotAllowedError')
        return assertion
      },
    })
    const router = renderApp('/sign-in', api, passkeys)

    await user.click(screen.getByRole('button', { name: 'Sign in with Face ID' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in was cancelled.')
    expect(router.state.location.pathname).toBe('/sign-in')

    cancel = false
    await user.click(screen.getByRole('button', { name: 'Sign in with Face ID' }))

    expect(await screen.findByText('Latest Weigh-in: 72 kg')).toBeInTheDocument()
  })

  it('says the Passkey was refused when the server turns it down, for example after it was deleted', async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'POST /auth/signin/begin': { status: 200, body: { publicKey: requestOptions } },
      'POST /auth/signin/finish': { status: 401, body: 'passkey refused' },
    })
    const { passkeys } = fakePasskeys()
    const router = renderApp('/sign-in', api, passkeys)

    await user.click(screen.getByRole('button', { name: 'Sign in with Face ID' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This Passkey wasn't accepted. If it was deleted, register a new one with an Enrollment Code.",
    )
    expect(router.state.location.pathname).toBe('/sign-in')
  })


  it("ignores a second tap while a sign-in is still running", async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({
      'POST /auth/signin/begin': { status: 200, body: { publicKey: requestOptions } },
      'POST /auth/signin/finish': { status: 204 },
    })
    let unlock = () => {}
    const { passkeys } = fakePasskeys({
      get: () => new Promise((resolve) => (unlock = () => resolve(assertion))),
    })
    renderApp('/sign-in', api, passkeys)

    await user.click(screen.getByRole('button', { name: 'Sign in with Face ID' }))
    await user.click(screen.getByRole('button', { name: 'Sign in with Face ID' }))
    unlock()

    expect(await screen.findByText('Latest Weigh-in: 72 kg')).toBeInTheDocument()
    expect(sent.filter((request) => request.path === '/auth/signin/begin')).toHaveLength(1)
  })
})

describe('Enrollment', () => {
  it('registers a new Passkey with an Enrollment Code, which signs the Owner in and opens Home', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({
      'POST /auth/register/begin': { status: 200, body: { publicKey: creationOptions } },
      'POST /auth/register/finish': { status: 204 },
    })
    const { passkeys, asked } = fakePasskeys()
    const router = renderApp('/sign-in', api, passkeys)

    await user.click(screen.getByRole('link', { name: 'Use an Enrollment Code' }))
    await user.type(screen.getByLabelText('Enrollment Code'), 'BY95P-1SQMF')
    await user.click(screen.getByRole('button', { name: 'Create Passkey' }))

    expect(await screen.findByText('Latest Weigh-in: 72 kg')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(sent[0]).toEqual({ method: 'POST', path: '/auth/register/begin', body: { code: 'BY95P-1SQMF' } })
    expect(asked).toEqual([creationOptions])
    expect(sent.filter((request) => request.path.startsWith('/auth/')).at(-1)).toEqual({
      method: 'POST',
      path: '/auth/register/finish',
      body: attestation,
    })
  })

  it("says the Enrollment Code didn't work when it is unknown, used or expired, without asking for Face ID", async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({ 'POST /auth/register/begin': { status: 401, body: 'unknown code' } })
    const { passkeys, asked } = fakePasskeys()
    const router = renderApp('/enroll', api, passkeys)

    await user.type(screen.getByLabelText('Enrollment Code'), 'BY95P-1SQMX')
    await user.click(screen.getByRole('button', { name: 'Create Passkey' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That Enrollment Code is unknown, used or expired. Run nando-server enroll for a new one.',
    )
    expect(asked).toEqual([])
    expect(router.state.location.pathname).toBe('/enroll')
  })

  it('tells the Owner to sign in instead when this device already has a Passkey', async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'POST /auth/register/begin': { status: 200, body: { publicKey: creationOptions } },
    })
    const { passkeys } = fakePasskeys({
      create: async () => {
        throw new DOMException('The authenticator was previously registered.', 'InvalidStateError')
      },
    })
    const router = renderApp('/enroll', api, passkeys)

    await user.type(screen.getByLabelText('Enrollment Code'), 'BY95P-1SQMF')
    await user.click(screen.getByRole('button', { name: 'Create Passkey' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This device already has a Passkey for Nando.')
    await user.click(screen.getByRole('link', { name: 'Sign in with Face ID' }))
    expect(router.state.location.pathname).toBe('/sign-in')
  })
})

describe('Enrollment problems', () => {
  it('sends the Enrollment Code as printed even when pasted with spaces or typed in lowercase', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi({ 'POST /auth/register/begin': { status: 401, body: 'unknown code' } })
    const { passkeys } = fakePasskeys()
    renderApp('/enroll', api, passkeys)

    await user.type(screen.getByLabelText('Enrollment Code'), ' by95p-1sqmf ')
    await user.click(screen.getByRole('button', { name: 'Create Passkey' }))

    await screen.findByRole('alert')
    expect(sent[0]).toEqual({ method: 'POST', path: '/auth/register/begin', body: { code: 'BY95P-1SQMF' } })
  })

  it('says registering was cancelled when the Owner cancels Face ID', async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'POST /auth/register/begin': { status: 200, body: { publicKey: creationOptions } },
    })
    const { passkeys } = fakePasskeys({
      create: async () => {
        throw new DOMException('The operation was cancelled.', 'NotAllowedError')
      },
    })
    renderApp('/enroll', api, passkeys)

    await user.type(screen.getByLabelText('Enrollment Code'), 'BY95P-1SQMF')
    await user.click(screen.getByRole('button', { name: 'Create Passkey' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Registering the Passkey was cancelled.')
  })

  it("doesn't blame the Enrollment Code when the server refuses the new Passkey itself", async () => {
    const user = userEvent.setup()
    const { api } = fakeApi({
      'POST /auth/register/begin': { status: 200, body: { publicKey: creationOptions } },
      'POST /auth/register/finish': { status: 401, body: 'passkey not verified' },
    })
    const { passkeys } = fakePasskeys()
    renderApp('/enroll', api, passkeys)

    await user.type(screen.getByLabelText('Enrollment Code'), 'BY95P-1SQMF')
    await user.click(screen.getByRole('button', { name: 'Create Passkey' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Nando couldn't register this Passkey, or the Enrollment Code expired in the meantime.",
    )
  })
})

describe('Signed out', () => {
  it('goes to sign-in when any /api/ route answers 401, because the Session is gone', async () => {
    const { api } = fakeApi({ 'GET /api/calories/days/today': { status: 401, body: 'no session' } })
    const { passkeys } = fakePasskeys()
    const router = renderApp('/calories', api, passkeys)

    expect(await screen.findByRole('button', { name: 'Sign in with Face ID' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/sign-in')
  })
})
