import type { Page } from '@playwright/test'
import type { CoreSettings } from '../src/core/settings/settings'
import fixtures from '../public/models/kanji/drawings.json' with { type: 'json' }

// What Draw's e2e tests share: the Owner's settings, and drawing a fixture with the pointer.

export const settings: CoreSettings = {
  timeZone: 'Asia/Tokyo',
  heightCm: null,
  weighInReminder: { enabled: false, weekday: 'sunday', time: '08:00' },
}

// Draws a fixture's strokes on the drawing area with the mouse, fitted inside it with a margin.
export async function drawFixture(page: Page, name: string) {
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

export const candidates = (page: Page) => page.getByRole('list', { name: 'Candidates' }).getByRole('listitem')
