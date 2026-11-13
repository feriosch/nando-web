import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, noPush, renderApp, type Answers } from '../../test/app'
import { createJapanese } from '.'

// A Kanji Lookup as GET /api/japanese/lookup/kanji/{kanji} answers it (nando-server's API.md).
type KanjiLookup = {
  kanji: string
  meanings: string[]
  on: string[]
  kun: string[]
  strokes: number
  grade: number | null
  joyo: boolean
  jlpt: number | null
  words: { word: string; reading: string; meanings: string[] }[]
}

// The path GET /api/japanese/lookup/kanji/{kanji} is requested at: a browser percent-encodes the kanji.
const lookupOf = (kanji: string) => `GET /api/japanese/lookup/kanji/${encodeURIComponent(kanji)}`

function renderLookup(path: string, answers: Answers) {
  const fake = fakeApi(answers)
  const router = renderApp(path, fake.api, noPush, [createJapanese({ recognizer: { recognize: async () => [] } })])
  return { ...fake, router }
}

// The rows of the list named `name`, each as its text.
function rowsOf(name: string) {
  return within(screen.getByRole('list', { name })).getAllByRole('listitem').map((row) => row.textContent)
}

const shi: KanjiLookup = {
  kanji: '士',
  meanings: ['gentleman', 'scholar', 'samurai'],
  on: ['シ'],
  kun: ['さむらい'],
  strokes: 3,
  grade: 4,
  joyo: true,
  jlpt: 1,
  words: [
    { word: '武士', reading: 'ぶし', meanings: ['warrior', 'samurai'] },
    { word: '弁護士', reading: 'べんごし', meanings: ['lawyer', 'attorney'] },
  ],
}

describe('Kanji Lookup', () => {
  it('tells what a kanji the Owner hasn’t stored is', async () => {
    renderLookup('/japanese/lookup/士', { [lookupOf('士')]: { status: 200, body: shi } })

    expect(await screen.findByRole('heading', { level: 1, name: '士' })).toBeInTheDocument()
    expect(screen.getByText('gentleman, scholar, samurai')).toBeInTheDocument()
    expect(screen.getByText('Not one of your Kanji yet.')).toBeInTheDocument()
    expect(rowsOf('Readings')).toEqual(['Onシ', 'Kunさむらい'])
    expect(rowsOf('Details')).toEqual(['Strokes3', 'JōyōYes, grade 4', 'JLPTN1'])
    expect(rowsOf('Words')).toEqual(['武士ぶしwarrior, samurai', '弁護士べんごしlawyer, attorney'])
  })

  it('leaves out what kanjiapi.dev and Jisho don’t know', async () => {
    const ryu: KanjiLookup = {
      kanji: '龘',
      meanings: ['appearance of a dragon'],
      on: ['トウ', 'ドウ'],
      kun: [],
      strokes: 48,
      grade: null,
      joyo: false,
      jlpt: null,
      words: [],
    }
    renderLookup('/japanese/lookup/龘', { [lookupOf('龘')]: { status: 200, body: ryu } })

    expect(await screen.findByRole('heading', { level: 1, name: '龘' })).toBeInTheDocument()
    expect(rowsOf('Readings')).toEqual(['Onトウ、ドウ'])
    expect(rowsOf('Details')).toEqual(['Strokes48', 'JōyōNo'])
    expect(screen.queryByRole('list', { name: 'Words' })).not.toBeInTheDocument()
  })

  it('says how jōyō a kanji is, by its school grade', async () => {
    for (const [grade, says] of [[8, 'Yes, secondary school'], [9, 'No, jinmeiyō'], [10, 'No, jinmeiyō']] as const) {
      renderLookupOnce(grade)
      expect(await screen.findByText(says)).toBeInTheDocument()
      cleanup()
    }
  })

  it('says so when nothing is known about a kanji', async () => {
    renderLookup('/japanese/lookup/龘', { [lookupOf('龘')]: { status: 404, body: 'kanjiapi.dev doesn’t know this kanji' } })

    expect(await screen.findByText('Nothing is known about this kanji.')).toBeInTheDocument()
    // It would only say the same again.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it.each([
    ['kanjiapi.dev can’t be asked', 'Couldn’t look this kanji up.', () => ({ status: 503, body: 'try again later' })],
    ['offline', 'Offline: can’t look this kanji up.', () => Promise.reject(new TypeError('Load failed'))],
  ])('can try again when %s', async (_, message, failure) => {
    const user = userEvent.setup()
    let failing = true
    renderLookup('/japanese/lookup/士', { [lookupOf('士')]: () => (failing ? failure() : { status: 200, body: shi }) })

    expect(await screen.findByText(message)).toBeInTheDocument()
    failing = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: '士' })).toBeInTheDocument()
  })
})

// A Lookup of 士 at `grade`, rendered on its own.
function renderLookupOnce(grade: number) {
  const fake = fakeApi({ [lookupOf('士')]: { status: 200, body: { ...shi, grade, joyo: grade === 8 } } })
  return renderApp('/japanese/lookup/士', fake.api, noPush, [createJapanese({ recognizer: { recognize: async () => [] } })])
}
