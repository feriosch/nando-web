import { kcal, type DaySummary } from './calories'

// The Day view's summary card, on the walnut board: the Consumed Calories against the Daily Limit, a
// bar of how much of it is used, and what's left (or how far over it the Day is). An Unlogged Day says
// so, never 0 kcal.
export function Board({ view }: { view: DaySummary }) {
  return (
    <section aria-label="Summary" className="mt-3 mb-1 rounded-[20px] bg-board px-5 py-4 text-board-ink shadow-[0_2px_8px_rgb(0_0_0/0.12)]">
      {view.consumedCalories === null ? (
        <>
          <p className="my-0 font-display text-[28px] leading-tight font-bold">Not logged</p>
          <p className="mt-1 mb-0 text-[15px] text-board-sub">Nothing logged for this Day yet.</p>
        </>
      ) : (
        <Logged consumedCalories={view.consumedCalories} dailyLimit={view.dailyLimit} remaining={view.remaining} />
      )}
    </section>
  )
}

function Logged({
  consumedCalories,
  dailyLimit,
  remaining,
}: {
  consumedCalories: number
  dailyLimit: number | null
  remaining: number | null
}) {
  const over = remaining !== null && remaining < 0
  // How much of the Daily Limit is used, the bar full once it is all used.
  const used = dailyLimit === null || dailyLimit === 0 ? 1 : Math.min(consumedCalories / dailyLimit, 1)
  return (
    <>
      <p className="my-0 flex items-baseline gap-1.5">
        <span className="font-display text-[40px] leading-none font-bold tabular-nums">{kcal(consumedCalories)}</span>{' '}
        <span className="text-[17px] text-board-sub">{dailyLimit === null ? 'kcal' : `/ ${kcal(dailyLimit)} kcal`}</span>
      </p>
      {dailyLimit !== null && (
        // Shown by the line under it, so hidden from screen readers. Eases to its new width after
        // each log (instantly under Reduce Motion: src/index.css).
        <div aria-hidden="true" className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-board-track">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-[280ms] ease-out ${over ? 'bg-warn-bar' : 'bg-bar-fill'}`}
            style={{ width: `${used * 100}%` }}
          />
        </div>
      )}
      {remaining !== null && (
        <p className={`mt-2 mb-0 text-[15px] ${over ? 'text-warn-bar' : 'text-board-sub'}`}>
          {over ? `${kcal(-remaining)} kcal over the Daily Limit` : `${kcal(remaining)} kcal left`}
        </p>
      )}
    </>
  )
}
