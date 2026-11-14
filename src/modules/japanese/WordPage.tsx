import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { lucideProps } from '../../core/ui/icons'
import { GroupedList, ListRow } from '../../core/ui/List'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { ImproveWithClaude } from './withClaude'
import { Chip, Chips } from './chips'
import { typeOf, words, type Hint, type Word, type WordLink, type WordLinkKind } from './japanese'
import { KanjiRowLink, rowLinkClasses, WordLines } from './rows'
import { Section, TextBlock } from './Section'

// Word Links are shown by kind, in this order.
const kinds: { kind: WordLinkKind; title: string }[] = [
  { kind: 'synonym', title: 'Synonyms' },
  { kind: 'antonym', title: 'Antonyms' },
  { kind: 'related', title: 'Related' },
]

// A Word page, at /japanese/words/:id: everything about the Word, its Word Links by kind (each
// opening the other Word), its Hints and the Kanji in its spelling (each opening its Kanji page).
export function WordPage() {
  const { id } = useParams()
  const api = useApi()
  const word = useQuery({
    queryKey: ['japanese', 'words', id],
    queryFn: () => api.get<Word>(`/api/japanese/words/${id}`),
  })
  const back = { to: '/japanese', label: 'Search' }

  if (!word.data) {
    return (
      <>
        <ScreenHeader back={back} />
        {word.isError && <LoadProblem message="Couldn't load this Word." retry={() => word.refetch()} />}
      </>
    )
  }
  const w = word.data
  const type = typeOf(w.type)
  return (
    <>
      <ScreenHeader
        back={back}
        overline={w.hiragana && <span lang="ja">{w.hiragana}</span>}
        title={<span lang="ja">{w.word}</span>}
        subtitle={<span lang="es">{w.spanish}</span>}
      />
      {w.tags.length > 0 && (
        <Chips label="Word Tags">
          {w.tags.map((tag) => (
            <li key={tag}>
              <Chip>{words(tag)}</Chip>
            </li>
          ))}
        </Chips>
      )}
      <GroupedList>
        {type !== '' && (
          <ListRow>
            <span>Type</span>
            <span className="text-right text-sub">{type}</span>
          </ListRow>
        )}
        <ListRow>
          <span>Group</span>
          <span className="flex items-center gap-2 text-sub">
            {w.group.imageUrl && <img src={w.group.imageUrl} alt="" className="size-7 rounded-[8px] bg-fill object-cover" />}
            {w.group.name}
          </span>
        </ListRow>
      </GroupedList>
      {w.notes && (
        <Section title="Notes">
          <TextBlock>{w.notes}</TextBlock>
        </Section>
      )}
      {w.sentences.length > 0 && (
        <Section title="Example sentences" list>
          {w.sentences.map((s, i) => (
            <li key={i} className="px-4 py-3">
              <p lang="ja" className="my-0 text-[17px]">
                {s.sentence}
              </p>
              <p lang="es" className="mt-0.5 mb-0 text-[15px] text-sub">
                {s.translation}
              </p>
            </li>
          ))}
        </Section>
      )}
      {kinds.map(({ kind, title }) => {
        const links = w.wordLinks.filter((link) => link.kind === kind)
        return (
          links.length > 0 && (
            <Section key={kind} title={title} list>
              {links.map((link) => (
                <li key={link.word.id}>
                  <WordLinkRow link={link} />
                </li>
              ))}
            </Section>
          )
        )
      })}
      {w.hints.length > 0 && (
        <Section title="Hints" list>
          {w.hints.map((hint) => (
            <li key={hint.text}>
              <HintRow hint={hint} />
            </li>
          ))}
        </Section>
      )}
      {w.kanji.length > 0 && (
        <Section title="Kanji" list>
          {w.kanji.map((kanji) => (
            <li key={kanji.id}>
              <KanjiRowLink kanji={kanji} />
            </li>
          ))}
        </Section>
      )}
      {/* Keyed by Word: going to another Word's cached page must not keep what was asked about this one. */}
      <ImproveWithClaude key={w.id} word={w} />
    </>
  )
}

// One side of a Word Link, opening the other Word: its spelling and reading, its meaning, then this
// side's note and Nuance Tags about it.
function WordLinkRow({ link }: { link: WordLink }) {
  const { word, note, nuanceTags } = link
  return (
    <Link to={`/japanese/words/${word.id}`} viewTransition className={rowLinkClasses}>
      <span className="min-w-0 flex-1">
        <WordLines word={word} />
        {note && (
          <span lang="es" className="mt-1 block text-[15px]">
            {note}
          </span>
        )}
        {nuanceTags.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {nuanceTags.map((tag) => (
              <Chip key={tag}>{words(tag)}</Chip>
            ))}
          </span>
        )}
      </span>
      <ChevronRight {...lucideProps} className="-mr-1.5 size-5 shrink-0 text-sub" />
    </Link>
  )
}

// A Hint: plain text, as it can't be opened.
function HintRow({ hint }: { hint: Hint }) {
  return (
    <div className="flex min-h-[52px] flex-col justify-center px-4 py-2.5">
      <span lang="ja" className="text-[19px] leading-snug">
        {hint.text}
      </span>
      {hint.note && (
        <span lang="es" className="text-[15px] text-sub">
          {hint.note}
        </span>
      )}
    </div>
  )
}
