import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import litertPkg from './node_modules/@litertjs/core/package.json' with { type: 'json' }
import pkg from './package.json' with { type: 'json' }

// LiteRT.js loads its WASM build (one of four, by what the browser supports) at run time from a
// directory it's given. The app serves them itself, not from a CDN, so Draw works offline: under
// /litert/<version>/, so a new version is a new path and they can be cached for good.
const litertWasmDir = `/litert/${litertPkg.version}/`
const litertWasmSource = fileURLToPath(new URL('./node_modules/@litertjs/core/wasm/', import.meta.url))

function litertWasm(): Plugin {
  const contentType = (file: string) => (file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
  return {
    name: 'litert-wasm',
    // In development, straight from node_modules.
    configureServer(server) {
      server.middlewares.use(litertWasmDir, (request, response, next) => {
        const file = join(litertWasmSource, (request.url ?? '').split('?')[0])
        if (!file.startsWith(litertWasmSource) || !existsSync(file)) return next()
        response.setHeader('Content-Type', contentType(file))
        response.end(readFileSync(file))
      })
    },
    // In the build, copied in as they are.
    generateBundle() {
      for (const name of readdirSync(litertWasmSource)) {
        this.emitFile({ type: 'asset', fileName: `${litertWasmDir.slice(1)}${name}`, source: readFileSync(join(litertWasmSource, name)) })
      }
    },
  }
}

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
    __LITERT_WASM_DIR__: JSON.stringify(litertWasmDir),
  },
  plugins: [
    litertWasm(),
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
        // LiteRT.js's four WASM builds are about 3 MB each and a phone uses one: the service worker
        // keeps that one when Draw first loads it, instead of every install downloading all four.
        globIgnores: ['litert/**'],
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
