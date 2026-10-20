import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Registry } from '../module'
import { createRoutes } from './routes'

function renderShell(registry: Registry, path = '/') {
  const router = createMemoryRouter(createRoutes(registry), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
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
      routes: [{ index: true, element: <h1>Today's Entries</h1> }],
      homeCards: [{ id: 'calories', Component: () => <p>1200 / 1800 kcal</p> }],
      settingsSections: [
        { id: 'calories', title: 'Calories', Component: () => <label>Daily Limit (kcal)<input /></label> },
      ],
    },
  ],
}

describe('Core shell', () => {
  it('shows Home Cards from Core and every Module on Home, Core first', () => {
    renderShell(registry, '/')

    const home = screen.getByRole('main')
    const cards = within(home).getAllByRole('article')
    expect(cards.map((card) => card.textContent)).toEqual([
      'Latest Weigh-in: 72 kg',
      '1200 / 1800 kcal',
    ])
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

  it("opens a menu listing every Module, and picking one shows that Module's screen", async () => {
    const user = userEvent.setup()
    const router = renderShell(registry, '/')

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = screen.getByRole('navigation')
    expect(within(menu).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Home',
      'Calories',
      'Settings',
    ])

    await user.click(within(menu).getByRole('link', { name: 'Calories' }))

    expect(router.state.location.pathname).toBe('/calories')
    expect(screen.getByRole('heading', { name: "Today's Entries" })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
