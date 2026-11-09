import { consumedAgainstLimit, kcal, type DaySummary } from './calories'

// How a Day stands against its Daily Limit. An Unlogged Day says so, never 0 kcal.
export function Summary({ view }: { view: DaySummary }) {
  if (view.consumedCalories === null) return <p>Nothing logged.</p>
  return (
    <>
      <p>{consumedAgainstLimit(view.consumedCalories, view.dailyLimit)}</p>
      {view.remaining !== null && (
        <p>{view.remaining < 0 ? `${kcal(-view.remaining)} kcal over` : `${kcal(view.remaining)} kcal left`}</p>
      )}
    </>
  )
}
