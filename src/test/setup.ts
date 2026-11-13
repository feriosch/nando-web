import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom's own, which fakePageScroll replaces.
const jsdomScroll = (['scrollY', 'scrollTo'] as const).map((name) => [name, Object.getOwnPropertyDescriptor(window, name)] as const)

afterEach(() => {
  cleanup()
  // Appearance is kept in localStorage and applied to <html>; each test starts on a fresh device.
  localStorage.clear()
  sessionStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
  document.body.className = ''
  // Back online, as each test starts: fakeConnection's navigator.onLine is dropped (the next test's
  // query client reads it, src/core/queries.ts).
  Reflect.deleteProperty(navigator, 'onLine')
  for (const [name, descriptor] of jsdomScroll) {
    if (descriptor) Object.defineProperty(window, name, descriptor)
    else Reflect.deleteProperty(window, name)
  }
})
