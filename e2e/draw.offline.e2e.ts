import { expect, test, type Page } from '@playwright/test'
import type { CoreSettings } from '../src/core/settings/settings'
import fixtures from '../public/models/kanji/drawings.json' with { type: 'json' }

// Draw offline, in the production build with its service worker: once Draw has been opened online,
// the model, its labels and LiteRT.js's WASM are kept, so a Drawing is still read with no network.

const settings: CoreSettings = {
  timeZone: 'Asia/Tokyo',
  heightCm: null,
  weighInReminder: { enabled: false, weekday: 'sunday', time: '08:00' },
}

async function drawFixture(page: Page, name: string) {
  const { strokes } = (fixtures as { name: string; strokes: number[][][] }[]).find((f) => f.name === name)!
  await page.waitForFunction(() => {
    const area = document.querySelector('[aria-label="Drawing"]')
    const box = area?.getBoundingClientRect()
    return !!box && document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('svg') === area
  })
  const box = (await page.getByLabel('Drawing').boundingBox())!
  const points = strokes.flat()
  const [lowX, lowY] = [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))]
  const extent = Math.max(...points.map((p) => p[0] - lowX), ...points.map((p) => p[1] - lowY))
  const scale = (box.width - 80) / extent
  const at = ([x, y]: number[]) => [box.x + 40 + (x - lowX) * scale, box.y + 40 + (y - lowY) * scale] as const
  for (const stroke of strokes) {
    await page.mouse.move(...at(stroke[0]))
    await page.mouse.down()
    for (const point of stroke.slice(1)) await page.mouse.move(...at(point))
    await page.mouse.up()
  }
}

const firstCandidate = (page: Page) => page.getByRole('list', { name: 'Candidates' }).getByRole('listitem').first()

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
