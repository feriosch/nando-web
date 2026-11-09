import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import type { DaySummary } from './calories'
import { Summary } from './Summary'

// The Calories Home Card: today's Consumed Calories against the Daily Limit.
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
    <>
      <h2>Calories</h2>
      {(settings.isError || card.isError) && (
        <LoadProblem
          message="Couldn't load today's Calories."
          retry={() => {
            if (settings.isError) settings.refetch()
            if (card.isError) card.refetch()
          }}
        />
      )}
      {card.data && <Summary view={card.data} />}
      <p>
        <Link to="/calories">Today</Link>
      </p>
    </>
  )
}
