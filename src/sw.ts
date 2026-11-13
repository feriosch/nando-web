/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { ExpirationPlugin } from 'workbox-expiration'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import type { WorkboxPlugin } from 'workbox-core'
import { registerNotificationHandlers } from './core/sw/notifications'

declare const self: ServiceWorkerGlobalScope

// The app shell is precached, and every navigation is answered with index.html, so Nando opens
// offline. API calls go to the API origin and are never cached: logging needs a connection.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Font files (hashed, so they never change) are kept the first time a screen uses them, so the
// display font works offline. Only the unicode-range slices actually used are ever fetched.
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === 'font',
  new CacheFirst({ cacheName: 'fonts', plugins: [new ExpirationPlugin({ maxEntries: 300 })] }),
)

// Draw's kanji model (public/models/kanji/, nando-server's ADR 0005), kept the first time Draw loads
// it, so a Drawing is read offline. version.json names the current model and always comes from the
// network when there is one; the model and labels are requested with that version (?v=v1) and
// kept for good. Once a new version is kept, the old one's files are deleted, so labels and
// weights from different models never mix.
const kanjiModel = 'kanji-model'
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname === '/models/kanji/version.json',
  new NetworkFirst({ cacheName: kanjiModel }),
)
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/models/kanji/') && url.searchParams.has('v'),
  new CacheFirst({ cacheName: kanjiModel, plugins: [onlyThisVersion()] }),
)

// LiteRT.js's WASM (vite.config.ts), under /litert/<its version>/, so never stale: kept the first
// time Draw loads it. Only the one build of four this phone uses is ever fetched.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/litert/'),
  new CacheFirst({ cacheName: 'litert', plugins: [new ExpirationPlugin({ maxEntries: 8 })] }),
)

// When a versioned model file is kept, deletes the files kept for any other version.
function onlyThisVersion(): WorkboxPlugin {
  return {
    cacheDidUpdate: async ({ cacheName, request }) => {
      const version = new URL(request.url).searchParams.get('v')
      const cache = await caches.open(cacheName)
      for (const kept of await cache.keys()) {
        const keptVersion = new URL(kept.url).searchParams.get('v')
        if (keptVersion !== null && keptVersion !== version) await cache.delete(kept)
      }
    },
  }
}

// A new build takes over at once instead of waiting for every window to close.
void self.skipWaiting()
clientsClaim()

registerNotificationHandlers(self)
