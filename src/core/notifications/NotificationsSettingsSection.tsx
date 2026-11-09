import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, type ReactNode } from 'react'
import { useApi, usePush } from '../services'
import { LoadProblem } from '../shell/LoadProblem'
import { pillClasses } from '../ui/pill'
import { GroupedList, ListRow } from '../ui/List'
import type { PushSubscriptionJSON } from './push'

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
  // device's settings. A Push Subscription is registered again each time: Core deletes one a push
  // service stopped knowing, and registering the same one again is safe. Without the permission
  // it can't deliver, so it counts as none.
  const device = useQuery({
    queryKey: ['push-subscription'],
    queryFn: async (): Promise<DeviceNotifications> => {
      const permission = push.permission()
      const subscription = permission === 'granted' ? await push.subscription() : null
      if (subscription) await api.post('/api/push-subscriptions', subscription)
      return { permission, subscription }
    },
    enabled: supported,
  })
  // Set straight from the tap, so a quick second tap can't start a second subscribe before
  // `isPending` reaches the button.
  const enabling = useRef(false)
  const enable = useMutation({
    mutationFn: async (asked: Promise<NotificationPermission>): Promise<DeviceNotifications> => {
      const permission = await asked
      if (permission !== 'granted') return { permission, subscription: null }
      const { publicKey } = await api.get<{ publicKey: string }>('/api/push-subscriptions/vapid-public-key')
      const subscription = await push.subscribe(publicKey)
      await api.post('/api/push-subscriptions', subscription)
      return { permission, subscription }
    },
    onSuccess: (enabled) => queryClient.setQueryData(['push-subscription'], enabled),
    onSettled: () => {
      enabling.current = false
    },
  })

  function tapEnable() {
    if (enabling.current) return
    enabling.current = true
    enable.mutate(push.requestPermission())
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
  if (device.data.subscription) return <DeviceStatus on />
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
