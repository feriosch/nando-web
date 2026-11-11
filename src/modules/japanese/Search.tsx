import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search as SearchGlass } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { lucideProps } from '../../core/ui/icons'
import { EmptyNote } from '../../core/ui/Notice'
import { GroupedList, SectionHeader } from '../../core/ui/List'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import type { SearchResults } from './japanese'
import { KanjiRowLink, WordRowLink } from './rows'

// How long typing has to pause before the search is sent.
const debounceMs = 250

// The Japanese tab: one search field, focused, finding Words and then Kanji as it is typed in.
export function Search() {
  const api = useApi()
  const [typed, setTyped] = useState('')
  const q = useDebounced(typed.trim(), debounceMs)
  const search = useQuery({
    queryKey: ['japanese', 'search', q],
    queryFn: () => api.get<SearchResults>(`/api/japanese/search?q=${encodeURIComponent(q)}`),
    enabled: q !== '',
    placeholderData: keepPreviousData,
  })
  const wordsId = useId()
  const kanjiId = useId()
  // A cleared field shows the hint at once, without waiting for the pause.
  const empty = typed.trim() === ''
  const failed = !empty && q !== '' && search.isError
  const results = empty || q === '' || failed ? undefined : search.data
  // Said only once the answer is for what's in the field, not the one before it.
  const foundNothing = results !== undefined && !search.isPlaceholderData && results.words.length === 0 && results.kanji.length === 0

  return (
    <>
      <ScreenHeader title="Japanese" />
      <label className="relative my-2 block">
        <span className="sr-only">Search</span>
        <SearchGlass {...lucideProps} className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-sub" />
        <input
          type="search"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoFocus
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Kanji, kana or Spanish"
          className="m-0 min-h-11 w-full rounded-[12px] border-0 bg-fill py-0 pr-3 pl-10 text-[17px] text-ink outline-none placeholder:text-sub/70"
        />
      </label>
      {empty && <EmptyNote>Search your Words and Kanji in kanji, kana or Spanish.</EmptyNote>}
      {failed && <LoadProblem message="Couldn't search." retry={() => search.refetch()} />}
      {foundNothing && <EmptyNote>Nothing found for “{q}”.</EmptyNote>}
      {results && results.words.length > 0 && (
        <>
          <SectionHeader id={wordsId}>Words</SectionHeader>
          <GroupedList as="ul" labelledBy={wordsId}>
            {results.words.map((word) => (
              <li key={word.id}>
                <WordRowLink word={word} />
              </li>
            ))}
          </GroupedList>
        </>
      )}
      {results && results.kanji.length > 0 && (
        <>
          <SectionHeader id={kanjiId}>Kanji</SectionHeader>
          <GroupedList as="ul" labelledBy={kanjiId}>
            {results.kanji.map((kanji) => (
              <li key={kanji.id}>
                <KanjiRowLink kanji={kanji} />
              </li>
            ))}
          </GroupedList>
        </>
      )}
    </>
  )
}

// `value`, once it has stayed the same for `ms`.
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}
