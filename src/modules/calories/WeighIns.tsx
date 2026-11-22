import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import { GroupedList, ListRow, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { logWeighInsNote, weekName, type WeighIn } from './calories'

// Weigh-ins, opened from the Weight Home Card: every Weigh-in, newest first. The web app only reads:
// the Calories Assistant logs them in Telegram (ADR 0012).
export function WeighIns() {
  const api = useApi()
  const { today, settings } = useToday()
  const weighIns = useQuery({
    queryKey: ['calories', 'weigh-ins'],
    queryFn: () => api.get<WeighIn[]>('/api/calories/weigh-ins'),
  })

  return (
    <>
      <ScreenHeader title="Weigh-ins" back={{ to: '/calories', label: 'Today' }} />
      {(settings.isError || weighIns.isError) && (
        <LoadProblem
          message="Couldn't load your Weigh-ins."
          retry={() => {
            if (settings.isError) settings.refetch()
            if (weighIns.isError) weighIns.refetch()
          }}
        />
      )}
      {weighIns.data && today && (
        <>
          <SectionHeader id="weigh-ins-history">History</SectionHeader>
          {weighIns.data.length === 0 ? (
            <EmptyNote>No Weigh-ins yet.</EmptyNote>
          ) : (
            <GroupedList as="ul" labelledBy="weigh-ins-history">
              {weighIns.data.map((weighIn) => (
                <ListRow as="li" key={weighIn.week}>
                  <span>{weekName(weighIn.week, today)}</span>
                  <span className="tabular-nums">{weighIn.kg.toFixed(1)} kg</span>
                </ListRow>
              ))}
            </GroupedList>
          )}
          <EmptyNote>{logWeighInsNote}</EmptyNote>
        </>
      )}
    </>
  )
}
