import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Passkeys } from '../identity/passkeys'
import { fakeApi, fakeClipboard, renderAppWith, type Answers } from '../../test/app'

// Sync Keys (ADR 0015): long-lived keys for the Owner's own automations, such as the Health Sync
// Shortcut, created with Face ID and shown only once.

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175 }
const requestOptions = { challenge: 'c3luYw', rpId: 'nanders.app', userVerification: 'required' }
const assertion = { id: 'q1w2', rawId: 'q1w2', type: 'public-key', response: { signature: 'c2ln' } }

type SyncKey = { id: string; name: string; createdAt: string; lastUsedAt: string | null }

// The device's Face ID, faked: `get` answers with `assertion` (or as `get` says).
function fakePasskeys(get?: Passkeys['get']): Passkeys {
  return {
    get: async (options) => (get ? get(options) : assertion),
    create: () => Promise.reject(new Error('no registering here')),
  }
}

// Settings, with the server's Sync Keys in `keys`: creating one adds it, removing one drops it.
function renderSettings(keys: SyncKey[], { passkeys = fakePasskeys(), answers = {} }: { passkeys?: Passkeys; answers?: Answers } = {}) {
  let list = [...keys]
  const fake = fakeApi({
    'GET /api/settings': { status: 200, body: tokyo },
    'GET /api/connectors': { status: 200, body: [] },
    'GET /api/sync-keys': () => ({ status: 200, body: list }),
    'POST /api/sync-keys/begin': { status: 200, body: { publicKey: requestOptions } },
    'POST /api/sync-keys/finish': () => {
      const created = { id: 'k9', name: 'iPhone Health', createdAt: '2026-11-08T20:00:00Z', lastUsedAt: null }
      list = [...list, created]
      return { status: 201, body: { ...created, key: 'K7Q2-SECRET-KEY' } }
    },
    'DELETE /api/sync-keys/k1': () => {
      list = list.filter((key) => key.id !== 'k1')
      return { status: 204 }
    },
    ...answers,
  })
  const { clipboard, copied } = fakeClipboard()
  renderAppWith('/settings', { api: fake.api, passkeys, clipboard })
  return { ...fake, copied }
}

async function syncKeysSection() {
  return await screen.findByRole('region', { name: 'Sync Keys' })
}

describe('Sync Keys Settings Section', () => {
  beforeEach(() => {
    // Monday 9 November 2026, 05:00 in Tokyo.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-08T20:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists each Sync Key with when it was created and last used, in the Owner Time Zone', async () => {
    renderSettings([
      { id: 'k1', name: 'iPhone Health', createdAt: '2026-11-01T03:00:00Z', lastUsedAt: '2026-11-08T19:30:00Z' },
      { id: 'k2', name: 'Old iPhone', createdAt: '2026-10-01T03:00:00Z', lastUsedAt: null },
    ])

    const list = await within(await syncKeysSection()).findByRole('list', { name: 'Sync Keys' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(/^iPhone Health\s*Created 1 Nov · Last used today/)
    expect(rows[1]).toHaveTextContent(/^Old iPhone\s*Created 1 Oct · Never used/)
  })

  it('says what a Sync Key is for when there are none', async () => {
    renderSettings([])

    expect(await within(await syncKeysSection()).findByText(/let your own automations, such as the Health Sync Shortcut/)).toBeInTheDocument()
  })

  it('creates a Sync Key with Face ID, shows its key once to copy, and lists it', async () => {
    const user = userEvent.setup()
    const { sent, copied } = renderSettings([])

    const section = await syncKeysSection()
    await user.click(await within(section).findByRole('button', { name: 'Create with Face ID' }))

    const sheet = await screen.findByRole('dialog', { name: 'iPhone Health' })
    expect(sheet).toHaveTextContent('K7Q2-SECRET-KEY')
    expect(sheet).toHaveTextContent('Nando shows it only now')
    await user.click(within(sheet).getByRole('button', { name: 'Copy' }))
    expect(copied).toEqual(['K7Q2-SECRET-KEY'])
    expect(sent.filter((r) => r.method === 'POST')).toEqual([
      { method: 'POST', path: '/api/sync-keys/begin', body: { name: 'iPhone Health' } },
      { method: 'POST', path: '/api/sync-keys/finish', body: assertion },
    ])

    await user.click(within(sheet).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByText('K7Q2-SECRET-KEY')).not.toBeInTheDocument())
    const list = await within(section).findByRole('list', { name: 'Sync Keys' })
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(/^iPhone Health\s*Created today · Never used/)
  })

  it('names the Sync Key as the Owner types it', async () => {
    const user = userEvent.setup()
    const { sent } = renderSettings([])

    const section = await syncKeysSection()
    const name = await within(section).findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Watch')
    await user.click(within(section).getByRole('button', { name: 'Create with Face ID' }))

    await waitFor(() => expect(sent.find((r) => r.path === '/api/sync-keys/begin')?.body).toEqual({ name: 'Watch' }))
  })

  it('says when Face ID was cancelled, and creates nothing', async () => {
    const user = userEvent.setup()
    const { sent } = renderSettings([], { passkeys: fakePasskeys(() => Promise.reject(new DOMException('cancelled', 'NotAllowedError'))) })

    const section = await syncKeysSection()
    await user.click(await within(section).findByRole('button', { name: 'Create with Face ID' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent("Face ID was cancelled, so no Sync Key was created.")
    expect(sent.some((r) => r.path === '/api/sync-keys/finish')).toBe(false)
  })

  it("says when the Passkey wasn't accepted, and keeps the Owner signed in", async () => {
    const user = userEvent.setup()
    renderSettings([], { answers: { 'POST /api/sync-keys/finish': { status: 403, body: 'that passkey is unknown or could not be verified' } } })

    const section = await syncKeysSection()
    await user.click(await within(section).findByRole('button', { name: 'Create with Face ID' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent("This Passkey wasn't accepted, or Face ID took too long, so no Sync Key was created.")
    expect(screen.getByRole('region', { name: 'Sync Keys' })).toBeInTheDocument()
  })

  it('asks before removing a Sync Key, then removes it', async () => {
    const user = userEvent.setup()
    const { sent } = renderSettings([{ id: 'k1', name: 'Old iPhone', createdAt: '2026-10-01T03:00:00Z', lastUsedAt: null }])

    const section = await syncKeysSection()
    await user.click(await within(section).findByRole('button', { name: 'Remove Old iPhone' }))
    const question = await screen.findByRole('alertdialog', { name: 'Remove Old iPhone?' })
    expect(question).toHaveTextContent('Automations using it will stop syncing.')
    await user.click(within(question).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(within(section).queryByRole('list', { name: 'Sync Keys' })).not.toBeInTheDocument())
    expect(sent.filter((r) => r.method === 'DELETE')).toEqual([{ method: 'DELETE', path: '/api/sync-keys/k1', body: undefined }])
  })
})
