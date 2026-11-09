import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import { CardHeader, CardLink, cardClasses } from '../../core/ui/HomeCard'
import { boardClasses, Figures } from './Board'
import type { DaySummary } from './calories'
import { BowlIcon } from './icon'

// The Calories Home Card, on the walnut board: today's Consumed Calories against the Daily Limit.
// The whole card opens today in the Day view.
export function CaloriesCard() {
  const api = useApi()
  // Keyed by today so a Home screen left open moves on to the new Day at midnight.
  const { today, settings } = useToday()
  const card = useQuery({
    queryKey: ['calories', 'home-card', today],
    queryFn: () => api.get<DaySummary>('/api/calories/home-card'),
    enabled: today !== undefined,
  })

  return (
    <div className={`${cardClasses} ${boardClasses}`}>
      <CardHeader icon={<BowlIcon />}>Calories</CardHeader>
      {(settings.isError || card.isError) && (
        // Above the card's link.
        <div className="relative z-10">
          <LoadProblem
            message="Couldn't load today's Calories."
            retry={() => {
              if (settings.isError) settings.refetch()
              if (card.isError) card.refetch()
            }}
          />
        </div>
      )}
      {card.data && (
        <div className="mt-3">
          <Figures view={card.data} unlogged="Nothing logged today yet." />
        </div>
      )}
      <CardLink to="/calories">
        <span className="sr-only">Today</span>
      </CardLink>
    </div>
  )
}
