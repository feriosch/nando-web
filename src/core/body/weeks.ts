import { addDays, dayOf } from '../days'

// A week is named by the Monday it starts on, as YYYY-MM-DD.

// The Monday of the week `now` falls in, in `timeZone`.
export function weekOf(now: Date, timeZone: string): string {
  const today = dayOf(now, timeZone)
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

// `week` in short, such as "9 Nov", with its year only when that isn't `thisYear`: "9 Nov 2025".
export function formatWeekShort(week: string, thisYear: number): string {
  const date = new Date(`${week}T00:00:00Z`)
  const sameYear = date.getUTCFullYear() === thisYear
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date)
}
