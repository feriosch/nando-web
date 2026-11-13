import { onlineManager } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ServicesContext, type Services } from './services'

export function CoreProvider({ api, passkeys, push, share, leave, children }: Services & { children: ReactNode }) {
  // React Query only learns the device is offline from the browser's 'offline' event, which never
  // comes when Nando opens offline: it would then never see 'online' as a change, and never make
  // failed queries again. Starting from the device's own state, before any screen asks, fixes that.
  useState(() => onlineManager.setOnline(navigator.onLine))
  return <ServicesContext.Provider value={{ api, passkeys, push, share, leave }}>{children}</ServicesContext.Provider>
}
