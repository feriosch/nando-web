import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { candidates, drawFixture, settings } from './draw'

// Draw offline, in the production build with its service worker: once Draw has been opened online,
// the model, its labels and LiteRT.js's WASM are kept, so a Drawing is still read with no network.

const firstCandidate = (page: Page) => candidates(page).first()

// The fake API, context-wide so it also answers what the service worker fetches. Nothing is stored.
// Once `network.offline` is set it can't be reached at all (Playwright's routes would otherwise
// still answer).
async function fakeApi(context: BrowserContext) {
  const network = { offline: false }
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      if (network.offline) return route.abort('internetdisconnected')
      const { pathname } = new URL(route.request().url())
      if (pathname === '/api/settings') return route.fulfill({ json: settings })
      if (pathname === '/api/japanese/kanji') return route.fulfill({ json: [] })
      return route.fulfill({ status: 501 })
    },
  )
  return network
}

// Opens Draw with the service worker in control, and reads a 十 so the model in version.json is kept.
async function openDrawOnce(page: Page) {
  await page.goto('/japanese/draw')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await drawFixture(page, '十')
  await expect(firstCandidate(page)).toHaveText('十', { timeout: 30_000 })
}

// The model files the service worker keeps, as path and query.
const keptModelFiles = (page: Page) =>
  page.evaluate(async () => {
    const cache = await caches.open('kanji-model')
    return (await cache.keys()).map((request) => new URL(request.url)).map((url) => url.pathname + url.search).sort()
  })

test('reads a Drawing offline once Draw has been opened online', async ({ page, context }) => {
  // The fake API: context-wide, so it also answers what the service worker fetches. Nothing is
  // stored. Offline it can't be reached at all (Playwright's routes would otherwise still answer).
  let offline = false
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      if (offline) return route.abort('internetdisconnected')
      const { pathname } = new URL(route.request().url())
      if (pathname === '/api/settings') return route.fulfill({ json: settings })
      if (pathname === '/api/japanese/kanji') return route.fulfill({ json: [] })
      return route.fulfill({ status: 501 })
    },
  )

  // Online: the service worker takes over, then Draw loads the model once.
  await page.goto('/japanese/draw')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await drawFixture(page, '十')
  await expect(firstCandidate(page)).toHaveText('十', { timeout: 30_000 })

  // Offline, after a fresh start of the app.
  offline = true
  await context.setOffline(true)
  await page.reload()
  await drawFixture(page, '口')

  await expect(firstCandidate(page)).toHaveText('口', { timeout: 30_000 })
  await expect(page.getByText('Offline: can’t check your kanji.')).toBeVisible()
})

test('a new model version replaces the kept one, files and all', async ({ page, context }) => {
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const { pathname } = new URL(route.request().url())
      if (pathname === '/api/settings') return route.fulfill({ json: settings })
      if (pathname === '/api/japanese/kanji') return route.fulfill({ json: [] })
      return route.fulfill({ status: 501 })
    },
  )
  const keptModelFiles = () =>
    page.evaluate(async () => {
      const cache = await caches.open('kanji-model')
      return (await cache.keys()).map((request) => new URL(request.url)).map((url) => url.pathname + url.search).sort()
    })

  await page.goto('/japanese/draw')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await drawFixture(page, '十')
  await expect(firstCandidate(page)).toHaveText('十', { timeout: 30_000 })
  await expect.poll(keptModelFiles).toEqual(['/models/kanji/kanji.tflite?v=v1', '/models/kanji/labels.json?v=v1', '/models/kanji/version.json'])

  // A release later, the server names v2 (the same files stand in for it).
  await context.route('**/models/kanji/version.json', (route) => route.fulfill({ json: { version: 'v2' } }))
  await page.reload()
  await drawFixture(page, '十')
  await expect(firstCandidate(page)).toHaveText('十', { timeout: 30_000 })

  await expect.poll(keptModelFiles).toEqual(['/models/kanji/kanji.tflite?v=v2', '/models/kanji/labels.json?v=v2', '/models/kanji/version.json'])
})

test('a new model version cut off mid-download leaves the kept one working', async ({ page, context }) => {
  const network = await fakeApi(context)
  await openDrawOnce(page)

  // A release later, the server names v2, but the 3.8 MB model never finishes downloading.
  await context.route('**/models/kanji/version.json', (route) => route.fulfill({ json: { version: 'v2' } }))
  await context.route(
    (url) => url.pathname === '/models/kanji/kanji.tflite' && url.searchParams.get('v') === 'v2',
    (route) => route.abort('connectionreset'),
  )
  await page.reload()
  await drawFixture(page, '十')
  await expect(firstCandidate(page)).toHaveText('十', { timeout: 30_000 })

  // Offline afterwards, the kept v1 still reads a Drawing.
  network.offline = true
  await context.setOffline(true)
  await page.reload()
  await drawFixture(page, '口')

  await expect(firstCandidate(page)).toHaveText('口', { timeout: 30_000 })
  expect(await keptModelFiles(page)).toEqual(expect.arrayContaining(['/models/kanji/kanji.tflite?v=v1', '/models/kanji/labels.json?v=v1']))
})

test('reads a Drawing offline even when version.json can’t be had, from the version that last loaded', async ({ page, context }) => {
  const network = await fakeApi(context)
  await openDrawOnce(page)

  // version.json is gone from the kept files (evicted, say), and offline it can't be fetched.
  await page.evaluate(async () => (await caches.open('kanji-model')).delete('/models/kanji/version.json'))
  network.offline = true
  await context.setOffline(true)
  await page.reload()
  await drawFixture(page, '口')

  await expect(firstCandidate(page)).toHaveText('口', { timeout: 30_000 })
})

test('reads a Drawing when the browser won’t lend its storage', async ({ page, context }) => {
  await fakeApi(context)
  // As in some private modes: localStorage throws.
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
  })

  await openDrawOnce(page)
})
