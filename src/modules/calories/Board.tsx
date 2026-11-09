import type { ReactNode } from 'react'
import { kcal, usedOf, type DaySummary } from './calories'

// The walnut board's look: the board colour, its ink, rounded and lifted off the screen. Inside it the
// theme's sub, ink and fill read the board's own, so the blocks a board holds (such as `LoadProblem`)
// stay legible on it.
export const boardClasses =
  'bg-board text-board-ink shadow-[0_2px_8px_rgb(0_0_0/0.12)] [--fill:var(--board-track)] [--ink:var(--board-ink)] [--sub:var(--board-sub)]'

// The Day view's summary card, on the walnut board.
export function Board({ view }: { view: DaySummary }) {
  return (
    <section aria-label="Summary" className={`mt-3 mb-1 rounded-[20px] px-5 py-4 ${boardClasses}`}>
      <Figures view={view} unlogged="Nothing logged for this Day yet." />
    </section>
  )
}

// What a board shows of a Day: the Consumed Calories against the Daily Limit, a bar of how much of it
// is used, and what's left (or how far over it the Day is). An Unlogged Day says "Not logged" over
// `unlogged`, never 0 kcal.
export function Figures({ view, unlogged }: { view: DaySummary; unlogged: ReactNode }) {
  if (view.consumedCalories === null) {
    return (
      <>
        <p className="my-0 font-display text-[28px] leading-tight font-bold">Not logged</p>
        <p className="mt-1 mb-0 text-[15px] text-board-sub">{unlogged}</p>
      </>
    )
  }
  return <Logged consumedCalories={view.consumedCalories} dailyLimit={view.dailyLimit} remaining={view.remaining} />
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
  return (
    <>
      <p className="my-0 flex items-baseline gap-1.5">
        <span className="font-display text-[40px] leading-none font-bold tabular-nums">{kcal(consumedCalories)}</span>{' '}
        <span className="text-[17px] text-board-sub">{dailyLimit === null ? 'kcal' : `/ ${kcal(dailyLimit)} kcal`}</span>
      </p>
      {dailyLimit !== null && (
        <Bar
          used={usedOf(consumedCalories, dailyLimit)}
          over={over}
          className="mt-3.5 h-2.5 bg-board-track"
          fill="bg-bar-fill"
        />
      )}
      {remaining !== null && (
        <p className={`mt-2 mb-0 text-[15px] ${over ? 'text-warn-bar' : 'text-board-sub'}`}>
          {over ? `${kcal(-remaining)} kcal over the Daily Limit` : `${kcal(remaining)} kcal left`}
        </p>
      )}
    </>
  )
}

// A bar `used` full (0 to 1), its track in `className` and its fill in `fill`, or in warn-bar when
// `over` the Daily Limit. Shown by the text beside it, so hidden from screen readers. Eases to its new
// width after each log (instantly under Reduce Motion: src/index.css).
export function Bar({ used, over, className, fill }: { used: number; over: boolean; className: string; fill: string }) {
  return (
    <div aria-hidden="true" className={`overflow-hidden rounded-full ${className}`}>
      <div
        className={`h-full rounded-full transition-[width,background-color] duration-[280ms] ease-out ${over ? 'bg-warn-bar' : fill}`}
        style={{ width: `${used * 100}%` }}
      />
    </div>
  )
}
