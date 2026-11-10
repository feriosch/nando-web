import { expect, test, type Page } from '@playwright/test'
import type { CoreSettings } from '../src/core/settings/settings'
import type { DayView, Meal } from '../src/modules/calories/calories'

// The iPhone's keyboard: it covers the bottom of the screen without resizing the page, and only
// the visual viewport shrinks. Chromium has no such keyboard, so this stands in for it at the OS
// boundary: while a text field has focus, `window.visualViewport` is this much shorter.
const keyboardHeight = 336

async function iPhoneKeyboard(page: Page) {
  await page.addInitScript((height) => {
    const viewport = new EventTarget()
    let open = false
    const sizes = {
      width: () => innerWidth,
      height: () => innerHeight - (open ? height : 0),
      offsetTop: () => 0,
      offsetLeft: () => 0,
      pageTop: () => 0,
      pageLeft: () => 0,
      scale: () => 1,
    }
    for (const [name, get] of Object.entries(sizes)) Object.defineProperty(viewport, name, { get })
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
    // What raises the keyboard: a text-like input, a textarea, or editable content.
    const typesText = (target: EventTarget | null) =>
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable) ||
      (target instanceof HTMLInputElement &&
        !['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'file', 'range', 'color', 'hidden'].includes(target.type))
    const show = (next: boolean) => {
      if (open === next) return
      open = next
      viewport.dispatchEvent(new Event('resize'))
    }
    document.addEventListener('focusin', (event) => show(typesText(event.target)))
    document.addEventListener('focusout', (event) => show(typesText(event.relatedTarget)))
  }, keyboardHeight)
}

// Today with one Entry and a Quick List of one Meal. Typed as the app reads them, so they keep up
// with the API.
const settings: CoreSettings = {
  timeZone: 'Asia/Tokyo',
  heightCm: null,
  weighInReminder: { enabled: false, weekday: 'sunday', time: '08:00' },
}
const chicken: Meal = {
  id: 'm1',
  name: 'Spicy Nosh Chicken',
  kcal: 465,
  store: null,
  emoji: null,
  imageUrl: null,
  tags: [],
  pinned: true,
  archived: false,
}
const dayView = (day: string): DayView => ({
  day,
  consumedCalories: 465,
  dailyLimit: 2000,
  remaining: 1535,
  overLimit: false,
  entries: [
    {
      id: 'e1',
      day,
      mealId: chicken.id,
      name: chicken.name,
      kcalPerServing: chicken.kcal,
      servings: 1,
      kcal: 465,
      loggedAt: `${day}T12:30:00+09:00`,
    },
  ],
})

async function fakeApi(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const { pathname } = new URL(route.request().url())
      const day = pathname.match(/^\/api\/calories\/days\/(\d{4}-\d{2}-\d{2})$/)?.[1]
      const body =
        pathname === '/api/settings'
          ? settings
          : pathname === '/api/calories/meals/quick'
            ? [chicken]
            : day && dayView(day)
      return body === undefined ? route.fulfill({ status: 501 }) : route.fulfill({ json: body })
    },
  )
}

test('a sheet stays above the keyboard while you type in it', async ({ page }) => {
  await iPhoneKeyboard(page)
  await fakeApi(page)
  await page.goto('/calories')
  await page.getByRole('button', { name: 'Something else' }).click()
  const sheet = page.getByRole('dialog', { name: 'Something else' })
  await sheet.getByRole('textbox', { name: 'Name' }).click()

  // Everything from the sheet's title down to its Log button, its last control, is on screen and
  // clear of the keyboard.
  const keyboardTop = page.viewportSize()!.height - keyboardHeight
  const top = async () => (await sheet.getByRole('heading', { name: 'Something else' }).boundingBox())!.y
  const bottom = async () => {
    const box = (await sheet.getByRole('button', { name: 'Log' }).boundingBox())!
    return box.y + box.height
  }
  await expect.poll(bottom).toBeLessThanOrEqual(keyboardTop)
  expect(await top()).toBeGreaterThanOrEqual(0)
})
