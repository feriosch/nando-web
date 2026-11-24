import { dayOf, formatDayShort } from '../../core/days'
import { GroupedList, SectionHeader } from '../../core/ui/List'
import { kcal, type Activity as DayActivity } from './calories'
import { rowClasses } from './rows'

// What a Day's Steps and Burned Calories come from (ADR 0015): the iPhone's Health Sync, synced at a
// time in the Owner Time Zone or not at all, and each Treadmill Walk the Calories Assistant logged.
// The web app only shows them.
export function Activity({ day, activity, timeZone }: { day: string; activity: DayActivity; timeZone: string }) {
  const { healthSync, walks } = activity
  return (
    <>
      <SectionHeader id="calories-activity">Activity</SectionHeader>
      <GroupedList as="ul" labelledBy="calories-activity" footer="Burned Calories are an estimate, and never change the Daily Limit.">
        <li>
          <div className={rowClasses}>
            {healthSync === null ? (
              <Line name="iPhone" detail="Not synced" />
            ) : (
              <Line
                name="iPhone"
                detail={`${healthSync.corrected ? 'Corrected' : 'Synced'} ${syncedWhen(healthSync.syncedAt, day, timeZone)}`}
                steps={healthSync.steps}
                kcalText={`${kcal(healthSync.activeKcal)} kcal`}
              />
            )}
          </div>
        </li>
        {walks.map((walk) => (
          <li key={walk.id}>
            <div className={rowClasses}>
              <Line
                name="Treadmill"
                detail={`${walk.km} km`}
                steps={walk.steps}
                kcalText={`${kcal(walk.kcal)} kcal${walk.kcalEstimated ? ' (est.)' : ''}`}
              />
            </div>
          </li>
        ))}
      </GroupedList>
    </>
  )
}

// A row: where the activity came from over its detail on the left, and its steps over its kcal on
// the right, such as "iPhone, Synced 04:30: 9,812 steps · 312 kcal" to a screen reader. Steps are "—"
// when a walk has none, as when the Owner's height wasn't set; a row with no figures has no right side.
function Line({ name, detail, steps, kcalText }: { name: string; detail: string; steps?: number | null; kcalText?: string }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block leading-snug">{name}</span>
        <span className="block text-[13px] text-sub">
          <span className="sr-only">, </span>
          {detail}
        </span>
      </span>
      {kcalText !== undefined && (
        <span className="shrink-0 text-right tabular-nums">
          <span className="sr-only">: </span>
          <span className="block leading-snug">{steps == null ? '— steps' : `${kcal(steps)} steps`}</span>
          <span className="block text-[13px] text-sub">
            <span className="sr-only"> · </span>
            {kcalText}
          </span>
        </span>
      )}
    </>
  )
}

// When `moment` was in the Owner Time Zone: its clock time, such as "04:30", on `day` itself, and
// with its date, such as "10 Nov, 04:30", on another, as when yesterday was last synced this morning.
function syncedWhen(moment: string, day: string, timeZone: string): string {
  const date = new Date(moment)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(date)
  const syncedOn = dayOf(date, timeZone)
  return syncedOn === day ? time : `${formatDayShort(syncedOn, day)}, ${time}`
}
