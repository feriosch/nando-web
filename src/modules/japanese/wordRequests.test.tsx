import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, noPush, renderApp, type Answers } from '../../test/app'
import { japanese } from '.'

// A Word Request as GET /api/japanese/word-requests lists it (nando-server's internal/japanese/API.md).
type WordRequest = {
  id: string
  text: string
  kind: 'add' | 'improve'
  group: string | null
  wordId: string | null
  state: 'pending' | 'working' | 'done' | 'needs_answer' | 'failed'
  attempts: number
  answer: string | null
  summary: string | null
  suggestions: string[]
  question: string | null
  choices: string[]
}

function renderJapanese(path: string, answers: Answers) {
  const fake = fakeApi(answers)
  const router = renderApp(path, fake.api, noPush, [japanese])
  return { ...fake, router }
}

// The server listing `requests` for the Pending strip.
function listing(requests: WordRequest[]): Answers {
  return { 'GET /api/japanese/word-requests': { status: 200, body: requests } }
}

// A Word Request as the server lists it: open, with nothing asked or said yet, unless `fields` say so.
function wordRequest(fields: Partial<WordRequest> & Pick<WordRequest, 'id' | 'text' | 'state'>): WordRequest {
  return {
    kind: 'add',
    group: 'anime',
    wordId: null,
    attempts: 0,
    answer: null,
    summary: null,
    suggestions: [],
    question: null,
    choices: [],
    ...fields,
  }
}

const waiting = wordRequest({ id: 'r1', text: 'たべた', state: 'pending', group: 'gaming' })
const taken = wordRequest({ id: 'r2', text: '期待', state: 'working', kind: 'improve', group: null, wordId: 'w3', attempts: 1 })
const added = wordRequest({
  id: 'r3',
  text: '足跡',
  state: 'done',
  wordId: 'w2',
  attempts: 1,
  summary: 'Added 足跡 (あしあと) to JLPT N2.',
  suggestions: ['Link it to 足 as a related Word.', 'Move it to Anime, where you found it.'],
})
const asking = wordRequest({
  id: 'r4',
  text: 'かける',
  state: 'needs_answer',
  attempts: 1,
  question: 'Which かける: to hang, or to call?',
  choices: ['掛ける (to hang)', '架ける (to call)'],
})
const askingToo = wordRequest({
  id: 'r7',
  text: 'はし',
  state: 'needs_answer',
  attempts: 1,
  question: 'Which はし: bridge or chopsticks?',
  choices: ['橋 (bridge)', '箸 (chopsticks)'],
})
const givenUp = wordRequest({ id: 'r5', text: 'ぎゃふん', state: 'failed', attempts: 3, summary: 'jisho.org has no word ぎゃふん.' })
const notImproved = wordRequest({ id: 'r6', text: '明日', state: 'failed', kind: 'improve', group: null, wordId: 'w7', attempts: 3 })

// The server as the Owner's actions change it: it lists `requests` as they stand, without those
// dismissed, and answers, retries and dismisses as nando-server does.
function server(requests: WordRequest[]): Answers {
  let listed = requests
  const change = (id: string, fields: Partial<WordRequest> | null) => {
    const request = listed.find((each) => each.id === id)!
    listed = fields === null ? listed.filter((each) => each !== request) : listed.map((each) => (each === request ? { ...each, ...fields } : each))
    return { status: 200, body: { ...request, ...fields } }
  }
  const answers: Answers = { 'GET /api/japanese/word-requests': () => ({ status: 200, body: listed }) }
  for (const { id } of requests) {
    answers[`POST /api/japanese/word-requests/${id}/dismiss`] = () => change(id, null)
    answers[`POST /api/japanese/word-requests/${id}/retry`] = () => change(id, { state: 'pending', attempts: 0 })
    answers[`POST /api/japanese/word-requests/${id}/answer`] = (body) =>
      change(id, { state: 'pending', attempts: 0, answer: (body as { answer: string }).answer })
  }
  return answers
}

// Word w2, 足跡, as its Word page loads it.
const ashiato = {
  id: 'w2',
  word: '足跡',
  hiragana: 'あしあと',
  spanish: 'huella, pisada',
  type: { noun: 1 },
  group: { key: 'jlpt_n2', name: 'JLPT N2', imageUrl: null },
  tags: [],
  notes: null,
  sentences: [],
  wordLinks: [],
  hints: [],
  kanji: [],
}

// The rows of the Pending strip.
async function pendingRows() {
  return within(await screen.findByRole('list', { name: 'Pending' })).getAllByRole('listitem')
}

describe('Pending strip', () => {
  it('asks for the Word Requests when Japanese search opens, and shows no strip when there are none', async () => {
    const { sent } = renderJapanese('/japanese', listing([]))

    expect(await screen.findByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    await expect.poll(() => sent).toContainEqual({ method: 'GET', path: '/api/japanese/word-requests', body: undefined })
    expect(screen.queryByRole('heading', { name: 'Pending' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows each Word Request as it stands', async () => {
    renderJapanese('/japanese', listing([waiting, taken, added, asking, givenUp, notImproved]))

    const [pending, working, done, needsAnswer, failed, failedImprove] = await pendingRows()

    expect(pending).toHaveTextContent(/^たべたWaiting$/)
    expect(working).toHaveTextContent(/^期待Claude is on it$/)
    expect(done).toHaveTextContent(/^足跡Added 足跡 \(あしあと\) to JLPT N2\.$/)
    expect(within(needsAnswer).getByText('かける')).toBeInTheDocument()
    expect(within(needsAnswer).getByText('Which かける: to hang, or to call?')).toBeInTheDocument()
    expect(within(needsAnswer).getAllByRole('button').map((button) => button.textContent)).toEqual([
      '掛ける (to hang)',
      '架ける (to call)',
      'Other…',
    ])
    expect(failed).toHaveTextContent(/^ぎゃふんCouldn't addjisho.org has no word ぎゃふん\.Retry$/)
    expect(failedImprove).toHaveTextContent(/^明日Couldn't improveRetry$/)
  })

  it('opens a done one with what Claude did and suggests, dismisses it, and opens its Word', async () => {
    const user = userEvent.setup()
    const { sent } = renderJapanese('/japanese', {
      ...server([waiting, added]),
      'GET /api/japanese/words/w2': { status: 200, body: ashiato },
    })

    await user.click(within(await screen.findByRole('list', { name: 'Pending' })).getByRole('button', { name: /足跡/ }))

    const sheet = await screen.findByRole('dialog', { name: '足跡' })
    expect(within(sheet).getByText('Added 足跡 (あしあと) to JLPT N2.')).toBeInTheDocument()
    const suggestions = within(within(sheet).getByRole('list', { name: 'To do in Claude Code' })).getAllByRole('listitem')
    expect(suggestions.map((row) => row.textContent)).toEqual([
      'Link it to 足 as a related Word.',
      'Move it to Anime, where you found it.',
    ])
    expect(sent).toContainEqual({ method: 'POST', path: '/api/japanese/word-requests/r3/dismiss', body: undefined })
    // The strip loads again, without it, and the sheet stays.
    await expect.poll(() => sent.filter((request) => request.path === '/api/japanese/word-requests')).toHaveLength(2)

    await user.click(within(sheet).getByRole('link', { name: 'Open word' }))

    expect(await screen.findByRole('heading', { level: 1, name: '足跡' })).toBeInTheDocument()
  })

  it("answers Claude's question with one of its choices, or the Owner's own words", async () => {
    const user = userEvent.setup()
    const { sent } = renderJapanese('/japanese', server([asking, askingToo]))
    const [kakeru] = await pendingRows()

    await user.click(within(kakeru).getByRole('button', { name: '掛ける (to hang)' }))

    expect(sent).toContainEqual({ method: 'POST', path: '/api/japanese/word-requests/r4/answer', body: { answer: '掛ける (to hang)' } })
    await expect.poll(async () => (await pendingRows())[0].textContent).toBe('かけるWaiting')

    const hashi = (await pendingRows())[1]
    await user.click(within(hashi).getByRole('button', { name: 'Other…' }))
    await user.type(within(hashi).getByRole('textbox', { name: 'Your answer' }), '端 (edge)')
    await user.click(within(hashi).getByRole('button', { name: 'Send' }))

    expect(sent).toContainEqual({ method: 'POST', path: '/api/japanese/word-requests/r7/answer', body: { answer: '端 (edge)' } })
    await expect.poll(async () => (await pendingRows())[1].textContent).toBe('はしWaiting')
  })

  it('retries a failed one, which goes back to waiting', async () => {
    const user = userEvent.setup()
    const { sent } = renderJapanese('/japanese', server([givenUp]))
    const [gyafun] = await pendingRows()

    await user.click(within(gyafun).getByRole('button', { name: 'Retry' }))

    expect(sent).toContainEqual({ method: 'POST', path: '/api/japanese/word-requests/r5/retry', body: undefined })
    await expect.poll(async () => (await pendingRows())[0].textContent).toBe('ぎゃふんWaiting')
  })

  it('shows the Word Requests as they stand now whenever Japanese search opens and Nando comes back to the foreground', async () => {
    const user = userEvent.setup()
    // A Claude run takes and finishes the Word Request meanwhile.
    let now = waiting
    renderJapanese('/japanese', { 'GET /api/japanese/word-requests': () => ({ status: 200, body: [now] }) })
    expect((await pendingRows()).map((row) => row.textContent)).toEqual(['たべたWaiting'])

    now = { ...waiting, state: 'working', attempts: 1 }
    const tabs = screen.getByRole('navigation', { name: 'Tabs' })
    await user.click(within(tabs).getByRole('link', { name: 'Home' }))
    await user.click(within(tabs).getByRole('link', { name: 'Japanese' }))

    await expect.poll(async () => (await pendingRows()).map((row) => row.textContent)).toEqual(['たべたClaude is on it'])

    now = { ...waiting, state: 'done', attempts: 1, wordId: 'w8', summary: 'Added 食べる (たべる) to Gaming.' }
    // iOS brings Nando back from the background.
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))

    await expect.poll(async () => (await pendingRows()).map((row) => row.textContent)).toEqual(['たべたAdded 食べる (たべる) to Gaming.'])
  })
})

describe('Asking Claude from Japanese search', () => {
  it('shows the new Word Request in the Pending strip at once', async () => {
    const user = userEvent.setup()
    let stored: WordRequest[] = []
    renderJapanese('/japanese', {
      'GET /api/japanese/search': { status: 200, body: { words: [], kanji: [] } },
      'GET /api/japanese/word-requests': () => ({ status: 200, body: stored }),
      'POST /api/japanese/word-requests': () => {
        stored = [wordRequest({ id: 'r9', text: '食べた', state: 'pending', group: 'miscellaneous' })]
        return { status: 201, body: stored[0] }
      },
    })
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '食べた')
    await user.click(await screen.findByRole('button', { name: 'Add 「食べた」 with Claude' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Add with Claude' })).getByRole('button', { name: 'Add' }))

    const strip = await screen.findByRole('list', { name: 'Pending' })
    expect(within(strip).getByText('食べた')).toBeInTheDocument()
    expect(within(strip).getByText('Waiting')).toBeInTheDocument()
  })
})

describe('When the server refuses', () => {
  const asked = wordRequest({ id: 'r7', text: 'かける', state: 'needs_answer', question: 'Which かける?', choices: ['掛ける', '架ける'], attempts: 1 })
  const gaveUp = wordRequest({ id: 'r8', text: 'たべたべ', state: 'failed', attempts: 3, summary: 'jisho.org has no such word.' })

  it('says an answer did not go through', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', { ...listing([asked]), 'POST /api/japanese/word-requests/r7/answer': { status: 500, body: 'oops' } })

    await user.click(within(await screen.findByRole('list', { name: 'Pending' })).getByRole('button', { name: '掛ける' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't send your answer. Try again.")
  })

  it('says a retry did not go through', async () => {
    const user = userEvent.setup()
    renderJapanese('/japanese', { ...listing([gaveUp]), 'POST /api/japanese/word-requests/r8/retry': { status: 500, body: 'oops' } })

    await user.click(within(await screen.findByRole('list', { name: 'Pending' })).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't retry. Try again.")
  })
})
