import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, fakeConnection, noPush, renderApp, type Answer, type Answers } from '../../test/app'
import { addDays } from '../../core/days'
import { calories } from '.'

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175 }

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
    steps: null,
    burnedCalories: null,
    entries,
    activity: { healthSync: null, walks: [] },
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

// The Calories API for one Day: its Day view, worked out from `entries` and `dailyLimit`, and the
// Meals in use, whose emoji its Entries show.
function caloriesServer({ day, entries = [], meals = [], dailyLimit = 2000 }: { day: string; entries?: Entry[]; meals?: Meal[]; dailyLimit?: number | null }) {
  const answers: Answers = {
    [`GET /api/calories/days/${day}`]: () => ({ status: 200, body: dayView(day, entries, dailyLimit) }),
    'GET /api/calories/meals': () => ({ status: 200, body: meals.filter((m) => !m.archived) }),
  }
  return answers
}

// Waits for the Day view's summary card to show `text` as the Day's Consumed Calories against its
// Daily Limit, such as "770 / 2,150 kcal".
async function expectConsumed(text: string) {
  await waitFor(() => expect(screen.getByRole('region', { name: 'Summary' }).querySelector('p')?.textContent).toBe(text))
}

// Waits for the Entry on the Day view that reads `text`, such as "Sushi × 12, 45 kcal each: 540 kcal",
// and gives its row.
function findEntry(text: string) {
  return waitFor(() => {
    const items = within(screen.getByRole('list', { name: 'Entries' })).getAllByRole('listitem')
    const item = items.find((li) => li.textContent?.includes(text))
    if (!item) throw new Error(`No Entry reads "${text}"`)
    return item
  })
}

// Opens the Day picker's chip for the Day named `name`, such as "Thursday, 5 November".
async function pickDay(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(within(await screen.findByRole('group', { name: 'Day' })).getByRole('button', { name }))
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
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText('Monday, 9 November')).toBeInTheDocument()
    await expectConsumed('770 / 2,150 kcal')
    expect(screen.getByText('1,380 kcal left')).toBeInTheDocument()
    const entries = screen.getByRole('list', { name: 'Entries' })
    const items = within(entries).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Tuna mayo onigiri: 230 kcal')
    expect(items[1]).toHaveTextContent('Sushi × 12, 45 kcal each: 540 kcal')
  })

  it('says how far over the Daily Limit a Day is', async () => {
    renderCalories(
      '/calories',
      caloriesServer({ day: '2026-11-09', dailyLimit: 2150, entries: [entry({ id: 'e1', day: '2026-11-09', name: 'Katsu curry', kcalPerServing: 2440 })] }),
    )

    await expectConsumed('2,440 / 2,150 kcal')
    expect(screen.getByText('290 kcal over the Daily Limit')).toBeInTheDocument()
  })
})

describe('Choosing a Day', () => {
  it('picks any Day of the last 8, today and the 7 Days before it, and shows it', async () => {
    const user = userEvent.setup()
    const thursday = caloriesServer({
      day: '2026-11-05',
      entries: [entry({ id: 'e1', day: '2026-11-05', name: 'Ramen', kcalPerServing: 800 })],
      meals: [meal({ id: 'm1', name: 'Tuna mayo onigiri', kcal: 230 })],
    })
    const { router } = renderCalories('/calories', { ...caloriesServer({ day: '2026-11-09' }), ...thursday })

    // A chip per Day, oldest first, today's chosen.
    const chips = within(await screen.findByRole('group', { name: 'Day' })).getAllByRole('button')
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Monday, 2 November',
      'Tuesday, 3 November',
      'Wednesday, 4 November',
      'Thursday, 5 November',
      'Friday, 6 November',
      'Saturday, 7 November',
      'Sunday, 8 November',
      'Monday, 9 November',
    ])
    expect(chips.map((chip) => chip.getAttribute('aria-pressed'))).toEqual([...Array(7).fill('false'), 'true'])
    await pickDay(user, 'Thursday, 5 November')

    expect(await screen.findByRole('heading', { level: 1, name: 'Thu 5 Nov' })).toBeInTheDocument()
    expect(screen.getByText('Thursday, 5 November')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thursday, 5 November' })).toHaveAttribute('aria-pressed', 'true')
    expect(router.state.location.search).toBe('?day=2026-11-05')
    await expectConsumed('800 / 2,000 kcal')
    expect(await findEntry('Ramen')).toHaveTextContent('800 kcal')
  })

  it('titles yesterday with its date, over "Yesterday"', async () => {
    const user = userEvent.setup()
    renderCalories('/calories', { ...caloriesServer({ day: '2026-11-09' }), ...caloriesServer({ day: '2026-11-08' }) })

    await pickDay(user, 'Sunday, 8 November')

    expect(await screen.findByRole('heading', { level: 1, name: 'Sun 8 Nov' })).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('shows a Day older than the Day picker, from History', async () => {
    renderCalories('/calories?day=2026-11-01', {
      'GET /api/calories/days/2026-11-01': {
        status: 200,
        body: dayView('2026-11-01', [entry({ id: 'e1', day: '2026-11-01', name: 'Ramen', kcalPerServing: 800 })]),
      },
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Sun 1 Nov' })).toBeInTheDocument()
    await expectConsumed('800 / 2,000 kcal')
    // It has no chip: older Days are opened from History.
    expect(within(screen.getByRole('group', { name: 'Day' })).queryByRole('button', { pressed: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Quick list' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Something else' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Entries' })).queryByRole('button')).not.toBeInTheDocument()
  })

  it('says an Unlogged Day has nothing logged, rather than 0 kcal', async () => {
    renderCalories('/calories', caloriesServer({ day: '2026-11-09' }))

    expect(await screen.findByText('Not logged')).toBeInTheDocument()
    expect(screen.getByText('Nothing logged for this Day yet.')).toBeInTheDocument()
    expect(screen.queryByText(/0 kcal|kcal left/)).not.toBeInTheDocument()
  })
})

describe('Read-only', () => {
  it('says an empty Day is logged with the Calories Assistant in Telegram', async () => {
    renderCalories('/calories', caloriesServer({ day: '2026-11-09' }))

    expect(await screen.findByText('Not logged')).toBeInTheDocument()
    expect(screen.getByText('Log what you eat with the Calories Assistant in Telegram.')).toBeInTheDocument()
  })

  it("doesn't send the Owner to the Calories Assistant for an empty Day it can no longer log on", async () => {
    renderCalories('/calories?day=2026-11-01', { 'GET /api/calories/days/2026-11-01': { status: 200, body: dayView('2026-11-01', []) } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Sun 1 Nov' })).toBeInTheDocument()
    expect(await screen.findByText('Not logged')).toBeInTheDocument()
    expect(screen.queryByText(/Calories Assistant/)).not.toBeInTheDocument()
  })

  it('shows today without a way to log, change or delete, and only reads', async () => {
    const { sent } = renderCalories('/calories', {
      'GET /api/calories/days/2026-11-09': {
        status: 200,
        body: dayView('2026-11-09', [entry({ id: 'e1', day: '2026-11-09', mealId: 'm1', name: 'Tuna mayo onigiri', kcalPerServing: 230 })]),
      },
      'GET /api/calories/meals': { status: 200, body: [meal({ id: 'm1', name: 'Tuna mayo onigiri', kcal: 230, emoji: '🍙' })] },
    })

    // An Entry logged from a Meal shows the Meal's emoji.
    await waitFor(async () => expect(await findEntry('Tuna mayo onigiri')).toHaveTextContent('🍙'))
    await expectConsumed('230 / 2,000 kcal')
    expect(screen.queryByRole('list', { name: 'Quick list' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Something else' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Entries' })).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('This Day can no longer be changed.')).not.toBeInTheDocument()
    expect(sent.filter((request) => request.path.startsWith('/api/calories/') && request.method !== 'GET')).toEqual([])
  })
})

// The Calories API's Meals: those in use, or with ?archived=true the archived ones, by name.
function mealsServer(meals: Meal[]) {
  const byName = (a: Meal, b: Meal) => a.name.localeCompare(b.name)
  const answers: Answers = {
    'GET /api/calories/meals': (_, query) => ({
      status: 200,
      body: meals.filter((m) => m.archived === (query.get('archived') === 'true')).sort(byName),
    }),
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
async function mealItem(name: string, list = 'In use') {
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
    expect(screen.getByText('2 Meals')).toBeInTheDocument()
    const items = within(await screen.findByRole('list', { name: 'In use' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Salmon nigiri')
    expect(items[1]).toHaveTextContent('Tuna mayo onigiri · Pinned')
    expect(items[1]).toHaveTextContent('230 kcal')
    expect(items[1]).toHaveTextContent('7-Eleven · snack, conbini')
    // The photo is the row's tile, in place of the emoji. It is decoration (the row's text names the
    // Meal), so it has no role to find it by.
    expect(items[1].querySelector('img')).toHaveAttribute('src', onigiri.imageUrl)
    expect(items[1]).not.toHaveTextContent('🍙')
    expect(items[0].querySelector('img')).not.toBeInTheDocument()
  })

  it('lists the Meals in use and the archived ones, with nothing to open, add or restore', async () => {
    const { sent } = renderCalories('/calories/meals', mealsServer([onigiri, { ...nigiri, archived: true }]))

    expect(await screen.findByText('1 Meal · 1 archived')).toBeInTheDocument()
    expect(await mealItem('Tuna mayo onigiri')).toHaveTextContent('230 kcal')
    expect(await mealItem('Salmon nigiri', 'Archived')).toHaveTextContent('kcal')
    for (const list of screen.getAllByRole('list')) {
      expect(within(list).queryByRole('link')).not.toBeInTheDocument()
      expect(within(list).queryByRole('button')).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('link', { name: 'New Meal' })).not.toBeInTheDocument()
    expect(sent.filter((request) => request.method !== 'GET')).toEqual([])
  })

  it('goes back to today from Meals opened on another Day', async () => {
    const user = userEvent.setup()
    const { router } = renderCalories('/calories', {
      ...caloriesServer({ day: '2026-11-09' }),
      ...caloriesServer({ day: '2026-11-05' }),
      ...mealsServer([onigiri]),
    })
    await pickDay(user, 'Thursday, 5 November')
    await screen.findByRole('heading', { level: 1, name: 'Thu 5 Nov' })

    await user.click(screen.getByRole('link', { name: 'Meals' }))
    await screen.findByRole('heading', { level: 1, name: 'Meals' })
    await user.click(screen.getByRole('link', { name: 'Today' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
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

    await expectConsumed('800 / 2,000 kcal')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says the Day is out of reach while offline, and loads it once back online, when Nando was opened offline', async () => {
    const connection = fakeConnection({ online: false })
    renderCalories('/calories', caloriesServer({ day: '2026-11-09', entries: [entry({ id: 'e1', day: '2026-11-09', name: 'Ramen', kcalPerServing: 800 })] }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the Day.")
    expect(screen.getByText("You're offline. This loads again once you're back online.")).toBeInTheDocument()
    connection.goOnline()

    await expectConsumed('800 / 2,000 kcal')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument()
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

})

describe('A new Day', () => {
  it('moves on to the new Day when the Owner comes back to the app after midnight', async () => {
    renderCalories('/calories', { ...caloriesServer({ day: '2026-11-09', meals: [nigiri] }), ...caloriesServer({ day: '2026-11-10', meals: [nigiri] }) })
    expect(await screen.findByText('Monday, 9 November')).toBeInTheDocument()
    expect(await screen.findByText('Not logged')).toBeInTheDocument()

    // Tuesday 10 November, 05:00 in Tokyo, when the Owner comes back to the open app.
    vi.setSystemTime(new Date('2026-11-09T20:00:00Z'))
    fireEvent(document, new Event('visibilitychange'))

    expect(await screen.findByText('Tuesday, 10 November')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Day' })).getAllByRole('button')[0]).toHaveAccessibleName('Tuesday, 3 November')
  })

  it('moves on to the new Day at midnight while the screen stays open', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-11-08T20:00:00Z'))
    renderCalories('/calories', { ...caloriesServer({ day: '2026-11-09', meals: [nigiri] }), ...caloriesServer({ day: '2026-11-10', meals: [nigiri] }) })
    expect(await screen.findByText('Monday, 9 November')).toBeInTheDocument()
    expect(await screen.findByText('Not logged')).toBeInTheDocument()

    // Tuesday 10 November, 00:00 in Tokyo.
    vi.setSystemTime(new Date('2026-11-09T15:00:00Z'))
    vi.advanceTimersByTime(60_000)

    expect(await screen.findByText('Tuesday, 10 November')).toBeInTheDocument()
  })
})

describe('Review fixes', () => {

  it.each(['2026-13-01', '2026-02-30'])('opens on today when ?day=%s is no real date', async (asked) => {
    renderCalories(`/calories?day=${asked}`, caloriesServer({ day: '2026-11-09' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText('Monday, 9 November')).toBeInTheDocument()
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
        body: { day: '2026-11-09', consumedCalories: 460, dailyLimit: 2000, remaining: 1540, overLimit: false, steps: null, burnedCalories: null },
      },
      ...caloriesServer({ day: '2026-11-09' }),
    })

    const card = await caloriesCard()
    await waitFor(() => expect(card).toHaveTextContent('460 / 2,000 kcal'))
    expect(within(card).getByText('1,540 kcal left')).toBeInTheDocument()
    await user.click(within(card).getByRole('link', { name: 'Today' }))

    expect(router.state.location.pathname).toBe('/calories')
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
  })

  it('says nothing is logged yet on an Unlogged Day, rather than 0 kcal', async () => {
    renderCalories('/', {
      'GET /api/calories/home-card': {
        status: 200,
        body: { day: '2026-11-09', consumedCalories: null, dailyLimit: 2000, remaining: null, overLimit: null, steps: null, burnedCalories: null },
      },
    })

    const card = await caloriesCard()
    expect(await within(card).findByText('Not logged')).toBeInTheDocument()
    expect(card).not.toHaveTextContent(/0 kcal|kcal left/)
  })

  it("says when it couldn't load, and loads again when asked", async () => {
    const user = userEvent.setup()
    let answer: Answer = { status: 500 }
    renderCalories('/', { 'GET /api/calories/home-card': () => answer })

    const card = await caloriesCard()
    expect(await within(card).findByRole('alert')).toHaveTextContent("Couldn't load today's Calories.")

    answer = { status: 200, body: { day: '2026-11-09', consumedCalories: 2100, dailyLimit: 2000, remaining: -100, overLimit: true, steps: null, burnedCalories: null } }
    await user.click(within(card).getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(card).toHaveTextContent('2,100 / 2,000 kcal'))
    expect(within(card).getByText('100 kcal over the Daily Limit')).toBeInTheDocument()
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('moves on to the new Day at midnight while Home stays open', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-11-09T14:58:00Z'))
    let answer: Answer = { status: 200, body: { day: '2026-11-09', consumedCalories: 1700, dailyLimit: 1800, remaining: 100, overLimit: false, steps: null, burnedCalories: null } }
    renderCalories('/', { 'GET /api/calories/home-card': () => answer })

    const card = await caloriesCard()
    await waitFor(() => expect(card).toHaveTextContent('1,700 / 1,800 kcal'))

    // Tuesday 10 November, 00:00 in Tokyo: nothing logged yet.
    answer = { status: 200, body: { day: '2026-11-10', consumedCalories: null, dailyLimit: 1800, remaining: null, overLimit: null, steps: null, burnedCalories: null } }
    vi.setSystemTime(new Date('2026-11-09T15:00:00Z'))
    vi.advanceTimersByTime(60_000)

    expect(await within(card).findByText('Not logged')).toBeInTheDocument()
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
        steps: null,
        burnedCalories: null,
      })
    }
    return { status: 200, body: days }
  }
  return { answers: { 'GET /api/calories/history': answer } as Answers, asked }
}

// Every Day History lists, newest first, across its weeks.
function historyDays() {
  return within(screen.getByRole('main')).getAllByRole('listitem')
}

// Waits for History to list `count` Days, and gives them.
function findHistoryDays(count = 30) {
  return waitFor(() => {
    const days = historyDays()
    expect(days).toHaveLength(count)
    return days
  })
}

describe('History', () => {
  it("lists today and the 29 Days before it, newest first, each with its Consumed Calories against that Day's Daily Limit", async () => {
    const history = historyServer({
      '2026-11-09': { consumedCalories: 460, dailyLimit: 1800 },
      '2026-11-07': { consumedCalories: 2100, dailyLimit: 2000 },
    })
    renderCalories('/calories/history', history.answers)

    expect(await screen.findByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
    const days = await findHistoryDays()
    expect(days[0]).toHaveTextContent('Mon 9 Nov: 460 / 1,800 kcal')
    // An Unlogged Day isn't recorded, so it is never 0 kcal or under the Daily Limit.
    expect(days[1]).toHaveTextContent('Sun 8 Nov: not logged')
    expect(days[1]).not.toHaveTextContent(/kcal/)
    expect(days[2]).toHaveTextContent('Sat 7 Nov: 2,100 / 2,000 kcal')
    expect(days[29]).toHaveTextContent('Sun 11 Oct: not logged')
    expect(history.asked).toEqual([{ from: '2026-10-11', to: '2026-11-09' }])
  })

  it('groups the Days by week, from Monday to Sunday', async () => {
    renderCalories('/calories/history', historyServer({}).answers)
    await findHistoryDays()

    // Each week's list, by the section header that names it, and how many Days it has.
    const weeks = screen.getAllByRole('list').map((list) => [
      document.getElementById(list.getAttribute('aria-labelledby')!)?.textContent,
      within(list).getAllByRole('listitem').length,
    ])
    // Today is Monday 9 November; the 30th Day back is Sunday 11 October.
    expect(weeks).toEqual([
      ['This week', 1],
      ['Last week', 7],
      ['Week of 26 Oct', 7],
      ['Week of 19 Oct', 7],
      ['Week of 12 Oct', 7],
      ['Week of 5 Oct', 1],
    ])
  })

  it('shows just the Consumed Calories of a Day with no Daily Limit', async () => {
    renderCalories('/calories/history', historyServer({ '2026-11-09': { consumedCalories: 460, dailyLimit: null } }, null).answers)

    const days = await findHistoryDays()
    expect(days[0]).toHaveTextContent(/^Mon 9 Nov: 460 kcal$/)
  })

  it('shows the 30 Days before those listed when asked for older ones', async () => {
    const user = userEvent.setup()
    const history = historyServer({ '2026-10-01': { consumedCalories: 1900, dailyLimit: 2200 } })
    renderCalories('/calories/history', history.answers)

    await findHistoryDays()
    await user.click(screen.getByRole('button', { name: 'Show older' }))

    const days = await findHistoryDays(60)
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
    expect(await findEntry('Ramen: 800 kcal')).toBeInTheDocument()
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

    expect((await findHistoryDays())[0]).toHaveTextContent('Mon 9 Nov: 460 / 1,800 kcal')
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

    await findHistoryDays()
    await user.click(screen.getByRole('button', { name: 'Show older' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the history.")
    // Said at the bottom, where older Days were asked for, in place of "Show older".
    const lists = screen.getAllByRole('list')
    expect(lists.at(-1)!.compareDocumentPosition(screen.getByRole('alert')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show older' })).not.toBeInTheDocument()
    failOlder = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect((await findHistoryDays(60))[39]).toHaveTextContent('Thu 1 Oct: 1,900 / 2,200 kcal')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show older' })).toBeInTheDocument()
  })
})

describe('Settings', () => {
  it('has no Calories Section: the Calories Assistant sets the Daily Limit and the reminders', async () => {
    renderCalories('/settings', {})

    expect(await screen.findByRole('region', { name: 'General' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Calories' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Daily Limit (kcal)')).not.toBeInTheDocument()
  })
})

