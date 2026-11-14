import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '../../core/api/client'
import { useApi } from '../../core/services'

// The Japanese API's shapes, as nando-server's internal/japanese/API.md documents them. Word Tags
// and Nuance Tags come as stored, in snake_case; optional strings are null, lists never are.

// A Word as a row: in search results, a Word Link and a Kanji page.
export type WordRow = {
  id: string
  // The kanji spelling, or the kana if the Word has none.
  word: string
  // The reading, or null when `word` is already kana.
  hiragana: string | null
  spanish: string
  // The key of the Word's Group, such as `jlpt_n2`.
  group: string
}

// A Kanji as a row.
export type KanjiRow = {
  id: string
  kanji: string
  // Its meaning, which is also its Heisig keyword.
  spanish: string
}

// What GET /api/japanese/search answers: Words first, then Kanji.
export type SearchResults = { words: WordRow[]; kanji: KanjiRow[] }

// Each Group's display name, by key, for a Word row (which has only the key). The Word page has the
// Group's own name and picture from the server.
const groupNames: Record<string, string> = {
  jlpt_n1: 'JLPT N1',
  jlpt_n2: 'JLPT N2',
  jlpt_n3: 'JLPT N3',
  basic: 'Basic',
  literature: 'Literature',
  gaming: 'Gaming',
  anime: 'Anime',
  movie: 'Movie',
  miscellaneous: 'Miscellaneous',
}

// The Group with key `key` as the Owner reads it, such as "JLPT N2".
export function groupName(key: string): string {
  return groupNames[key] ?? words(key)
}

// The level a Group studies, easiest first, for its chip's colour: Basic, then JLPT N3, N2 and N1.
// The other Groups are where a Word was found, not a level.
export type Level = 'basic' | 'n3' | 'n2' | 'n1'

const groupLevels: Record<string, Level> = {
  basic: 'basic',
  jlpt_n3: 'n3',
  jlpt_n2: 'n2',
  jlpt_n1: 'n1',
}

export function groupLevel(key: string): Level | undefined {
  return groupLevels[key]
}

// A snake_case key written for display, such as `usually_kana` as "usually kana".
export function words(key: string): string {
  return key.replaceAll('_', ' ')
}

export type WordLinkKind = 'synonym' | 'antonym' | 'related'

// One side of a Word Link: about the other Word, and how it differs from this one.
export type WordLink = { kind: WordLinkKind; note: string | null; nuanceTags: string[]; word: WordRow }

// A Hint: an everyday word that isn't stored as a Word. It can't be opened.
export type Hint = { text: string; note: string | null }

// What GET /api/japanese/words/{id} answers.
export type Word = Omit<WordRow, 'group'> & {
  // Each part of speech, by key, with 1, or 4 for its と form, or 5 for its 的 form.
  type: Record<string, number | boolean>
  group: { key: string; name: string; imageUrl: string | null }
  tags: string[]
  notes: string | null
  sentences: { sentence: string; translation: string }[]
  wordLinks: WordLink[]
  hints: Hint[]
  kanji: KanjiRow[]
}

const partsOfSpeech: Record<string, string> = {
  noun: 'noun',
  suru: 'suru verb',
  no_adj: 'の adjective',
  na_adj: 'な adjective',
  i_adj: 'い adjective',
  adv: 'adverb',
  verb: 'verb',
  adj_noun: 'adjectival noun',
  adv_noun: 'adverbial noun',
  counter: 'counter',
}

// A Word's parts of speech in the order stored, such as "noun, suru verb" or "adverb (と)".
export function typeOf(type: Word['type']): string {
  return Object.entries(type)
    .filter(([, form]) => form)
    .map(([key, form]) => {
      const name = partsOfSpeech[key] ?? words(key)
      if (form === 4) return `${name} (と)`
      if (form === 5) return `${name} (的)`
      return name
    })
    .join(', ')
}

// One of the shapes a Kanji is written with: a stored Kanji (`kanji`), or an irregular shape (null).
export type Component = { name: string; kanji: KanjiRow | null }

// What GET /api/japanese/kanji/{id} answers.
export type Kanji = KanjiRow & {
  on: string | null
  kun: string | null
  // Its Heisig numbers: in volume 1, and in volume 2 if it has one.
  v1: number
  v2: number | null
  story: string | null
  components: Component[]
  // Up to 50 Words spelled with it, shorter first.
  words: WordRow[]
}

// A stored Kanji that one of a Drawing's Candidates turned out to be, as GET /api/japanese/kanji?kanji=
// answers it.
export type CandidateKanji = KanjiRow & {
  // Its number in Heisig's Remembering the Kanji, volume 1.
  v1: number
}

// A Kanji Lookup: what Nando finds out about a kanji the Owner hasn't stored, from kanjiapi.dev and
// jisho.org, as GET /api/japanese/lookup/kanji/{kanji} answers it. Meanings are in English.
export type KanjiLookup = {
  kanji: string
  meanings: string[]
  on: string[]
  kun: string[]
  strokes: number
  // Its school grade: 1 to 6, 8 for secondary school, 9 or 10 for jinmeiyō; null for none.
  grade: number | null
  joyo: boolean
  jlpt: number | null
  // Common words spelled with it, from Jisho.
  words: { word: string; reading: string; meanings: string[] }[]
}

// A Word Request: the Owner's ask for Claude to add a word or to improve a stored Word, as
// GET /api/japanese/word-requests lists it for the Pending strip.
export type WordRequest = {
  id: string
  // The word as the Owner typed it to add, or the Word's spelling to improve.
  text: string
  kind: 'add' | 'improve'
  // The Group the Owner found the word in, to add; null to improve.
  group: string | null
  // The Word to improve; once done, the Word added or improved.
  wordId: string | null
  state: 'pending' | 'working' | 'done' | 'needs_answer' | 'failed'
  // How many Claude runs have taken it.
  attempts: number
  answer: string | null
  // What Claude did, once done, or why it gave up, once failed.
  summary: string | null
  // What Claude thinks the Owner should do in Claude Code, once done.
  suggestions: string[]
  question: string | null
  choices: string[]
}

const wordRequestsKey = ['japanese', 'word-requests']

// The Word Requests for the Pending strip, newest first: the open ones, and those done or failed in
// the last 7 days that the Owner hasn't dismissed. Loaded again whenever Japanese search opens and
// whenever Nando comes back to the foreground (React Query's refetchOnMount and refetchOnWindowFocus,
// which follows visibilitychange), never polled.
export function useWordRequests() {
  const api = useApi()
  return useQuery({ queryKey: wordRequestsKey, queryFn: () => api.get<WordRequest[]>('/api/japanese/word-requests') })
}

// Answers Claude's question on a Word Request, with one of its choices or the Owner's own words,
// which sends it back to waiting for a Claude run.
export function useAnswerWordRequest() {
  return useWordRequestChange((api, { id, answer }: { id: string; answer: string }) =>
    api.post<WordRequest>(`/api/japanese/word-requests/${encodeURIComponent(id)}/answer`, { answer }),
  )
}

// Sends a failed Word Request back to waiting, for 3 fresh Claude runs.
export function useRetryWordRequest() {
  return useWordRequestChange((api, id: string) => api.post<WordRequest>(`/api/japanese/word-requests/${encodeURIComponent(id)}/retry`))
}

// Takes a done or failed Word Request off the Pending strip, as when the Owner opens it.
export function useDismissWordRequest() {
  return useWordRequestChange((api, id: string) => api.post<WordRequest>(`/api/japanese/word-requests/${encodeURIComponent(id)}/dismiss`))
}

// A change the Owner makes to a Word Request, sent with `send`; the strip then loads again, so it
// shows the Word Request as the server has it, whether the change went through or not.
function useWordRequestChange<Change>(send: (api: ApiClient, change: Change) => Promise<WordRequest>) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (change: Change) => send(api, change),
    onSettled: () => queryClient.invalidateQueries({ queryKey: wordRequestsKey }),
  })
}
