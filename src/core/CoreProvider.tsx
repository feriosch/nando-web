import { useEffect, type ReactNode } from 'react'
import { ServicesContext, type Services } from './services'

export function CoreProvider({ api, passkeys, push, share, clipboard, leave, children }: Services & { children: ReactNode }) {
  // Nando's Notifications come through Telegram now: drop the Push Subscription this device may
  // still hold, once each time Nando opens. Failing to is harmless, so it is only ignored.
  useEffect(() => {
    push.unsubscribe().catch(() => {})
  }, [push])
  return <ServicesContext.Provider value={{ api, passkeys, push, share, clipboard, leave }}>{children}</ServicesContext.Provider>
}
