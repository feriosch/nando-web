import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  claudeAsking,
  fakeApi,
  fakeConnection,
  fakePageScroll,
  fakeShare,
  noPush,
  renderApp,
  renderAppWith,
  type Answer,
  type Answers,
} from '../../test/app'
import { japanese } from '.'

// The API's JSON shapes, as nando-server's internal/japanese/API.md documents them.
type WordRow = { id: string; word: string; hiragana: string | null; spanish: string; group: string }
type KanjiRow = { id: string; kanji: string; spanish: string }

function renderJapanese(path: string, answers: Answers) {
  const fake = fakeApi(answers)
  const router = renderApp(path, fake.api, noPush, [japanese])
  return { ...fake, router }
}

// The search, faked: each query typed answers as given, any other finds nothing.
function searchServer(results: Record<string, { words: WordRow[]; kanji: KanjiRow[] }>): Answers {
  return {
    'GET /api/japanese/search': (_, query) => ({ status: 200, body: results[query.get('q') ?? ''] ?? { words: [], kanji: [] } }),
  }
}

const ashi: WordRow = { id: 'w1', word: '足', hiragana: 'あし', spanish: 'pie, pierna', group: 'basic' }
const ashiato: WordRow = { id: 'w2', word: '足跡', hiragana: 'あしあと', spanish: 'huella, pisada', group: 'jlpt_n2' }
const ashiKanji: KanjiRow = { id: 'k1', kanji: '足', spanish: 'pie' }

describe('Search', () => {
  it('finds Words, then Kanji, as the field is typed in', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', searchServer({ 足: { words: [ashi, ashiato], kanji: [ashiKanji] } }))

    const field = await screen.findByRole('searchbox', { name: 'Search' })
    expect(field).toHaveFocus()
    await user.type(field, '足')

    const words = within(await screen.findByRole('list', { name: 'Words' })).getAllByRole('listitem')
    expect(words.map((row) => row.textContent)).toEqual(['足あしpie, piernaBasic', '足跡あしあとhuella, pisadaJLPT N2'])
    const kanji = within(screen.getByRole('list', { name: 'Kanji' })).getAllByRole('listitem')
    expect(kanji.map((row) => row.textContent)).toEqual(['足pie'])
    // Words come before Kanji.
    expect(screen.getByRole('list', { name: 'Words' }).compareDocumentPosition(screen.getByRole('list', { name: 'Kanji' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('keeps the search when coming back from a Word', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', {
      ...searchServer({ 足: { words: [ashi, ashiato], kanji: [ashiKanji] } }),
      'GET /api/japanese/words/w2': { status: 200, body: wordPage(ashiato) },
    })

    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '足')
    await user.click(within(await screen.findByRole('list', { name: 'Words' })).getByRole('link', { name: /足跡/ }))
    await screen.findByRole('heading', { level: 1, name: '足跡' })
    await user.click(screen.getByRole('link', { name: 'Search' }))

    expect(await screen.findByRole('searchbox', { name: 'Search' })).toHaveValue('足')
    expect(rowsOf('Words')).toEqual(['足あしpie, piernaBasic', '足跡あしあとhuella, pisadaJLPT N2'])
  })

  it('comes back from a Word to where the search was scrolled', async () => {
    const user = userEvent.setup()
    const page = fakePageScroll()
    renderJapanese('/japanese', {
      ...searchServer({ 足: { words: [ashi, ashiato], kanji: [ashiKanji] } }),
      'GET /api/japanese/words/w2': { status: 200, body: wordPage(ashiato) },
    })
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '足')
    const found = await screen.findByRole('list', { name: 'Words' })
    page.scrollTo(600)

    await user.click(within(found).getByRole('link', { name: /足跡/ }))
    await screen.findByRole('heading', { level: 1, name: '足跡' })
    expect(page.y).toBe(0)
    await user.click(screen.getByRole('link', { name: 'Search' }))

    expect(await screen.findByRole('list', { name: 'Words' })).toBeInTheDocument()
    expect(page.y).toBe(600)
  })

  it('opens Search at its top from a Word opened from elsewhere', async () => {
    const user = userEvent.setup()
    const page = fakePageScroll()
    renderJapanese('/japanese/words/w3', {
      'GET /api/japanese/words/w3': { status: 200, body: kitai },
      'GET /api/japanese/words/w4': { status: 200, body: wordPage(machinozomu) },
    })
    await user.click(within(await screen.findByRole('list', { name: 'Synonyms' })).getByRole('link', { name: /待ち望む/ }))
    await screen.findByRole('heading', { level: 1, name: '待ち望む' })
    page.scrollTo(400)

    await user.click(screen.getByRole('link', { name: 'Search' }))

    expect(await screen.findByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(page.y).toBe(0)
  })

  it('shows a hint of what can be searched while the field is empty, and nothing else', async () => {
    const user = userEvent.setup()
    const { sent } = renderJapanese('/japanese', searchServer({ 足: { words: [ashi], kanji: [ashiKanji] } }))

    const field = await screen.findByRole('searchbox', { name: 'Search' })
    expect(screen.getByText('Search your Words and Kanji in kanji, kana or Spanish.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    await user.type(field, '足')
    await screen.findByRole('list', { name: 'Words' })
    expect(screen.queryByText('Search your Words and Kanji in kanji, kana or Spanish.')).not.toBeInTheDocument()

    await user.clear(field)
    expect(await screen.findByText('Search your Words and Kanji in kanji, kana or Spanish.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    // An empty field never asks the server.
    expect(sent.map((request) => request.path)).toEqual(['/api/japanese/search'])
  })

  it('searches again on its own once back online, when Nando was opened offline', async () => {
    const user = userEvent.setup()
    const connection = fakeConnection({ online: false })
    renderJapanese('/japanese', searchServer({ 足: { words: [ashi], kanji: [ashiKanji] } }))

    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '足')
    expect(await screen.findByText("Couldn't search.")).toBeInTheDocument()
    expect(screen.getByText("You're offline. This loads again once you're back online.")).toBeInTheDocument()

    connection.goOnline()

    expect(await screen.findByRole('list', { name: 'Words' })).toBeInTheDocument()
    expect(rowsOf('Words')).toEqual(['足あしpie, piernaBasic'])
    expect(screen.queryByText("Couldn't search.")).not.toBeInTheDocument()
  })

  it('searches again once Nando comes back to the foreground online, when the connection came back while it was away', async () => {
    const user = userEvent.setup()
    const connection = fakeConnection({ online: false })
    renderJapanese('/japanese', searchServer({ 足: { words: [ashi], kanji: [ashiKanji] } }))

    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '足')
    expect(await screen.findByText("Couldn't search.")).toBeInTheDocument()

    connection.goOnlineWhileAway()

    expect(await screen.findByRole('list', { name: 'Words' })).toBeInTheDocument()
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument()
  })

  it('says only what went wrong when the server fails while online', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', { 'GET /api/japanese/search': { status: 500, body: 'boom' } })

    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '足')

    expect(await screen.findByText("Couldn't search.")).toBeInTheDocument()
    expect(screen.queryByText("You're offline. This loads again once you're back online.")).not.toBeInTheDocument()
  })

  it('says so when a search finds nothing', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', searchServer({}))

    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), 'xyz')

    expect(await screen.findByText('Nothing found for “xyz”.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

type WordPage = Omit<WordRow, 'group'> & {
  type: Record<string, number>
  group: { key: string; name: string; imageUrl: string | null }
  tags: string[]
  notes: string | null
  sentences: { sentence: string; translation: string }[]
  wordLinks: { kind: 'synonym' | 'antonym' | 'related'; note: string | null; nuanceTags: string[]; word: WordRow }[]
  hints: { text: string; note: string | null }[]
  kanji: KanjiRow[]
}

const machinozomu: WordRow = { id: 'w4', word: '待ち望む', hiragana: 'まちのぞむ', spanish: 'esperar con ansia', group: 'jlpt_n1' }
const shitsubou: WordRow = { id: 'w5', word: '失望', hiragana: 'しつぼう', spanish: 'decepción', group: 'jlpt_n2' }
const yokisuru: WordRow = { id: 'w6', word: '予期', hiragana: 'よき', spanish: 'anticipación', group: 'jlpt_n1' }
const kiKanji: KanjiRow = { id: 'k2', kanji: '期', spanish: 'período' }
const matsuKanji: KanjiRow = { id: 'k3', kanji: '待', spanish: 'esperar' }

const kitai: WordPage = {
  id: 'w3',
  word: '期待',
  hiragana: 'きたい',
  spanish: 'expectativa',
  type: { noun: 1, suru: 1 },
  group: { key: 'jlpt_n2', name: 'JLPT N2', imageUrl: 'https://storage.googleapis.com/benkyo/jlpt_n2.png' },
  tags: ['common', 'usually_kana'],
  notes: 'Suele ir con に.',
  sentences: [{ sentence: '期待に胸を膨らませる。', translation: 'Tener el corazón lleno de ilusión.' }],
  wordLinks: [
    { kind: 'related', note: 'Lo que se prevé, no lo que se desea.', nuanceTags: ['formal'], word: yokisuru },
    { kind: 'synonym', note: 'Más intenso y escrito.', nuanceTags: ['written', 'literary'], word: machinozomu },
    { kind: 'antonym', note: null, nuanceTags: [], word: shitsubou },
  ],
  hints: [
    { text: '楽しみ', note: 'Más cotidiano.' },
    { text: '望み', note: null },
  ],
  kanji: [kiKanji, matsuKanji],
}

const kitaiRow: WordRow = { id: 'w3', word: '期待', hiragana: 'きたい', spanish: 'expectativa', group: 'jlpt_n2' }

// The Word page of `row`, with nothing more than its row has unless given.
function wordPage(row: WordRow, fields: Partial<WordPage> = {}): WordPage {
  const group = { key: row.group, name: row.group, imageUrl: null }
  return { ...row, type: {}, group, tags: [], notes: null, sentences: [], wordLinks: [], hints: [], kanji: [], ...fields }
}

// A list's rows, each as its text.
function rowsOf(name: string) {
  return within(screen.getByRole('list', { name })).getAllByRole('listitem').map((row) => row.textContent)
}

describe('Word page', () => {
  it('shows everything about the Word: its Word Links by kind, Hints and Kanji', async () => {
    renderJapanese('/japanese/words/w3', { 'GET /api/japanese/words/w3': { status: 200, body: kitai } })

    expect(await screen.findByRole('heading', { level: 1, name: '期待' })).toBeInTheDocument()
    expect(screen.getByText('きたい')).toBeInTheDocument()
    expect(screen.getByText('expectativa')).toBeInTheDocument()
    expect(screen.getByText('noun, suru verb')).toBeInTheDocument()
    expect(screen.getByText('JLPT N2')).toBeInTheDocument()
    expect(rowsOf('Word Tags')).toEqual(['common', 'usually kana'])
    expect(screen.getByText('Suele ir con に.')).toBeInTheDocument()
    expect(rowsOf('Example sentences')).toEqual(['期待に胸を膨らませる。Tener el corazón lleno de ilusión.'])

    expect(rowsOf('Synonyms')).toEqual(['待ち望むまちのぞむesperar con ansiaMás intenso y escrito.writtenliterary'])
    expect(rowsOf('Antonyms')).toEqual(['失望しつぼうdecepción'])
    expect(rowsOf('Related')).toEqual(['予期よきanticipaciónLo que se prevé, no lo que se desea.formal'])
    // By kind: Synonyms, then Antonyms, then Related.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(headings.indexOf('Synonyms')).toBeLessThan(headings.indexOf('Antonyms'))
    expect(headings.indexOf('Antonyms')).toBeLessThan(headings.indexOf('Related'))

    // Hints are plain text, not links.
    expect(rowsOf('Hints')).toEqual(['楽しみMás cotidiano.', '望み'])
    expect(within(screen.getByRole('list', { name: 'Hints' })).queryByRole('link')).not.toBeInTheDocument()

    expect(rowsOf('Kanji')).toEqual(['期período', '待esperar'])
  })

  it('opens a linked Word', async () => {
    const user = userEvent.setup()
    const { router } = renderJapanese('/japanese/words/w3', {
      'GET /api/japanese/words/w3': { status: 200, body: kitai },
      'GET /api/japanese/words/w4': {
        status: 200,
        body: wordPage(machinozomu, { wordLinks: [{ kind: 'synonym', note: null, nuanceTags: ['spoken'], word: kitaiRow }] }),
      },
    })

    await user.click(within(await screen.findByRole('list', { name: 'Synonyms' })).getByRole('link', { name: /待ち望む/ }))

    expect(await screen.findByRole('heading', { level: 1, name: '待ち望む' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/japanese/words/w4')
    expect(rowsOf('Synonyms')).toEqual(['期待きたいexpectativaspoken'])
  })

  it('opens a linked Word at its title, and goes back to where the Owner was', async () => {
    const user = userEvent.setup()
    const page = fakePageScroll()
    const { router } = renderJapanese('/japanese/words/w3', {
      'GET /api/japanese/words/w3': { status: 200, body: kitai },
      'GET /api/japanese/words/w4': { status: 200, body: wordPage(machinozomu) },
    })
    const synonyms = await screen.findByRole('list', { name: 'Synonyms' })
    // Down at the Word Links.
    page.scrollTo(1200)

    await user.click(within(synonyms).getByRole('link', { name: /待ち望む/ }))
    expect(await screen.findByRole('heading', { level: 1, name: '待ち望む' })).toBeInTheDocument()
    expect(page.y).toBe(0)

    // Back, as the back gesture goes.
    await act(() => router.navigate(-1))
    expect(await screen.findByRole('heading', { level: 1, name: '期待' })).toBeInTheDocument()
    expect(page.y).toBe(1200)
  })

  it('opens a Kanji in its spelling', async () => {
    const user = userEvent.setup()
    const { router } = renderJapanese('/japanese/words/w3', {
      'GET /api/japanese/words/w3': { status: 200, body: kitai },
      'GET /api/japanese/kanji/k3': { status: 200, body: kanjiPage(matsuKanji, { words: [kitaiRow, machinozomu] }) },
    })

    await user.click(within(await screen.findByRole('list', { name: 'Kanji' })).getByRole('link', { name: /待/ }))

    expect(await screen.findByRole('heading', { level: 1, name: '待' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/japanese/kanji/k3')
  })
})

type KanjiPage = KanjiRow & {
  on: string | null
  kun: string | null
  v1: number
  v2: number | null
  story: string | null
  components: { name: string; kanji: KanjiRow | null }[]
  words: WordRow[]
}

// The Kanji page of `row`, with nothing more than its row has unless given.
function kanjiPage(row: KanjiRow, fields: Partial<KanjiPage> = {}): KanjiPage {
  return { ...row, on: null, kun: null, v1: 1, v2: null, story: null, components: [], words: [], ...fields }
}

const umi: KanjiRow = { id: 'k4', kanji: '海', spanish: 'mar' }
const mai: KanjiRow = { id: 'k5', kanji: '毎', spanish: 'cada' }
const umiWord: WordRow = { id: 'w7', word: '海', hiragana: 'うみ', spanish: 'mar, océano', group: 'basic' }
const kaigai: WordRow = { id: 'w8', word: '海外', hiragana: 'かいがい', spanish: 'extranjero', group: 'jlpt_n3' }

describe('Kanji page', () => {
  it('shows the Kanji, its Components, stored and irregular, and the Words spelled with it', async () => {
    const user = userEvent.setup()
    const { router } = renderJapanese('/japanese/kanji/k4', {
      'GET /api/japanese/kanji/k4': {
        status: 200,
        body: kanjiPage(umi, {
          on: 'カイ',
          kun: 'うみ',
          v1: 491,
          v2: 1520,
          story: 'Las gotas de agua de cada río acaban en el mar.',
          components: [
            { name: 'gotas de agua', kanji: null },
            { name: 'cada', kanji: mai },
          ],
          words: [umiWord, kaigai],
        }),
      },
      'GET /api/japanese/kanji/k5': { status: 200, body: kanjiPage(mai) },
    })

    expect(await screen.findByRole('heading', { level: 1, name: '海' })).toBeInTheDocument()
    expect(screen.getByText('mar')).toBeInTheDocument()
    expect(rowsOf('Readings')).toEqual(['Onカイ', 'Kunうみ'])
    expect(rowsOf('Heisig')).toEqual(['Volume 1491', 'Volume 21,520'])
    expect(screen.getByText('Las gotas de agua de cada río acaban en el mar.')).toBeInTheDocument()
    expect(rowsOf('Words')).toEqual(['海うみmar, océanoBasic', '海外かいがいextranjeroJLPT N3'])

    // An irregular shape is shown as it is; a stored Kanji opens.
    const components = screen.getByRole('list', { name: 'Components' })
    expect(rowsOf('Components')).toEqual(['gotas de agua', '毎cada'])
    expect(within(components).getAllByRole('link')).toHaveLength(1)
    await user.click(within(components).getByRole('link', { name: /毎/ }))

    expect(await screen.findByRole('heading', { level: 1, name: '毎' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/japanese/kanji/k5')
  })

  it('opens a Word spelled with it', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese/kanji/k4', {
      'GET /api/japanese/kanji/k4': { status: 200, body: kanjiPage(umi, { words: [umiWord, kaigai] }) },
      'GET /api/japanese/words/w8': { status: 200, body: wordPage(kaigai) },
    })

    await user.click(within(await screen.findByRole('list', { name: 'Words' })).getByRole('link', { name: /海外/ }))

    expect(await screen.findByRole('heading', { level: 1, name: '海外' })).toBeInTheDocument()
  })
})

// Answers 500 the first time, then `answer`.
function failingOnce(answer: Answer): () => Answer {
  let failed = false
  return () => {
    if (failed) return answer
    failed = true
    return { status: 500, body: 'unavailable' }
  }
}

describe('A load that fails', () => {
  it('says the search failed, and searches again', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', { 'GET /api/japanese/search': failingOnce({ status: 200, body: { words: [ashi], kanji: [] } }) })

    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '足')
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't search.")
    expect(screen.queryByText(/Nothing found/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('list', { name: 'Words' })).toBeInTheDocument()
    expect(rowsOf('Words')).toEqual(['足あしpie, piernaBasic'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("says a Word page couldn't load, and loads it again", async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese/words/w3', { 'GET /api/japanese/words/w3': failingOnce({ status: 200, body: kitai }) })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this Word.")
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: '期待' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("says a Kanji page couldn't load, and loads it again", async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese/kanji/k4', { 'GET /api/japanese/kanji/k4': failingOnce({ status: 200, body: kanjiPage(umi) }) })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this Kanji.")
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: '海' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// The JLPT deck as GET /api/japanese/anki/jlpt.csv answers it.
const deckCsv = '#separator:Comma\n#html:true\n#notetype:Benkyo Note Type V2\n#deck:JLPT Benkyo Deck V2\nw2,足跡,あしあと,"huella, pisada"\n'
const deck: Answer = {
  status: 200,
  body: deckCsv,
  headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="jlpt-2026-11-11.csv"' },
}

// The Japanese Settings Section on the Settings screen, found by its heading.
async function japaneseSection() {
  return await screen.findByRole('region', { name: 'Japanese' })
}

describe('Japanese Settings Section', () => {
  it('shares the JLPT deck as a CSV file named for today, for AnkiMobile', async () => {
    const user = userEvent.setup()
    const { share, shared } = fakeShare()
    renderApp('/settings', fakeApi({ 'GET /api/japanese/anki/jlpt.csv': deck }).api, noPush, [japanese], share)

    const section = await japaneseSection()
    expect(within(section).getByText('In AnkiMobile, set Existing notes to Update.')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Export JLPT deck' }))

    await waitFor(() => expect(shared).toHaveLength(1))
    expect(shared[0].name).toBe('jlpt-2026-11-11.csv')
    expect(shared[0].type).toBe('text/csv')
    expect(await shared[0].text()).toBe(deckCsv)
  })

  it('downloads the deck where the device has no share sheet for files', async () => {
    const user = userEvent.setup()
    const { share, shared, downloaded } = fakeShare({ canShareFiles: false })
    renderApp('/settings', fakeApi({ 'GET /api/japanese/anki/jlpt.csv': deck }).api, noPush, [japanese], share)

    await user.click(within(await japaneseSection()).getByRole('button', { name: 'Export JLPT deck' }))

    await waitFor(() => expect(downloaded).toHaveLength(1))
    expect(downloaded[0].name).toBe('jlpt-2026-11-11.csv')
    expect(await downloaded[0].text()).toBe(deckCsv)
    expect(shared).toEqual([])
  })

  it('says nothing when the Owner closes the share sheet, and shares again on the next tap', async () => {
    const user = userEvent.setup()
    const { share, shared } = fakeShare({ answers: ['cancelled'] })
    renderApp('/settings', fakeApi({ 'GET /api/japanese/anki/jlpt.csv': deck }).api, noPush, [japanese], share)

    const section = await japaneseSection()
    await user.click(within(section).getByRole('button', { name: 'Export JLPT deck' }))
    // The row is ready again once the sheet is closed.
    await waitFor(() => expect(within(section).getByRole('button', { name: 'Export JLPT deck' })).toBeEnabled())
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
    expect(shared).toEqual([])

    await user.click(within(section).getByRole('button', { name: 'Export JLPT deck' }))
    await waitFor(() => expect(shared).toHaveLength(1))
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
  })

  it("says why the deck couldn't be fetched, and fetches it again", async () => {
    const user = userEvent.setup()
    const { share, shared } = fakeShare()
    let answered = 0
    const api = fakeApi({
      'GET /api/japanese/anki/jlpt.csv': () => (answered++ === 0 ? { status: 500, body: 'database unavailable' } : deck),
    }).api
    renderApp('/settings', api, noPush, [japanese], share)

    const section = await japaneseSection()
    await user.click(within(section).getByRole('button', { name: 'Export JLPT deck' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't get the JLPT deck: database unavailable")
    expect(shared).toEqual([])
    await user.click(within(section).getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(shared).toHaveLength(1))
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('shows it is busy while the deck is fetched, and a second tap does nothing', async () => {
    const user = userEvent.setup()
    const { share, shared } = fakeShare()
    let answer: (answer: Answer) => void = () => {}
    const { api, sent } = fakeApi({ 'GET /api/japanese/anki/jlpt.csv': () => new Promise<Answer>((resolve) => (answer = resolve)) })
    renderApp('/settings', api, noPush, [japanese], share)

    const section = await japaneseSection()
    const row = within(section).getByRole('button', { name: 'Export JLPT deck' })
    await user.click(row)
    await waitFor(() => expect(row).toBeDisabled())
    expect(row).toHaveTextContent('Preparing…')
    await user.click(row)

    answer(deck)
    await waitFor(() => expect(shared).toHaveLength(1))
    expect(sent.filter((request) => request.path === '/api/japanese/anki/jlpt.csv')).toHaveLength(1)
    await waitFor(() => expect(row).toBeEnabled())
  })

  it('offers to share the fetched deck with another tap when Safari refuses the first', async () => {
    const user = userEvent.setup()
    const { share, shared } = fakeShare({ answers: ['not-allowed'] })
    const { api, sent } = fakeApi({ 'GET /api/japanese/anki/jlpt.csv': deck })
    renderApp('/settings', api, noPush, [japanese], share)

    const section = await japaneseSection()
    await user.click(within(section).getByRole('button', { name: 'Export JLPT deck' }))
    await user.click(await within(section).findByRole('button', { name: 'Share jlpt-2026-11-11.csv' }))

    await waitFor(() => expect(shared).toHaveLength(1))
    expect(shared[0].name).toBe('jlpt-2026-11-11.csv')
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument()
    // The deck was fetched once, and the row is back to exporting.
    expect(sent.filter((request) => request.path === '/api/japanese/anki/jlpt.csv')).toHaveLength(1)
    expect(await within(section).findByRole('button', { name: 'Export JLPT deck' })).toBeEnabled()
  })

  it("says the share sheet failed, not the fetch, when sharing goes wrong", async () => {
    const user = userEvent.setup()
    const { share } = fakeShare({ answers: ['failed'] })
    renderApp('/settings', fakeApi({ 'GET /api/japanese/anki/jlpt.csv': deck }).api, noPush, [japanese], share)

    const section = await japaneseSection()
    await user.click(within(section).getByRole('button', { name: 'Export JLPT deck' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent("Couldn't share the JLPT deck.")
  })

  it('names the file after its path when the server hides Content-Disposition', async () => {
    const user = userEvent.setup()
    const { share, shared } = fakeShare()
    const hidden: Answer = { ...deck, headers: { 'Content-Type': 'text/csv; charset=utf-8' } }
    renderApp('/settings', fakeApi({ 'GET /api/japanese/anki/jlpt.csv': hidden }).api, noPush, [japanese], share)

    await user.click(within(await japaneseSection()).getByRole('button', { name: 'Export JLPT deck' }))

    await waitFor(() => expect(shared).toHaveLength(1))
    expect(shared[0].name).toBe('jlpt.csv')
    expect(shared[0].type).toBe('text/csv')
  })
})

describe('Connector consent page', () => {
  it('says what Japanese’s Tools let a Connector do', async () => {
    const { api } = fakeApi(claudeAsking)
    renderAppWith('/connect?request=r1', { api, modules: [japanese] })

    expect(await screen.findByText('It will be able to search your Words and Kanji, and add and change your Words.')).toBeInTheDocument()
  })
})
