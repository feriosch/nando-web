import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, type ReactNode } from 'react'
import { ApiError, type ApiClient } from '../api'
import { useApi, usePush } from '../services'
import { LoadProblem } from '../shell/LoadProblem'
import { Button } from '../ui/Button'
import { pillClasses } from '../ui/pill'
import { footerClasses, GroupedList, ListRow } from '../ui/List'
import type { Push, PushSubscriptionJSON } from './push'

// This device's Notification permission and, while it is granted, its Push Subscription.
type DeviceNotifications = { permission: NotificationPermission; subscription: PushSubscriptionJSON | null }

// Core's Notifications Settings Section: whether this device gets Notifications, and a button to
// enable them.
export function NotificationsSettingsSection() {
  const api = useApi()
  const push = usePush()
  const queryClient = useQueryClient()
  const supported = push.supported()
  // Read again whenever the Owner comes back to the app, since the permission can change in the
  // device's settings. A Push Subscription is registered again each time, which is safe: Core
  // deletes one a push service stopped knowing, and then this device's is replaced by a fresh one.
  // Without the permission it can't deliver, so it counts as none.
  const device = useQuery({
    queryKey: ['push-subscription'],
    queryFn: async (): Promise<DeviceNotifications> => {
      const permission = push.permission()
      const held = permission === 'granted' ? await push.subscription() : null
      const subscription = held && (await register(api, push, held))
      return { permission, subscription }
    },
    enabled: supported,
  })
  const enabling = useOneAtATime()
  const enable = useMutation({
    mutationFn: async (asked: Promise<NotificationPermission>): Promise<DeviceNotifications> => {
      const permission = await asked
      if (permission !== 'granted') return { permission, subscription: null }
      const subscription = await register(api, push, await subscribe(api, push))
      return { permission, subscription }
    },
    onSuccess: (enabled) => queryClient.setQueryData(['push-subscription'], enabled),
    onSettled: enabling.done,
  })

  function tapEnable() {
    enabling.start(() => enable.mutate(push.requestPermission()))
  }

  // On iPhone, Safari can't get Notifications; Nando added to the Home Screen can.
  if (!supported) {
    return <DeviceStatus on={false} footer={<p className="my-0">To get Notifications, add Nando to the Home Screen and open it from there.</p>} />
  }
  if (device.isError) {
    return <LoadProblem message="Couldn't check Notifications on this device." retry={() => device.refetch()} />
  }
  if (!device.isSuccess) return null
  // Once refused, the browser won't ask again; only the device's settings can allow them.
  if (device.data.permission === 'denied') {
    return (
      <DeviceStatus
        on={false}
        footer={
          <p role="alert" className="my-0">
            Notifications are turned off for Nando in this device's settings. Turn them on there first.
          </p>
        }
      />
    )
  }
  if (device.data.subscription) {
    return (
      <>
        <DeviceStatus on />
        {/* A device the test removed may be this one: registering it again finds out, and replaces it. */}
        <TestNotification onRemoved={() => queryClient.invalidateQueries({ queryKey: ['push-subscription'] })} />
      </>
    )
  }
  return (
    <>
      <DeviceStatus
        on={false}
        footer={
          enable.isError && (
            <p role="alert" className="my-0 text-ink">
              Couldn't enable Notifications.
            </p>
          )
        }
      />
      {/* Safari asks for the permission only straight from a tap's click, so it is asked before
          anything is awaited, from a native button's onClick. */}
      <button type="button" disabled={enable.isPending} onClick={tapEnable} className={`${pillClasses('accent')} mt-3 w-full`}>
        Enable Notifications
      </button>
    </>
  )
}

// Registers `subscription` with Core, and answers the Push Subscription this device now has. Core
// refuses one its push service no longer knows (410), which the browser still holds: it is then
// unsubscribed and replaced by a fresh one, without asking for the permission again, since it stays
// granted. Only once, so a fresh one Core refuses too is an error rather than a loop.
async function register(api: ApiClient, push: Push, subscription: PushSubscriptionJSON): Promise<PushSubscriptionJSON> {
  try {
    await api.post('/api/push-subscriptions', subscription)
    return subscription
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 410)) throw error
  }
  await push.unsubscribe()
  const fresh = await subscribe(api, push)
  await api.post('/api/push-subscriptions', fresh)
  return fresh
}

// Subscribes this device with Core's VAPID public key. Needs the permission granted.
async function subscribe(api: ApiClient, push: Push): Promise<PushSubscriptionJSON> {
  const { publicKey } = await api.get<{ publicKey: string }>('/api/push-subscriptions/vapid-public-key')
  return push.subscribe(publicKey)
}

// Whether this device gets Notifications, as one row ("This iPhone · On"), and why under it.
function DeviceStatus({ on, footer }: { on: boolean; footer?: ReactNode }) {
  return (
    <GroupedList footer={footer}>
      <ListRow className="text-[17px]">
        <span>{thisDevice()}</span>
        <span className="text-sub">{on ? 'On' : 'Off'}</span>
      </ListRow>
    </GroupedList>
  )
}

// This device, by its kind where Nando can tell. iPadOS says it is a Mac, but a Mac has no touch screen.
function thisDevice(): string {
  const { userAgent, maxTouchPoints } = navigator
  if (/iPhone/.test(userAgent)) return 'This iPhone'
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'This iPad'
  return 'This device'
}

// What Core answers about the test Notification it sent to every Push Subscription.
type TestNotificationResult = {
  sent: number
  removed: number
  failed: { pushService: string; status?: number; reason: string }[]
}

// The button that sends a test Notification to every device that gets them, and what came of it under
// it. Calls `onRemoved` when Core removed a device a push service no longer knew.
function TestNotification({ onRemoved }: { onRemoved: () => void }) {
  const api = useApi()
  const sending = useOneAtATime()
  const send = useMutation({
    mutationFn: () => api.post<TestNotificationResult>('/api/push-subscriptions/test'),
    onSuccess: (result) => {
      if (result.removed > 0) onRemoved()
    },
    onSettled: sending.done,
  })

  function tapSend() {
    sending.start(() => send.mutate())
  }
  return (
    <div className="mt-3">
      <Button size="large" isDisabled={send.isPending} onPress={tapSend}>
        {send.isPending ? 'Sending…' : 'Send a test Notification'}
      </Button>
      {/* Always there, so a screen reader reads out the result when it fills in. */}
      <div role="status" className={send.isSuccess ? footerClasses : undefined}>
        {send.isSuccess && (
          <>
            <p className="my-0">Sent to {devices(send.data.sent)}.</p>
            {send.data.removed > 0 && (
              <p className="my-0">
                Removed {devices(send.data.removed)} that no longer {send.data.removed === 1 ? 'gets' : 'get'} Notifications.
              </p>
            )}
            {send.data.failed.map((failure, i) => (
              <p key={i} className="my-0">
                {failureSentence(failure)}
              </p>
            ))}
          </>
        )}
      </div>
      {send.isError && <LoadProblem message="Couldn't send the test Notification." retry={tapSend} />}
    </div>
  )
}

// What one failed push service means for the Owner. One that answered 404 or 410 was reached, but no
// longer knows the device, which Core couldn't remove this time and removes at the next send.
function failureSentence({ pushService, status }: TestNotificationResult['failed'][number]): string {
  const name = pushServiceName(pushService)
  if (status === 404 || status === 410) return `${name} no longer knows 1 device. Nando removes it next time.`
  return `Couldn't reach ${name}${status ? ` (${status})` : ''}.`
}

// A guard for a button whose work must not start twice: `start` runs only while the last run is
// done. It is set straight from the tap, so a quick second tap can't start again before the
// mutation's `isPending` reaches the button; pass `done` as the mutation's `onSettled`.
function useOneAtATime() {
  const busy = useRef(false)
  return {
    start(run: () => void) {
      if (busy.current) return
      busy.current = true
      run()
    },
    done: () => {
      busy.current = false
    },
  }
}

// "1 device" or "2 devices".
function devices(count: number): string {
  return count === 1 ? '1 device' : `${count} devices`
}

// The push service at `host`, by whose it is where Nando knows it ("Apple's push service"), else by its host.
function pushServiceName(host: string): string {
  if (host === 'web.push.apple.com') return "Apple's push service"
  if (host === 'fcm.googleapis.com') return "Google's push service"
  if (host === 'updates.push.services.mozilla.com') return "Mozilla's push service"
  if (host.endsWith('.notify.windows.com')) return "Microsoft's push service"
  return host
}
