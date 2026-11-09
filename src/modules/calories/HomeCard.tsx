import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import type { DaySummary } from './calories'
import { Summary } from './Day'

// The Calories Home Card: today's Consumed Calories against the Daily Limit.
export function CaloriesCard() {
  const api = useApi()
  const today = useQuery({ queryKey: ['calories', 'home-card'], queryFn: () => api.get<DaySummary>('/api/calories/home-card') })

  return (
    <>
      <h2>Calories</h2>
      {today.isError && <LoadProblem message="Couldn't load today's Calories." retry={() => today.refetch()} />}
      {today.data && <Summary view={today.data} />}
      <p>
        <Link to="/calories">Today</Link>
      </p>
    </>
  )
}
