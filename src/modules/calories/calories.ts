import { formatDayAs, mondayOf } from '../../core/days'
import { formatWeekShort, weekBefore } from '../../core/weeks'

// How a Day stands against its Daily Limit, as the Calories API describes every Day. An Unlogged Day
// has `consumedCalories`, `remaining` and `overLimit` null: it is not recorded, never 0 kcal.
export type DaySummary = {
  day: string
  consumedCalories: number | null
  dailyLimit: number | null
  remaining: number | null
  overLimit: boolean | null
}

// One record that the Owner ate something on a Day. `kcal` is `kcalPerServing × servings`.
export type Entry = {
  id: string
  day: string
  mealId: string | null
  name: string
  kcalPerServing: number
  servings: number
  kcal: number
  loggedAt: string
}

// A Day's Steps and Burned Calories (ADR 0015): the iPhone's Health Sync plus the Treadmill Walks the
// Calories Assistant logs. Each is null for a Day with neither, never 0. Burned Calories are an
// estimate, and never change the Daily Limit.
export type ActivityTotals = { steps: number | null; burnedCalories: number | null }

// A Day's steps and active kcal from Apple Health, as the iPhone last synced them, or as the Calories
// Assistant `corrected` them from the Health app's numbers when the iPhone missed the Day's last sync.
export type HealthSync = { steps: number; activeKcal: number; syncedAt: string; corrected: boolean }

// A walk on the treadmill, which the iPhone never counts. `steps` is null when the Owner's height
// wasn't set; `kcalEstimated` when its kcal wasn't read off the treadmill's screen.
export type TreadmillWalk = {
  id: string
  day: string
  km: number
  steps: number | null
  kcal: number
  kcalEstimated: boolean
  loggedAt: string
}

// What a Day's Steps and Burned Calories come from.
export type Activity = { healthSync: HealthSync | null; walks: TreadmillWalk[] }

// What GET /api/calories/days/{day} answers.
export type DayView = DaySummary & ActivityTotals & { entries: Entry[]; activity: Activity }

// What GET /api/calories/home-card answers, and each Day of the history.
export type DayTotals = DaySummary & ActivityTotals

// A Day's Steps and Burned Calories in one line, such as "9,812 steps · 522 kcal burned (est.)", with
// "—" for either the Day has none of, never 0.
export function activityLine({ steps, burnedCalories }: ActivityTotals): string {
  const stepsPart = steps === null ? '— steps' : `${kcal(steps)} steps`
  const burnedPart = burnedCalories === null ? '— kcal burned' : `${kcal(burnedCalories)} kcal burned (est.)`
  return `${stepsPart} · ${burnedPart}`
}

// `n` with thousands separators, such as 2,150.
export function kcal(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

// A logged Day's Consumed Calories against its Daily Limit, such as "1,800 / 2,000 kcal", or just
// "1,800 kcal" without one.
export function consumedAgainstLimit(consumedCalories: number, dailyLimit: number | null): string {
  return dailyLimit === null ? `${kcal(consumedCalories)} kcal` : `${kcal(consumedCalories)} / ${kcal(dailyLimit)} kcal`
}

// How much of the Daily Limit a Day used, from 0 to 1: 1 once it is all used, and 1 when the limit is 0.
export function usedOf(consumedCalories: number, dailyLimit: number): number {
  return dailyLimit === 0 ? 1 : Math.min(consumedCalories / dailyLimit, 1)
}

// `day` for the Owner to read, such as "Mon 9 Nov".
export function formatDay(day: string): string {
  return formatDayAs(day, { weekday: 'short', day: 'numeric', month: 'short' })
}

// A Meal: something the Owner eats repeatedly, saved by name with its kcal per serving.
export type Meal = {
  id: string
  name: string
  kcal: number
  store: string | null
  emoji: string | null
  imageUrl: string | null
  tags: string[]
  pinned: boolean
  archived: boolean
}

// The week starting on `monday` as the Owner thinks of it from `today`, with its year only when it
// isn't this year's: "This week", "Last week" or "Week of 26 Oct".
export function weekName(monday: string, today: string): string {
  const thisWeek = mondayOf(today)
  if (monday === thisWeek) return 'This week'
  if (monday === weekBefore(thisWeek)) return 'Last week'
  return `Week of ${formatWeekShort(monday, today)}`
}

// A Weigh-in: the Owner's weight for the week starting on Monday `week` (YYYY-MM-DD), in kg.
export type WeighIn = { week: string; kg: number }

// What GET /api/calories/weight-card answers for the Weight Home Card. `bmi` is null until the
// Owner's height is set in Core's settings, and `change` when the week before has no Weigh-in.
export type WeightCard = {
  latest: WeighIn | null
  bmi: number | null
  change: number | null
}

// Where the web app sends the Owner to log a Weigh-in: it only reads them.
export const logWeighInsNote = 'Tell the Calories Assistant your weight in Telegram.'
