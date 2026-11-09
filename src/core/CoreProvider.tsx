import type { ReactNode } from 'react'
import { ServicesContext, type Services } from './services'

export function CoreProvider({ api, passkeys, children }: Services & { children: ReactNode }) {
  return <ServicesContext.Provider value={{ api, passkeys }}>{children}</ServicesContext.Provider>
}
