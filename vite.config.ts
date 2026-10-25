import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Also the theme-color in index.html and the background of public/icon.svg.
const brandColor = '#1f7a4d'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Our own service worker (src/sw.ts) shows Notifications, with the precache list injected at
    // build. nginx serves sw.js and manifest.webmanifest uncached.
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
        background_color: brandColor,
        theme_color: brandColor,
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
