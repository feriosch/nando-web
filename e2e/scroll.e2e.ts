import { expect, test, type Page } from '@playwright/test'
import type { DayView, Entry } from '../src/modules/calories/calories'
import type { Word, WordRow } from '../src/modules/japanese/japanese'
import { settings } from './draw'

// Where a screen lands on the page, in a real browser: a newly opened screen starts at its top, and
// going back returns to where the Owner was, as on an iPhone. Across Word pages, opened with their
// View Transitions.

const kitaiRow: WordRow = { id: 'w3', word: '期待', hiragana: 'きたい', spanish: 'expectativa', group: 'jlpt_n2' }
const machinozomuRow: WordRow = { id: 'w4', word: '待ち望む', hiragana: 'まちのぞむ', spanish: 'esperar con ansia', group: 'jlpt_n1' }

// A Word page long enough to scroll, its Word Link to `other` at the bottom.
function longWord(row: WordRow, other: WordRow): Word {
  return {
    ...row,
    type: { noun: 1 },
    group: { key: row.group, name: row.group, imageUrl: null },
    tags: [],
    notes: null,
    sentences: Array.from({ length: 14 }, (_, i) => ({ sentence: `${row.word}の例文、その${i + 1}。`, translation: `Ejemplo ${i + 1}.` })),
    wordLinks: [{ kind: 'synonym', note: null, nuanceTags: [], word: other }],
    hints: [],
    kanji: [],
  }
}

// A Day with enough Entries to scroll, on whichever Day is asked for.
function longDay(day: string): DayView {
  const entries: Entry[] = Array.from({ length: 16 }, (_, i) => ({
    id: `e${i}`,
    day,
    mealId: null,
    name: `Onigiri ${i + 1}`,
    kcalPerServing: 100,
    servings: 1,
    kcal: 100,
    loggedAt: `${day}T03:00:00Z`,
  }))
  return { day, consumedCalories: 1600, dailyLimit: 2000, remaining: 400, overLimit: false, entries }
}

// What any search finds: enough Words to scroll, the last of them 待ち望む.
const found: WordRow[] = [
  ...Array.from({ length: 14 }, (_, i): WordRow => ({ id: `s${i}`, word: `期${i + 1}`, hiragana: null, spanish: `palabra ${i + 1}`, group: 'basic' })),
  machinozomuRow,
]

async function fakeApi(page: Page) {
  const words: Record<string, Word> = { w3: longWord(kitaiRow, machinozomuRow), w4: longWord(machinozomuRow, kitaiRow) }
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const { pathname } = new URL(route.request().url())
      if (pathname === '/api/settings') return route.fulfill({ json: settings })
      const word = words[pathname.replace('/api/japanese/words/', '')]
      if (word) return route.fulfill({ json: word })
      const day = /^\/api\/calories\/days\/(\d{4}-\d{2}-\d{2})$/.exec(pathname)?.[1]
      if (day) return route.fulfill({ json: longDay(day) })
      if (pathname === '/api/calories/meals/quick') return route.fulfill({ json: [] })
      if (pathname === '/api/japanese/search') return route.fulfill({ json: { words: found, kanji: [] } })
      return route.fulfill({ status: 501 })
    },
  )
}

const title = (page: Page, word: string) => page.getByRole('heading', { level: 1, name: word })
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

test('opens a linked Word at its title, and goes back to where the Owner was', async ({ page }) => {
  await fakeApi(page)
  // Both Words seen once, so both are cached and drawn at full height straight away.
  await page.goto('/japanese/words/w4')
  await page.getByRole('link', { name: /期待/ }).click()
  await expect(title(page, '期待')).toBeVisible()

  // Down at the bottom of 期待, and on to 待ち望む.
  const link = page.getByRole('link', { name: /待ち望む/ })
  await link.scrollIntoViewIfNeeded()
  const where = await scrollY(page)
  expect(where).toBeGreaterThan(300)
  await link.click()

  await expect(title(page, '待ち望む')).toBeInViewport()
  expect(await scrollY(page)).toBe(0)

  await page.goBack()
  await expect(title(page, '期待')).toBeAttached()
  await expect.poll(() => scrollY(page)).toBe(where)
  await expect(link).toBeInViewport()
})

test('comes back from a Word to where the search was scrolled, with its back link', async ({ page }) => {
  await fakeApi(page)
  await page.goto('/japanese')
  await page.getByRole('searchbox', { name: 'Search' }).fill('期')
  const link = page.getByRole('list', { name: 'Words' }).getByRole('link', { name: /待ち望む/ })
  await link.scrollIntoViewIfNeeded()
  const where = await scrollY(page)
  expect(where).toBeGreaterThan(300)

  await link.click()
  await expect(title(page, '待ち望む')).toBeInViewport()
  await page.getByRole('link', { name: 'Search' }).click()

  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('期')
  await expect.poll(() => scrollY(page)).toBe(where)
  await expect(link).toBeInViewport()
})

test('opens a tab at its top', async ({ page }) => {
  await fakeApi(page)
  await page.goto('/japanese/words/w3')
  // The Day seen once, so it's cached and drawn at full height straight away.
  await page.getByRole('link', { name: 'Calories' }).click()
  await expect(page.getByText('Onigiri 16')).toBeAttached()
  await page.goBack()
  await page.getByRole('link', { name: /待ち望む/ }).scrollIntoViewIfNeeded()
  expect(await scrollY(page)).toBeGreaterThan(300)

  await page.getByRole('link', { name: 'Calories' }).click()

  await expect(page.getByText('Onigiri 16')).toBeAttached()
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeInViewport()
  expect(await scrollY(page)).toBe(0)
})
