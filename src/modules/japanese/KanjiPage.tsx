import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { ListRow } from '../../core/ui/List'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import type { Component, Kanji } from './japanese'
import { KanjiRowLink, KanjiTile, WordRowLink } from './rows'
import { Section, TextBlock } from './Section'

// A Kanji page, at /japanese/kanji/:id: the character, large, its meaning, readings, Heisig numbers
// and story, its Components (a stored Kanji opens its page) and the Words spelled with it.
export function KanjiPage() {
  const { id } = useParams()
  const api = useApi()
  const kanji = useQuery({
    queryKey: ['japanese', 'kanji', id],
    queryFn: () => api.get<Kanji>(`/api/japanese/kanji/${id}`),
  })
  const back = { to: '/japanese', label: 'Search' }

  if (!kanji.data) {
    return (
      <>
        <ScreenHeader back={back} />
        {kanji.isError && <LoadProblem message="Couldn't load this Kanji." retry={() => kanji.refetch()} />}
      </>
    )
  }
  const k = kanji.data
  return (
    <>
      <ScreenHeader
        back={back}
        title={
          <span lang="ja" className="mt-2 block text-[96px] leading-none font-normal">
            {k.kanji}
          </span>
        }
        subtitle={<span lang="es" className="text-[20px] text-ink">{k.spanish}</span>}
      />
      {(k.on || k.kun) && (
        <Section title="Readings" list>
          {k.on && <Detail label="On" lang="ja">{k.on}</Detail>}
          {k.kun && <Detail label="Kun" lang="ja">{k.kun}</Detail>}
        </Section>
      )}
      <Section title="Heisig" list>
        <Detail label="Volume 1">{number(k.v1)}</Detail>
        {k.v2 !== null && <Detail label="Volume 2">{number(k.v2)}</Detail>}
      </Section>
      {k.story && (
        <Section title="Story">
          <TextBlock>{k.story}</TextBlock>
        </Section>
      )}
      {k.components.length > 0 && (
        <Section title="Components" list>
          {k.components.map((component, i) => (
            <li key={i}>
              <ComponentRow component={component} />
            </li>
          ))}
        </Section>
      )}
      {k.words.length > 0 && (
        <Section title="Words" list>
          {k.words.map((word) => (
            <li key={word.id}>
              <WordRowLink word={word} />
            </li>
          ))}
        </Section>
      )}
    </>
  )
}

// A row of the page's details: its label, and its value on the right.
function Detail({ label, lang, children }: { label: string; lang?: string; children: ReactNode }) {
  return (
    <ListRow as="li">
      <span>{label}</span>
      <span lang={lang} className="text-right text-sub tabular-nums">
        {children}
      </span>
    </ListRow>
  )
}

// A Component: a stored Kanji, opening its page, or an irregular shape, shown by its keyword alone.
function ComponentRow({ component }: { component: Component }) {
  if (component.kanji) return <KanjiRowLink kanji={{ ...component.kanji, spanish: component.name }} />
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
      <KanjiTile irregular />
      <span lang="es" className="min-w-0 flex-1 text-[17px] text-sub">
        {component.name}
      </span>
    </div>
  )
}

function number(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}
