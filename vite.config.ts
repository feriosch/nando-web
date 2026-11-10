import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

// Paper's accent and light background (src/index.css). index.html's
// theme-color follows the screen on view instead.
const themeColor = '#8E4A49'
const backgroundColor = '#F6F4EF'

// https://vite.dev/config/
export default defineConfig({
  // The app's version, shown at the foot of Settings (src/core/version.ts). Bump it in package.json
  // for a release worth naming; the build number beside it counts main's commits on every deploy.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    // Our own service worker (src/sw.ts) shows Notifications, with the precache list injected at
    // build. nginx serves sw.js and manifest.webmanifest uncached. Font files are not precached:
    // Zen Maru Gothic comes in many small unicode-range files, and the service worker keeps each one
    // the first time a screen uses it.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
      manifest: {
        name: 'Nando',
        short_name: 'Nando',
        description: "The Owner's daily routines",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: backgroundColor,
        theme_color: themeColor,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
