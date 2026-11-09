/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { ExpirationPlugin } from 'workbox-expiration'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
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

// A new build takes over at once instead of waiting for every window to close.
void self.skipWaiting()
clientsClaim()

registerNotificationHandlers(self)
