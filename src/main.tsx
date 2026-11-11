import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { api } from './core/api'
import { CoreProvider } from './core/CoreProvider'
import { browserPasskeys } from './core/identity/passkeys'
import { browserPush } from './core/notifications/push'
import { createRoutes } from './core/shell/routes'
// Zen Maru Gothic, the display font of some Module themes, self-hosted.
import '@fontsource/zen-maru-gothic/500.css'
import '@fontsource/zen-maru-gothic/700.css'
// Zen Kaku Gothic New, Japanese's display font for Japanese text: a Word's spelling, a Kanji's character.
import '@fontsource/zen-kaku-gothic-new/400.css'
import '@fontsource/zen-kaku-gothic-new/700.css'
import './index.css'
import { registry } from './registry'

const queryClient = new QueryClient()
const router = createBrowserRouter(createRoutes(registry))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CoreProvider api={api} passkeys={browserPasskeys} push={browserPush}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </CoreProvider>
  </StrictMode>,
)
