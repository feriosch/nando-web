import { addDays, dayOf, formatDayAs, formatDayShort, mondayOf } from '../days'

// A week is named by the Monday it starts on, as YYYY-MM-DD.

// The Monday of the week `now` falls in, in `timeZone`.
export function weekOf(now: Date, timeZone: string): string {
  return mondayOf(dayOf(now, timeZone))
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
  return formatDayShort(week, today)
}
