import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, fakeClipboard, noClipboard, renderAppWith, type Answer, type Answers } from '../../test/app'
import { career } from '.'

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175, weighInReminder: { enabled: false, weekday: 'monday', time: '08:00' } }

type NextStep = { kind: string; date: string; time: string | null }
type TopOpportunity = {
  id: string
  company: { id: string; name: string }
  role: string
  stage: 'introduced' | 'in_process' | 'offer'
  interest: 'high' | 'normal' | 'low'
  nextStep: NextStep | null
}

function opportunity(fields: Partial<TopOpportunity> & Pick<TopOpportunity, 'id' | 'role'>): TopOpportunity {
  return { company: { id: `c-${fields.id}`, name: 'Kumo Pay' }, stage: 'introduced', interest: 'normal', nextStep: null, ...fields }
}

// GET /api/career/home-card, as the server answers it.
function homeCard({ looking = false, waiting = 0, top = [] }: { looking?: boolean; waiting?: number; top?: TopOpportunity[] } = {}) {
  return { status: 200, body: { looking, waiting, top } }
}

function renderCareer(path: string, answers: Answers, clipboard = noClipboard) {
  const fake = fakeApi({ 'GET /api/settings': { status: 200, body: tokyo }, ...answers })
  const router = renderAppWith(path, { api: fake.api, modules: [career], clipboard })
  return { ...fake, router }
}

// The Career Home Card on Home, found by its heading.
async function careerCard() {
  const heading = await screen.findByRole('heading', { name: 'Career' })
  return heading.closest('article') as HTMLElement
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Career Home Card', () => {
  it('shows the top 3 Opportunities with their Company, role, Stage and next Step, each opening its page', async () => {
    renderCareer('/', {
      'GET /api/career/home-card': homeCard({
        top: [
          opportunity({ id: 'o1', role: 'Backend Engineer', stage: 'in_process', nextStep: { kind: 'Final interview', date: '2026-11-27', time: '18:00' } }),
          opportunity({ id: 'o2', role: 'SRE', company: { id: 'c2', name: 'Sora Bank' }, stage: 'offer' }),
          opportunity({ id: 'o3', role: 'Platform Lead', company: { id: 'c3', name: 'Mori Labs' }, nextStep: { kind: 'Casual interview', date: '2026-12-02', time: null } }),
        ],
      }),
    })

    const card = await careerCard()
    const first = await within(card).findByRole('link', { name: /Backend Engineer/ })
    expect(first).toHaveAttribute('href', '/career/opportunities/o1')
    expect(first).toHaveTextContent('Kumo Pay')
    expect(first).toHaveTextContent('In Process')
    expect(first).toHaveTextContent('Final interview · Fri 27 Nov, 18:00')

    const second = within(card).getByRole('link', { name: /SRE/ })
    expect(second).toHaveAttribute('href', '/career/opportunities/o2')
    expect(second).toHaveTextContent('Sora Bank')
    expect(second).toHaveTextContent('Offer')

    const third = within(card).getByRole('link', { name: /Platform Lead/ })
    expect(third).toHaveTextContent('Introduced')
    expect(third).toHaveTextContent('Casual interview · Wed 2 Dec')
    await waitFor(() => expect(within(card).getAllByRole('link', { name: /Kumo Pay|Sora Bank|Mori Labs/ })).toHaveLength(3))
  })

  it('says how many Recruiters are waiting, and opens the Career screen', async () => {
    const user = userEvent.setup()
    const { router } = renderCareer('/', {
      'GET /api/career/home-card': homeCard({ waiting: 2, top: [opportunity({ id: 'o1', role: 'Backend Engineer' })] }),
    })

    const card = await careerCard()
    await user.click(await within(card).findByRole('link', { name: '2 Recruiters waiting' }))

    expect(router.state.location.pathname).toBe('/career')
    expect(await screen.findByRole('heading', { level: 1, name: 'Career' })).toBeInTheDocument()
  })

  it('says one Recruiter is waiting in the singular', async () => {
    renderCareer('/', { 'GET /api/career/home-card': homeCard({ waiting: 1 }) })

    const card = await careerCard()
    expect(await within(card).findByRole('link', { name: '1 Recruiter waiting' })).toHaveAttribute('href', '/career')
  })

  it('hides the waiting line when nobody is waiting', async () => {
    renderCareer('/', { 'GET /api/career/home-card': homeCard({ top: [opportunity({ id: 'o1', role: 'Backend Engineer' })] }) })

    const card = await careerCard()
    await within(card).findByRole('link', { name: /Backend Engineer/ })
    expect(card).not.toHaveTextContent(/waiting/)
    expect(within(card).getByRole('link', { name: 'Career' })).toHaveAttribute('href', '/career')
  })

  it('says nothing is waiting when no Recruiter waits and no Opportunity is open', async () => {
    renderCareer('/', { 'GET /api/career/home-card': homeCard() })

    const card = await careerCard()
    expect(await within(card).findByText('Nothing waiting.')).toBeInTheDocument()
    expect(within(card).queryByRole('list', { name: 'Top Opportunities' })).not.toBeInTheDocument()
  })

  it('leaves the empty state out while there is something to show', async () => {
    renderCareer('/', { 'GET /api/career/home-card': homeCard({ top: [opportunity({ id: 'o1', role: 'Backend Engineer' })] }) })

    const card = await careerCard()
    await within(card).findByRole('link', { name: /Backend Engineer/ })
    expect(within(card).queryByText('Nothing waiting.')).not.toBeInTheDocument()
  })

  it('switches to Looking at once, and saves it', async () => {
    const user = userEvent.setup()
    let saved: (answer: Answer) => void = () => {}
    const { sent } = renderCareer('/', {
      'GET /api/career/home-card': homeCard({ looking: false }),
      'PUT /api/career/settings': () => new Promise<Answer>((resolve) => (saved = resolve)),
    })

    const card = await careerCard()
    const looking = await within(card).findByRole('switch', { name: 'Looking' })
    await waitFor(() => expect(looking).not.toBeChecked())
    await user.click(looking)

    // Shown before the server answers.
    expect(looking).toBeChecked()
    expect(sent).toContainEqual({ method: 'PUT', path: '/api/career/settings', body: { looking: true } })
    saved({ status: 204 })
    await waitFor(() => expect(looking).toBeChecked())
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the Owner Looking when they are', async () => {
    renderCareer('/', { 'GET /api/career/home-card': homeCard({ looking: true }) })

    const card = await careerCard()
    await waitFor(() => expect(within(card).getByRole('switch', { name: 'Looking' })).toBeChecked())
  })

  it('goes back and says so when Looking could not be saved', async () => {
    const user = userEvent.setup()
    renderCareer('/', {
      'GET /api/career/home-card': homeCard({ looking: true }),
      'PUT /api/career/settings': { status: 500 },
    })

    const card = await careerCard()
    const looking = await within(card).findByRole('switch', { name: 'Looking' })
    await waitFor(() => expect(looking).toBeChecked())
    await user.click(looking)

    expect(await within(card).findByRole('alert')).toHaveTextContent("Couldn't change whether you're Looking. Try again.")
    expect(looking).toBeChecked()
  })

  it("says when it couldn't load, and loads again when asked", async () => {
    const user = userEvent.setup()
    let answer: Answer = { status: 500 }
    renderCareer('/', { 'GET /api/career/home-card': () => answer })

    const card = await careerCard()
    expect(await within(card).findByRole('alert')).toHaveTextContent("Couldn't load Career.")
    expect(within(card).queryByRole('switch')).not.toBeInTheDocument()

    answer = homeCard({ waiting: 3 })
    await user.click(within(card).getByRole('button', { name: 'Try again' }))

    expect(await within(card).findByRole('link', { name: '3 Recruiters waiting' })).toBeInTheDocument()
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
  })

  it("dates a next Step in another year with its year", async () => {
    // Monday 16 November 2026 in Tokyo.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-16T03:00:00Z'))
    renderCareer('/', {
      'GET /api/career/home-card': homeCard({
        top: [opportunity({ id: 'o1', role: 'Backend Engineer', stage: 'in_process', nextStep: { kind: 'Final interview', date: '2027-01-08', time: null } })],
      }),
    })

    const card = await careerCard()
    expect(await within(card).findByRole('link', { name: /Backend Engineer/ })).toHaveTextContent('Final interview · Fri 8 Jan 2027')
  })
})

type Waiting = { id: string; name: string; organisation: string; lastMessageAt: string; firstLine: string }

function waiting(fields: Partial<Waiting> & Pick<Waiting, 'id' | 'name'>): Waiting {
  return { organisation: 'Hays Japan', lastMessageAt: '2026-11-14T01:15:00Z', firstLine: 'Thank you for reaching out!', ...fields }
}

// GET /api/career, as the server answers it.
function careerScreen({ waiting = [], top = [], open = 0, lateReplies = 0 }: { waiting?: Waiting[]; top?: TopOpportunity[]; open?: number; lateReplies?: number } = {}) {
  return { status: 200, body: { waiting, top, open, lateReplies } }
}

// Monday 16 November 2026, 12:00 in Tokyo.
function atNoonMonday() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T03:00:00Z'))
}

describe('Career screen', () => {
  it('lists the Recruiters waiting, with how long ago they wrote and the first line of the Suggested Reply, each opening their page', async () => {
    atNoonMonday()
    renderCareer('/career', {
      'GET /api/career': careerScreen({
        waiting: [
          waiting({ id: 'r1', name: 'Tanaka Yui', lastMessageAt: '2026-11-14T01:15:00Z', firstLine: 'Thank you for reaching out!' }),
          waiting({ id: 'r2', name: 'Sato Ken', organisation: 'Sora Bank', lastMessageAt: '2026-11-16T00:00:00Z', firstLine: 'Hello Sato-san,' }),
        ],
      }),
    })

    const list = await screen.findByRole('list', { name: 'Waiting for you' })
    const [tanaka, sato] = within(list).getAllByRole('link')
    expect(tanaka).toHaveAttribute('href', '/career/recruiters/r1')
    expect(tanaka).toHaveTextContent('Tanaka Yui')
    expect(tanaka).toHaveTextContent('Hays Japan')
    expect(tanaka).toHaveTextContent('2 days ago')
    expect(tanaka).toHaveTextContent('Thank you for reaching out!')
    expect(sato).toHaveAttribute('href', '/career/recruiters/r2')
    expect(sato).toHaveTextContent('Sora Bank')
    expect(sato).toHaveTextContent('3 hours ago')
  })

  it('marks Japanese in a waiting row as Japanese, and only that', async () => {
    renderCareer('/career', {
      'GET /api/career': careerScreen({ waiting: [waiting({ id: 'r1', name: 'Tanaka Yui', firstLine: 'ご連絡ありがとうございます。' })] }),
    })

    const row = within(await screen.findByRole('list', { name: 'Waiting for you' })).getByRole('link')
    expect(within(row).getByText('ご連絡ありがとうございます。')).toHaveAttribute('lang', 'ja')
    expect(within(row).getByText('Hays Japan')).not.toHaveAttribute('lang')
    expect(within(row).getByText('Tanaka Yui')).not.toHaveAttribute('lang')
  })

  it('says when nobody is waiting', async () => {
    renderCareer('/career', { 'GET /api/career': careerScreen() })

    expect(await screen.findByText('Nobody is waiting.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Waiting for you' })).not.toBeInTheDocument()
  })

  it('shows the top Opportunities, each opening its page, and links to every open Opportunity and the Late Replies', async () => {
    atNoonMonday()
    renderCareer('/career', {
      'GET /api/career': careerScreen({
        top: [
          opportunity({ id: 'o1', role: 'Backend Engineer', stage: 'in_process', nextStep: { kind: 'Final interview', date: '2026-11-27', time: '18:00' } }),
          opportunity({ id: 'o2', role: 'SRE', company: { id: 'c2', name: 'Sora Bank' }, stage: 'offer' }),
        ],
        open: 7,
        lateReplies: 4,
      }),
    })

    const top = await screen.findByRole('list', { name: 'Top Opportunities' })
    const [first, second] = within(top).getAllByRole('link')
    expect(first).toHaveAttribute('href', '/career/opportunities/o1')
    expect(first).toHaveTextContent('Backend Engineer')
    expect(first).toHaveTextContent('Kumo Pay')
    expect(first).toHaveTextContent('In Process')
    expect(first).toHaveTextContent('Final interview · Fri 27 Nov, 18:00')
    expect(second).toHaveAttribute('href', '/career/opportunities/o2')
    expect(second).toHaveTextContent('Offer')

    expect(screen.getByRole('link', { name: 'All open (7)' })).toHaveAttribute('href', '/career/opportunities')
    expect(screen.getByRole('link', { name: 'Late Replies (4)' })).toHaveAttribute('href', '/career/late')
  })
})

type Message = { id: string; from: 'owner' | 'other'; sentAt: string; text: string }
type LanguageNote = { wrote: string; natural: string; why: string }
type Reply = { text: string; language: 'ja' | 'en'; kind: 'answer' | 'follow_up' | 'late'; notes: LanguageNote[] }
type Conversation = { id: string; url: string; messages: Message[]; suggestedReply: Reply | null }

function conversation(fields: Partial<Conversation> & Pick<Conversation, 'id'>): Conversation {
  return { url: `https://www.linkedin.com/messaging/thread/${fields.id}/`, messages: [], suggestedReply: null, ...fields }
}

// GET /api/career/recruiters/{id}, as the server answers it, for Tanaka Yui of Hays Japan.
function recruiterPage(conversations: Conversation[]) {
  return {
    status: 200,
    body: { id: 'r1', name: 'Tanaka Yui', profileUrl: 'https://www.linkedin.com/in/tanaka-yui/', kind: 'agency', organisation: 'Hays Japan', conversations },
  }
}

const tanakasConversation = conversation({
  id: 't1',
  messages: [
    { id: 'm3', from: 'other', sentAt: '2026-11-14T02:00:00Z', text: 'Sure, here is the job description.' },
    { id: 'm4', from: 'owner', sentAt: '2026-11-14T03:00:00Z', text: 'Thank you for reach out!' },
    { id: 'm5', from: 'other', sentAt: '2026-11-15T01:00:00Z', text: '来週、カジュアル面談はいかがでしょうか？' },
  ],
  suggestedReply: {
    text: 'ありがとうございます。\n木曜日の夜はいかがでしょうか。',
    language: 'ja',
    kind: 'answer',
    notes: [{ wrote: 'Thank you for reach out!', natural: 'Thank you for reaching out!', why: 'After "for", the -ing form.' }],
  },
})

describe('Loading problems', () => {
  it("says when the Career screen couldn't load, and loads it again when asked", async () => {
    const user = userEvent.setup()
    let answer: Answer = { status: 500 }
    renderCareer('/career', { 'GET /api/career': () => answer })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load Career.")
    answer = careerScreen()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Nobody is waiting.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("says when a Recruiter couldn't be loaded, and loads them again when asked", async () => {
    const user = userEvent.setup()
    let answer: Answer = { status: 500 }
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': () => answer })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this Recruiter.")
    answer = recruiterPage([])
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tanaka Yui' })).toBeInTheDocument()
  })

  it('says when there is no such Recruiter, with nothing to try again', async () => {
    renderCareer('/career/recruiters/r9', { 'GET /api/career/recruiters/r9': { status: 404, body: "there's no such Recruiter" } })

    expect(await screen.findByText("This Recruiter isn't in Nando.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})

describe('Recruiter page', () => {
  it("shows each Conversation's last messages, the Recruiter's and the Owner's told apart, and its Suggested Reply", async () => {
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]) })

    expect(await screen.findByRole('heading', { level: 1, name: 'Tanaka Yui' })).toBeInTheDocument()
    expect(screen.getByText('Hays Japan')).toBeInTheDocument()

    const list = screen.getByRole('list', { name: 'Messages' })
    const messages = within(list).getAllByRole('listitem')
    expect(messages.map((m) => m.textContent)).toEqual([
      'Tanaka Yui: Sure, here is the job description.',
      'You: Thank you for reach out!',
      'Tanaka Yui: 来週、カジュアル面談はいかがでしょうか？',
    ])
    expect(within(list).getByText('来週、カジュアル面談はいかがでしょうか？')).toHaveAttribute('lang', 'ja')
    expect(within(list).getByText('Thank you for reach out!')).not.toHaveAttribute('lang')

    const reply = screen.getByRole('region', { name: 'Suggested Reply' })
    expect(within(reply).getByText(/木曜日の夜はいかがでしょうか。/)).toHaveAttribute('lang', 'ja')
  })

  it('copies the Suggested Reply, and says so', async () => {
    const user = userEvent.setup()
    const { clipboard, copied } = fakeClipboard()
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]) }, clipboard)

    const reply = await screen.findByRole('region', { name: 'Suggested Reply' })
    expect(within(reply).queryByText('Copied')).not.toBeInTheDocument()
    await user.click(within(reply).getByRole('button', { name: 'Copy' }))

    expect(copied).toEqual(['ありがとうございます。\n木曜日の夜はいかがでしょうか。'])
    expect(await within(reply).findByRole('status')).toHaveTextContent('Copied')
  })

  it("says when the Suggested Reply couldn't be copied", async () => {
    const user = userEvent.setup()
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]) }, fakeClipboard({ fails: true }).clipboard)

    const reply = await screen.findByRole('region', { name: 'Suggested Reply' })
    await user.click(within(reply).getByRole('button', { name: 'Copy' }))

    expect(await within(reply).findByRole('alert')).toHaveTextContent("Couldn't copy. Select the text and copy it instead.")
  })

  it('opens the Conversation in LinkedIn', async () => {
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]) })

    const reply = await screen.findByRole('region', { name: 'Suggested Reply' })
    expect(within(reply).getByRole('link', { name: 'Open in LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/messaging/thread/t1/')
  })

  it('shows the notes about the Owner\'s last message: what they wrote, what is natural, and why', async () => {
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]) })

    const about = await screen.findByRole('region', { name: 'About your last message' })
    const [note] = within(about).getAllByRole('listitem')
    expect(within(note).getByText('Thank you for reach out!')).toBeInTheDocument()
    expect(within(note).getByText('Thank you for reaching out!')).toBeInTheDocument()
    expect(within(note).getByText('After "for", the -ing form.')).toBeInTheDocument()
  })

  it('leaves the notes out when there are none', async () => {
    const noNotes = { ...tanakasConversation, suggestedReply: { ...tanakasConversation.suggestedReply!, notes: [] } }
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([noNotes]) })

    await screen.findByRole('region', { name: 'Suggested Reply' })
    expect(screen.queryByRole('region', { name: 'About your last message' })).not.toBeInTheDocument()
  })

  it('labels a follow-up and a late reply as such', async () => {
    const withKind = (id: string, kind: Reply['kind']) =>
      conversation({ id, suggestedReply: { text: `A ${kind} reply.`, language: 'en', kind, notes: [] } })
    renderCareer('/career/recruiters/r1', {
      'GET /api/career/recruiters/r1': recruiterPage([withKind('a', 'answer'), withKind('f', 'follow_up'), withKind('l', 'late')]),
    })

    const [answer, followUp, late] = await screen.findAllByRole('region', { name: /Suggested Reply/ })
    expect(answer).toHaveAccessibleName('Suggested Reply')
    expect(followUp).toHaveAccessibleName('Suggested Reply, Follow-up')
    expect(within(followUp).getByText('Follow-up')).toBeInTheDocument()
    expect(late).toHaveAccessibleName('Suggested Reply, Late Reply')
    expect(within(late).getByText('Late Reply')).toBeInTheDocument()
  })
})

describe('Recruiter page with several Conversations', () => {
  it('shows each Conversation apart, with its own messages and Suggested Reply', async () => {
    const osaka = conversation({
      id: 't2',
      messages: [{ id: 'o1', from: 'other', sentAt: '2026-11-15T05:00:00Z', text: 'Another role, in Osaka.' }],
      suggestedReply: { text: "Thank you, but I'd rather stay in Tokyo.", language: 'en', kind: 'answer', notes: [] },
    })
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([osaka, tanakasConversation]) })

    const first = await screen.findByRole('region', { name: 'Conversation 1 of 2' })
    const second = screen.getByRole('region', { name: 'Conversation 2 of 2' })
    expect(within(first).getByRole('list', { name: 'Messages' })).toHaveTextContent('Another role, in Osaka.')
    expect(within(first).getByRole('region', { name: 'Suggested Reply' })).toHaveTextContent("I'd rather stay in Tokyo.")
    expect(within(second).getByRole('list', { name: 'Messages' })).toHaveTextContent('カジュアル面談')
    expect(within(second).getByRole('link', { name: 'Open in LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/messaging/thread/t1/')
  })

  it('leaves out the messages of a Conversation that has none', async () => {
    const empty = conversation({ id: 't3', suggestedReply: { text: 'Hello!', language: 'en', kind: 'late', notes: [] } })
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([empty]) })

    await screen.findByRole('region', { name: /Suggested Reply/ })
    expect(screen.queryByRole('list', { name: 'Messages' })).not.toBeInTheDocument()
  })
})

describe('Copied', () => {
  it('stays a moment after the last tap on Copy', async () => {
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]) })
    const reply = await screen.findByRole('region', { name: 'Suggested Reply' })
    // Timers faked once the page is loaded, so finding it above still polls.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const copy = within(reply).getByRole('button', { name: 'Copy' })
    // A plain click, as user-event's own delays wait on the faked timers.
    const tap = () => act(async () => void fireEvent.click(copy))

    await tap()
    expect(within(reply).getByRole('status')).toHaveTextContent('Copied')
    await act(() => vi.advanceTimersByTimeAsync(1500))
    await tap()
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(within(reply).getByRole('status')).toHaveTextContent('Copied')

    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(within(reply).getByRole('status')).toHaveTextContent('')
  })
})

describe('Late Replies', () => {
  it('lists the Recruiters whose Suggested Reply is late, oldest first, each opening their page', async () => {
    const user = userEvent.setup()
    atNoonMonday()
    const { router } = renderCareer('/career/late', {
      'GET /api/career/late-replies': {
        status: 200,
        body: [
          waiting({ id: 'r3', name: 'Ueda Mai', organisation: 'Robert Walters', lastMessageAt: '2025-10-12T01:00:00Z', firstLine: 'Hello Ueda-san!' }),
          waiting({ id: 'r4', name: 'Mori Taro', lastMessageAt: '2026-10-02T01:00:00Z', firstLine: 'My deepest apologies for the late response.' }),
        ],
      },
      'GET /api/career/recruiters/r3': recruiterPage([]),
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Late Replies' })).toBeInTheDocument()
    const [ueda, mori] = within(await screen.findByRole('list', { name: 'Late Replies' })).getAllByRole('link')
    expect(ueda).toHaveTextContent('Ueda Mai')
    expect(ueda).toHaveTextContent('Robert Walters')
    expect(ueda).toHaveTextContent('last year')
    expect(ueda).toHaveTextContent('Hello Ueda-san!')
    expect(mori).toHaveTextContent('last month')

    await user.click(ueda)
    expect(router.state.location.pathname).toBe('/career/recruiters/r3')
  })

  it('is where a Recruiter opened from it goes back to', async () => {
    const user = userEvent.setup()
    renderCareer('/career/late', {
      'GET /api/career/late-replies': { status: 200, body: [waiting({ id: 'r1', name: 'Tanaka Yui' })] },
      'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]),
    })

    await user.click(await screen.findByRole('link', { name: /Tanaka Yui/ }))
    expect(await backLink('Tanaka Yui')).toEqual({ name: 'Late Replies', href: '/career/late' })
  })

  it('is still where a Recruiter goes back to when their page opens again, already loaded', async () => {
    const user = userEvent.setup()
    const { router } = renderCareer('/career/late', {
      'GET /api/career/late-replies': { status: 200, body: [waiting({ id: 'r1', name: 'Tanaka Yui' })] },
      'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]),
    })

    await user.click(await screen.findByRole('link', { name: /Tanaka Yui/ }))
    await user.click(within((await screen.findByRole('heading', { level: 1, name: 'Tanaka Yui' })).closest('header') as HTMLElement).getByRole('link'))
    expect(router.state.location.pathname).toBe('/career/late')
    await user.click(await screen.findByRole('link', { name: /Tanaka Yui/ }))
    expect(await backLink('Tanaka Yui')).toEqual({ name: 'Late Replies', href: '/career/late' })
  })

  it('says when there are none', async () => {
    renderCareer('/career/late', { 'GET /api/career/late-replies': { status: 200, body: [] } })

    expect(await screen.findByText('No Late Replies.')).toBeInTheDocument()
  })
})

describe('Open Opportunities', () => {
  it('lists every open Opportunity, top first, each opening its page', async () => {
    const user = userEvent.setup()
    const { router } = renderCareer('/career/opportunities', {
      'GET /api/career/opportunities': {
        status: 200,
        body: [
          opportunity({ id: 'o1', role: 'Backend Engineer', stage: 'offer' }),
          opportunity({ id: 'o2', role: 'SRE', company: { id: 'c2', name: 'Sora Bank' }, nextStep: { kind: 'Casual interview', date: '2026-12-02', time: null } }),
        ],
      },
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Open Opportunities' })).toBeInTheDocument()
    const [first, second] = within(await screen.findByRole('list', { name: 'Open Opportunities' })).getAllByRole('link')
    expect(first).toHaveTextContent('Backend Engineer')
    expect(first).toHaveTextContent('Offer')
    expect(second).toHaveTextContent('Sora Bank')
    expect(second).toHaveTextContent('Casual interview · Wed 2 Dec')

    await user.click(second)
    expect(router.state.location.pathname).toBe('/career/opportunities/o2')
  })

  it('says when there are none', async () => {
    renderCareer('/career/opportunities', { 'GET /api/career/opportunities': { status: 200, body: [] } })

    expect(await screen.findByText('No open Opportunities.')).toBeInTheDocument()
  })
})

type PageStep = { id: string; kind: string; date: string; time: string | null; notes: string; next: boolean }
type OpportunityPage = {
  id: string
  role: string
  stage: 'introduced' | 'in_process' | 'offer' | 'closed'
  outcome: 'accepted' | 'declined' | 'withdrawn' | 'rejected' | 'faded' | null
  interest: 'high' | 'normal' | 'low'
  fitNote: string
  details: string
  pay: { firstStated: { min: number; max: number } | null; offered: { min: number; max: number } | null; bonusIncluded: boolean | null }
  conditions: { remote: 'remote' | 'hybrid' | 'office' | null; officeDays: number | null; officeLocation: string; workingLanguage: 'ja' | 'en' | 'mixed' | null }
  perks: string[]
  steps: PageStep[]
  recruiter: { id: string; name: string } | null
  company: { id: string; name: string; linkedInUrl: string; websiteUrl: string; brief: string }
}

// An Opportunity with nothing but its Company and role, as GET /api/career/opportunities/{id} answers it.
function bareOpportunity(fields: Partial<OpportunityPage> = {}): OpportunityPage {
  return {
    id: 'o1',
    role: 'Backend Engineer',
    stage: 'introduced',
    outcome: null,
    interest: 'normal',
    fitNote: '',
    details: '',
    pay: { firstStated: null, offered: null, bonusIncluded: null },
    conditions: { remote: null, officeDays: null, officeLocation: '', workingLanguage: null },
    perks: [],
    steps: [],
    recruiter: null,
    company: { id: 'c1', name: 'Kumo Pay', linkedInUrl: '', websiteUrl: '', brief: '' },
    ...fields,
  }
}

// Kumo Pay's Backend Engineer role, with everything filled in.
const fullOpportunity = bareOpportunity({
  stage: 'in_process',
  interest: 'high',
  fitNote: 'Go and payments: close to what the Owner does now.',
  details: 'Ledger team of 8.',
  pay: { firstStated: { min: 9_000_000, max: 12_000_000 }, offered: { min: 11_500_000, max: 11_500_000 }, bonusIncluded: true },
  conditions: { remote: 'hybrid', officeDays: 2, officeLocation: 'Shibuya', workingLanguage: 'en' },
  perks: ['Housing allowance', 'Side jobs allowed'],
  steps: [
    { id: 's1', kind: 'Casual interview', date: '2026-11-10', time: '18:00', notes: 'With the CTO.', next: false },
    { id: 's2', kind: 'Take-home assignment', date: '2026-11-16', time: '10:00', notes: 'Due by noon.', next: true },
    { id: 's3', kind: 'Final interview', date: '2026-11-27', time: null, notes: '', next: false },
  ],
  recruiter: { id: 'r1', name: 'Tanaka Yui' },
  company: { id: 'c1', name: 'Kumo Pay', linkedInUrl: '', websiteUrl: 'https://kumopay.example.com', brief: 'Payments for small shops in Japan, about 200 people.' },
})

// The back link in the header of the screen titled `title`: its name and where it goes.
async function backLink(title: string) {
  const header = (await screen.findByRole('heading', { level: 1, name: title })).closest('header') as HTMLElement
  const link = within(header).getByRole('link')
  return { name: link.textContent, href: link.getAttribute('href') }
}

describe('Opportunity page', () => {
  it('shows its role, Company, Stage and Interest, and its Steps by date with the next one highlighted', async () => {
    atNoonMonday()
    renderCareer('/career/opportunities/o1', { 'GET /api/career/opportunities/o1': { status: 200, body: fullOpportunity } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Backend Engineer' })).toBeInTheDocument()
    expect(screen.getByText('Kumo Pay')).toBeInTheDocument()
    expect(screen.getByText('In Process')).toBeInTheDocument()
    expect(screen.getByText('High interest')).toBeInTheDocument()

    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')
    expect(steps.map((s) => s.textContent)).toEqual([
      'Casual interviewTue 10 Nov, 18:00With the CTO.',
      'NextTake-home assignmentMon 16 Nov, 10:00Due by noon.',
      'Final interviewFri 27 Nov',
    ])
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(steps[0]).not.toHaveAttribute('aria-current')
  })

  it('shows its pay in 万円 with the yen under it, and its working conditions', async () => {
    renderCareer('/career/opportunities/o1', { 'GET /api/career/opportunities/o1': { status: 200, body: fullOpportunity } })

    const pay = await screen.findByRole('region', { name: 'Pay and working conditions' })
    const rows = within(pay).getAllByRole('listitem').map((row) => row.textContent)
    expect(rows).toEqual([
      'First stated900–1,200万円¥9,000,000 – ¥12,000,000',
      'Offered1,150万円¥11,500,000',
      'BonusIncluded',
      'WorkHybrid, 2 days a week in the office',
      'OfficeShibuya',
      'Working languageEnglish',
    ])
  })

  it('writes an odd salary to one decimal of 万円', async () => {
    renderCareer('/career/opportunities/o1', {
      'GET /api/career/opportunities/o1': { status: 200, body: bareOpportunity({ pay: { firstStated: { min: 9_255_000, max: 9_255_000 }, offered: null, bonusIncluded: false } }) },
    })

    const pay = await screen.findByRole('region', { name: 'Pay and working conditions' })
    expect(within(pay).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['First stated925.5万円¥9,255,000', 'BonusNot included'])
  })

  it('shows its Perks, fit note and details, links to its Recruiter, and shows the Company Brief', async () => {
    renderCareer('/career/opportunities/o1', { 'GET /api/career/opportunities/o1': { status: 200, body: fullOpportunity } })

    const perks = await screen.findByRole('list', { name: 'Perks' })
    expect(within(perks).getAllByRole('listitem').map((p) => p.textContent)).toEqual(['Housing allowance', 'Side jobs allowed'])
    expect(screen.getByRole('region', { name: 'Fit note' })).toHaveTextContent('Go and payments: close to what the Owner does now.')
    expect(screen.getByRole('region', { name: 'Details' })).toHaveTextContent('Ledger team of 8.')
    expect(screen.getByRole('link', { name: /Tanaka Yui/ })).toHaveAttribute('href', '/career/recruiters/r1')
    expect(screen.getByRole('region', { name: 'Company Brief' })).toHaveTextContent('Payments for small shops in Japan, about 200 people.')
  })

  it('shows nothing but its Company and role when that is all there is', async () => {
    renderCareer('/career/opportunities/o1', { 'GET /api/career/opportunities/o1': { status: 200, body: bareOpportunity() } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Backend Engineer' })).toBeInTheDocument()
    expect(screen.getByText('Kumo Pay')).toBeInTheDocument()
    expect(screen.getByText('Introduced')).toBeInTheDocument()
    expect(screen.queryAllByRole('heading', { level: 2 })).toEqual([])
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows how a closed one ended', async () => {
    renderCareer('/career/opportunities/o1', {
      'GET /api/career/opportunities/o1': { status: 200, body: bareOpportunity({ stage: 'closed', outcome: 'declined' }) },
    })

    expect(await screen.findByText('Closed · Declined')).toBeInTheDocument()
  })

  it('says when there is no such Opportunity', async () => {
    renderCareer('/career/opportunities/o9', {
      'GET /api/career/opportunities/o9': { status: 404, body: "there's no such Opportunity" },
    })
    expect(await screen.findByText("This Opportunity isn't in Nando.")).toBeInTheDocument()
  })

  it("says when an Opportunity couldn't load, with Try again", async () => {
    renderCareer('/career/opportunities/o8', { 'GET /api/career/opportunities/o8': { status: 500 } })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this Opportunity.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('marks no Step as next on a closed one', async () => {
    renderCareer('/career/opportunities/o1', {
      'GET /api/career/opportunities/o1': { status: 200, body: { ...fullOpportunity, stage: 'closed', outcome: 'withdrawn' } },
    })

    const steps = within(await screen.findByRole('list', { name: 'Steps' })).getAllByRole('listitem')
    expect(steps.filter((s) => s.hasAttribute('aria-current'))).toEqual([])
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('is where its Recruiter, opened from it, goes back to, named by its role', async () => {
    const user = userEvent.setup()
    const { sent } = renderCareer('/career/opportunities/o1', {
      'GET /api/career/opportunities/o1': { status: 200, body: fullOpportunity },
      'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]),
    })

    await user.click(await screen.findByRole('link', { name: /Tanaka Yui/ }))
    expect(await backLink('Tanaka Yui')).toEqual({ name: 'Backend Engineer', href: '/career/opportunities/o1' })
    // The role comes from the Opportunity page already loaded, not from asking again.
    expect(sent.filter((r) => r.path === '/api/career/opportunities/o1')).toHaveLength(1)
  })

  it('names itself in Japanese, back from its Recruiter, when its role is Japanese', async () => {
    const user = userEvent.setup()
    const { router } = renderCareer('/career/opportunities/o1', {
      'GET /api/career/opportunities/o1': { status: 200, body: { ...fullOpportunity, role: 'バックエンドエンジニア' } },
      'GET /api/career/recruiters/r1': recruiterPage([tanakasConversation]),
    })

    await user.click(await screen.findByRole('link', { name: /Tanaka Yui/ }))
    const header = (await screen.findByRole('heading', { level: 1, name: 'Tanaka Yui' })).closest('header') as HTMLElement
    const back = within(header).getByRole('link')
    expect(within(back).getByText('バックエンドエンジニア')).toHaveAttribute('lang', 'ja')

    await user.click(back)
    expect(router.state.location.pathname).toBe('/career/opportunities/o1')
    expect(await screen.findByRole('heading', { level: 1, name: 'バックエンドエンジニア' })).toBeInTheDocument()
  })

  it('goes back to the screen it was opened from', async () => {
    const user = userEvent.setup()
    renderCareer('/career/opportunities', {
      'GET /api/career/opportunities': { status: 200, body: [opportunity({ id: 'o1', role: 'Backend Engineer' })] },
      'GET /api/career/opportunities/o1': { status: 200, body: bareOpportunity() },
    })

    await user.click(await screen.findByRole('link', { name: /Backend Engineer/ }))
    expect(await backLink('Backend Engineer')).toEqual({ name: 'Open Opportunities', href: '/career/opportunities' })
  })

  it('goes back Home when opened from the Home Card', async () => {
    const user = userEvent.setup()
    renderCareer('/', {
      'GET /api/career/home-card': homeCard({ top: [opportunity({ id: 'o1', role: 'Backend Engineer' })] }),
      'GET /api/career/opportunities/o1': { status: 200, body: bareOpportunity() },
    })

    await user.click(await within(await careerCard()).findByRole('link', { name: /Backend Engineer/ }))
    expect(await backLink('Backend Engineer')).toEqual({ name: 'Home', href: '/' })
  })

  it('reads a salary range given high to low, or that rounds to one amount, sensibly, and a hybrid role with no office days as hybrid', async () => {
    renderCareer('/career/opportunities/o1', {
      'GET /api/career/opportunities/o1': {
        status: 200,
        body: bareOpportunity({
          pay: { firstStated: { min: 12_000_000, max: 9_000_000 }, offered: { min: 9_000_000, max: 9_000_400 }, bonusIncluded: null },
          conditions: { remote: 'hybrid', officeDays: 0, officeLocation: '', workingLanguage: null },
          fitNote: '   ',
        }),
      },
    })

    const pay = await screen.findByRole('region', { name: 'Pay and working conditions' })
    expect(within(pay).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'First stated900–1,200万円¥9,000,000 – ¥12,000,000',
      'Offered900万円¥9,000,000 – ¥9,000,400',
      'WorkHybrid',
    ])
    expect(screen.queryByRole('region', { name: 'Fit note' })).not.toBeInTheDocument()
  })
})

