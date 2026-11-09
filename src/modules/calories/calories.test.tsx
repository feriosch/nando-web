import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, noPush, renderApp, type Answer, type Answers } from '../../test/app'
import { addDays } from '../../core/days'
import { calories } from '.'

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175, weighInReminder: { enabled: false, weekday: 'monday', time: '08:00' } }

type Entry = { id: string; day: string; mealId: string | null; name: string; kcalPerServing: number; servings: number; kcal: number; loggedAt: string }

function entry(fields: Partial<Entry> & Pick<Entry, 'id' | 'day' | 'name' | 'kcalPerServing'>): Entry {
  const servings = fields.servings ?? 1
  return { mealId: null, servings, kcal: fields.kcalPerServing * servings, loggedAt: '2026-11-09T03:00:00Z', ...fields }
}

// A Day view as GET /api/calories/days/{day} answers it, worked out from `entries` and `dailyLimit`.
function dayView(day: string, entries: Entry[], dailyLimit: number | null = 2000) {
  const consumedCalories = entries.length === 0 ? null : entries.reduce((sum, e) => sum + e.kcal, 0)
  return {
    day,
    consumedCalories,
    dailyLimit,
    remaining: consumedCalories === null || dailyLimit === null ? null : dailyLimit - consumedCalories,
    overLimit: consumedCalories === null ? null : dailyLimit !== null && consumedCalories > dailyLimit,
    entries,
  }
}

type Meal = {
  id: string
  name: string
  kcal: number
  store: string | null
  emoji: string | null
  imageUrl: string | null
  tags: string[]
  pinned: boolean
  archived: boolean
}

function meal(fields: Partial<Meal> & Pick<Meal, 'id' | 'name' | 'kcal'>): Meal {
  return { store: null, emoji: null, imageUrl: null, tags: [], pinned: false, archived: false, ...fields }
}

// The Calories API for one Day in the Editable Window, faked with state: Entries logged on `day`
// show in its Day view, and the preview adds the kcal asked about to the Day.
function caloriesServer({ day, entries: initialEntries = [], meals = [], dailyLimit = 2000 }: { day: string; entries?: Entry[]; meals?: Meal[]; dailyLimit?: number | null }) {
  let entries = [...initialEntries]
  let nextId = 1
  const answers: Answers = {
    [`GET /api/calories/days/${day}`]: () => ({ status: 200, body: dayView(day, entries, dailyLimit) }),
    [`GET /api/calories/days/${day}/preview`]: (_, query) => {
      const others = entries.filter((e) => e.id !== query.get('replacing'))
      const consumedCalories = others.reduce((sum, e) => sum + e.kcal, 0) + Number(query.get('kcal'))
      const { entries: _entries, ...summary } = dayView(day, [entry({ id: 'x', day, name: 'x', kcalPerServing: consumedCalories })], dailyLimit)
      return { status: 200, body: summary }
    },
    [`POST /api/calories/days/${day}/entries`]: (body) => {
      const sent = body as { mealId?: string; name?: string; kcalPerServing?: number; servings: number }
      const from = sent.mealId === undefined ? undefined : meals.find((m) => m.id === sent.mealId)!
      const id = `new${nextId++}`
      entries.push(
        entry({ id, day, mealId: from?.id ?? null, name: from?.name ?? sent.name!, kcalPerServing: from?.kcal ?? sent.kcalPerServing!, servings: sent.servings }),
      )
      return { status: 201, body: { id } }
    },
    'GET /api/calories/meals/quick': () => ({ status: 200, body: meals.filter((m) => !m.archived) }),
  }
  for (const { id } of entries) {
    answers[`PUT /api/calories/entries/${id}`] = (body) => {
      const sent = body as Pick<Entry, 'name' | 'kcalPerServing' | 'servings'>
      const at = entries.findIndex((e) => e.id === id)
      entries[at] = { ...entries[at], ...sent, kcal: sent.kcalPerServing * sent.servings }
      return { status: 204 }
    }
    answers[`DELETE /api/calories/entries/${id}`] = () => {
      entries = entries.filter((e) => e.id !== id)
      return { status: 204 }
    }
  }
  return answers
}

// The quick list on the Day view, and the row in it for the Meal called `name`.
async function quickRow(name: string) {
  const list = await screen.findByRole('list', { name: 'Quick list' })
  return (await within(list).findByRole('button', { name: new RegExp(name) })).closest('li') as HTMLElement
}

function renderCalories(path: string, answers: Answers) {
  const fake = fakeApi({ 'GET /api/settings': { status: 200, body: tokyo }, ...answers })
  const router = renderApp(path, fake.api, noPush, [calories])
  return { ...fake, router }
}

beforeEach(() => {
  // Sunday 8 November 2026, 20:00 UTC: already Monday 9 November, 05:00, in Tokyo.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-08T20:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Day view', () => {
  it("opens on today in the Owner Time Zone, with its Entries, Consumed Calories, Daily Limit and what's left", async () => {
    renderCalories('/calories', {
      'GET /api/calories/days/2026-11-09': {
        status: 200,
        body: dayView('2026-11-09', [
          entry({ id: 'e1', day: '2026-11-09', name: 'Tuna mayo onigiri', kcalPerServing: 230 }),
          entry({ id: 'e2', day: '2026-11-09', name: 'Sushi', kcalPerServing: 45, servings: 12 }),
        ], 2150),
      },
      'GET /api/calories/meals/quick': { status: 200, body: [] },
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Today, Mon 9 Nov' })).toBeInTheDocument()
    expect(await screen.findByText('770 / 2,150 kcal')).toBeInTheDocument()
    expect(screen.getByText('1,380 kcal left')).toBeInTheDocument()
    const entries = screen.getByRole('list', { name: 'Entries' })
    const items = within(entries).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Tuna mayo onigiri: 230 kcal')
    expect(items[1]).toHaveTextContent('Sushi × 12: 540 kcal')
  })
})

describe('Quick list', () => {
  it('logs a Meal in one tap, with the Servings chosen on its stepper', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories(
      '/calories',
      caloriesServer({
        day: '2026-11-09',
        meals: [
          meal({ id: 'm1', name: 'Tuna mayo onigiri', kcal: 230, emoji: '🍙', pinned: true }),
          meal({ id: 'm2', name: 'Salmon nigiri', kcal: 45 }),
        ],
      }),
    )

    const sushi = await quickRow('Salmon nigiri')
    expect(sushi).toHaveTextContent('45 kcal')
    await user.click(within(sushi).getByRole('button', { name: 'More servings' }))
    await user.click(within(sushi).getByRole('button', { name: 'More servings' }))
    await user.click(within(sushi).getByRole('button', { name: 'Fewer servings' }))
    expect(within(sushi).getByLabelText('Servings')).toHaveTextContent('2')
    await user.click(within(sushi).getByRole('button', { name: /Salmon nigiri/ }))

    const entries = screen.getByRole('list', { name: 'Entries' })
    expect(await within(entries).findByText(/Salmon nigiri × 2: 90 kcal/)).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      { method: 'POST', path: '/api/calories/days/2026-11-09/entries', body: { mealId: 'm2', servings: 2 } },
    ])
    // Back to 1 for the next one.
    expect(within(await quickRow('Salmon nigiri')).getByLabelText('Servings')).toHaveTextContent('1')
  })
})

describe('Over-limit preview', () => {
  const nearlyFull = () =>
    caloriesServer({
      day: '2026-11-09',
      dailyLimit: 2150,
      entries: [entry({ id: 'e1', day: '2026-11-09', name: 'Katsu curry', kcalPerServing: 2070 })],
      meals: [meal({ id: 'm1', name: 'Tuna mayo onigiri', kcal: 230 })],
    })

  it('says where an Entry would take the Day before logging it over the Daily Limit, and logs it only when told to', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories', nearlyFull())

    await user.click(within(await quickRow('Tuna mayo onigiri')).getByRole('button', { name: /Tuna mayo onigiri/ }))

    const warning = await screen.findByRole('alertdialog')
    expect(warning).toHaveTextContent('This takes you to 2,300 / 2,150 kcal.')
    expect(sent.filter((request) => request.method === 'POST')).toEqual([])

    await user.click(within(warning).getByRole('button', { name: 'Log anyway' }))

    expect(await within(screen.getByRole('list', { name: 'Entries' })).findByText(/Tuna mayo onigiri: 230 kcal/)).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      { method: 'POST', path: '/api/calories/days/2026-11-09/entries', body: { mealId: 'm1', servings: 1 } },
    ])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it("logs nothing when the Owner cancels", async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories', nearlyFull())

    await user.click(within(await quickRow('Tuna mayo onigiri')).getByRole('button', { name: /Tuna mayo onigiri/ }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST')).toEqual([])
    expect(screen.getByText('2,070 / 2,150 kcal')).toBeInTheDocument()
  })
})

describe('One-off Entry', () => {
  it('logs something typed in, with its kcal per serving and Servings, and can save it as a Meal', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories', caloriesServer({ day: '2026-11-09' }))

    const form = await screen.findByRole('form', { name: 'Something else' })
    await user.type(within(form).getByLabelText('Name'), 'Sushi')
    await user.type(within(form).getByLabelText('kcal per serving'), '45')
    await user.clear(within(form).getByLabelText('Servings'))
    await user.type(within(form).getByLabelText('Servings'), '12')
    await user.click(within(form).getByLabelText('Save as Meal'))
    await user.click(within(form).getByRole('button', { name: 'Log' }))

    expect(await within(screen.getByRole('list', { name: 'Entries' })).findByText(/Sushi × 12: 540 kcal/)).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      {
        method: 'POST',
        path: '/api/calories/days/2026-11-09/entries',
        body: { name: 'Sushi', kcalPerServing: 45, servings: 12, saveAsMeal: true },
      },
    ])
    // Empty again for the next one.
    expect(within(form).getByLabelText('Name')).toHaveValue('')
    expect(within(form).getByLabelText('Servings')).toHaveValue('1')
    expect(within(form).getByLabelText('Save as Meal')).not.toBeChecked()
  })

  it.each([
    ['', '45', '1'],
    ['Sushi', 'lots', '1'],
    ['Sushi', '45.5', '1'],
    ['Sushi', '10001', '1'],
    ['Sushi', '45', '0'],
    ['Sushi', '45', '1.5'],
    ['Sushi', '45', '101'],
  ])("doesn't log name %j, %j kcal × %j, and says what an Entry needs", async (name, kcalPerServing, servings) => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories', caloriesServer({ day: '2026-11-09' }))

    const form = await screen.findByRole('form', { name: 'Something else' })
    if (name) await user.type(within(form).getByLabelText('Name'), name)
    await user.type(within(form).getByLabelText('kcal per serving'), kcalPerServing)
    await user.clear(within(form).getByLabelText('Servings'))
    await user.type(within(form).getByLabelText('Servings'), servings)
    await user.click(within(form).getByRole('button', { name: 'Log' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Enter a name, kcal per serving as a whole number from 0 to 10,000, and Servings from 1 to 100.',
    )
    expect(sent.filter((request) => request.method === 'POST' || request.path.endsWith('/preview'))).toEqual([])
  })
})

describe('Choosing a Day', () => {
  it('picks any Day in the Editable Window, today and the 7 Days before it, and logs on that Day', async () => {
    const user = userEvent.setup()
    const thursday = caloriesServer({
      day: '2026-11-05',
      entries: [entry({ id: 'e1', day: '2026-11-05', name: 'Ramen', kcalPerServing: 800 })],
      meals: [meal({ id: 'm1', name: 'Tuna mayo onigiri', kcal: 230 })],
    })
    const { sent, router } = renderCalories('/calories', { ...caloriesServer({ day: '2026-11-09' }), ...thursday })

    const picker = await screen.findByLabelText('Day')
    expect(picker).toHaveAttribute('min', '2026-11-02')
    expect(picker).toHaveAttribute('max', '2026-11-09')
    // The iPhone's date picker sets the whole date at once.
    fireEvent.change(picker, { target: { value: '2026-11-05' } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Thu 5 Nov' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?day=2026-11-05')
    expect(await screen.findByText('800 / 2,000 kcal')).toBeInTheDocument()
    await user.click(within(await quickRow('Tuna mayo onigiri')).getByRole('button', { name: /Tuna mayo onigiri/ }))

    expect(await screen.findByText('1,030 / 2,000 kcal')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      { method: 'POST', path: '/api/calories/days/2026-11-05/entries', body: { mealId: 'm1', servings: 1 } },
    ])
  })

  it('shows a Day before the Editable Window read-only', async () => {
    renderCalories('/calories?day=2026-11-01', {
      'GET /api/calories/days/2026-11-01': {
        status: 200,
        body: dayView('2026-11-01', [entry({ id: 'e1', day: '2026-11-01', name: 'Ramen', kcalPerServing: 800 })]),
      },
      'GET /api/calories/meals/quick': { status: 200, body: [meal({ id: 'm1', name: 'Tuna mayo onigiri', kcal: 230 })] },
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Sun 1 Nov' })).toBeInTheDocument()
    expect(await screen.findByText('800 / 2,000 kcal')).toBeInTheDocument()
    expect(screen.getByText('This Day can no longer be changed.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Quick list' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Something else' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Entries' })).queryByRole('button')).not.toBeInTheDocument()
  })

  it('says an Unlogged Day has nothing logged, rather than 0 kcal', async () => {
    renderCalories('/calories', caloriesServer({ day: '2026-11-09' }))

    expect(await screen.findByText('Nothing logged.')).toBeInTheDocument()
    expect(screen.queryByText(/0 kcal|kcal left/)).not.toBeInTheDocument()
  })
})

describe('Changing Entries', () => {
  const lunch = () =>
    caloriesServer({
      day: '2026-11-09',
      dailyLimit: 2150,
      entries: [
        entry({ id: 'e1', day: '2026-11-09', name: 'Katsu curry', kcalPerServing: 1000 }),
        entry({ id: 'e2', day: '2026-11-09', name: 'Sushi', kcalPerServing: 45, servings: 12 }),
      ],
    })

  // The Entry in the Day view whose text includes `text`.
  async function entryItem(text: string) {
    const entries = await screen.findByRole('list', { name: 'Entries' })
    return (await within(entries).findByText(new RegExp(text))).closest('li') as HTMLElement
  }

  it("changes an Entry's name, kcal per serving and Servings", async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories', lunch())

    await user.click(within(await entryItem('Sushi × 12')).getByRole('button', { name: 'Edit' }))
    const form = await screen.findByRole('form', { name: 'Edit Entry' })
    expect(within(form).getByLabelText('Name')).toHaveValue('Sushi')
    expect(within(form).getByLabelText('kcal per serving')).toHaveValue('45')
    expect(within(form).getByLabelText('Servings')).toHaveValue('12')
    await user.type(within(form).getByLabelText('Name'), ' (salmon)')
    await user.clear(within(form).getByLabelText('kcal per serving'))
    await user.type(within(form).getByLabelText('kcal per serving'), '50')
    await user.clear(within(form).getByLabelText('Servings'))
    await user.type(within(form).getByLabelText('Servings'), '10')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await entryItem('Sushi \\(salmon\\) × 10: 500 kcal')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Edit Entry' })).not.toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([
      { method: 'PUT', path: '/api/calories/entries/e2', body: { name: 'Sushi (salmon)', kcalPerServing: 50, servings: 10 } },
    ])
    expect(screen.getByText('1,500 / 2,150 kcal')).toBeInTheDocument()
  })

  it('warns before a change takes the Day over the Daily Limit, counting the Entry once', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories', lunch())

    await user.click(within(await entryItem('Sushi × 12')).getByRole('button', { name: 'Edit' }))
    const form = await screen.findByRole('form', { name: 'Edit Entry' })
    await user.clear(within(form).getByLabelText('Servings'))
    await user.type(within(form).getByLabelText('Servings'), '30')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    const warning = await screen.findByRole('alertdialog')
    expect(warning).toHaveTextContent('This takes you to 2,350 / 2,150 kcal.')
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([])
    await user.click(within(warning).getByRole('button', { name: 'Save anyway' }))

    expect(await entryItem('Sushi × 30: 1,350 kcal')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toHaveLength(1)
  })

  it('deletes an Entry', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories', lunch())

    await user.click(within(await entryItem('Katsu curry')).getByRole('button', { name: 'Edit' }))
    await user.click(within(await screen.findByRole('form', { name: 'Edit Entry' })).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('540 / 2,150 kcal')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Entries' })).queryByText(/Katsu curry/)).not.toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'DELETE')).toEqual([
      { method: 'DELETE', path: '/api/calories/entries/e1', body: undefined },
    ])
  })
})

// The Calories API's Meals, faked with state.
function mealsServer(initial: Meal[]) {
  let meals = [...initial]
  let nextId = 1
  const byName = (a: Meal, b: Meal) => a.name.localeCompare(b.name)
  const answers: Answers = {
    'GET /api/calories/meals': (_, query) => ({
      status: 200,
      body: meals.filter((m) => m.archived === (query.get('archived') === 'true')).sort(byName),
    }),
    'POST /api/calories/meals': (body) => {
      const id = `new${nextId++}`
      meals.push({ ...(body as Omit<Meal, 'id' | 'archived'>), id, archived: false })
      answers[`PUT /api/calories/meals/${id}`] = put(id)
      return { status: 201, body: { id } }
    },
  }
  const put = (id: string) => (body: unknown): Answer => {
    meals = meals.map((m) => (m.id === id ? { ...(body as Meal), id, archived: m.archived } : m))
    return { status: 204 }
  }
  for (const { id } of initial) {
    answers[`PUT /api/calories/meals/${id}`] = put(id)
    answers[`DELETE /api/calories/meals/${id}`] = () => {
      meals = meals.map((m) => (m.id === id ? { ...m, archived: true } : m))
      return { status: 204 }
    }
    answers[`POST /api/calories/meals/${id}/restore`] = () => {
      meals = meals.map((m) => (m.id === id ? { ...m, archived: false } : m))
      return { status: 204 }
    }
  }
  return answers
}

const onigiri = meal({
  id: 'm1',
  name: 'Tuna mayo onigiri',
  kcal: 230,
  store: '7-Eleven',
  emoji: '🍙',
  imageUrl: 'https://storage.googleapis.com/nando-meals/onigiri.jpg',
  tags: ['snack', 'conbini'],
  pinned: true,
})
const nigiri = meal({ id: 'm2', name: 'Salmon nigiri', kcal: 45 })

// The Meal called `name` in the list of Meals in use.
async function mealItem(name: string, list = 'Meals') {
  const meals = await screen.findByRole('list', { name: list })
  return (await within(meals).findByText(new RegExp(name))).closest('li') as HTMLElement
}

describe('Meals', () => {
  it('lists the Meals in use by name, with their kcal, store, Tags and photo, opened from the Day view', async () => {
    const user = userEvent.setup()
    const { router } = renderCalories('/calories', { ...caloriesServer({ day: '2026-11-09' }), ...mealsServer([onigiri, nigiri]) })

    await user.click(await screen.findByRole('link', { name: 'Meals' }))

    expect(router.state.location.pathname).toBe('/calories/meals')
    expect(await screen.findByRole('heading', { level: 1, name: 'Meals' })).toBeInTheDocument()
    const items = within(await screen.findByRole('list', { name: 'Meals' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Salmon nigiri')
    expect(items[1]).toHaveTextContent('🍙 Tuna mayo onigiri')
    expect(items[1]).toHaveTextContent('230 kcal')
    expect(items[1]).toHaveTextContent('7-Eleven')
    expect(items[1]).toHaveTextContent('snack, conbini')
    expect(items[1]).toHaveTextContent('Pinned')
    expect(within(items[1]).getByRole('img', { name: 'Tuna mayo onigiri' })).toHaveAttribute('src', onigiri.imageUrl)
    expect(within(items[0]).queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('Creating a Meal', () => {
  it('saves a new Meal with its emoji, store, Tags and pin, and lists it', async () => {
    const user = userEvent.setup()
    const { sent, router } = renderCalories('/calories/meals', mealsServer([nigiri]))

    await user.click(await screen.findByRole('link', { name: 'New Meal' }))
    const form = await screen.findByRole('form', { name: 'New Meal' })
    await user.type(within(form).getByLabelText('Name'), '  Tuna mayo onigiri ')
    await user.type(within(form).getByLabelText('kcal per serving'), '230')
    await user.type(within(form).getByLabelText('Store'), '7-Eleven')
    await user.type(within(form).getByLabelText('Emoji'), '🍙')
    await user.type(within(form).getByLabelText('Tags'), 'snack, conbini,, snack ')
    await user.click(within(form).getByLabelText('Pinned'))
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await mealItem('Tuna mayo onigiri')).toHaveTextContent('🍙 Tuna mayo onigiri 230 kcal · Pinned')
    expect(router.state.location.pathname).toBe('/calories/meals')
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      {
        method: 'POST',
        path: '/api/calories/meals',
        body: { name: 'Tuna mayo onigiri', kcal: 230, store: '7-Eleven', emoji: '🍙', imageUrl: null, tags: ['snack', 'conbini'], pinned: true },
      },
    ])
  })

  it('saves a Meal without a store, emoji or Tags as having none', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories/meals/new', mealsServer([]))

    const form = await screen.findByRole('form', { name: 'New Meal' })
    await user.type(within(form).getByLabelText('Name'), 'Salmon nigiri')
    await user.type(within(form).getByLabelText('kcal per serving'), '45')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await mealItem('Salmon nigiri')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST').map((request) => request.body)).toEqual([
      { name: 'Salmon nigiri', kcal: 45, store: null, emoji: null, imageUrl: null, tags: [], pinned: false },
    ])
  })

  it.each([
    ['', '45'],
    ['Salmon nigiri', '4.5'],
    ['Salmon nigiri', '10001'],
  ])("doesn't save name %j with %j kcal, and says what a Meal needs", async (name, kcalPerServing) => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories/meals/new', mealsServer([]))

    const form = await screen.findByRole('form', { name: 'New Meal' })
    if (name) await user.type(within(form).getByLabelText('Name'), name)
    await user.type(within(form).getByLabelText('kcal per serving'), kcalPerServing)
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Enter a name and kcal per serving as a whole number from 0 to 10,000.',
    )
    expect(sent.filter((request) => request.method === 'POST')).toEqual([])
  })

  it('says what the server refused, such as an emoji that is too long', async () => {
    const user = userEvent.setup()
    renderCalories('/calories/meals/new', { 'POST /api/calories/meals': { status: 400, body: 'emoji must be one emoji' } })

    const form = await screen.findByRole('form', { name: 'New Meal' })
    await user.type(within(form).getByLabelText('Name'), 'Salmon nigiri')
    await user.type(within(form).getByLabelText('kcal per serving'), '45')
    await user.type(within(form).getByLabelText('Emoji'), '🍣🍣🍣🍣🍣🍣🍣🍣🍣')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent("Couldn't save the Meal: emoji must be one emoji")
  })
})

describe('Changing a Meal', () => {
  it('changes a Meal from the Meals screen, keeping its photo, which it shows', async () => {
    const user = userEvent.setup()
    const { sent, router } = renderCalories('/calories/meals', mealsServer([onigiri, nigiri]))

    await user.click(within(await mealItem('Tuna mayo onigiri')).getByRole('link', { name: '🍙 Tuna mayo onigiri' }))
    expect(router.state.location.pathname).toBe('/calories/meals/m1')
    const form = await screen.findByRole('form', { name: 'Edit Meal' })
    expect(within(form).getByRole('img', { name: 'Tuna mayo onigiri' })).toHaveAttribute('src', onigiri.imageUrl)
    expect(within(form).getByLabelText('Name')).toHaveValue('Tuna mayo onigiri')
    expect(within(form).getByLabelText('Store')).toHaveValue('7-Eleven')
    expect(within(form).getByLabelText('Emoji')).toHaveValue('🍙')
    expect(within(form).getByLabelText('Tags')).toHaveValue('snack, conbini')
    expect(within(form).getByLabelText('Pinned')).toBeChecked()
    const kcalInput = within(form).getByLabelText('kcal per serving')
    expect(kcalInput).toHaveValue('230')
    await user.clear(kcalInput)
    await user.type(kcalInput, '240')
    await user.click(within(form).getByLabelText('Pinned'))
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await mealItem('Tuna mayo onigiri')).toHaveTextContent('🍙 Tuna mayo onigiri 240 kcal')
    expect(await mealItem('Tuna mayo onigiri')).not.toHaveTextContent('Pinned')
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([
      {
        method: 'PUT',
        path: '/api/calories/meals/m1',
        body: {
          name: 'Tuna mayo onigiri',
          kcal: 240,
          store: '7-Eleven',
          emoji: '🍙',
          imageUrl: onigiri.imageUrl,
          tags: ['snack', 'conbini'],
          pinned: false,
        },
      },
    ])
  })

  it('says when there is no such Meal', async () => {
    renderCalories('/calories/meals/gone', mealsServer([nigiri]))

    expect(await screen.findByText('There is no such Meal.')).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
})

describe('Archiving a Meal', () => {
  it('archives a Meal, which then shows under Archived, and restores it from there', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories/meals/m2', mealsServer([onigiri, nigiri]))

    await user.click(within(await screen.findByRole('form', { name: 'Edit Meal' })).getByRole('button', { name: 'Archive' }))

    const archivedItem = await mealItem('Salmon nigiri', 'Archived')
    expect(within(screen.getByRole('list', { name: 'Meals' })).queryByText(/Salmon nigiri/)).not.toBeInTheDocument()

    await user.click(within(archivedItem).getByRole('button', { name: 'Restore' }))

    expect(await mealItem('Salmon nigiri')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Archived' })).not.toBeInTheDocument())
    expect(sent.filter((request) => request.method === 'DELETE' || request.path.endsWith('/restore'))).toEqual([
      { method: 'DELETE', path: '/api/calories/meals/m2', body: undefined },
      { method: 'POST', path: '/api/calories/meals/m2/restore', body: undefined },
    ])
  })

  it('edits an archived Meal, which stays archived, and restores it from its own screen', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories/meals/m2', mealsServer([{ ...nigiri, archived: true }]))

    const form = await screen.findByRole('form', { name: 'Edit Meal' })
    expect(within(form).getByText('Archived: it is not in the quick list and can’t be logged.')).toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Restore' }))

    expect(await mealItem('Salmon nigiri')).toBeInTheDocument()
    expect(sent.filter((request) => request.path.endsWith('/restore'))).toHaveLength(1)
  })
})

describe('When something fails', () => {
  it("says when the Day couldn't load, and loads it again when asked", async () => {
    const user = userEvent.setup()
    const server = caloriesServer({ day: '2026-11-09', entries: [entry({ id: 'e1', day: '2026-11-09', name: 'Ramen', kcalPerServing: 800 })] })
    let fails = true
    renderCalories('/calories', {
      ...server,
      'GET /api/calories/days/2026-11-09': (body, query) => (fails ? { status: 500 } : (server['GET /api/calories/days/2026-11-09'] as (b: unknown, q: URLSearchParams) => Answer)(body, query)),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the Day.")
    fails = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('800 / 2,000 kcal')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("says the Day can no longer be changed when it left the Editable Window while open", async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/calories', {
      ...caloriesServer({ day: '2026-11-09', meals: [nigiri] }),
      'GET /api/calories/days/2026-11-09/preview': { status: 409, body: 'day is not editable' },
    })

    await user.click(within(await quickRow('Salmon nigiri')).getByRole('button', { name: /Salmon nigiri/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That Day can no longer be changed. Only today and the 7 Days before it can.',
    )
    expect(sent.filter((request) => request.method === 'POST')).toEqual([])
  })

  it("says when an Entry couldn't be logged", async () => {
    const user = userEvent.setup()
    renderCalories('/calories', {
      ...caloriesServer({ day: '2026-11-09', meals: [nigiri] }),
      'POST /api/calories/days/2026-11-09/entries': { status: 500 },
    })

    await user.click(within(await quickRow('Salmon nigiri')).getByRole('button', { name: /Salmon nigiri/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't log the Entry.")
  })

  it("says when an Entry couldn't be changed", async () => {
    const user = userEvent.setup()
    renderCalories('/calories', {
      ...caloriesServer({ day: '2026-11-09', entries: [entry({ id: 'e1', day: '2026-11-09', name: 'Ramen', kcalPerServing: 800 })] }),
      'PUT /api/calories/entries/e1': { status: 409, body: 'day is not editable' },
    })

    const entries = await screen.findByRole('list', { name: 'Entries' })
    await user.click(await within(entries).findByRole('button', { name: 'Edit' }))
    await user.click(within(await screen.findByRole('form', { name: 'Edit Entry' })).getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That Day can no longer be changed. Only today and the 7 Days before it can.',
    )
  })

  it("says when the Meals couldn't load, and loads them again when asked", async () => {
    const user = userEvent.setup()
    const server = mealsServer([nigiri])
    let fails = true
    renderCalories('/calories/meals', {
      ...server,
      'GET /api/calories/meals': (body, query) => (fails ? { status: 500 } : (server['GET /api/calories/meals'] as (b: unknown, q: URLSearchParams) => Answer)(body, query)),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your Meals.")
    fails = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await mealItem('Salmon nigiri')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("says when the quick list couldn't load, and loads it again when asked", async () => {
    const user = userEvent.setup()
    let fails = true
    renderCalories('/calories', {
      ...caloriesServer({ day: '2026-11-09' }),
      'GET /api/calories/meals/quick': () => (fails ? { status: 500 } : { status: 200, body: [nigiri] }),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your Meals.")
    fails = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await quickRow('Salmon nigiri')).toBeInTheDocument()
  })

  it("says when the Meal to edit couldn't load, and loads it again when asked", async () => {
    const user = userEvent.setup()
    const server = mealsServer([nigiri])
    let fails = true
    renderCalories('/calories/meals/m2', {
      ...server,
      'GET /api/calories/meals': (body, query) => (fails ? { status: 500 } : (server['GET /api/calories/meals'] as (b: unknown, q: URLSearchParams) => Answer)(body, query)),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the Meal.")
    fails = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(within(await screen.findByRole('form', { name: 'Edit Meal' })).getByLabelText('Name')).toHaveValue('Salmon nigiri')
  })
})

describe('A new Day', () => {
  it('moves on to the new Day when the Owner comes back to the app after midnight', async () => {
    renderCalories('/calories', { ...caloriesServer({ day: '2026-11-09', meals: [nigiri] }), ...caloriesServer({ day: '2026-11-10', meals: [nigiri] }) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Today, Mon 9 Nov' })).toBeInTheDocument()
    await quickRow('Salmon nigiri')

    // Tuesday 10 November, 05:00 in Tokyo, when the Owner comes back to the open app.
    vi.setSystemTime(new Date('2026-11-09T20:00:00Z'))
    fireEvent(document, new Event('visibilitychange'))

    expect(await screen.findByRole('heading', { level: 1, name: 'Today, Tue 10 Nov' })).toBeInTheDocument()
    expect(screen.getByLabelText('Day')).toHaveAttribute('min', '2026-11-03')
  })

  it('moves on to the new Day at midnight while the screen stays open', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-11-08T20:00:00Z'))
    renderCalories('/calories', { ...caloriesServer({ day: '2026-11-09', meals: [nigiri] }), ...caloriesServer({ day: '2026-11-10', meals: [nigiri] }) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Today, Mon 9 Nov' })).toBeInTheDocument()
    await quickRow('Salmon nigiri')

    // Tuesday 10 November, 00:00 in Tokyo.
    vi.setSystemTime(new Date('2026-11-09T15:00:00Z'))
    vi.advanceTimersByTime(60_000)

    expect(await screen.findByRole('heading', { level: 1, name: 'Today, Tue 10 Nov' })).toBeInTheDocument()
  })
})

describe('Review fixes', () => {
  it('logs once when the Owner taps a quick-list Meal twice in a row', async () => {
    const { sent } = renderCalories('/calories', caloriesServer({ day: '2026-11-09', meals: [nigiri] }))

    // The second tap lands while the first log is still under way.
    const meal = within(await quickRow('Salmon nigiri')).getByRole('button', { name: /Salmon nigiri/ })
    fireEvent.click(meal)
    fireEvent.click(meal)

    expect(await within(screen.getByRole('list', { name: 'Entries' })).findByText(/Salmon nigiri: 45 kcal/)).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST')).toHaveLength(1)
  })

  it("drops an over-limit warning when the Owner picks another Day, so it can't log there", async () => {
    const user = userEvent.setup()
    const today = caloriesServer({
      day: '2026-11-09',
      dailyLimit: 2150,
      entries: [entry({ id: 'e1', day: '2026-11-09', name: 'Katsu curry', kcalPerServing: 2070 })],
      meals: [onigiri],
    })
    const { sent } = renderCalories('/calories', { ...today, ...caloriesServer({ day: '2026-11-08', meals: [onigiri] }) })

    // Yesterday, loaded once already.
    fireEvent.change(await screen.findByLabelText('Day'), { target: { value: '2026-11-08' } })
    expect(await screen.findByRole('heading', { level: 1, name: 'Sun 8 Nov' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-11-09' } })
    await screen.findByText('2,070 / 2,150 kcal')

    await user.click(within(await quickRow('Tuna mayo onigiri')).getByRole('button', { name: /Tuna mayo onigiri/ }))
    await screen.findByRole('alertdialog')
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-11-08' } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Sun 8 Nov' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST')).toEqual([])
  })

  it.each(['2026-13-01', '2026-02-30'])('opens on today when ?day=%s is no real date', async (asked) => {
    renderCalories(`/calories?day=${asked}`, caloriesServer({ day: '2026-11-09' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Today, Mon 9 Nov' })).toBeInTheDocument()
  })

  it("says a Day that hasn't started yet can't be changed yet", async () => {
    renderCalories('/calories?day=2026-11-12', { 'GET /api/calories/days/2026-11-12': { status: 200, body: dayView('2026-11-12', []) } })

    expect(await screen.findByText('This Day hasn’t started yet.')).toBeInTheDocument()
    expect(screen.queryByText('This Day can no longer be changed.')).not.toBeInTheDocument()
  })
})

// The Calories Home Card on Home, found by its heading.
async function caloriesCard() {
  const heading = await screen.findByRole('heading', { name: 'Calories' })
  return heading.closest('article') as HTMLElement
}

describe('Calories Home Card', () => {
  it("shows today's Consumed Calories against the Daily Limit, and opens the Day view", async () => {
    const user = userEvent.setup()
    const { router } = renderCalories('/', {
      'GET /api/calories/home-card': {
        status: 200,
        body: { day: '2026-11-09', consumedCalories: 460, dailyLimit: 2000, remaining: 1540, overLimit: false },
      },
      ...caloriesServer({ day: '2026-11-09' }),
    })

    const card = await caloriesCard()
    expect(await within(card).findByText('460 / 2,000 kcal')).toBeInTheDocument()
    expect(within(card).getByText('1,540 kcal left')).toBeInTheDocument()
    await user.click(within(card).getByRole('link', { name: 'Today' }))

    expect(router.state.location.pathname).toBe('/calories')
    expect(await screen.findByRole('heading', { level: 1, name: 'Today, Mon 9 Nov' })).toBeInTheDocument()
  })

  it('says nothing is logged yet on an Unlogged Day, rather than 0 kcal', async () => {
    renderCalories('/', {
      'GET /api/calories/home-card': {
        status: 200,
        body: { day: '2026-11-09', consumedCalories: null, dailyLimit: 2000, remaining: null, overLimit: null },
      },
    })

    const card = await caloriesCard()
    expect(await within(card).findByText('Nothing logged.')).toBeInTheDocument()
    expect(within(card).queryByText(/0 kcal|kcal left/)).not.toBeInTheDocument()
  })

  it("says when it couldn't load, and loads again when asked", async () => {
    const user = userEvent.setup()
    let answer: Answer = { status: 500 }
    renderCalories('/', { 'GET /api/calories/home-card': () => answer })

    const card = await caloriesCard()
    expect(await within(card).findByRole('alert')).toHaveTextContent("Couldn't load today's Calories.")

    answer = { status: 200, body: { day: '2026-11-09', consumedCalories: 2100, dailyLimit: 2000, remaining: -100, overLimit: true } }
    await user.click(within(card).getByRole('button', { name: 'Try again' }))

    expect(await within(card).findByText('2,100 / 2,000 kcal')).toBeInTheDocument()
    expect(within(card).getByText('100 kcal over')).toBeInTheDocument()
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('moves on to the new Day at midnight while Home stays open', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-11-09T14:58:00Z'))
    let answer: Answer = { status: 200, body: { day: '2026-11-09', consumedCalories: 1700, dailyLimit: 1800, remaining: 100, overLimit: false } }
    renderCalories('/', { 'GET /api/calories/home-card': () => answer })

    const card = await caloriesCard()
    expect(await within(card).findByText('1,700 / 1,800 kcal')).toBeInTheDocument()

    // Tuesday 10 November, 00:00 in Tokyo: nothing logged yet.
    answer = { status: 200, body: { day: '2026-11-10', consumedCalories: null, dailyLimit: 1800, remaining: null, overLimit: null } }
    vi.setSystemTime(new Date('2026-11-09T15:00:00Z'))
    vi.advanceTimersByTime(60_000)

    expect(await within(card).findByText('Nothing logged.')).toBeInTheDocument()
  })
})

// GET /api/calories/history, faked: every Day from `from` to `to`, newest first, as `logged` has
// them (Consumed Calories and that Day's Daily Limit), and Unlogged otherwise.
function historyServer(logged: Record<string, { consumedCalories: number; dailyLimit: number | null }>, unloggedLimit: number | null = 2000) {
  const asked: { from: string; to: string }[] = []
  const answer = (_: unknown, query: URLSearchParams): Answer => {
    const from = query.get('from')!
    const to = query.get('to')!
    asked.push({ from, to })
    const days = []
    for (let day = to; day >= from; day = addDays(day, -1)) {
      const found = logged[day]
      const consumedCalories = found?.consumedCalories ?? null
      const dailyLimit = found ? found.dailyLimit : unloggedLimit
      days.push({
        day,
        consumedCalories,
        dailyLimit,
        remaining: consumedCalories === null || dailyLimit === null ? null : dailyLimit - consumedCalories,
        overLimit: consumedCalories === null ? null : dailyLimit !== null && consumedCalories > dailyLimit,
      })
    }
    return { status: 200, body: days }
  }
  return { answers: { 'GET /api/calories/history': answer } as Answers, asked }
}

describe('History', () => {
  it("lists today and the 29 Days before it, newest first, each with its Consumed Calories against that Day's Daily Limit", async () => {
    const history = historyServer({
      '2026-11-09': { consumedCalories: 460, dailyLimit: 1800 },
      '2026-11-07': { consumedCalories: 2100, dailyLimit: 2000 },
    })
    renderCalories('/calories/history', history.answers)

    expect(await screen.findByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
    const days = within(await screen.findByRole('list', { name: 'Days' })).getAllByRole('listitem')
    expect(days).toHaveLength(30)
    expect(days[0]).toHaveTextContent('Mon 9 Nov: 460 / 1,800 kcal')
    // An Unlogged Day isn't recorded, so it is never 0 kcal or under the Daily Limit.
    expect(days[1]).toHaveTextContent('Sun 8 Nov: not logged')
    expect(days[1]).not.toHaveTextContent(/kcal/)
    expect(days[2]).toHaveTextContent('Sat 7 Nov: 2,100 / 2,000 kcal')
    expect(days[29]).toHaveTextContent('Sun 11 Oct: not logged')
    expect(history.asked).toEqual([{ from: '2026-10-11', to: '2026-11-09' }])
  })

  it('shows just the Consumed Calories of a Day with no Daily Limit', async () => {
    renderCalories('/calories/history', historyServer({ '2026-11-09': { consumedCalories: 460, dailyLimit: null } }, null).answers)

    const days = within(await screen.findByRole('list', { name: 'Days' })).getAllByRole('listitem')
    expect(days[0]).toHaveTextContent(/^Mon 9 Nov: 460 kcal$/)
  })

  it('shows the 30 Days before those listed when asked for older ones', async () => {
    const user = userEvent.setup()
    const history = historyServer({ '2026-10-01': { consumedCalories: 1900, dailyLimit: 2200 } })
    renderCalories('/calories/history', history.answers)

    await screen.findByRole('list', { name: 'Days' })
    await user.click(screen.getByRole('button', { name: 'Show older' }))

    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Days' })).getAllByRole('listitem')).toHaveLength(60))
    const days = within(screen.getByRole('list', { name: 'Days' })).getAllByRole('listitem')
    expect(days[29]).toHaveTextContent('Sun 11 Oct: not logged')
    expect(days[39]).toHaveTextContent('Thu 1 Oct: 1,900 / 2,200 kcal')
    expect(days[59]).toHaveTextContent('Fri 11 Sept: not logged')
    expect(history.asked).toEqual([
      { from: '2026-10-11', to: '2026-11-09' },
      { from: '2026-09-11', to: '2026-10-10' },
    ])
  })

  it('is opened from the Day view, and opens each Day in it', async () => {
    const user = userEvent.setup()
    const { router } = renderCalories('/calories', {
      ...caloriesServer({ day: '2026-11-09' }),
      ...historyServer({ '2026-10-20': { consumedCalories: 800, dailyLimit: 2000 } }).answers,
      'GET /api/calories/days/2026-10-20': {
        status: 200,
        body: dayView('2026-10-20', [entry({ id: 'e1', day: '2026-10-20', name: 'Ramen', kcalPerServing: 800 })]),
      },
    })

    await user.click(await screen.findByRole('link', { name: 'History' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
    await user.click(await screen.findByRole('link', { name: /Tue 20 Oct/ }))

    expect(router.state.location.pathname).toBe('/calories')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tue 20 Oct' })).toBeInTheDocument()
    expect(await screen.findByText('Ramen: 800 kcal')).toBeInTheDocument()
  })

  it("says when it couldn't load, and loads it again when asked", async () => {
    const user = userEvent.setup()
    let failing = true
    const history = historyServer({ '2026-11-09': { consumedCalories: 460, dailyLimit: 1800 } })
    renderCalories('/calories/history', {
      'GET /api/calories/history': (body, query) => (failing ? { status: 500 } : (history.answers['GET /api/calories/history'] as (b: unknown, q: URLSearchParams) => Answer)(body, query)),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the history.")
    failing = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Mon 9 Nov: 460 / 1,800 kcal')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('loads the older Days again when "Show older" failed and the Owner tries again', async () => {
    const user = userEvent.setup()
    const history = historyServer({ '2026-10-01': { consumedCalories: 1900, dailyLimit: 2200 } })
    const answer = history.answers['GET /api/calories/history'] as (b: unknown, q: URLSearchParams) => Answer
    let failOlder = true
    renderCalories('/calories/history', {
      'GET /api/calories/history': (body, query) => (failOlder && query.get('to') !== '2026-11-09' ? { status: 500 } : answer(body, query)),
    })

    await screen.findByRole('list', { name: 'Days' })
    await user.click(screen.getByRole('button', { name: 'Show older' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the history.")
    failOlder = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Thu 1 Oct: 1,900 / 2,200 kcal')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Days' })).getAllByRole('listitem')).toHaveLength(60)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// What GET /api/calories/settings answers until the Owner first saves them.
const reminderDefaults = { noEntriesReminder: { enabled: false, time: '14:00' }, eveningSummary: { enabled: false, time: '21:00' } }

// The Calories Settings Section on the Settings screen, found by its heading.
async function caloriesSection() {
  return await screen.findByRole('region', { name: 'Calories' })
}

describe('Calories Settings Section', () => {
  it('shows the Daily Limit and changes it from today', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/settings', {
      'GET /api/calories/daily-limit': { status: 200, body: { kcal: 2000, effectiveFrom: '2026-10-23' } },
      'PUT /api/calories/daily-limit': { status: 204 },
      'GET /api/calories/settings': { status: 200, body: reminderDefaults },
    })

    const form = await within(await caloriesSection()).findByRole('form', { name: 'Daily Limit' })
    const limit = await within(form).findByLabelText('Daily Limit (kcal)')
    expect(limit).toHaveValue('2000')
    await user.clear(limit)
    await user.type(limit, '1800')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByText('Saved. It applies from today.')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([
      { method: 'PUT', path: '/api/calories/daily-limit', body: { kcal: 1800 } },
    ])
  })

  it.each(['', '0', '10001', '1800.5', 'lots'])("doesn't save a Daily Limit of %j, and says what it must be", async (typed) => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/settings', {
      'GET /api/calories/daily-limit': { status: 200, body: null },
      'PUT /api/calories/daily-limit': { status: 204 },
      'GET /api/calories/settings': { status: 200, body: reminderDefaults },
    })

    const form = await within(await caloriesSection()).findByRole('form', { name: 'Daily Limit' })
    // None was ever set, so the field starts empty.
    expect(within(form).getByLabelText('Daily Limit (kcal)')).toHaveValue('')
    if (typed) await user.type(within(form).getByLabelText('Daily Limit (kcal)'), typed)
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('Enter the Daily Limit as a whole number of kcal from 1 to 10,000.')
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([])
  })

  it('shows the two reminders and saves whether each is sent and when', async () => {
    const user = userEvent.setup()
    const { sent } = renderCalories('/settings', {
      'GET /api/calories/daily-limit': { status: 200, body: null },
      'GET /api/calories/settings': { status: 200, body: reminderDefaults },
      'PUT /api/calories/settings': { status: 204 },
    })

    const form = await within(await caloriesSection()).findByRole('form', { name: 'Reminders' })
    const nothingLogged = within(form).getByRole('group', { name: 'Nothing logged yet' })
    const evening = within(form).getByRole('group', { name: 'Evening summary' })
    expect(within(nothingLogged).getByRole('switch', { name: 'Send it' })).not.toBeChecked()
    expect(within(nothingLogged).getByLabelText('Time')).toHaveValue('14:00')
    expect(within(evening).getByRole('switch', { name: 'Send it' })).not.toBeChecked()
    expect(within(evening).getByLabelText('Time')).toHaveValue('21:00')

    await user.click(within(nothingLogged).getByRole('switch', { name: 'Send it' }))
    await user.selectOptions(within(nothingLogged).getByLabelText('Time'), '12:30')
    await user.click(within(evening).getByRole('switch', { name: 'Send it' }))
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByText('Saved.')).toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'PUT')).toEqual([
      {
        method: 'PUT',
        path: '/api/calories/settings',
        body: { noEntriesReminder: { enabled: true, time: '12:30' }, eveningSummary: { enabled: true, time: '21:00' } },
      },
    ])
  })

  it('offers reminder times only on the hour or half hour, from 00:00 to 23:30', async () => {
    renderCalories('/settings', {
      'GET /api/calories/daily-limit': { status: 200, body: null },
      'GET /api/calories/settings': { status: 200, body: reminderDefaults },
    })

    const form = await within(await caloriesSection()).findByRole('form', { name: 'Reminders' })
    for (const name of ['Nothing logged yet', 'Evening summary']) {
      const labels = within(within(within(form).getByRole('group', { name })).getByLabelText('Time'))
        .getAllByRole('option')
        .map((option) => option.textContent)
      expect(labels).toHaveLength(48)
      expect(labels.slice(0, 3)).toEqual(['00:00', '00:30', '01:00'])
      expect(labels.at(-1)).toBe('23:30')
    }
  })

  it.each([
    { path: '/api/calories/daily-limit', body: { kcal: 2000, effectiveFrom: '2026-10-23' }, form: 'Daily Limit', message: "Couldn't load the Daily Limit." },
    { path: '/api/calories/settings', body: reminderDefaults, form: 'Reminders', message: "Couldn't load the reminders." },
  ])("says when $path couldn't load, and loads it again when asked", async ({ path, body, form, message }) => {
    const user = userEvent.setup()
    let failing = true
    renderCalories('/settings', {
      'GET /api/calories/daily-limit': { status: 200, body: { kcal: 2000, effectiveFrom: '2026-10-23' } },
      'GET /api/calories/settings': { status: 200, body: reminderDefaults },
      [`GET ${path}`]: () => (failing ? { status: 500 } : { status: 200, body }),
    })

    const section = await caloriesSection()
    expect(await within(section).findByRole('alert')).toHaveTextContent(message)
    expect(within(section).queryByRole('form', { name: form })).not.toBeInTheDocument()
    failing = false
    await user.click(within(section).getByRole('button', { name: 'Try again' }))

    expect(await within(section).findByRole('form', { name: form })).toBeInTheDocument()
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    { form: 'Daily Limit', path: '/api/calories/daily-limit', message: "Couldn't save the Daily Limit." },
    { form: 'Reminders', path: '/api/calories/settings', message: "Couldn't save the reminders: eveningSummary.time must be on the hour or half hour" },
  ])("says when the $form couldn't be saved", async ({ form, path, message }) => {
    const user = userEvent.setup()
    renderCalories('/settings', {
      'GET /api/calories/daily-limit': { status: 200, body: { kcal: 2000, effectiveFrom: '2026-10-23' } },
      'GET /api/calories/settings': { status: 200, body: reminderDefaults },
      [`PUT ${path}`]:
        form === 'Reminders' ? { status: 400, body: 'eveningSummary.time must be on the hour or half hour' } : { status: 500 },
    })

    const found = await within(await caloriesSection()).findByRole('form', { name: form })
    await user.click(within(found).getByRole('button', { name: 'Save' }))

    expect(await within(found).findByRole('alert')).toHaveTextContent(message)
    expect(within(found).queryByText(/Saved/)).not.toBeInTheDocument()
  })
})
