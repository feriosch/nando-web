import { GroupedList } from '../../core/ui/List'
import { joinNames, monthName, shortMonth, yen, type MonthSummary } from './money'

// The charts on the Money screen, drawn as inline SVG in the theme's colours. Each says what it shows
// in its aria-label, and its bars and points are hidden from screen readers.

const width = 340

// The label of a run of months, such as "from August 2026 to October 2026", or one month's name.
function span(months: string[]): string {
  if (months.length === 1) return `in ${monthName(months[0])}`
  return `from ${monthName(months[0])} to ${monthName(months[months.length - 1])}`
}

// Spending in each month, oldest first, as bars stacked Essential, Optional and not marked, with
// income as a line over them; `current` is the month the screen shows.
export function SpendingChart({ months, current }: { months: MonthSummary[]; current: string }) {
  const height = 150
  const top = 10
  const bottom = 22
  const high = Math.max(1, ...months.map((m) => Math.max(m.spending.total, m.income)))
  const slot = (width - 16) / months.length
  const barWidth = Math.min(22, slot * 0.6)
  const x = (i: number) => 8 + slot * i + slot / 2
  const y = (amount: number) => top + ((high - Math.max(0, amount)) * (height - top - bottom)) / high
  const base = y(0)
  const incomes = months.map((m, i) => `${x(i)},${y(m.income)}`).join(' ')
  const label =
    `Spending by month ${span(months.map((m) => m.month))}: ${joinNames(months.map((m) => yen(m.spending.total)))}. ` +
    `Income: ${joinNames(months.map((m) => yen(m.income)))}.`
  return (
    <GroupedList>
      <div className="px-4 py-3">
        <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
          {months.map((m, i) => {
            const parts = [
              { amount: m.spending.essential, className: 'fill-accent' },
              { amount: m.spending.optional, className: 'fill-optional' },
              { amount: m.spending.unmarked, className: 'fill-sub opacity-40' },
            ]
            let at = base
            return (
              <g key={m.month} aria-hidden>
                {parts.map((part, j) => {
                  if (part.amount <= 0) return null
                  const h = base - y(part.amount)
                  at -= h
                  return <rect key={j} x={x(i) - barWidth / 2} y={at} width={barWidth} height={h} className={part.className} />
                })}
                <text
                  x={x(i)}
                  y={height - 6}
                  textAnchor="middle"
                  className={`text-[11px] ${m.month === current ? 'fill-ink font-semibold' : 'fill-sub'}`}
                >
                  {shortMonth(m.month)}
                </text>
              </g>
            )
          })}
          <polyline aria-hidden points={incomes} fill="none" className="stroke-ink" strokeWidth={1.5} strokeDasharray="3 3" />
          {months.map((m, i) => (
            <circle aria-hidden key={m.month} cx={x(i)} cy={y(m.income)} r={2.5} className="fill-ink" />
          ))}
        </svg>
        <p aria-hidden className="m-0 mt-1 flex flex-wrap gap-x-3 text-[12px] text-sub">
          <Key className="bg-accent">Essential</Key>
          <Key className="bg-optional">Optional</Key>
          <Key className="bg-sub opacity-40">Not marked</Key>
          <span className="inline-flex items-center gap-1">
            <svg viewBox="0 0 12 8" className="h-2 w-3">
              <line x1={0} x2={12} y1={4} y2={4} className="stroke-ink" strokeWidth={1.5} strokeDasharray="3 2" />
            </svg>
            Income
          </span>
        </p>
      </div>
    </GroupedList>
  )
}

function Key({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2 w-3 rounded-[2px] ${className}`} />
      {children}
    </span>
  )
}

// One amount a month, oldest first, as bars, the `current` month's in the accent and the rest
// lighter: a Category's spending.
export function MonthBars({ months, current, what }: { months: { month: string; total: number }[]; current: string; what: string }) {
  const height = 110
  const top = 8
  const bottom = 22
  const high = Math.max(1, ...months.map((m) => m.total))
  const slot = (width - 16) / Math.max(1, months.length)
  const barWidth = Math.min(22, slot * 0.6)
  const x = (i: number) => 8 + slot * i + slot / 2
  const y = (amount: number) => top + ((high - Math.max(0, amount)) * (height - top - bottom)) / high
  const label = `${what} by month ${span(months.map((m) => m.month))}: ${joinNames(months.map((m) => yen(m.total)))}.`
  return (
    <GroupedList>
      <div className="px-4 py-3">
        <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
          {months.map((m, i) => (
            <g key={m.month} aria-hidden>
              <rect
                x={x(i) - barWidth / 2}
                y={y(m.total)}
                width={barWidth}
                height={y(0) - y(m.total)}
                rx={2}
                className={m.month === current ? 'fill-accent' : 'fill-accent opacity-35'}
              />
              <text
                x={x(i)}
                y={height - 6}
                textAnchor="middle"
                className={`text-[11px] ${m.month === current ? 'fill-ink font-semibold' : 'fill-sub'}`}
              >
                {shortMonth(m.month)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </GroupedList>
  )
}

// Net worth in each month, oldest first, as a line, with the lowest and highest under it.
export function NetWorthChart({ months }: { months: { month: string; total: number }[] }) {
  const height = 120
  const totals = months.map((m) => m.total)
  const low = Math.min(...totals)
  const high = Math.max(...totals)
  const range = high - low || 1
  const x = (i: number) => (months.length === 1 ? width / 2 : 8 + (i * (width - 16)) / (months.length - 1))
  const y = (total: number) => 12 + ((high - total) * (height - 24)) / range
  const points = months.map((m, i) => `${x(i)},${y(m.total)}`).join(' ')
  const first = months[0]
  const last = months[months.length - 1]
  const label = `Net worth by month ${span(months.map((m) => m.month))}: ${joinNames(totals.map(yen))}.`
  return (
    <GroupedList>
      <div className="px-4 py-3">
        <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
          <polyline aria-hidden points={points} fill="none" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {months.map((m, i) => (
            <circle aria-hidden key={m.month} cx={x(i)} cy={y(m.total)} r={3} className="fill-accent" />
          ))}
        </svg>
        <p aria-hidden className="m-0 mt-1 flex justify-between text-[13px] text-sub tabular-nums">
          <span>
            {shortMonth(first.month)} {yen(first.total)}
          </span>
          <span>
            {shortMonth(last.month)} {yen(last.total)}
          </span>
        </p>
      </div>
    </GroupedList>
  )
}
