import { createContext, useContext } from 'react'

// Appearance (see the glossary): Light, Dark, or System, which follows the device. Kept in this
// device's localStorage only. The script in index.html applies the same key before first paint.
export type Appearance = 'system' | 'light' | 'dark'

export const storageKey = 'nando.appearance'
export const deviceDark = '(prefers-color-scheme: dark)'

// localStorage can throw (blocked storage, private browsing): every read and write falls back to System.
export function read(): Appearance {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Fall through to System.
  }
  return 'system'
}

export function save(appearance: Appearance) {
  try {
    if (appearance === 'system') localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, appearance)
  } catch {
    // Not kept, but still applied for as long as the app is open.
  }
}

// Dark or light colours on the whole page: the `dark` class the themes key off, and `color-scheme`
// for the browser's own controls and scrollbars.
export function apply(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  syncThemeColor()
}

// <meta name="theme-color">, which colours the browser's own chrome, follows the background of the
// screen on view (`screen`, or the [data-screen] frame the shell draws).
export function syncThemeColor(screen?: Element | null) {
  const meta = document.querySelector('meta[name="theme-color"]')
  const frame = screen ?? document.querySelector('[data-screen]')
  if (!meta || !frame) return
  const background = getComputedStyle(frame).backgroundColor
  if (background) meta.setAttribute('content', background)
}

export const AppearanceContext = createContext<readonly [Appearance, (next: Appearance) => void] | null>(null)

export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('useAppearance needs an <AppearanceProvider>')
  return value
}
