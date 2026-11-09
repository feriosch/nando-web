import { useEffect, useState, type ReactNode } from 'react'
import { AppearanceContext, apply, deviceDark, read, save, type Appearance } from './appearance'

// Holds the Appearance for the whole app and keeps the page in step with it, and on System with the
// device's own setting as it changes.
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(read)

  useEffect(() => {
    if (appearance !== 'system') {
      apply(appearance === 'dark')
      return
    }
    // jsdom and very old browsers have no matchMedia: System is then light.
    const query = typeof window.matchMedia === 'function' ? window.matchMedia(deviceDark) : null
    apply(query?.matches ?? false)
    if (!query) return
    const follow = (event: MediaQueryListEvent) => apply(event.matches)
    query.addEventListener('change', follow)
    return () => query.removeEventListener('change', follow)
  }, [appearance])

  const change = (next: Appearance) => {
    save(next)
    setAppearance(next)
  }
  return <AppearanceContext.Provider value={[appearance, change]}>{children}</AppearanceContext.Provider>
}
