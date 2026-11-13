import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, noPush, renderApp, type Answers } from '../../test/app'
import { createJapanese } from '.'
import type { Drawing } from './drawing'
import type { Recognizer } from './recognizer'

// The kanji model, faked: each Drawing it's asked about is recorded, and it answers with the
// Candidates `answer` gives for that Drawing (by default, none).
function fakeRecognizer(answer: (drawing: Drawing) => string[] | Promise<string[]> = () => []) {
  const asked: Drawing[] = []
  const recognizer: Recognizer = {
    recognize: async (drawing) => {
      asked.push(structuredClone(drawing))
      return answer(drawing)
    },
  }
  return { recognizer, asked }
}

function renderDraw(path: string, answers: Answers, recognizer = fakeRecognizer().recognizer) {
  const fake = fakeApi(answers)
  const router = renderApp(path, fake.api, noPush, [createJapanese({ recognizer })])
  return { ...fake, router }
}

// A stroke drawn by finger on the drawing area, through `points` ([x, y] from its top left).
function drawStroke(points: number[][]) {
  const area = screen.getByLabelText('Drawing')
  const at = ([x, y]: number[]) => ({ clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true })
  fireEvent.pointerDown(area, at(points[0]))
  for (const point of points.slice(1)) fireEvent.pointerMove(area, at(point))
  fireEvent.pointerUp(area, at(points[points.length - 1]))
}

// How many strokes the drawing area shows.
function strokesShown() {
  return screen.getByLabelText('Drawing').querySelectorAll('polyline').length
}

// The Candidates as shown, in order, each as its text.
function candidates() {
  const list = screen.queryByRole('list', { name: 'Candidates' })
  return list ? within(list).getAllByRole('listitem').map((item) => item.textContent) : []
}

// The lookup of stored Kanji, faked: each kanji in `stored` is stored, and every request is answered
// with those among the Candidates asked about, in their order.
type StoredKanji = { id: string; kanji: string; spanish: string; v1: number }
function storedKanji(...stored: StoredKanji[]): Answers {
  return {
    'GET /api/japanese/kanji': (_, query) => {
      const asked = [...(query.get('kanji') ?? '')]
      return { status: 200, body: asked.flatMap((k) => stored.filter((s) => s.kanji === k)) }
    },
  }
}

const eightCandidates = ['水', '氷', '永', '泳', '承', '次', '派', '旅']

describe('Draw', () => {
  it('opens from Search', async () => {
    const user = userEvent.setup()
    const { router } = renderDraw('/japanese', {})

    await user.click(await screen.findByRole('link', { name: 'Draw' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Draw' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/japanese/draw')
  })

  it('says what to do while nothing is drawn, and nothing else', async () => {
    const user = userEvent.setup()
    renderDraw('/japanese/draw', storedKanji(), fakeRecognizer(() => ['一']).recognizer)
    const hint = 'Draw a kanji to find it among yours.'

    expect(await screen.findByText(hint)).toBeInTheDocument()
    drawStroke([[10, 20], [90, 20]])
    await waitFor(() => expect(candidates()).toEqual(['一']))
    expect(screen.queryByText(hint)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText(hint)).toBeInTheDocument()
  })

  it('reads each stroke as it ends, and shows its Candidates, best first', async () => {
    const { recognizer, asked } = fakeRecognizer(() => eightCandidates)
    renderDraw('/japanese/draw', storedKanji(), recognizer)
    await screen.findByLabelText('Drawing')

    drawStroke([[10, 20], [30, 40], [50, 60]])

    await waitFor(() => expect(candidates()).toEqual(eightCandidates))
    expect(asked).toEqual([[[[10, 20], [30, 40], [50, 60]]]])
  })

  it('opens a stored Candidate’s Kanji, and the Kanji Lookup of one not stored', async () => {
    const water = { id: 'k1', kanji: '水', spanish: 'agua', v1: 137 }
    const swim = { id: 'k2', kanji: '泳', spanish: 'nadar', v1: 140 }
    const { router, sent } = renderDraw('/japanese/draw', storedKanji(water, swim), fakeRecognizer(() => eightCandidates).recognizer)
    await screen.findByLabelText('Drawing')

    drawStroke([[10, 20], [50, 60]])

    await waitFor(() => expect(candidates()).toEqual(['水agua137', '氷', '永', '泳nadar140', '承', '次', '派', '旅']))
    const list = screen.getByRole('list', { name: 'Candidates' })
    const opens = (name: string) => decodeURIComponent(within(list).getByRole('link', { name }).getAttribute('href')!)
    expect(opens('水 agua 137')).toBe('/japanese/kanji/k1')
    expect(opens('泳 nadar 140')).toBe('/japanese/kanji/k2')
    // Not stored: dimmed, and opening what Nando can find out about it.
    expect(opens('氷, not stored')).toBe('/japanese/lookup/氷')
    expect(opens('旅, not stored')).toBe('/japanese/lookup/旅')

    fireEvent.click(within(list).getByRole('link', { name: '水 agua 137' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/japanese/kanji/k1'))
    // A stored Kanji is never looked up outside Nando.
    expect(sent.filter((request) => request.path.startsWith('/api/japanese/lookup/'))).toEqual([])
  })

  it('reads the Drawing again after Undo, and Clear starts over', async () => {
    const user = userEvent.setup()
    // A stroke reads as 一, two as 二.
    const { recognizer, asked } = fakeRecognizer((drawing) => (drawing.length === 1 ? ['一'] : ['二']))
    renderDraw('/japanese/draw', storedKanji(), recognizer)
    await screen.findByLabelText('Drawing')

    drawStroke([[10, 20], [90, 20]])
    await waitFor(() => expect(candidates()).toEqual(['一']))
    drawStroke([[10, 60], [90, 60]])
    await waitFor(() => expect(candidates()).toEqual(['二']))
    expect(strokesShown()).toBe(2)

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(candidates()).toEqual(['一']))
    expect(strokesShown()).toBe(1)
    expect(asked.at(-1)).toEqual([[[10, 20], [90, 20]]])

    const times = asked.length
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(candidates()).toEqual([])
    expect(strokesShown()).toBe(0)
    // An empty Drawing has nothing to read.
    expect(asked).toHaveLength(times)
  })

  it('still reads the Drawing offline, and checks the Candidates once back online', async () => {
    const water = { id: 'k1', kanji: '水', spanish: 'agua', v1: 137 }
    let online = false
    const lookup = storedKanji(water)['GET /api/japanese/kanji']
    renderDraw(
      '/japanese/draw',
      {
        // Offline, the request never reaches the server: fetch itself fails.
        'GET /api/japanese/kanji': (body, query) => (online && typeof lookup === 'function' ? lookup(body, query) : Promise.reject(new TypeError('Load failed'))),
      },
      fakeRecognizer(() => ['水', '氷']).recognizer,
    )
    await screen.findByLabelText('Drawing')

    window.dispatchEvent(new Event('offline'))
    drawStroke([[10, 20], [50, 60]])

    expect(await screen.findByText('Offline: can’t check your kanji.')).toBeInTheDocument()
    expect(candidates()).toEqual(['水', '氷'])
    expect(screen.queryByRole('link', { name: /水/ })).not.toBeInTheDocument()

    online = true
    window.dispatchEvent(new Event('online'))

    expect(await screen.findByRole('link', { name: /水/ })).toHaveAttribute('href', '/japanese/kanji/k1')
    expect(candidates()).toEqual(['水agua137', '氷'])
    expect(screen.queryByText('Offline: can’t check your kanji.')).not.toBeInTheDocument()
  })

  it('comes back from a Candidate’s Kanji to the same Drawing', async () => {
    const user = userEvent.setup()
    const water = { id: 'k1', kanji: '水', spanish: 'agua', v1: 137 }
    const { recognizer, asked } = fakeRecognizer(() => ['水', '氷'])
    renderDraw(
      '/japanese/draw',
      {
        ...storedKanji(water),
        'GET /api/japanese/kanji/k1': {
          status: 200,
          body: { ...water, on: 'スイ', kun: 'みず', v2: null, story: null, components: [], words: [] },
        },
      },
      recognizer,
    )
    await screen.findByLabelText('Drawing')
    drawStroke([[10, 20], [50, 60]])
    drawStroke([[60, 20], [20, 60]])

    await user.click(await screen.findByRole('link', { name: /水/ }))
    await screen.findByRole('heading', { level: 1, name: '水' })
    await user.click(screen.getByRole('link', { name: 'Draw' }))

    await screen.findByLabelText('Drawing')
    expect(strokesShown()).toBe(2)
    await waitFor(() => expect(candidates()).toEqual(['水agua137', '氷']))
    expect(asked.at(-1)).toEqual([
      [[10, 20], [50, 60]],
      [[60, 20], [20, 60]],
    ])
  })

  it('checks the Candidates once back online, even when the app started offline', async () => {
    const water = { id: 'k1', kanji: '水', spanish: 'agua', v1: 137 }
    let online = false
    const lookup = storedKanji(water)['GET /api/japanese/kanji']
    renderDraw(
      '/japanese/draw',
      {
        // No 'offline' event this time: the app opened with no connection, so it only finds out
        // when the request fails.
        'GET /api/japanese/kanji': (body, query) => (online && typeof lookup === 'function' ? lookup(body, query) : Promise.reject(new TypeError('Load failed'))),
      },
      fakeRecognizer(() => ['水', '氷']).recognizer,
    )
    await screen.findByLabelText('Drawing')

    drawStroke([[10, 20], [50, 60]])
    expect(await screen.findByText('Offline: can’t check your kanji.')).toBeInTheDocument()

    online = true
    window.dispatchEvent(new Event('online'))

    expect(await screen.findByRole('link', { name: /水/ })).toHaveAttribute('href', '/japanese/kanji/k1')
    expect(screen.queryByText('Offline: can’t check your kanji.')).not.toBeInTheDocument()
  })

  it('says so when the Drawing can’t be read, and reads the next stroke again', async () => {
    let broken = true
    renderDraw('/japanese/draw', storedKanji(), fakeRecognizer(() => (broken ? Promise.reject(new Error('model not loaded')) : ['一'])).recognizer)
    await screen.findByLabelText('Drawing')

    drawStroke([[10, 20], [90, 20]])

    expect(await screen.findByText('Couldn’t read the Drawing. Draw again to retry.')).toBeInTheDocument()
    expect(candidates()).toEqual([])

    broken = false
    drawStroke([[10, 60], [90, 60]])
    await waitFor(() => expect(candidates()).toEqual(['一']))
    expect(screen.queryByText('Couldn’t read the Drawing. Draw again to retry.')).not.toBeInTheDocument()
  })

  it('ignores a second finger while a stroke is being drawn', async () => {
    const { recognizer, asked } = fakeRecognizer(() => ['一'])
    renderDraw('/japanese/draw', storedKanji(), recognizer)
    const area = await screen.findByLabelText('Drawing')
    const finger = (pointerId: number, [x, y]: number[]) => ({ clientX: x, clientY: y, pointerId, pointerType: 'touch' })

    fireEvent.pointerDown(area, finger(1, [10, 20]))
    fireEvent.pointerMove(area, finger(1, [50, 20]))
    // A thumb lands, moves and lifts mid-stroke.
    fireEvent.pointerDown(area, finger(2, [200, 200]))
    fireEvent.pointerMove(area, finger(2, [210, 210]))
    fireEvent.pointerUp(area, finger(2, [210, 210]))
    fireEvent.pointerMove(area, finger(1, [90, 20]))
    fireEvent.pointerUp(area, finger(1, [90, 20]))

    await waitFor(() => expect(asked).toEqual([[[[10, 20], [50, 20], [90, 20]]]]))
  })

  it('never shows the Candidates of a cleared Drawing for a new one', async () => {
    const user = userEvent.setup()
    let answerSecond: (found: string[]) => void = () => {}
    const { recognizer } = fakeRecognizer((drawing) =>
      drawing[0][0][0] === 10 ? ['木'] : new Promise<string[]>((resolve) => (answerSecond = resolve)),
    )
    renderDraw('/japanese/draw', storedKanji(), recognizer)
    await screen.findByLabelText('Drawing')
    drawStroke([[10, 20], [90, 20]])
    await waitFor(() => expect(candidates()).toEqual(['木']))

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    drawStroke([[20, 20], [90, 90]])

    // Still being read: nothing yet, not 木 again.
    expect(candidates()).toEqual([])
    answerSecond(['水'])
    await waitFor(() => expect(candidates()).toEqual(['水']))
  })

  it('opens the Kanji page of a Candidate stored since it was checked', async () => {
    const user = userEvent.setup()
    // The lookup of Candidates said 氷 isn't stored, but it was just added.
    const ice = { id: 'k9', kanji: '氷', spanish: 'hielo', v1: 138 }
    const { router } = renderDraw(
      '/japanese/draw',
      {
        ...storedKanji(),
        [`GET /api/japanese/lookup/kanji/${encodeURIComponent('氷')}`]: { status: 409, body: { id: 'k9' } },
        'GET /api/japanese/kanji/k9': {
          status: 200,
          body: { ...ice, on: 'ヒョウ', kun: 'こおり', v2: null, story: null, components: [], words: [] },
        },
      },
      fakeRecognizer(() => ['氷']).recognizer,
    )
    await screen.findByLabelText('Drawing')
    drawStroke([[10, 20], [50, 60]])

    await user.click(await screen.findByRole('link', { name: '氷, not stored' }))

    expect(await screen.findByRole('heading', { level: 1, name: '氷' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/japanese/kanji/k9')
    await user.click(screen.getByRole('link', { name: 'Draw' }))
    expect(await screen.findByLabelText('Drawing')).toBeInTheDocument()
    expect(strokesShown()).toBe(1)
  })

  it('comes back from a Candidate’s Kanji Lookup to the same Drawing', async () => {
    const user = userEvent.setup()
    renderDraw(
      '/japanese/draw',
      {
        ...storedKanji(),
        [`GET /api/japanese/lookup/kanji/${encodeURIComponent('氷')}`]: {
          status: 200,
          body: { kanji: '氷', meanings: ['ice'], on: ['ヒョウ'], kun: ['こおり'], strokes: 5, grade: 3, joyo: true, jlpt: 3, words: [] },
        },
      },
      fakeRecognizer(() => ['氷']).recognizer,
    )
    await screen.findByLabelText('Drawing')
    drawStroke([[10, 20], [50, 60]])
    drawStroke([[60, 20], [20, 60]])

    await user.click(await screen.findByRole('link', { name: '氷, not stored' }))
    expect(await screen.findByRole('heading', { level: 1, name: '氷' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Draw' }))

    await screen.findByLabelText('Drawing')
    expect(strokesShown()).toBe(2)
    await waitFor(() => expect(candidates()).toEqual(['氷']))
  })
})
