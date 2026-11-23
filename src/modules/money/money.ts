import { formatDayAs } from '../../core/days'

// The types below mirror nando-server's internal/money/API.md.

// The Money Home Card, from GET /api/money/card: the latest Complete month, or null before any.
export type MoneyCard = {
  month: string
  spending: { total: number; average3: number | null; essential: number; optional: number; unmarked: number }
  netWorth: { total: number; previous: number | null }
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
