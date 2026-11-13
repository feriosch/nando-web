import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeApi, fakeConnection, noPush, renderApp, type Answers } from '../../test/app'
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

    expect(await screen.findByText('gentleman, scholar, samurai')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '士' })).toBeInTheDocument()
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

    expect(await screen.findByText('appearance of a dragon')).toBeInTheDocument()
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

  it('can try again when kanjiapi.dev can’t be asked', async () => {
    const user = userEvent.setup()
    let failing = true
    renderLookup('/japanese/lookup/士', { [lookupOf('士')]: () => (failing ? { status: 503, body: 'try again later' } : { status: 200, body: shi }) })

    expect(await screen.findByText('Couldn’t look this kanji up.')).toBeInTheDocument()
    failing = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('gentleman, scholar, samurai')).toBeInTheDocument()
  })

  it('says once that it’s offline, and looks the kanji up on its own once back online, when Nando was opened offline', async () => {
    const connection = fakeConnection({ online: false })
    renderLookup('/japanese/lookup/士', { [lookupOf('士')]: { status: 200, body: shi } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t look this kanji up.')
    expect(screen.getAllByText(/offline/i)).toHaveLength(1)
    connection.goOnline()

    expect(await screen.findByText('gentleman, scholar, samurai')).toBeInTheDocument()
  })

  it('says nothing is known, without Try again, for what the server won’t look up', async () => {
    renderLookup('/japanese/lookup/abc', { [lookupOf('abc')]: { status: 400, body: 'kanji must be one kanji' } })

    expect(await screen.findByText('Nothing is known about this kanji.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('shows which kanji it is about while it can’t be looked up', async () => {
    renderLookup('/japanese/lookup/龘', { [lookupOf('龘')]: { status: 404, body: 'not known' } })

    expect(await screen.findByText('Nothing is known about this kanji.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '龘' })).toBeInTheDocument()
  })

  it('takes whether it is jōyō from the server, the grade only for how', async () => {
    renderLookup('/japanese/lookup/士', { [lookupOf('士')]: { status: 200, body: { ...shi, grade: 7, joyo: true } } })

    expect(await screen.findByText('Yes, secondary school')).toBeInTheDocument()
  })

  it('lists two words spelled alike as two', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const otona = { word: '大人', reading: 'おとな', meanings: ['adult'] }
    const taijin = { word: '大人', reading: 'たいじん', meanings: ['giant', 'man of virtue'] }
    renderLookup('/japanese/lookup/士', { [lookupOf('士')]: { status: 200, body: { ...shi, words: [otona, taijin] } } })

    await screen.findByRole('list', { name: 'Words' })
    expect(rowsOf('Words')).toEqual(['大人おとなadult', '大人たいじんgiant, man of virtue'])
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key/)
    errors.mockRestore()
  })
})

// A Lookup of 士 at `grade`, rendered on its own.
function renderLookupOnce(grade: number) {
  const fake = fakeApi({ [lookupOf('士')]: { status: 200, body: { ...shi, grade, joyo: grade === 8 } } })
  return renderApp('/japanese/lookup/士', fake.api, noPush, [createJapanese({ recognizer: { recognize: async () => [] } })])
}
