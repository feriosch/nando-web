import type { ReactNode } from 'react'
import { ServicesContext, type Services } from './services'

export function CoreProvider({ api, passkeys, push, children }: Services & { children: ReactNode }) {
  return <ServicesContext.Provider value={{ api, passkeys, push }}>{children}</ServicesContext.Provider>
}
