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
