import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../api/client'
import type { Passkeys } from '../identity/passkeys'
import type { Module, Registry } from '../module'
import { fakeApi, renderApp, withProviders } from '../../test/app'
import { appVersionLabel } from '../version'
import { createRoutes } from './routes'

function renderShell(registry: Registry, path = '/') {
  const router = createMemoryRouter(createRoutes(registry), { initialEntries: [path] })
  const api = createApiClient({ baseUrl: 'https://api.example.com', fetch: async () => new Response(null, { status: 204 }) })
  const passkeys: Passkeys = {
    get: () => Promise.reject(new Error('no Passkeys in the shell tests')),
    create: () => Promise.reject(new Error('no Passkeys in the shell tests')),
  }
  render(withProviders(<RouterProvider router={router} />, { api, passkeys }))
  return router
}

const registry: Registry = {
  core: {
    homeCards: [{ id: 'body', Component: () => <p>Latest Weigh-in: 72 kg</p> }],
    settingsSections: [
      { id: 'body', title: 'Body', Component: () => <label>Height (cm)<input /></label> },
    ],
  },
  modules: [
    {
      id: 'calories',
      name: 'Calories',
      path: '/calories',
      theme: 'theme-calories',
      icon: () => <svg />,
      routes: [{ index: true, element: <h1>Today's Entries</h1> }],
      homeCards: [{ id: 'calories', Component: () => <p>1200 / 1800 kcal</p> }],
      settingsSections: [
        { id: 'calories', title: 'Calories', Component: () => <label>Daily Limit (kcal)<input /></label> },
      ],
    },
  ],
}

// A Module with one screen, a heading with its name.
function module(name: string): Module {
  const id = name.toLowerCase()
  return {
    id,
    name,
    path: `/${id}`,
    theme: `theme-${id}`,
    icon: () => <svg />,
    routes: [{ index: true, element: <h1>{name} screen</h1> }],
    homeCards: [],
    settingsSections: [],
  }
}

function withModules(...names: string[]): Registry {
  return { core: { homeCards: [], settingsSections: [] }, modules: names.map(module) }
}

function tabNames() {
  return within(screen.getByRole('navigation', { name: 'Tabs' }))
    .getAllByRole('link')
    .map((link) => link.textContent)
}

describe('Core shell', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows Home Cards from Core and every Module on Home, Core first', () => {
    renderShell(registry, '/')

    const home = screen.getByRole('main')
    const cards = within(home).getAllByRole('article')
    expect(cards.map((card) => card.textContent)).toEqual([
      'Latest Weigh-in: 72 kg',
      '1200 / 1800 kcal',
    ])
  })

  it('dates Home with today in the Owner Time Zone', async () => {
    // Sunday 8 November, 20:00 UTC: already Monday 9 November in Tokyo.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-08T20:00:00Z'))
    const { api } = fakeApi({
      'GET /api/settings': {
        status: 200,
        body: { timeZone: 'Asia/Tokyo', heightCm: 175 },
      },
    })
    renderApp('/', api)

    expect(await screen.findByText('Monday, 9 November')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
  })

  it('shows every Settings Section on the Settings screen under its own heading, Core first', () => {
    renderShell(registry, '/settings')

    const settings = screen.getByRole('main')
    expect(within(settings).getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    const sections = within(settings).getAllByRole('heading', { level: 2 })
    expect(sections.map((heading) => heading.textContent)).toEqual(['Body', 'Calories'])
    expect(within(settings).getByLabelText('Height (cm)')).toBeInTheDocument()
    expect(within(settings).getByLabelText('Daily Limit (kcal)')).toBeInTheDocument()
  })

  it("ends the Settings screen with the app's version", () => {
    renderShell(registry, '/settings')

    // versionLabel itself, with and without a build number, is covered in version.test.ts.
    expect(within(screen.getByRole('main')).getByText(appVersionLabel)).toBeInTheDocument()
  })

  it('has a tab bar with Home, Modules and Settings, whatever the number of Modules', () => {
    renderShell(withModules('Calories'), '/')
    expect(tabNames()).toEqual(['Home', 'Modules', 'Settings'])
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    cleanup()

    renderShell(withModules('Calories', 'Habits', 'Money', 'Reading', 'Sleep'), '/')
    expect(tabNames()).toEqual(['Home', 'Modules', 'Settings'])
  })

  it('opens the Modules screen from its tab, listing every Module, and a Module opens with Modules still current', async () => {
    const user = userEvent.setup()
    const router = renderShell(withModules('Calories', 'Habits', 'Money', 'Reading', 'Sleep'), '/')

    const tabs = screen.getByRole('navigation', { name: 'Tabs' })
    await user.click(within(tabs).getByRole('link', { name: 'Modules' }))

    const modules = screen.getByRole('main')
    expect(within(modules).getByRole('heading', { level: 1, name: 'Modules' })).toBeInTheDocument()
    expect(within(modules).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Calories',
      'Habits',
      'Money',
      'Reading',
      'Sleep',
    ])
    expect(within(tabs).getByRole('link', { name: 'Modules' })).toHaveAttribute('aria-current', 'page')

    await user.click(within(modules).getByRole('link', { name: 'Reading' }))

    expect(router.state.location.pathname).toBe('/reading')
    expect(screen.getByRole('heading', { name: 'Reading screen' })).toBeInTheDocument()
    expect(within(tabs).getByRole('link', { name: 'Modules' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabs).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('returns to the last Module screen from the Modules tab, and opens the Modules screen when tapped on a Module', async () => {
    const user = userEvent.setup()
    const habits: Module = {
      ...module('Habits'),
      routes: [{ path: 'streaks/:id', element: <h1>Streak page</h1> }],
    }
    const router = renderShell({ core: { homeCards: [], settingsSections: [] }, modules: [module('Calories'), habits] }, '/')
    const tabs = screen.getByRole('navigation', { name: 'Tabs' })

    // With no Module visited yet, it opens the Modules screen.
    await user.click(within(tabs).getByRole('link', { name: 'Modules' }))
    expect(router.state.location.pathname).toBe('/modules')

    await router.navigate('/habits/streaks/7')
    await user.click(within(tabs).getByRole('link', { name: 'Home' }))
    expect(router.state.location.pathname).toBe('/')

    await user.click(within(tabs).getByRole('link', { name: 'Modules' }))
    expect(router.state.location.pathname).toBe('/habits/streaks/7')
    expect(screen.getByRole('heading', { name: 'Streak page' })).toBeInTheDocument()

    await user.click(within(tabs).getByRole('link', { name: 'Modules' }))
    expect(router.state.location.pathname).toBe('/modules')

    // Back on the Modules screen, the tab keeps it there.
    await user.click(within(tabs).getByRole('link', { name: 'Settings' }))
    await user.click(within(tabs).getByRole('link', { name: 'Modules' }))
    expect(router.state.location.pathname).toBe('/modules')
  })
})
