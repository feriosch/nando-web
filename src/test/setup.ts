import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // Appearance is kept in localStorage and applied to <html>; each test starts on a fresh device.
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
})
