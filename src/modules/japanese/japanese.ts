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
