import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, noPush, renderApp, type Answer, type Answers } from '../../test/app'
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

function renderCareer(path: string, answers: Answers) {
  const fake = fakeApi({ 'GET /api/settings': { status: 200, body: tokyo }, ...answers })
  const router = renderApp(path, fake.api, noPush, [career])
  return { ...fake, router }
}

// The Career Home Card on Home, found by its heading.
async function careerCard() {
  const heading = await screen.findByRole('heading', { name: 'Career' })
  return heading.closest('article') as HTMLElement
}

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
})
