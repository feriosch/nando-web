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

// The kept model files' cache (src/sw.ts), and where the last version that loaded is remembered.
const MODEL_CACHE = 'kanji-model'
const LAST_LOADED_KEY = 'nando.kanji-model.version'

// Loads the version version.json names. If that fails (its download was cut off, or version.json
// can't be fetched at all), the last version that loaded, which is still kept, so a release never
// leaves Draw without a model. Only once a version has loaded are the others' files deleted.
async function loadModel(): Promise<Loaded> {
  const named = await fetchJson<{ version: string }>(`${MODEL_DIR}/version.json`).then(
    ({ version }) => version,
    () => null,
  )
  const versions = [...new Set([named, lastLoaded()].filter((version) => version !== null))]
  if (versions.length === 0) throw new Error('No kanji model version to load: version.json is out of reach')
  const litert = await import('@litertjs/core')
  await litert.loadLiteRt(__LITERT_WASM_DIR__)
  let failure: unknown
  for (const version of versions) {
    try {
      const loaded = await loadVersion(litert, version)
      rememberLoaded(version)
      void keepOnly(version)
      return loaded
    } catch (error) {
      // Said where it can be seen, as a release that can't load otherwise goes unnoticed: phones
      // quietly keep using the version before it.
      console.warn(`Kanji model ${version} couldn't load${version === versions.at(-1) ? '' : ', trying the last one that did'}`, error)
      failure = error
    }
  }
  throw failure
}

// The model and labels of `version`, requested with it (?v=), so a new release is fetched afresh
// and labels and weights from different versions never mix (nando-server's ADR 0005).
async function loadVersion(litert: typeof import('@litertjs/core'), version: string): Promise<Loaded> {
  const [labelsResult, modelResult] = await Promise.allSettled([
    fetchJson<string[]>(`${MODEL_DIR}/labels.json?v=${version}`),
    litert.loadAndCompile(`${MODEL_DIR}/kanji.tflite?v=${version}`, { accelerator: 'wasm' }),
  ])
  if (labelsResult.status === 'rejected') {
    // The model may have compiled: it won't be used, so its memory is freed before trying another.
    if (modelResult.status === 'fulfilled') modelResult.value.delete()
    throw labelsResult.reason
  }
  if (modelResult.status === 'rejected') throw modelResult.reason
  const labels = labelsResult.value
  const model = modelResult.value
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

// The last version that loaded on this phone, or null. localStorage can be unavailable (some
// private modes): then there's simply no fallback.
function lastLoaded(): string | null {
  try {
    return localStorage.getItem(LAST_LOADED_KEY)
  } catch {
    return null
  }
}

function rememberLoaded(version: string) {
  try {
    localStorage.setItem(LAST_LOADED_KEY, version)
  } catch {
    // No fallback next time, nothing worse.
  }
}

// Deletes the kept files of every version but `version`, now that it has loaded.
async function keepOnly(version: string) {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(MODEL_CACHE)
    for (const kept of await cache.keys()) {
      const keptVersion = new URL(kept.url).searchParams.get('v')
      if (keptVersion !== null && keptVersion !== version) await cache.delete(kept)
    }
  } catch {
    // Left for the next load to clean up.
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
