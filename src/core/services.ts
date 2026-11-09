import { createContext, useContext } from 'react'
import type { ApiClient } from './api/client'
import type { Passkeys } from './identity/passkeys'

// What Core hands to every screen, Core's and every Module's: the API client and the device's
// Passkeys. <CoreProvider> provides them.
export type Services = {
  api: ApiClient
  passkeys: Passkeys
}

export const ServicesContext = createContext<Services | null>(null)

function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) {
    throw new Error('Render inside <CoreProvider>')
  }
  return services
}

export function useApi(): ApiClient {
  return useServices().api
}

export function usePasskeys(): Passkeys {
  return useServices().passkeys
}
