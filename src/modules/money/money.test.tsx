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

// Complete months as GET /api/money/months lists them, newest first, made up for tests.
function summary(month: string, total: number, essential: number, optional: number, income: number) {
  return { month, spending: { total, essential, optional, unmarked: total - essential - optional }, income, savingRate: null, netWorth: { total: 400000, missing: [] } }
}
const months = [
  summary('2026-10', 105000, 90000, 12000, 120000),
  summary('2026-09', 95000, 85000, 10000, 120000),
  summary('2026-08', 101000, 88000, 13000, 120000),
]

// October's totals as GET /api/money/months/2026-10 answers them.
const octoberTotals = {
  month: '2026-10',
  spending: {
    total: 105000,
    previous: 95000,
    average3: 98000,
    essential: 90000,
    optional: 12000,
    unmarked: 3000,
    byCategory: [
      { category: 'rent', name: 'Rent', total: 80000, previous: 80000, average3: 80000 },
      { category: 'eating_out', name: 'Eating Out', total: 12000, previous: 9000, average3: 10000 },
      { category: 'groceries', name: 'Groceries', total: 10000, previous: 6000, average3: 8000 },
      { category: '', name: 'Uncategorized', total: 3000 },
    ],
  },
  income: { total: 120000 },
  savingRate: 0.125,
  unconfirmed: { count: 2, yen: 1500 },
}

const screenAnswers: Answers = {
  'GET /api/money/months': { status: 200, body: months },
  'GET /api/money/months/2026-10': { status: 200, body: octoberTotals },
  'GET /api/money/months/2026-09': { status: 200, body: { ...octoberTotals, month: '2026-09' } },
}

describe('Money screen', () => {
  it('opens on the latest Complete month, with its spending against the average, the split, income and what to confirm', async () => {
    renderMoney('/money', screenAnswers)

    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
    const month = await screen.findByRole('region', { name: 'October 2026' })
    expect(month).toHaveTextContent('¥105,000')
    expect(month).toHaveTextContent('¥7,000 above your 3-month average')
    expect(month).toHaveTextContent('Essential ¥90,000')
    expect(month).toHaveTextContent('Optional ¥12,000')
    expect(month).toHaveTextContent('Not marked ¥3,000')
    expect(within(month).getByText('Income').parentElement).toHaveTextContent('¥120,000')
    expect(within(month).getByText('Saving rate').parentElement).toHaveTextContent('13%')
    expect(month).toHaveTextContent('2 to confirm in the Money chat')
  })

  it('moves between Complete months with arrows', async () => {
    renderMoney('/money', screenAnswers)

    const before = await screen.findByRole('link', { name: 'September 2026' })
    expect(before).toHaveAttribute('href', '/money/2026-09')
    expect(screen.queryByRole('link', { name: 'November 2026' })).not.toBeInTheDocument()
  })

  it('lists the Categories largest first, each opening its page, with its change against the average', async () => {
    renderMoney('/money/2026-10', screenAnswers)

    const categories = await screen.findByRole('list', { name: 'Categories' })
    const rows = within(categories).getAllByRole('link')
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/money/2026-10/rent',
      '/money/2026-10/eating_out',
      '/money/2026-10/groceries',
      '/money/2026-10/uncategorized',
    ])
    expect(rows[1]).toHaveTextContent('Eating Out')
    expect(rows[1]).toHaveTextContent('¥12,000')
    expect(rows[1]).toHaveTextContent('+¥2,000 against the average')
  })

  it('charts spending over the months, Essential against Optional, with income', async () => {
    renderMoney('/money', screenAnswers)

    const chart = await screen.findByRole('img', { name: /Spending by month/ })
    expect(chart.getAttribute('aria-label')).toBe(
      'Spending by month from August 2026 to October 2026: ¥101,000, ¥95,000 and ¥105,000. Income: ¥120,000, ¥120,000 and ¥120,000.',
    )
  })

  it('opens Subscriptions and Net worth', async () => {
    renderMoney('/money', screenAnswers)

    expect(await screen.findByRole('link', { name: /Subscriptions/ })).toHaveAttribute('href', '/money/subscriptions')
    expect(screen.getByRole('link', { name: /Net worth/ })).toHaveAttribute('href', '/money/net-worth')
    expect(screen.getByRole('link', { name: /Net worth/ })).toHaveTextContent('¥400,000')
  })

  it('says Money fills in once a month is in, before any is Complete', async () => {
    renderMoney('/money', { 'GET /api/money/months': { status: 200, body: [] } })

    expect(await screen.findByText(/Money fills in once a month's Statements are in/)).toBeInTheDocument()
  })

  it('says a month that isn’t Complete has nothing to show', async () => {
    renderMoney('/money/2026-11', { ...screenAnswers, 'GET /api/money/months/2026-11': { status: 404, body: 'no such Complete month' } })

    expect(await screen.findByText(/November 2026 isn't Complete/)).toBeInTheDocument()
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

// October's Eating Out as its page answers it, made up for tests.
const eatingOut = {
  month: '2026-10',
  category: 'eating_out',
  name: 'Eating Out',
  total: 12000,
  previous: 9000,
  average3: 10000,
  subcategories: [
    { subcategory: 's1', name: 'Cafés', total: 8000 },
    { subcategory: '', name: '', total: 4000 },
  ],
  transactions: [
    {
      id: 't1', day: '2026-10-03', merchant: 'Corner Café', amount: 8000, currency: 'JPY', yen: 8000, account: 'Card',
      subcategory: 'Cafés', essential: false, unconfirmed: false, note: '',
    },
    {
      id: 't2', day: '2026-10-12', merchant: 'Taco Stand', amount: 600, currency: 'MXN', yen: 4800, account: 'Peso card',
      subcategory: '', essential: false, unconfirmed: true, note: '',
    },
    {
      id: 't3', day: '2026-10-14', merchant: 'Taco Stand', amount: -100, currency: 'MXN', yen: -800, account: 'Peso card',
      subcategory: '', essential: false, unconfirmed: false, note: '',
    },
  ],
  history: [
    { month: '2026-08', total: 11000 },
    { month: '2026-09', total: 9000 },
    { month: '2026-10', total: 12000 },
  ],
}

describe('A Category’s page', () => {
  it('shows its total against the average, its months and its Subcategories', async () => {
    renderMoney('/money/2026-10/eating_out', { 'GET /api/money/months/2026-10/categories/eating_out': { status: 200, body: eatingOut } })

    expect(await screen.findByRole('heading', { name: 'Eating Out' })).toBeInTheDocument()
    expect(screen.getByText('October 2026')).toBeInTheDocument()
    expect(screen.getByText('¥12,000')).toBeInTheDocument()
    expect(screen.getByText('¥2,000 above your 3-month average')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Eating Out by month from August 2026 to October 2026: ¥11,000, ¥9,000 and ¥12,000.' })).toBeInTheDocument()
    const subcategories = screen.getByRole('list', { name: 'Subcategories' })
    expect(within(subcategories).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['Cafés¥8,000', 'No Subcategory¥4,000'])
  })

  it('lists its Transactions by Day, pesos with their yen, Unconfirmed ones tagged and Refunds as money back', async () => {
    renderMoney('/money/2026-10/eating_out', { 'GET /api/money/months/2026-10/categories/eating_out': { status: 200, body: eatingOut } })

    const list = await screen.findByRole('list', { name: 'Transactions' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Corner Café')
    expect(rows[0]).toHaveTextContent('3 Oct · Card · Cafés')
    expect(rows[0]).toHaveTextContent('¥8,000')
    expect(rows[1]).toHaveTextContent('MX$600.00')
    expect(rows[1]).toHaveTextContent('¥4,800')
    expect(rows[1]).toHaveTextContent('Unconfirmed')
    expect(rows[2]).toHaveTextContent('Refund')
    expect(rows[2]).toHaveTextContent('+¥800')
    expect(rows[2]).toHaveTextContent('+MX$100.00')
  })

  it('lists no Subcategories when the Category has none', async () => {
    renderMoney('/money/2026-10/rent', {
      'GET /api/money/months/2026-10/categories/rent': {
        status: 200,
        body: { ...eatingOut, category: 'rent', name: 'Rent', subcategories: [], transactions: [eatingOut.transactions[0]] },
      },
    })

    await screen.findByRole('heading', { name: 'Rent' })
    expect(screen.queryByRole('list', { name: 'Subcategories' })).not.toBeInTheDocument()
  })

  it('says when the page isn’t there', async () => {
    renderMoney('/money/2026-11/rent', { 'GET /api/money/months/2026-11/categories/rent': { status: 404, body: 'no such Complete month' } })

    expect(await screen.findByText(/Nothing to show for this month/)).toBeInTheDocument()
  })
})

describe('Subscriptions', () => {
  it('lists the late ones first, each costed a month in yen, with their monthly total, and the stopped ones apart', async () => {
    renderMoney('/money/subscriptions', {
      'GET /api/money/subscriptions': {
        status: 200,
        body: {
          monthlyTotal: 2780,
          subscriptions: [
            { id: 'a', merchantName: 'Music', amount: 980, currency: 'JPY', every: 'monthly', lastCharged: '2026-10-15', active: true, late: false, monthlyYen: 980 },
            { id: 'b', merchantName: 'Storage', amount: 12000, currency: 'JPY', every: 'yearly', lastCharged: '2026-03-01', active: true, late: false, monthlyYen: 1000 },
            { id: 'c', merchantName: 'Video', amount: 100, currency: 'MXN', every: 'monthly', lastCharged: '2026-08-10', active: true, late: true, monthlyYen: 800 },
            { id: 'd', merchantName: 'Old', amount: 500, currency: 'JPY', every: 'monthly', lastCharged: '2026-05-01', active: false, late: false, monthlyYen: null },
          ],
        },
      },
    })

    const active = await screen.findByRole('list', { name: 'Active' })
    const rows = within(active).getAllByRole('listitem')
    expect(rows.map((row) => within(row).getByText(/Music|Storage|Video/).textContent)).toEqual(['Video', 'Music', 'Storage'])
    expect(rows[0]).toHaveTextContent('Late')
    expect(rows[0]).toHaveTextContent('MX$100.00 a month')
    expect(rows[0]).toHaveTextContent('¥800')
    expect(rows[2]).toHaveTextContent('¥12,000 a year')
    expect(rows[2]).toHaveTextContent('¥1,000')
    expect(screen.getByText('A month').parentElement).toHaveTextContent('¥2,780')
    expect(screen.getByText('Stopped (1)')).toBeInTheDocument()
    expect(screen.getByText('Old', { selector: 'span' })).not.toBeVisible()
  })
})

describe('Net worth', () => {
  it('charts it over the months and lists the newest month’s Accounts, Returns and any left out', async () => {
    renderMoney('/money/net-worth', {
      'GET /api/money/net-worth': {
        status: 200,
        body: [
          {
            month: '2026-10',
            total: 486500,
            accounts: [
              { account: 'a1', name: 'Bank', currency: 'JPY', balance: 480000, yen: 480000 },
              { account: 'a2', name: 'Pot', currency: 'MXN', balance: 1600, yen: 14400 },
              { account: 'a3', name: 'Card', currency: 'JPY', balance: -7900, yen: -7900 },
            ],
            returns: [{ account: 'a2', name: 'Pot', yen: 900 }],
            missing: [{ id: 'a4', name: 'Rent card' }],
          },
          { month: '2026-09', total: 476500, accounts: [], returns: [], missing: [] },
        ],
      },
    })

    expect(await screen.findByRole('img', { name: 'Net worth by month from September 2026 to October 2026: ¥476,500 and ¥486,500.' })).toBeInTheDocument()
    const accounts = screen.getByRole('list', { name: 'October 2026' })
    const rows = within(accounts).getAllByRole('listitem')
    expect(rows[1]).toHaveTextContent('Pot')
    expect(rows[1]).toHaveTextContent('MX$1,600.00')
    expect(rows[1]).toHaveTextContent('¥14,400')
    expect(rows[2]).toHaveTextContent('Card')
    expect(rows[2]).toHaveTextContent('¥7,900 owed')
    expect(screen.getByText('Total').parentElement).toHaveTextContent('¥486,500')
    expect(screen.getByText(/Without Rent card/)).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Return' })).getByText('Pot').parentElement).toHaveTextContent('+¥900')
  })
})
