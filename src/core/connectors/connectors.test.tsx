import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Passkeys } from '../identity/passkeys'
import { claudeAsking, claudeRequest, fakeApi, renderAppWith, type Answers } from '../../test/app'

const requestOptions = { challenge: 'Y29ubmVjdA', rpId: 'nanders.app', userVerification: 'required' }
const assertion = { id: 'q1w2', rawId: 'q1w2', type: 'public-key', response: { signature: 'c2ln' } }

// The device's Face ID, faked: `get` answers with `assertion` (or as `get` says) and records the
// options it was given.
function fakePasskeys(get?: Passkeys['get']) {
  const asked: unknown[] = []
  const passkeys: Passkeys = {
    get: async (options) => {
      asked.push(options)
      return get ? get(options) : assertion
    },
    create: () => Promise.reject(new Error('no registering here')),
  }
  return { passkeys, asked }
}

// Leaving Nando for another site, faked: every URL left for is recorded.
function fakeLeave() {
  const left: string[] = []
  return { leave: (url: string) => void left.push(url), left }
}

// The consent page for pending request `r1`, with the server answering `answers` on top of a
// request from Claude that returns to claude.ai.
function renderConsent(answers: Answers = {}, passkeys = fakePasskeys().passkeys) {
  const fake = fakeApi({ ...claudeAsking(), ...answers })
  const { leave, left } = fakeLeave()
  const router = renderAppWith('/connect?request=r1', { api: fake.api, passkeys, leave })
  return { ...fake, left, router }
}

describe('Connector consent page', () => {
  it('says who wants to use Nando, what it gets and where it returns, and asks for nothing until a tap', async () => {
    const { passkeys, asked } = fakePasskeys()
    const { sent } = renderConsent({}, passkeys)

    expect(await screen.findByRole('heading', { level: 1, name: 'Claude wants to use Nando' })).toBeInTheDocument()
    // The server says no Module has Tools.
    expect(screen.getByText('It will be able to use every Tool Nando offers.')).toBeInTheDocument()
    expect(screen.getByText('claude.ai')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Allow with Face ID' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Don't allow" })).toBeInTheDocument()
    // No tab bar: it's not part of the tab shell.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    // WebAuthn starts only from a tap.
    expect(sent.map((request) => `${request.method} ${request.path}`)).toEqual(['GET /auth/connect/r1'])
    expect(asked).toEqual([])
  })

  it('says what every Module’s Tools let it do, in one sentence, as the server says', async () => {
    renderConsent(claudeAsking(['search your Words and Kanji, and add, change, merge and delete your Words', 'log your workouts']))

    expect(
      await screen.findByText('It will be able to search your Words and Kanji, and add, change, merge and delete your Words, and log your workouts.'),
    ).toBeInTheDocument()
  })

  it('approves the Connector with Face ID when the Owner taps Allow, then goes back to it', async () => {
    const user = userEvent.setup()
    const { passkeys, asked } = fakePasskeys()
    const redirect = 'https://claude.ai/api/mcp/auth_callback?code=c0de&state=s7'
    const { sent, left } = renderConsent(
      {
        'POST /auth/connect/r1/begin': { status: 200, body: { publicKey: requestOptions } },
        'POST /auth/connect/r1/finish': { status: 200, body: { redirect } },
      },
      passkeys,
    )

    await user.click(await screen.findByRole('button', { name: 'Allow with Face ID' }))

    await waitFor(() => expect(left).toEqual([redirect]))
    expect(asked).toEqual([requestOptions])
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      { method: 'POST', path: '/auth/connect/r1/begin', body: undefined },
      { method: 'POST', path: '/auth/connect/r1/finish', body: assertion },
    ])
  })

  it("denies the request when the Owner taps Don't allow, without asking for Face ID", async () => {
    const user = userEvent.setup()
    const { passkeys, asked } = fakePasskeys()
    const redirect = 'https://claude.ai/api/mcp/auth_callback?error=access_denied&state=s7'
    const { left } = renderConsent({ 'POST /auth/connect/r1/deny': { status: 200, body: { redirect } } }, passkeys)

    await user.click(await screen.findByRole('button', { name: "Don't allow" }))

    await waitFor(() => expect(left).toEqual([redirect]))
    expect(asked).toEqual([])
  })

  it('says an unknown or expired request has expired, with nothing to tap', async () => {
    renderConsent({ 'GET /auth/connect/r1': { status: 404, body: 'no such request' } })

    expect(await screen.findByText('This request has expired. Try connecting again from Claude.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('stays on the page with the reason when Face ID is cancelled, and both buttons still work', async () => {
    const user = userEvent.setup()
    let cancel = true
    const { passkeys } = fakePasskeys(async () => {
      if (cancel) throw new DOMException('The operation was cancelled.', 'NotAllowedError')
      return assertion
    })
    const redirect = 'https://claude.ai/api/mcp/auth_callback?code=c0de&state=s7'
    const { left } = renderConsent(
      {
        'POST /auth/connect/r1/begin': { status: 200, body: { publicKey: requestOptions } },
        'POST /auth/connect/r1/finish': { status: 200, body: { redirect } },
      },
      passkeys,
    )

    await user.click(await screen.findByRole('button', { name: 'Allow with Face ID' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Face ID was cancelled, so Claude wasn\'t allowed.')
    expect(left).toEqual([])
    expect(screen.getByRole('button', { name: "Don't allow" })).toBeEnabled()

    cancel = false
    await user.click(screen.getByRole('button', { name: 'Allow with Face ID' }))
    await waitFor(() => expect(left).toEqual([redirect]))
  })

  it("says the Passkey wasn't accepted when the server refuses it", async () => {
    const user = userEvent.setup()
    renderConsent({
      'POST /auth/connect/r1/begin': { status: 200, body: { publicKey: requestOptions } },
      'POST /auth/connect/r1/finish': { status: 401, body: 'passkey refused' },
    })

    await user.click(await screen.findByRole('button', { name: 'Allow with Face ID' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("This Passkey wasn't accepted, so Claude wasn't allowed.")
    expect(screen.getByRole('button', { name: 'Allow with Face ID' })).toBeEnabled()
  })

  it('says the request has expired, with nothing to tap, when it expires before the Owner answers', async () => {
    const user = userEvent.setup()
    renderConsent({ 'POST /auth/connect/r1/deny': { status: 404, body: 'no such request' } })

    await user.click(await screen.findByRole('button', { name: "Don't allow" }))

    expect(await screen.findByText('This request has expired. Try connecting again from Claude.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Claude wants to use Nando' })).not.toBeInTheDocument()
  })

  it('says the request has expired when the link has no request at all, without asking the server', async () => {
    const { leave } = fakeLeave()
    const { api, sent } = fakeApi({})
    renderAppWith('/connect', { api, leave })

    expect(await screen.findByText('This request has expired. Try connecting again from Claude.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(sent).toEqual([])
  })

  it("says when it couldn't load the request, and loads it again", async () => {
    const user = userEvent.setup()
    let answered = 0
    renderConsent({
      'GET /auth/connect/r1': () =>
        answered++ === 0 ? { status: 503, body: 'unavailable' } : claudeRequest(),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this request.")
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Claude wants to use Nando' })).toBeInTheDocument()
  })
})

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175, weighInReminder: { enabled: false, weekday: 'monday', time: '08:00' } }

type Connector = { id: string; name: string; approvedAt: string; lastUsedAt: string | null }

// The Connectors Settings Section on the Settings screen, found by its heading.
async function connectorsSection() {
  return await screen.findByRole('region', { name: 'Connectors' })
}

function renderSettings(connectors: Connector[], answers: Answers = {}) {
  const fake = fakeApi({
    'GET /api/settings': { status: 200, body: tokyo },
    'GET /api/connectors': () => ({ status: 200, body: connectors }),
    ...answers,
  })
  renderAppWith('/settings', { api: fake.api })
  return fake
}

describe('Connectors Settings Section', () => {
  beforeEach(() => {
    // Monday 9 November 2026, 05:00 in Tokyo (Sunday 20:00 UTC).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-08T20:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists each Connector with when it was approved and last used, in the Owner Time Zone', async () => {
    renderSettings([
      // Approved on Sunday 1 November in Tokyo; last used early on Monday 9 November there.
      { id: 'c1', name: 'Claude', approvedAt: '2026-11-01T03:00:00Z', lastUsedAt: '2026-11-08T19:30:00Z' },
      { id: 'c2', name: 'Claude Code', approvedAt: '2026-11-07T10:00:00Z', lastUsedAt: '2026-11-08T10:00:00Z' },
      { id: 'c3', name: 'Claude Desktop', approvedAt: '2025-12-30T10:00:00Z', lastUsedAt: null },
    ])

    const list = await within(await connectorsSection()).findByRole('list', { name: 'Connectors' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent(/^Claude\s*Approved 1 Nov · Last used today/)
    expect(rows[1]).toHaveTextContent(/^Claude Code\s*Approved 7 Nov · Last used yesterday/)
    expect(rows[2]).toHaveTextContent(/^Claude Desktop\s*Approved 30 Dec 2025 · Never used/)
  })

  it('asks before removing a Connector, then removes it', async () => {
    const user = userEvent.setup()
    let connectors: Connector[] = [
      { id: 'c1', name: 'Claude', approvedAt: '2026-11-01T03:00:00Z', lastUsedAt: null },
      { id: 'c2', name: 'Claude Code', approvedAt: '2026-11-07T10:00:00Z', lastUsedAt: null },
    ]
    const fake = fakeApi({
      'GET /api/settings': { status: 200, body: tokyo },
      'GET /api/connectors': () => ({ status: 200, body: connectors }),
      'DELETE /api/connectors/c1': () => {
        connectors = connectors.filter((connector) => connector.id !== 'c1')
        return { status: 204 }
      },
    })
    renderAppWith('/settings', { api: fake.api })

    const list = await within(await connectorsSection()).findByRole('list', { name: 'Connectors' })
    await user.click(within(list).getByRole('button', { name: 'Remove Claude' }))

    const question = await screen.findByRole('alertdialog', { name: 'Remove Claude?' })
    expect(question).toHaveTextContent('Claude will lose access to Nando until you connect it again.')
    expect(fake.sent.filter((request) => request.method === 'DELETE')).toEqual([])
    await user.click(within(question).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1))
    expect(within(list).getByRole('listitem')).toHaveTextContent(/^Claude Code/)
    expect(fake.sent.filter((request) => request.method === 'DELETE')).toEqual([
      { method: 'DELETE', path: '/api/connectors/c1', body: undefined },
    ])
  })

  it('removes nothing when the Owner cancels', async () => {
    const user = userEvent.setup()
    const { sent } = renderSettings([{ id: 'c1', name: 'Claude', approvedAt: '2026-11-01T03:00:00Z', lastUsedAt: null }])

    await user.click(await within(await connectorsSection()).findByRole('button', { name: 'Remove Claude' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(sent.filter((request) => request.method === 'DELETE')).toEqual([])
  })

  it('says how to add a Connector when there are none', async () => {
    renderSettings([])

    const section = await connectorsSection()
    expect(await within(section).findByText(/^No Connectors yet\./)).toHaveTextContent(
      /^No Connectors yet\. To add one, add a custom connector in the Claude app with https?:\/\/\S+\/mcp\.$/,
    )
    expect(within(section).queryByRole('list')).not.toBeInTheDocument()
  })

  it("says when it couldn't load the Connectors, and loads them again", async () => {
    const user = userEvent.setup()
    let answered = 0
    renderSettings([], {
      'GET /api/connectors': () =>
        answered++ === 0
          ? { status: 503, body: 'unavailable' }
          : { status: 200, body: [{ id: 'c1', name: 'Claude', approvedAt: '2026-11-01T03:00:00Z', lastUsedAt: null }] },
    })

    const section = await connectorsSection()
    expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't load the Connectors.")
    await user.click(within(section).getByRole('button', { name: 'Try again' }))

    expect(await within(section).findByRole('button', { name: 'Remove Claude' })).toBeInTheDocument()
  })

  it("says when a Connector couldn't be removed, and keeps it listed", async () => {
    const user = userEvent.setup()
    renderSettings([{ id: 'c1', name: 'Claude', approvedAt: '2026-11-01T03:00:00Z', lastUsedAt: null }], {
      'DELETE /api/connectors/c1': { status: 503, body: 'unavailable' },
    })

    const section = await connectorsSection()
    await user.click(await within(section).findByRole('button', { name: 'Remove Claude' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't remove Claude.")
    expect(within(section).getByRole('button', { name: 'Remove Claude' })).toBeInTheDocument()
  })
})
