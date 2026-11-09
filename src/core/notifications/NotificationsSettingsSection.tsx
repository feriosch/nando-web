import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi, usePush } from '../services'
import { LoadProblem } from '../shell/LoadProblem'

// Core's Notifications Settings Section: whether this device gets Notifications, and a button to
// enable them.
export function NotificationsSettingsSection() {
  const api = useApi()
  const push = usePush()
  const queryClient = useQueryClient()
  const [supported] = useState(() => push.supported())
  const [permission, setPermission] = useState(() => push.permission())
  // This device's Push Subscription, registered again whenever it is read: Core deletes one a push
  // service stopped knowing, and registering the same one again is safe.
  const subscription = useQuery({
    queryKey: ['push-subscription'],
    queryFn: async () => {
      const current = await push.subscription()
      if (current) await api.post('/api/push-subscriptions', current)
      return current
    },
    enabled: supported,
  })
  const enable = useMutation({
    mutationFn: async (asked: Promise<NotificationPermission>) => {
      const answer = await asked
      setPermission(answer)
      if (answer !== 'granted') return null
      const { publicKey } = await api.get<{ publicKey: string }>('/api/push-subscriptions/vapid-public-key')
      const subscribed = await push.subscribe(publicKey)
      await api.post('/api/push-subscriptions', subscribed)
      return subscribed
    },
    onSuccess: (subscribed) => {
      if (subscribed) queryClient.setQueryData(['push-subscription'], subscribed)
    },
  })

  // On iPhone, Safari can't get Notifications; Nando added to the Home Screen can.
  if (!supported) {
    return <p>To get Notifications, add Nando to the Home Screen and open it from there.</p>
  }
  if (subscription.isError) {
    return <LoadProblem message="Couldn't check Notifications on this device." retry={() => subscription.refetch()} />
  }
  if (!subscription.isSuccess) return null
  if (subscription.data) {
    return <p>Notifications are on for this device.</p>
  }
  // Once refused, the browser won't ask again; only the device's settings can allow them.
  if (permission === 'denied') {
    return <p role="alert">Notifications are turned off for Nando in this device's settings. Turn them on there first.</p>
  }
  return (
    <>
      <p>Notifications are off on this device.</p>
      {/* Safari asks for the permission only straight from a tap, so it is asked before anything is awaited. */}
      <button type="button" onClick={() => enable.mutate(push.requestPermission())}>
        Enable Notifications
      </button>
      {enable.isError && <p role="alert">Couldn't enable Notifications.</p>}
    </>
  )
}
