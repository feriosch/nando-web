import type { Drawing } from './drawing'

// What reads a Drawing: up to 8 kanji it may be, best guess first (the Drawing's Candidates).
export type Recognizer = {
  recognize(drawing: Drawing): Promise<string[]>
}
