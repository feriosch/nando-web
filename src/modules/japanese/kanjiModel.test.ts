import { describe, expect, it } from 'vitest'

// public/models/kanji/ is replaced by nando-kanji-ml's release workflow. These check the
// contract Draw relies on, so a broken release fails here, not as misnamed Candidates.
// Until the first release is merged the folder doesn't exist, and they're skipped.
const files: Record<string, unknown> = import.meta.glob('/public/models/kanji/*.json', {
  eager: true,
  import: 'default',
})
const file = (name: string) => files[`/public/models/kanji/${name}`]

type Release = { runtime: string; accelerator: string; input: number[]; classes: number; top1: number; top8: number }
type Fixture = { name: string; strokes: number[][][]; expected: number[][] }

describe.skipIf(Object.keys(files).length === 0)('the kanji model folder', () => {
  const release = file('release.json') as Release

  it('names its version, as vN', () => {
    expect(file('version.json')).toEqual({ version: expect.stringMatching(/^v\d+$/) })
  })

  it('was checked with a pinned LiteRT.js on WASM, one 48x48 Drawing at a time, and passed the gate', () => {
    expect(release.runtime).toMatch(/^@litertjs\/core@\d+\.\d+\.\d+$/)
    expect(release.accelerator).toBe('wasm')
    expect(release.input).toEqual([1, 48, 48, 1])
    expect(release.top8).toBeGreaterThanOrEqual(0.95) // nando-server's ADR 0005: ship only if top-8 >= 95%
  })

  it('has one kanji label per model output, each a single character', () => {
    const labels = file('labels.json') as string[]

    expect(labels).toHaveLength(release.classes)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels.every((label) => [...label].length === 1)).toBe(true)
  })

  it('has preprocessing fixtures: strokes in, a 48x48 image of 0-255 out', () => {
    const fixtures = file('drawings.json') as Fixture[]

    expect(fixtures.length).toBeGreaterThan(0)
    for (const { name, strokes, expected } of fixtures) {
      expect(name).toBeTruthy()
      expect(Array.isArray(strokes)).toBe(true)
      expect(expected).toHaveLength(48)
      expect(expected.every((row) => row.length === 48 && row.every((v) => Number.isInteger(v) && v >= 0 && v <= 255))).toBe(true)
    }
  })
})
