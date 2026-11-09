import type { HomeCard } from '../module'
import { ScreenHeader } from '../ui/ScreenHeader'

// A Home Card with the theme of whoever contributed it: Core's, or its Module's.
export type ThemedHomeCard = HomeCard & { theme: string }

export function Home({ cards }: { cards: ThemedHomeCard[] }) {
  return (
    <>
      <ScreenHeader title="Home" />
      <div className="flex flex-col gap-3 pt-2">
        {cards.map(({ id, theme, Component }) => (
          <article key={id} className={`${theme} rounded-[14px] bg-surface px-4 py-1 text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)]`}>
            <Component />
          </article>
        ))}
      </div>
    </>
  )
}
