import { describe, expect, it } from 'vitest'
import fixtures from '../../../public/models/kanji/drawings.json'
import { drawingToModelInput, type Drawing } from './drawing'

// drawings.json comes from nando-kanji-ml's Python preprocessing, which trained the model: the
// TypeScript port must give the same 48x48 input, to within 1 per pixel (NumPy adds up its area
// averages in a different order from a plain loop).
type Fixture = { name: string; strokes: Drawing; expected: number[][] }

describe('drawingToModelInput', () => {
  it.each((fixtures as Fixture[]).map((f) => [f.name, f] as const))('turns the Drawing of %s into the input the model was trained on', (_, fixture) => {
    const input = drawingToModelInput(fixture.strokes)

    expect(input).not.toBeNull()
    const off: string[] = []
    fixture.expected.forEach((row, y) =>
      row.forEach((want, x) => {
        const got = input![y * 48 + x]
        if (Math.abs(got - want) > 1) off.push(`(${x}, ${y}): ${got}, want ${want}`)
      }),
    )
    expect(off).toEqual([])
  })

  it('gives no input for a Drawing without points', () => {
    expect(drawingToModelInput([])).toBeNull()
    expect(drawingToModelInput([[], []])).toBeNull()
  })
})
