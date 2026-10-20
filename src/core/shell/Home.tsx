import type { HomeCard } from '../module'

export function Home({ cards }: { cards: HomeCard[] }) {
  return (
    <>
      {cards.map(({ id, Component }) => (
        <article key={id}>
          <Component />
        </article>
      ))}
    </>
  )
}
