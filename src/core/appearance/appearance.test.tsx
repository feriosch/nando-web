import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, renderApp } from '../../test/app'

// Appearance is kept on the device, so Settings shows it whether or not the server answers.
function openSettings(path = '/settings') {
  const { api } = fakeApi({})
  return renderApp(path, api)
}

// The device's own light or dark setting, which it can change while Nando is open.
function fakeDeviceScheme(dark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const query = {
    get matches() {
      return dark
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', (media: string) => {
    if (media !== query.media) throw new Error(`unexpected media query ${media}`)
    return query
  })
  return (next: boolean) => {
    dark = next
    listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent))
  }
}

function appearance() {
  return screen.getByRole('radiogroup', { name: 'Appearance' })
}

describe('Appearance', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('is the first thing in General and starts on System, which follows the iPhone', () => {
    openSettings()

    const general = screen.getByRole('region', { name: 'General' })
    expect(within(general).getAllByRole('radiogroup')[0]).toBe(appearance())
    expect(within(appearance()).getAllByRole('radio').map((option) => option.textContent)).toEqual([
      'System',
      'Light',
      'Dark',
    ])
    expect(within(appearance()).getByRole('radio', { name: 'System' })).toBeChecked()
    expect(within(general).getByText('System follows your iPhone.')).toBeInTheDocument()
  })

  it('switches the whole page to the one picked at once, and keeps it after a reload', async () => {
    const user = userEvent.setup()
    openSettings()

    await user.click(within(appearance()).getByRole('radio', { name: 'Dark' }))

    expect(within(appearance()).getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    cleanup()
    document.documentElement.className = ''
    openSettings()

    expect(within(appearance()).getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(document.documentElement).toHaveClass('dark')

    await user.click(within(appearance()).getByRole('radio', { name: 'Light' }))

    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('falls back to System when this device won\'t let it read or keep the choice, and still switches', async () => {
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    openSettings()

    expect(within(appearance()).getByRole('radio', { name: 'System' })).toBeChecked()

    await user.click(within(appearance()).getByRole('radio', { name: 'Dark' }))

    expect(within(appearance()).getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(document.documentElement).toHaveClass('dark')
  })

  it('on System, follows the device, also when it changes while Nando is open', async () => {
    const setDeviceDark = fakeDeviceScheme(true)
    // On any screen, not only Settings.
    openSettings('/')

    expect(document.documentElement).toHaveClass('dark')

    act(() => setDeviceDark(false))

    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('on Light, stays light whatever the device is set to', async () => {
    const user = userEvent.setup()
    const setDeviceDark = fakeDeviceScheme(true)
    openSettings()

    await user.click(within(appearance()).getByRole('radio', { name: 'Light' }))
    act(() => setDeviceDark(true))

    expect(document.documentElement).not.toHaveClass('dark')
  })
})
