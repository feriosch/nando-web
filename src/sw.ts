/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { registerNotificationHandlers } from './core/sw/notifications'

declare const self: ServiceWorkerGlobalScope

// The app shell is precached, and every navigation is answered with index.html, so Nando opens
// offline. API calls go to the API origin and are never cached: logging needs a connection.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// A new build takes over at once instead of waiting for every window to close.
void self.skipWaiting()
clientsClaim()

registerNotificationHandlers(self)
