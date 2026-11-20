// This device's Push Subscription, which Nando no longer uses: its Notifications come through
// Telegram now, in each Assistant's chat (nando-server's ADR 0008). The app only drops the one an
// iPhone still holds from before, so it stops getting push messages.
export type Push = {
  // Drops this device's Push Subscription, if it has one.
  unsubscribe(): Promise<void>
}

export const browserPush: Push = {
  async unsubscribe() {
    // No service worker is registered under `bun run dev`, or where push never was.
    if (!('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.getRegistration()
    await (await registration?.pushManager?.getSubscription())?.unsubscribe()
  },
}
