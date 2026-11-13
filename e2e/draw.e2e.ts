import { expect, test, type Page } from '@playwright/test'
import type { CoreSettings } from '../src/core/settings/settings'
import type { CandidateKanji, Kanji } from '../src/modules/japanese/japanese'
import fixtures from '../public/models/kanji/drawings.json' with { type: 'json' }

// Draw with the real kanji model: LiteRT.js on WASM in Chromium, reading a Drawing drawn with real
// pointer events, against a fake API.

const settings: CoreSettings = {
  timeZone: 'Asia/Tokyo',
  heightCm: null,
  weighInReminder: { enabled: false, weekday: 'sunday', time: '08:00' },
}
const ten: CandidateKanji = { id: 'k10', kanji: '十', spanish: 'diez', v1: 7 }
const tenPage: Kanji = { ...ten, on: 'ジュウ', kun: 'とお', v2: null, story: null, components: [], words: [] }

async function fakeApi(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/settings') return route.fulfill({ json: settings })
      // Only 十 is stored.
      if (url.pathname === '/api/japanese/kanji') {
        return route.fulfill({ json: [...(url.searchParams.get('kanji') ?? '')].includes('十') ? [ten] : [] })
      }
      if (url.pathname === `/api/japanese/kanji/${ten.id}`) return route.fulfill({ json: tenPage })
      return route.fulfill({ status: 501 })
    },
  )
}

// Draws a fixture's strokes on the drawing area with the mouse, fitted inside it with a margin.
async function drawFixture(page: Page, name: string) {
  const { strokes } = (fixtures as { name: string; strokes: number[][][] }[]).find((f) => f.name === name)!
  // As a person would, start once the screen has finished sliding in: during a View Transition the
  // pointer goes to the page itself, not the drawing area under it.
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

const candidates = (page: Page) => page.getByRole('list', { name: 'Candidates' }).getByRole('listitem')

test('reads a drawn 十 with the real model, and comes back to it from its Kanji page', async ({ page }) => {
  await fakeApi(page)
  await page.goto('/japanese')
  await page.getByRole('link', { name: 'Draw' }).click()

  await drawFixture(page, '十')

  await expect(candidates(page).first()).toHaveText('十diez7', { timeout: 30_000 })
  await expect(candidates(page)).toHaveCount(8)

  await candidates(page).first().getByRole('link').click()
  await expect(page.getByRole('heading', { level: 1, name: '十' })).toBeVisible()
  await page.getByRole('link', { name: 'Draw' }).click()

  await expect(page.getByLabel('Drawing').locator('polyline')).toHaveCount(2)
  await expect(candidates(page).first()).toHaveText('十diez7')
})
