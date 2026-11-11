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

// The Monday of the week `day` falls in: `day` itself on a Monday. A week is named by its Monday.
export function mondayOf(day: string): string {
  const daysSinceMonday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(day, -daysSinceMonday)
}

// Whether `text` is a real date written YYYY-MM-DD, such as 2026-11-09 but not 2026-02-30.
export function isDay(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}

// `day` for the Owner to read, in British English with the parts `options` asks for, such as
// { day: 'numeric', month: 'short' } for "9 Nov".
export function formatDayAs(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(new Date(`${day}T00:00:00Z`))
}

// `day` written out for the Owner, such as "Monday, 9 November".
export function formatLongDay(day: string): string {
  return `${formatDayAs(day, { weekday: 'long' })}, ${formatDayAs(day, { day: 'numeric', month: 'long' })}`
}

// `day` in short, such as "9 Nov", with its year only when it isn't the year `today` is in:
// "29 Dec 2025". Without `today`, it leaves the year out.
export function formatDayShort(day: string, today: string | undefined): string {
  const otherYear = today !== undefined && day.slice(0, 4) !== today.slice(0, 4)
  return formatDayAs(day, { day: 'numeric', month: 'short', ...(otherYear && { year: 'numeric' }) })
}
