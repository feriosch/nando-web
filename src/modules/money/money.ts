import { formatDayAs, isDay } from '../../core/days'

// The types below mirror nando-server's internal/money/API.md.

// The Money Home Card, from GET /api/money/card: the latest Complete month, or null before any.
export type MoneyCard = {
  month: string
  spending: { total: number; average3: number | null; essential: number; optional: number; unmarked: number }
  // missing names the Accounts with no balance near the month's end, left out of total.
  netWorth: { total: number; previous: number | null; missing?: { id: string; name: string }[] }
  unconfirmed: number
}

// Money's settings, from GET /api/money/settings: each reminder's Accounts by name.
export type MoneySettings = {
  askAbove: { JPY: number; MXN: number }
  reminderTime: string
  reminders: { name: string; day: number; accounts: string[] }[]
}

// Yen for the Owner to read, such as "¥105,000".
export function yen(amount: number): string {
  return `${amount < 0 ? '−' : ''}¥${Math.abs(amount).toLocaleString('en-US')}`
}

// Pesos for the Owner to read, such as "MX$300".
export function pesos(amount: number): string {
  return `MX$${amount.toLocaleString('en-US')}`
}

// A change in yen, signed, such as "+¥10,000" or "−¥3,000".
export function yenChange(amount: number): string {
  if (amount === 0) return '±¥0'
  return `${amount < 0 ? '−' : '+'}¥${Math.abs(amount).toLocaleString('en-US')}`
}

// A month for the Owner to read, such as "October 2026".
export function monthName(month: string): string {
  return formatDayAs(`${month}-01`, { month: 'long', year: 'numeric' })
}

// How a month's spending compares with the average of the months before, such as "¥7,000 above
// your 3-month average"; null when there is nothing to compare with yet.
export function againstAverage(total: number, average3: number | null): string | null {
  if (average3 === null) return null
  const difference = total - average3
  if (difference === 0) return 'Same as your 3-month average'
  return `${yen(Math.abs(difference))} ${difference > 0 ? 'above' : 'below'} your 3-month average`
}

// A day of the month for the Owner to read: "1st", "2nd", "28th".
export function ordinal(day: number): string {
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return `${day}${suffix}`
}

// Names as a list in a sentence: "A", "A and B", "A, B and C".
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// One Complete month as GET /api/money/months lists it, newest first.
export type MonthSummary = {
  month: string
  spending: { total: number; essential: number; optional: number; unmarked: number }
  income: number
  savingRate: number | null
  netWorth: { total: number; missing: { id: string; name: string }[] }
}

// A Category's total in yen, against the month before and the average of up to 3 before. The
// Expenses in no Category come under the key "".
export type CategoryTotal = {
  category: string
  name: string
  total: number
  previous?: number | null
  average3?: number | null
}

// A Complete month's totals, from GET /api/money/months/{month}.
export type MonthTotals = {
  month: string
  spending: {
    total: number
    previous: number | null
    average3: number | null
    essential: number
    optional: number
    unmarked: number
    byCategory: CategoryTotal[]
  }
  income: { total: number }
  savingRate: number | null
  unconfirmed: { count: number; yen: number }
}

// An Expense as a Category's page lists it: in its own currency and in yen, a Refund below 0.
export type ScreenTransaction = {
  id: string
  day: string
  merchant: string
  amount: number
  currency: 'JPY' | 'MXN'
  yen: number
  account: string
  subcategory: string
  essential: boolean | null
  unconfirmed: boolean
  note: string
}

// An expense Category's page for a month, from GET /api/money/months/{month}/categories/{key}.
export type CategoryPage = {
  month: string
  category: string
  name: string
  total: number
  previous: number | null
  average3: number | null
  subcategories: { subcategory: string; name: string; total: number }[]
  transactions: ScreenTransaction[]
  history: { month: string; total: number }[]
}

// A Subscription, with what it costs a month in yen while active.
export type Subscription = {
  id: string
  merchantName: string
  amount: number
  currency: 'JPY' | 'MXN'
  every: 'monthly' | 'yearly'
  lastCharged: string
  active: boolean
  late: boolean
  monthlyYen: number | null
}

// GET /api/money/subscriptions.
export type SubscriptionsPage = { monthlyTotal: number; subscriptions: Subscription[] }

// One Complete month's net worth, from GET /api/money/net-worth, newest first. A card's balance is
// what it owes, below 0.
export type NetWorthMonth = {
  month: string
  total: number
  accounts: { account: string; name: string; currency: 'JPY' | 'MXN'; balance: number; yen: number }[]
  returns: { account: string; name: string; yen: number }[]
  missing: { id: string; name: string }[]
}

// A Category's page: the Expenses in no Category have theirs at "uncategorized".
export function categoryPath(month: string, key: string): string {
  return `/money/${month}/${key === '' ? 'uncategorized' : key}`
}

// An amount in its own currency, such as "¥980" or "MX$94.46".
export function inCurrency(amount: number, currency: 'JPY' | 'MXN'): string {
  if (currency === 'JPY') return yen(amount)
  const digits = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${amount < 0 ? '−' : ''}MX$${digits}`
}

// A month's short name for a chart, such as "Oct".
export function shortMonth(month: string): string {
  return formatDayAs(`${month}-01`, { month: 'short' })
}

// A saving rate for the Owner to read, such as "12%".
export function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

// Whether `text` is a month as the server names one, `YYYY-MM`, with a real month in it.
export function isMonth(text: string): boolean {
  return /^\d{4}-\d{2}$/.test(text) && isDay(`${text}-01`)
}

// The month `n` months before `month` (`YYYY-MM`), such as "2025-11" for 11 before "2026-10".
export function monthsBefore(month: string, n: number): string {
  const [year, number] = month.split('-').map(Number)
  const index = year * 12 + (number - 1) - n
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

// "ja" when `text` has Japanese in it (kana, kanji, Japanese punctuation or full-width and
// half-width forms), so iOS picks Japanese glyphs for it: a Merchant's name, say.
export function langOf(text: string): 'ja' | undefined {
  return /[　-ヿ㐀-鿿豈-﫿＀-￯]/.test(text) ? 'ja' : undefined
}
