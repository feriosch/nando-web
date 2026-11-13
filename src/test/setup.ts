import '@testing-library/jest-dom/vitest'
import { onlineManager } from '@tanstack/react-query'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // Appearance is kept in localStorage and applied to <html>; each test starts on a fresh device.
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
  document.body.className = ''
  // Back online, as each test starts: fakeConnection's navigator.onLine is dropped, and React
  // Query's online state, which is global, is reset.
  Reflect.deleteProperty(navigator, 'onLine')
  onlineManager.setOnline(true)
})
