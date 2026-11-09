import { useQuery } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { addDays, formatDayAs, formatLongDay, isDay } from '../../core/days'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import { GroupedList, SectionHeader } from '../../core/ui/List'
import { HeaderLink, ScreenHeader } from '../../core/ui/ScreenHeader'
import { Sheet } from '../../core/ui/Sheet'
import { useLastShown } from '../../core/ui/useLastShown'
import { Board } from './Board'
import { formatDay, kcal, type DayView, type Entry } from './calories'
import { EntryEditor, OneOffForm } from './EntrySheets'
import { useGuard } from './guard'
import { QuickList } from './QuickList'
import { useQuickMeals } from './quickMeals'
import { rowButtonClasses, rowClasses, Tile } from './rows'

// The Day view: a Day's Entries and how it stands against its Daily Limit.
export function Day() {
  const api = useApi()
  const { today, settings } = useToday()
  // Today unless the address names another Day, as the Day picker (or the history) does.
  const [searchParams, setSearchParams] = useSearchParams()
  const asked = searchParams.get('day')
  const day = asked && isDay(asked) ? asked : today
  const editableFrom = today && addDays(today, -7)
  const editable = day !== undefined && today !== undefined && day >= editableFrom! && day <= today
  const view = useQuery({
    queryKey: ['calories', 'day', day],
    queryFn: () => api.get<DayView>(`/api/calories/days/${day}`),
    enabled: day !== undefined,
  })
  const heading = day ? titleOf(day, today) : { title: 'Calories' }

  return (
    <>
      <ScreenHeader
        title={heading.title}
        subtitle={heading.subtitle}
        leading={<HeaderLink to="history">History</HeaderLink>}
        actions={<HeaderLink to="meals">Meals</HeaderLink>}
      />
      {day && today && (
        <DayPicker day={day} today={today} pick={(picked) => setSearchParams(picked === today ? {} : { day: picked })} />
      )}
      {(settings.isError || view.isError) && (
        <LoadProblem
          message="Couldn't load the Day."
          retry={() => {
            if (settings.isError) settings.refetch()
            if (view.isError) view.refetch()
          }}
        />
      )}
      {view.data &&
        (editable ? (
          <EditableDay key={view.data.day} view={view.data} />
        ) : (
          <ReadOnlyDay
            view={view.data}
            note={today && (view.data.day > today ? 'This Day hasn’t started yet.' : 'This Day can no longer be changed.')}
          />
        ))}
    </>
  )
}

// Today is "Today" over its long date; yesterday its short date over "Yesterday"; any other Day its
// short date over its long date.
function titleOf(day: string, today: string | undefined): { title: string; subtitle?: string } {
  if (day === today) return { title: 'Today', subtitle: formatLongDay(day) }
  if (today && day === addDays(today, -1)) return { title: formatDay(day), subtitle: 'Yesterday' }
  return { title: formatDay(day), subtitle: formatLongDay(day) }
}

// A chip per Day of the Editable Window, oldest on the left, scrolled to the Day on view. Older Days
// are opened from History.
function DayPicker({ day, today, pick }: { day: string; today: string; pick: (day: string) => void }) {
  const row = useRef<HTMLDivElement>(null)
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i - 7))

  useLayoutEffect(() => {
    const container = row.current
    if (!container) return
    const chip = container.querySelector<HTMLElement>('[aria-pressed="true"]')
    container.scrollLeft = chip ? chip.offsetLeft - (container.clientWidth - chip.offsetWidth) / 2 : container.scrollWidth
  }, [day, today])

  return (
    <div
      ref={row}
      role="group"
      aria-label="Day"
      className="relative -mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((chip) => (
        <button
          key={chip}
          type="button"
          aria-pressed={chip === day}
          aria-label={formatLongDay(chip)}
          onClick={() => pick(chip)}
          className="group m-0 flex h-[62px] min-h-0 w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] bg-surface p-0 text-ink shadow-[0_1px_2px_rgb(0_0_0/0.05)] aria-pressed:bg-accent aria-pressed:text-accent-ink"
        >
          <span className="text-[11px] font-medium text-sub group-aria-pressed:text-accent-ink/85">
            {formatDayAs(chip, { weekday: 'short' })}
          </span>
          <span className="font-display text-[20px] leading-none font-bold">{formatDayAs(chip, { day: 'numeric' })}</span>
        </button>
      ))}
    </div>
  )
}

function ReadOnlyDay({ view, note }: { view: DayView; note?: string }) {
  return (
    <>
      <Board view={view} />
      <Entries entries={view.entries} footer={note} />
    </>
  )
}

// A Day in the Editable Window: tapping an Entry opens it to change or delete, and the quick list
// and "Something else" log more. Every log or change is checked against the Daily Limit first.
function EditableDay({ view }: { view: DayView }) {
  const guard = useGuard(view.day)
  const [editing, setEditing] = useState<Entry | null>(null)
  const shownEntry = useLastShown(editing)
  const [loggingOther, setLoggingOther] = useState(false)
  return (
    <>
      <Board view={view} />
      <Entries entries={view.entries} edit={setEditing} />
      <QuickList day={view.day} guard={guard} logOther={() => setLoggingOther(true)} />
      <Sheet isOpen={editing !== null} onOpenChange={(open) => !open && setEditing(null)} title="Edit Entry">
        {shownEntry && <EntryEditor key={shownEntry.id} entry={shownEntry} guard={guard} done={() => setEditing(null)} />}
      </Sheet>
      <Sheet isOpen={loggingOther} onOpenChange={setLoggingOther} title="Something else">
        <OneOffForm day={view.day} guard={guard} done={() => setLoggingOther(false)} />
      </Sheet>
      {guard.sheets}
    </>
  )
}

// The Day's Entries, each opening the Entry editor when `edit` is given. `footer` says something
// about them all, and shows on its own when there are none.
function Entries({ entries, edit, footer }: { entries: Entry[]; edit?: (entry: Entry) => void; footer?: ReactNode }) {
  const meals = useQuickMeals()
  // An Entry logged from a Meal shows the Meal's emoji.
  const emojiOf = (entry: Entry) => meals.data?.find((meal) => meal.id === entry.mealId)?.emoji ?? undefined

  if (entries.length === 0) return footer ? <p className="mx-4 my-4 text-[13px] text-sub">{footer}</p> : null
  return (
    <>
      <SectionHeader id="calories-entries">Entries</SectionHeader>
      <GroupedList as="ul" labelledBy="calories-entries" footer={footer}>
        {entries.map((entry) => (
          <li key={entry.id}>
            {edit ? (
              <button type="button" aria-haspopup="dialog" onClick={() => edit(entry)} className={rowButtonClasses}>
                <EntryLine entry={entry} emoji={emojiOf(entry)} />
              </button>
            ) : (
              <div className={rowClasses}>
                <EntryLine entry={entry} emoji={emojiOf(entry)} />
              </div>
            )}
          </li>
        ))}
      </GroupedList>
    </>
  )
}

// Such as "Sushi × 12, 45 kcal each: 540 kcal", the separators for screen readers only.
function EntryLine({ entry, emoji }: { entry: Entry; emoji?: string }) {
  return (
    <>
      <Tile>{emoji}</Tile>
      <span className="min-w-0 flex-1">
        <span className="block leading-snug">
          <span lang="ja">{entry.name}</span>
          {entry.servings > 1 && <span className="text-sub"> × {entry.servings}</span>}
        </span>
        {entry.servings > 1 && (
          <span className="block text-[13px] text-sub">
            <span className="sr-only">, </span>
            {kcal(entry.kcalPerServing)} kcal each
          </span>
        )}
      </span>
      <span className="shrink-0 tabular-nums">
        <span className="sr-only">: </span>
        {kcal(entry.kcal)} kcal
      </span>
    </>
  )
}
