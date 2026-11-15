import { screen, waitFor, within } from '@testing-library/react'
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

const tanakasThread = conversation({
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

  it("says when a Recruiter couldn't be loaded", async () => {
    renderCareer('/career/recruiters/r9', { 'GET /api/career/recruiters/r9': { status: 404, body: "there's no such Recruiter" } })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this Recruiter.")
  })
})

describe('Recruiter page', () => {
  it("shows each Conversation's last messages, the Recruiter's and the Owner's told apart, and its Suggested Reply", async () => {
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasThread]) })

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
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasThread]) }, clipboard)

    const reply = await screen.findByRole('region', { name: 'Suggested Reply' })
    expect(within(reply).queryByText('Copied')).not.toBeInTheDocument()
    await user.click(within(reply).getByRole('button', { name: 'Copy' }))

    expect(copied).toEqual(['ありがとうございます。\n木曜日の夜はいかがでしょうか。'])
    expect(await within(reply).findByRole('status')).toHaveTextContent('Copied')
  })

  it("says when the Suggested Reply couldn't be copied", async () => {
    const user = userEvent.setup()
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasThread]) }, fakeClipboard({ fails: true }).clipboard)

    const reply = await screen.findByRole('region', { name: 'Suggested Reply' })
    await user.click(within(reply).getByRole('button', { name: 'Copy' }))

    expect(await within(reply).findByRole('alert')).toHaveTextContent("Couldn't copy. Select the text and copy it instead.")
  })

  it('opens the Conversation in LinkedIn', async () => {
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasThread]) })

    const reply = await screen.findByRole('region', { name: 'Suggested Reply' })
    expect(within(reply).getByRole('link', { name: 'Open in LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/messaging/thread/t1/')
  })

  it('shows the notes about the Owner\'s last message: what they wrote, what is natural, and why', async () => {
    renderCareer('/career/recruiters/r1', { 'GET /api/career/recruiters/r1': recruiterPage([tanakasThread]) })

    const about = await screen.findByRole('region', { name: 'About your last message' })
    const [note] = within(about).getAllByRole('listitem')
    expect(within(note).getByText('Thank you for reach out!')).toBeInTheDocument()
    expect(within(note).getByText('Thank you for reaching out!')).toBeInTheDocument()
    expect(within(note).getByText('After "for", the -ing form.')).toBeInTheDocument()
  })

  it('leaves the notes out when there are none', async () => {
    const noNotes = { ...tanakasThread, suggestedReply: { ...tanakasThread.suggestedReply!, notes: [] } }
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

  it('says when there are none', async () => {
    renderCareer('/career/late', { 'GET /api/career/late-replies': { status: 200, body: [] } })

    expect(await screen.findByText('No Late Replies.')).toBeInTheDocument()
  })
})

