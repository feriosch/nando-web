import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { useToday } from '../../core/today'
import { lucideProps } from '../../core/ui/icons'
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
    <div
      className={`relative rounded-[22px] p-[18px] transition-opacity has-[[data-card-link]:active]:opacity-70 ${boardClasses}`}
    >
      <div className="flex items-center gap-2 text-board-sub">
        <BowlIcon />
        <h2 className="my-0 text-[15px] font-semibold text-board-sub">Calories</h2>
        <ChevronRight {...lucideProps} className="ml-auto" />
      </div>
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
      {/* Stretched over the whole card, so a tap anywhere on it opens the Day view. */}
      <Link
        to="/calories"
        viewTransition
        data-card-link
        className="outline-none after:absolute after:inset-0 after:rounded-[22px] focus-visible:after:outline-2 focus-visible:after:outline-accent"
      >
        <span className="sr-only">Today</span>
      </Link>
    </div>
  )
}
