import { drawingToModelInput, INPUT_SIZE, type Drawing } from './drawing'
import type { Recognizer } from './recognizer'

// The kanji model from nando-kanji-ml (public/models/kanji/), run with LiteRT.js on WASM, as that
// release chose on the iPhone 17 (release.json). Nothing loads until Draw first needs it: then the
// runtime, its WASM (served from /litert/<its version>/ by the build, see vite.config.ts) and the
// model, all kept by the service worker so Draw works offline.

const MODEL_DIR = '/models/kanji'
const CANDIDATES = 8

type Loaded = { classify: (input: Float32Array) => Promise<Float32Array>; labels: string[] }

let loading: Promise<Loaded> | null = null

// Loads once; a failed load is forgotten, so the next Drawing tries again (say, back online).
function load(): Promise<Loaded> {
  loading ??= loadModel().catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

async function loadModel(): Promise<Loaded> {
  // version.json names the current model; its files are requested with it, so a new release is
  // fetched afresh and the old one is never mixed in (nando-server's ADR 0005).
  const { version } = await fetchJson<{ version: string }>(`${MODEL_DIR}/version.json`)
  const [litert, labels] = await Promise.all([import('@litertjs/core'), fetchJson<string[]>(`${MODEL_DIR}/labels.json?v=${version}`)])
  await litert.loadLiteRt(__LITERT_WASM_DIR__)
  const model = await litert.loadAndCompile(`${MODEL_DIR}/kanji.tflite?v=${version}`, { accelerator: 'wasm' })
  return {
    labels,
    classify: async (input) => {
      const tensor = new litert.Tensor(input, [1, INPUT_SIZE, INPUT_SIZE, 1])
      const outputs = await model.run(tensor)
      tensor.delete()
      const scores = outputs[0].toTypedArray().slice() as Float32Array // copied before its memory is freed
      for (const output of outputs) output.delete()
      return scores
    },
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`)
  return (await response.json()) as T
}

export const liteRtRecognizer: Recognizer = {
  prepare: () => void load().catch(() => {}),
  recognize: async (drawing: Drawing) => {
    const input = drawingToModelInput(drawing)
    if (!input) return []
    const { classify, labels } = await load()
    const scores = await classify(Float32Array.from(input))
    return topIndexes(scores, CANDIDATES).map((i) => labels[i])
  },
}

// The indexes of the `count` highest scores, highest first.
function topIndexes(scores: Float32Array, count: number): number[] {
  return Array.from(scores.keys())
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, count)
}
