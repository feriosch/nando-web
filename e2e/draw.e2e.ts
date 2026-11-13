import { expect, test, type Page } from '@playwright/test'
import type { CandidateKanji, Kanji } from '../src/modules/japanese/japanese'
import { candidates, drawFixture, settings } from './draw'

// Draw with the real kanji model: LiteRT.js on WASM in Chromium, reading a Drawing drawn with real
// pointer events, against a fake API.

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
