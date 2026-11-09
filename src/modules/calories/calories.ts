import { formatDayAs } from '../../core/days'

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

// What GET /api/calories/days/{day} answers.
export type DayView = DaySummary & { entries: Entry[] }

// `n` with thousands separators, such as 2,150.
export function kcal(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

// A logged Day's Consumed Calories against its Daily Limit, such as "1,800 / 2,000 kcal", or just
// "1,800 kcal" without one.
export function consumedAgainstLimit(consumedCalories: number, dailyLimit: number | null): string {
  return dailyLimit === null ? `${kcal(consumedCalories)} kcal` : `${kcal(consumedCalories)} / ${kcal(dailyLimit)} kcal`
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

// How POST /api/calories/days/{day}/entries takes an Entry: from a Meal, or as a one-off.
export type NewEntry =
  | { mealId: string; servings: number }
  | { name: string; kcalPerServing: number; servings: number; saveAsMeal: boolean }

// A whole number from `min` to `max` as typed, or null.
export function parseWhole(typed: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(typed.trim())) return null
  const n = Number(typed.trim())
  return n >= min && n <= max ? n : null
}

// Its name, after its emoji if it has one.
export function mealName(meal: Meal): string {
  return meal.emoji ? `${meal.emoji} ${meal.name}` : meal.name
}
