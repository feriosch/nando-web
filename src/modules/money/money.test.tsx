import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, renderAppWith, type Answers } from '../../test/app'
import { money } from '.'

const tokyo = { timeZone: 'Asia/Tokyo', heightCm: 175 }

// The Money Home Card as nando-server answers it, made up for tests.
const october = {
  month: '2026-10',
  spending: { total: 105000, average3: 98000, essential: 90000, optional: 12000, unmarked: 3000 },
  netWorth: { total: 486500, previous: 476500 },
  unconfirmed: 2,
}

function renderMoney(path: string, answers: Answers) {
  const fake = fakeApi({ 'GET /api/settings': { status: 200, body: tokyo }, ...answers })
  renderAppWith(path, { api: fake.api, modules: [money] })
  return fake
}

describe('Money Home Card', () => {
  it('shows the latest Complete month against the average, Essential and Optional, net worth and what to confirm', async () => {
    renderMoney('/', { 'GET /api/money/card': { status: 200, body: october } })

    const card = await screen.findByRole('link', { name: /October 2026/ })
    expect(card).toHaveAttribute('href', '/money')
    expect(card).toHaveTextContent('¥105,000')
    expect(card).toHaveTextContent('¥7,000 above your 3-month average')
    expect(card).toHaveTextContent('Essential ¥90,000')
    expect(card).toHaveTextContent('Optional ¥12,000')
    expect(card).toHaveTextContent('Net worth ¥486,500')
    expect(card).toHaveTextContent('+¥10,000')
    expect(card).toHaveTextContent('2 to confirm in the Money chat')
  })

  it('names the Accounts left out of net worth, without a change that would mislead', async () => {
    renderMoney('/', {
      'GET /api/money/card': {
        status: 200,
        body: { ...october, netWorth: { total: 5000, previous: 110000, missing: [{ id: 'a2', name: 'Other bank' }] } },
      },
    })

    const card = await screen.findByRole('link', { name: /October 2026/ })
    expect(card).toHaveTextContent('Net worth ¥5,000')
    expect(card).toHaveTextContent('Without Other bank')
    expect(card).not.toHaveTextContent('−¥105,000')
  })

  it('says Money fills in once a month is in, before any is Complete', async () => {
    renderMoney('/', { 'GET /api/money/card': { status: 200, body: null } })

    const card = await screen.findByRole('link', { name: /Money fills in/ })
    expect(card).toHaveAttribute('href', '/money')
  })
})

describe('Money screen', () => {
  it('shows the latest Complete month in rows', async () => {
    renderMoney('/money', { 'GET /api/money/card': { status: 200, body: { ...october, unconfirmed: 0 } } })

    const month = await screen.findByRole('list', { name: 'October 2026' })
    expect(within(month).getByText('Spending').parentElement).toHaveTextContent('¥105,000')
    expect(within(month).getByText('3-month average').parentElement).toHaveTextContent('¥98,000')
    expect(within(month).getByText('Net worth').parentElement).toHaveTextContent('¥486,500')
    expect(screen.queryByText(/to confirm/)).not.toBeInTheDocument()
  })
})

describe('Money Settings Section', () => {
  it('shows the reminders with their Accounts, the time and the asking thresholds, read-only', async () => {
    renderMoney('/settings', {
      'GET /api/money/settings': {
        status: 200,
        body: {
          askAbove: { JPY: 3000, MXN: 300 },
          reminderTime: '09:00',
          reminders: [
            { name: 'Bank app', day: 1, accounts: ['Card', 'Account'] },
            { name: 'Rent card app', day: 28, accounts: ['Rent card'] },
          ],
        },
      },
    })

    const bank = await screen.findByText('Bank app')
    expect(bank.closest('li, div')).toHaveTextContent('1st · Card and Account')
    expect(screen.getByText('Rent card app').closest('li, div')).toHaveTextContent('28th · Rent card')
    expect(screen.getByText('Reminder time').parentElement).toHaveTextContent('09:00')
    expect(screen.getByText('Ask above').parentElement).toHaveTextContent('¥3,000 · MX$300')
    expect(screen.getByText(/ask the Money Assistant in the Money chat/)).toBeInTheDocument()
  })
})
