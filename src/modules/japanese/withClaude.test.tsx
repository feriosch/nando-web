import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, fakeConnection, noPush, renderApp, type Answers } from '../../test/app'
import { japanese } from '.'

// Asking Claude, from Japanese search and the Word page, to add a word or improve a Word: a Word
// Request (POST /api/japanese/word-requests, nando-server's internal/japanese/API.md).

function renderJapanese(path: string, answers: Answers) {
  const fake = fakeApi(answers)
  const router = renderApp(path, fake.api, noPush, [japanese])
  return { ...fake, router }
}

// A Word Request as the server answers it: `fields` over a new, pending one asking to add 食べた.
function wordRequest(fields: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    text: '食べた',
    kind: 'add',
    group: 'gaming',
    wordId: null,
    state: 'pending',
    attempts: 0,
    answer: null,
    summary: null,
    suggestions: [],
    question: null,
    choices: [],
    ...fields,
  }
}

// 期待, as GET /api/japanese/words/w3 answers it.
const kitai = {
  id: 'w3',
  word: '期待',
  hiragana: 'きたい',
  spanish: 'expectativa',
  type: { noun: 1, suru: 1 },
  group: { key: 'jlpt_n2', name: 'JLPT N2', imageUrl: null },
  tags: [],
  notes: null,
  sentences: [],
  wordLinks: [],
  hints: [],
  kanji: [],
}

// A search that finds nothing, whatever is typed.
const findsNothing: Answers = { 'GET /api/japanese/search': { status: 200, body: { words: [], kanji: [] } } }

describe('Add with Claude', () => {
  it('is offered when a search finds no Word', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', findsNothing)

    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '食べた')

    expect(await screen.findByRole('button', { name: 'Add 「食べた」 with Claude' })).toBeInTheDocument()
  })

  it('sends the text and the chosen Group, and closes', async () => {
    const user = userEvent.setup()
    const { sent } = renderJapanese('/japanese', {
      ...findsNothing,
      'POST /api/japanese/word-requests': (body) => ({ status: 201, body: wordRequest(body as Record<string, unknown>) }),
    })
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '食べた')
    await user.click(await screen.findByRole('button', { name: 'Add 「食べた」 with Claude' }))

    const sheet = await screen.findByRole('dialog', { name: 'Add with Claude' })
    expect(within(sheet).getByRole('textbox', { name: 'Word' })).toHaveValue('食べた')
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Group' }), 'Anime')
    await user.click(within(sheet).getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Asked Claude to add 「食べた」.')
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      { method: 'POST', path: '/api/japanese/word-requests', body: { kind: 'add', text: '食べた', group: 'anime' } },
    ])
  })

  it('remembers the last Group on the device', async () => {
    const user = userEvent.setup()
    const answers: Answers = {
      ...findsNothing,
      'POST /api/japanese/word-requests': (body) => ({ status: 201, body: wordRequest(body as Record<string, unknown>) }),
    }
    renderJapanese('/japanese', answers)
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '食べた')
    await user.click(await screen.findByRole('button', { name: 'Add 「食べた」 with Claude' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add with Claude' })
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Group' }), 'Movie')
    await user.click(within(sheet).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Nando is closed and opened again on the same device.
    cleanup()
    renderJapanese('/japanese', answers)
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '走った')
    await user.click(await screen.findByRole('button', { name: 'Add 「走った」 with Claude' }))

    const next = await screen.findByRole('dialog', { name: 'Add with Claude' })
    expect(within(next).getByRole('combobox', { name: 'Group' })).toHaveDisplayValue('Movie')
  })
})

describe('Improve with Claude', () => {
  it('is offered on a Word page, and asks Claude to improve the Word', async () => {
    const user = userEvent.setup()
    const { sent } = renderJapanese('/japanese/words/w3', {
      'GET /api/japanese/words/w3': { status: 200, body: kitai },
      'POST /api/japanese/word-requests': { status: 201, body: wordRequest({ kind: 'improve', text: '期待', group: null, wordId: 'w3' }) },
    })

    await user.click(await screen.findByRole('button', { name: 'Improve with Claude' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Asked Claude to improve 期待.')
    expect(sent.filter((request) => request.method === 'POST')).toEqual([
      { method: 'POST', path: '/api/japanese/word-requests', body: { kind: 'improve', wordId: 'w3' } },
    ])
  })
})

describe('Asking again', () => {
  it('says Claude was already asked, when an open Word Request asks the same', async () => {
    const user = userEvent.setup()
    const { sent } = renderJapanese('/japanese', {
      ...findsNothing,
      // Asked before from another Group, and not taken yet.
      'POST /api/japanese/word-requests': { status: 200, body: wordRequest({ group: 'gaming' }) },
    })
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '食べた')
    await user.click(await screen.findByRole('button', { name: 'Add 「食べた」 with Claude' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add with Claude' })
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'Group' }), 'Anime')
    await user.click(within(sheet).getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Already asked Claude to add 「食べた」, still waiting.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST')).toHaveLength(1)
  })

  it('says Claude was already asked to improve a Word', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese/words/w3', {
      'GET /api/japanese/words/w3': { status: 200, body: kitai },
      'POST /api/japanese/word-requests': {
        status: 200,
        body: wordRequest({ kind: 'improve', text: '期待', group: null, wordId: 'w3', state: 'working', attempts: 1 }),
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Improve with Claude' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Already asked Claude to improve 期待, still waiting.')
  })
})

describe('A Word Request that fails', () => {
  it("says why, in the sheet, and adds once it's tapped again", async () => {
    const user = userEvent.setup()
    // The server refuses the first ask (say, a Group it doesn't know yet) and takes the second.
    let asks = 0
    const { sent } = renderJapanese('/japanese', {
      ...findsNothing,
      'POST /api/japanese/word-requests': (body) =>
        ++asks === 1 ? { status: 400, body: 'try again' } : { status: 201, body: wordRequest(body as Record<string, unknown>) },
    })
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '食べた')
    await user.click(await screen.findByRole('button', { name: 'Add 「食べた」 with Claude' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add with Claude' })
    await user.click(within(sheet).getByRole('button', { name: 'Add' }))

    expect(await within(sheet).findByRole('alert')).toHaveTextContent("Couldn't ask Claude: try again")
    await user.click(within(sheet).getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(sent.filter((request) => request.method === 'POST').map((request) => request.body)).toEqual([
      { kind: 'add', text: '食べた', group: 'miscellaneous' },
      { kind: 'add', text: '食べた', group: 'miscellaneous' },
    ])
  })

  it('says a Word could not be improved for lack of a connection, and asks again', async () => {
    const user = userEvent.setup()
    const { sent } = renderJapanese('/japanese/words/w3', {
      'GET /api/japanese/words/w3': { status: 200, body: kitai },
      'POST /api/japanese/word-requests': { status: 201, body: wordRequest({ kind: 'improve', text: '期待', group: null, wordId: 'w3' }) },
    })
    await screen.findByRole('heading', { level: 1, name: '期待' })
    const connection = fakeConnection({ online: false })

    await user.click(screen.getByRole('button', { name: 'Improve with Claude' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't ask Claude. Check the connection.")
    connection.goOnline()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Asked Claude to improve 期待.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(sent.filter((request) => request.method === 'POST')).toHaveLength(2)
  })
})

describe('Review fixes', () => {
  it("doesn't carry what was asked about one Word to the next Word's page", async () => {
    const user = userEvent.setup()
    // 期限 was opened first, so its page is cached and shows at once when the Owner goes back.
    const { router } = renderJapanese('/japanese/words/w4', {
      'GET /api/japanese/words/w3': { status: 200, body: kitai },
      'GET /api/japanese/words/w4': { status: 200, body: { ...kitai, id: 'w4', word: '期限', hiragana: 'きげん', spanish: 'plazo' } },
      'POST /api/japanese/word-requests': { status: 201, body: wordRequest({ kind: 'improve', text: '期待', group: null, wordId: 'w3' }) },
    })
    await screen.findByRole('heading', { name: /期限/ })
    await router.navigate('/japanese/words/w3')
    await screen.findByRole('heading', { name: /期待/ })
    await user.click(screen.getByRole('button', { name: 'Improve with Claude' }))
    await screen.findByRole('status')

    await router.navigate('/japanese/words/w4')

    expect(await screen.findByRole('heading', { name: /期限/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Improve with Claude' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('says the open Word Request has a question for the Owner, not that it is still waiting', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', {
      ...findsNothing,
      'POST /api/japanese/word-requests': {
        status: 200,
        body: wordRequest({ text: 'かける', state: 'needs_answer', question: 'Which かける?', choices: ['掛ける', '架ける'] }),
      },
    })
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), 'かける')
    await user.click(await screen.findByRole('button', { name: 'Add 「かける」 with Claude' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Add with Claude' })).getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Already asked Claude to add 「かける」: it has a question for you.')
  })

  it("can't add a blank word", async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', findsNothing)
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '食べた')
    await user.click(await screen.findByRole('button', { name: 'Add 「食べた」 with Claude' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add with Claude' })

    await user.clear(within(sheet).getByRole('textbox', { name: 'Word' }))
    await user.type(within(sheet).getByRole('textbox', { name: 'Word' }), '  ')

    expect(within(sheet).getByRole('button', { name: 'Add' })).toBeDisabled()
  })
})
