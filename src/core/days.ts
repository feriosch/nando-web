// A Day is one date in the Owner Time Zone, written YYYY-MM-DD.

// The Day `now` falls on in `timeZone`.
export function dayOf(now: Date, timeZone: string): string {
  // Read from the parts rather than a locale's whole date, whose format can change between browsers.
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

// The Day `days` after `day` (before it, if negative).
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Whether `text` is a real date written YYYY-MM-DD, such as 2026-11-09 but not 2026-02-30.
export function isDay(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}

// `day` written out for the Owner, such as "Monday, 9 November".
export function formatLongDay(day: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).formatToParts(new Date(`${day}T00:00:00Z`))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value
  return `${part('weekday')}, ${part('day')} ${part('month')}`
}
