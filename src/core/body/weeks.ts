// A week is named by the Monday it starts on, as YYYY-MM-DD.

// The Monday of the week `now` falls in, in `timeZone`.
export function weekOf(now: Date, timeZone: string): string {
  // en-CA writes dates as YYYY-MM-DD.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const date = new Date(`${today}T00:00:00Z`)
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  return addDays(today, -daysSinceMonday)
}

// The week before `week`.
export function weekBefore(week: string): string {
  return addDays(week, -7)
}

// `week` for the Owner to read, such as "9 Nov 2026".
export function formatWeek(week: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${week}T00:00:00Z`),
  )
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
