import { formatLongDay } from '../days'
import type { HomeCard } from '../module'
import { useToday } from '../today'
import { ScreenHeader } from '../ui/ScreenHeader'

// A Home Card with the theme of whoever contributed it: Core's, or its Module's.
export type ThemedHomeCard = HomeCard & { theme: string }

// Home: today's date in the Owner Time Zone, then every Home Card, each drawing its own card.
export function Home({ cards }: { cards: ThemedHomeCard[] }) {
  const { today } = useToday()
  return (
    <>
      <ScreenHeader title="Home" subtitle={today && formatLongDay(today)} />
      <div className="flex flex-col gap-3 pt-2">
        {cards.map(({ id, theme, Component }) => (
          <article key={id} className={`${theme} text-ink`}>
            <Component />
          </article>
        ))}
      </div>
    </>
  )
}
