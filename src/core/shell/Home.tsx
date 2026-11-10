import nando from '../../assets/nando.png'
import { formatLongDay } from '../days'
import type { HomeCard } from '../module'
import { useToday } from '../today'
import { ScreenHeader } from '../ui/ScreenHeader'

// A Home Card with the theme of whoever contributed it: Core's, or its Module's.
export type ThemedHomeCard = HomeCard & { theme: string }

// Home: today's date in the Owner Time Zone with Nando beside it, then every Home Card, each drawing
// its own card.
export function Home({ cards }: { cards: ThemedHomeCard[] }) {
  const { today } = useToday()
  return (
    <>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <ScreenHeader title="Home" subtitle={today && formatLongDay(today)} />
        </div>
        {/* Its arms and legs are black, so in dark they get a soft edge in the ink colour to stay visible. */}
        <img
          src={nando}
          alt=""
          width={291}
          height={300}
          className="pointer-events-none mb-1 h-[68px] w-auto shrink-0 select-none dark:[filter:drop-shadow(0_0_1.5px_color-mix(in_srgb,var(--ink)_70%,transparent))]"
        />
      </div>
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
