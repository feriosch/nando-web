import { defineConfig, devices } from '@playwright/test'

// End-to-end tests: the real app in Chromium on Nando's main phone, the iPhone 17, against a fake
// API on the app's own origin (VITE_API_BASE_URL), so nando-server isn't needed. For what only a
// real browser can show, such as where things land on the screen; everything else is a Vitest test.
const port = 5198
const origin = `http://localhost:${port}`
const iPhone17 = devices['iPhone 17']

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  forbidOnly: !!process.env.CI,
  use: {
    ...iPhone17,
    browserName: 'chromium',
    // Nando runs as a Home Screen PWA, so the viewport is the whole 402×874 screen rather than Safari's.
    viewport: { width: 402, height: 874 },
    baseURL: origin,
    serviceWorkers: 'block',
    trace: 'off',
  },
  webServer: {
    command: `vite --port ${port} --strictPort`,
    url: origin,
    env: { VITE_API_BASE_URL: origin },
    reuseExistingServer: !process.env.CI,
  },
})
