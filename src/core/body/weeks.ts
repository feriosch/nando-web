import { addDays, dayOf, formatDayAs } from '../days'

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
  return formatDayAs(week, { day: 'numeric', month: 'short', year: 'numeric' })
}

// `week` in short, such as "9 Nov", with its year only when it isn't the year `today` is in:
// "29 Dec 2025". Without `today`, it leaves the year out.
export function formatWeekShort(week: string, today: string | undefined): string {
  const otherYear = today !== undefined && week.slice(0, 4) !== today.slice(0, 4)
  return formatDayAs(week, { day: 'numeric', month: 'short', ...(otherYear && { year: 'numeric' }) })
}
