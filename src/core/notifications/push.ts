// A Push Subscription as `subscription.toJSON()` gives it, and as POST /api/push-subscriptions takes it.
export type PushSubscriptionJSON = {
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
}

// This copy of Nando's Notification permission and Push Subscription.
export type Push = {
  // Whether this browser can receive Notifications at all. On iPhone, only Nando added to the
  // Home Screen can.
  supported(): boolean
  permission(): NotificationPermission
  // Must be called from a tap, before anything else is awaited, or Safari refuses to ask.
  requestPermission(): Promise<NotificationPermission>
  // This copy's Push Subscription, or null if it has none.
  subscription(): Promise<PushSubscriptionJSON | null>
  // Subscribes with the server's VAPID public key (base64url). Needs the permission granted.
  subscribe(vapidPublicKey: string): Promise<PushSubscriptionJSON>
}

export const browserPush: Push = {
  supported: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  permission: () => ('Notification' in window ? Notification.permission : 'default'),
  requestPermission: () => Notification.requestPermission(),
  async subscription() {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription ? toJSON(subscription) : null
  },
  async subscribe(vapidPublicKey) {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: fromBase64url(vapidPublicKey),
    })
    return toJSON(subscription)
  },
}

function toJSON(subscription: PushSubscription): PushSubscriptionJSON {
  return subscription.toJSON() as PushSubscriptionJSON
}

// The VAPID public key as bytes; not every browser takes the base64url string itself.
function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}
