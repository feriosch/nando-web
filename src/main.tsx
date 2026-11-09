import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { api } from './core/api'
import { CoreProvider } from './core/CoreProvider'
import { browserPasskeys } from './core/identity/passkeys'
import { createRoutes } from './core/shell/routes'
import './index.css'
import { registry } from './registry'

const queryClient = new QueryClient()
const router = createBrowserRouter(createRoutes(registry))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CoreProvider api={api} passkeys={browserPasskeys}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </CoreProvider>
  </StrictMode>,
)
