// A Drawing, turned into the 48x48 input the kanji model was trained on.
//
// A step-for-step port of nando-kanji-ml's kanji_ml/strokes.py (drawing_to_model_input) and
// kanji_ml/preprocess.py (to_model_input): the model only recognises what these give, so they must
// stay in step. public/models/kanji/drawings.json, from the Python side, checks that they do.
// Both sides compute in float64 (plain JS numbers) and round halves up, floor(x + 0.5).

// The strokes in the order drawn, each a list of [x, y] points, y pointing down, in any unit.
export type Drawing = number[][][]

export const INPUT_SIZE = 48

const BOX = 160 // the Drawing is drawn to fit this square, pen included: 4x the model's 40-pixel box
const PEN = 6 // ink fades from 1 on a stroke's centre line to 0 this many pixels away
const MARGIN = 2 // blank pixels around the box
const INK_BOX = 40 // the ink's longer side is scaled to this, leaving a 4-pixel margin
const INK_THRESHOLD = 0.2 // pixels at or below this fraction of the strongest pixel are background

const round = (x: number) => Math.floor(x + 0.5)

// The model's input for a Drawing, row by row (48 x 48, 0-255, ink 255 on 0), or null when the
// Drawing has no points and there is nothing to recognise.
export function drawingToModelInput(drawing: Drawing): Uint8Array | null {
  const rendered = render(drawing)
  return rendered && toModelInput(rendered.pixels, rendered.size)
}

// strokes.py's _render: the Drawing drawn with a soft pen on a (BOX + 2 * MARGIN)-pixel square.
// A pixel's ink is measured at its centre; each stroke can only raise it, from 0.
function render(drawing: Drawing): { pixels: Float64Array; size: number } | null {
  const points = drawing.flat()
  if (points.length === 0) return null
  let lowX = Infinity
  let lowY = Infinity
  let highX = -Infinity
  let highY = -Infinity
  for (const [x, y] of points) {
    lowX = Math.min(lowX, x)
    lowY = Math.min(lowY, y)
    highX = Math.max(highX, x)
    highY = Math.max(highY, y)
  }
  const extent = Math.max(highX - lowX, highY - lowY)
  const scale = extent > 0 ? (BOX - 2 * PEN) / extent : 0
  const size = BOX + 2 * MARGIN
  const ink = new Float64Array(size * size)

  for (const stroke of drawing) {
    if (stroke.length === 0) continue
    const fitted = stroke.map(([x, y]) => [(x - lowX) * scale + (MARGIN + PEN), (y - lowY) * scale + (MARGIN + PEN)])
    // A tap is a segment of length 0.
    const segments = fitted.length > 1 ? fitted.slice(1).map((b, i) => [fitted[i], b]) : [[fitted[0], fitted[0]]]
    for (const [[ax, ay], [bx, by]] of segments) {
      const dx = bx - ax
      const dy = by - ay
      const length2 = dx * dx + dy * dy
      for (let row = 0; row < size; row++) {
        const y = row + 0.5
        for (let col = 0; col < size; col++) {
          const x = col + 0.5
          const t = length2 > 0 ? Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / length2, 0), 1) : 0
          const offX = x - (ax + t * dx)
          const offY = y - (ay + t * dy)
          const value = 1 - Math.sqrt(offX * offX + offY * offY) / PEN
          if (value > ink[row * size + col]) ink[row * size + col] = value
        }
      }
    }
  }
  const pixels = new Float64Array(size * size)
  for (let i = 0; i < pixels.length; i++) pixels[i] = round(ink[i] * 255)
  return { pixels, size }
}

// preprocess.py's to_model_input: crop to the ink, scale its longer side to 40 by area-averaging,
// centre it in 48x48, and stretch it so the strongest ink is 255.
function toModelInput(source: Float64Array, size: number): Uint8Array {
  const image = Float64Array.from(source)
  const threshold = Math.max(...image) * INK_THRESHOLD
  for (let i = 0; i < image.length; i++) if (image[i] <= threshold) image[i] = 0

  let top = Infinity
  let bottom = -1
  let left = Infinity
  let right = -1
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (image[row * size + col] === 0) continue
      top = Math.min(top, row)
      bottom = Math.max(bottom, row)
      left = Math.min(left, col)
      right = Math.max(right, col)
    }
  }
  const out = new Uint8Array(INPUT_SIZE * INPUT_SIZE)
  if (bottom < 0) return out
  const inkHeight = bottom - top + 1
  const inkWidth = right - left + 1

  const scale = INK_BOX / Math.max(inkHeight, inkWidth)
  const height = Math.max(1, round(inkHeight * scale))
  const width = Math.max(1, round(inkWidth * scale))
  const offsetTop = Math.floor((INPUT_SIZE - height) / 2)
  const offsetLeft = Math.floor((INPUT_SIZE - width) / 2)

  // (rows @ ink) @ cols^T, as NumPy evaluates it.
  const rows = areaWeights(inkHeight, height)
  const cols = areaWeights(inkWidth, width)
  const tall = new Float64Array(height * inkWidth)
  for (let i = 0; i < height; i++) {
    for (let k = 0; k < inkHeight; k++) {
      const weight = rows[i * inkHeight + k]
      if (weight === 0) continue
      for (let j = 0; j < inkWidth; j++) tall[i * inkWidth + j] += weight * image[(top + k) * size + left + j]
    }
  }
  const resized = new Float64Array(INPUT_SIZE * INPUT_SIZE)
  let strongest = 0
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      let sum = 0
      for (let k = 0; k < inkWidth; k++) sum += tall[i * inkWidth + k] * cols[j * inkWidth + k]
      resized[(offsetTop + i) * INPUT_SIZE + offsetLeft + j] = sum
      strongest = Math.max(strongest, sum)
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = round((resized[i] * 255) / strongest)
  return out
}

// A (target x source) matrix, row by row, that averages source pixels into target pixels by how
// much each overlaps it.
function areaWeights(source: number, target: number): Float64Array {
  const weights = new Float64Array(target * source)
  const span = source / target
  for (let i = 0; i < target; i++) {
    const start = (i * source) / target
    const end = ((i + 1) * source) / target
    for (let pixel = 0; pixel < source; pixel++) {
      const overlap = Math.max(Math.min(end, pixel + 1) - Math.max(start, pixel), 0)
      weights[i * source + pixel] = overlap / span
    }
  }
  return weights
}
