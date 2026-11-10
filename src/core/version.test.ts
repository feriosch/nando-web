import { describe, expect, it } from 'vitest'
import { versionLabel } from './version'

describe('versionLabel', () => {
  it('shows the build number beside the version when the deploy set one', () => {
    expect(versionLabel('0.1.0', '45')).toBe('Version 0.1.0 (45)')
  })

  it('shows the version alone in a local or PR build', () => {
    expect(versionLabel('0.1.0', undefined)).toBe('Version 0.1.0')
  })
})
