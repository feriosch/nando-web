import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
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

// The longest search the API takes.
const maxQueryLength = 100

// What was last typed in the field, kept in the query cache (never fetched) so that coming back from
// a Word or Kanji page, or another tab, finds the same search.
const lastSearchKey = ['japanese', 'last-search']

// The Japanese tab: one search field, focused, finding Words and then Kanji as it is typed in.
export function Search() {
  const api = useApi()
  const queryClient = useQueryClient()
  const [typed, setTypedState] = useState(() => lastSearch(queryClient))
  const setTyped = (value: string) => {
    setTypedState(value)
    queryClient.setQueryData(lastSearchKey, value)
  }
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
      {/* A form so the keyboard's Search key puts the keyboard away, uncovering the results. */}
      <form
        role="search"
        className="my-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        }}
      >
        <label className="relative block">
          <span className="sr-only">Search</span>
          <SearchGlass {...lucideProps} className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-sub" />
          <input
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoFocus
            lang="ja"
            maxLength={maxQueryLength}
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Kanji, kana or Spanish"
            className="m-0 min-h-11 w-full rounded-[12px] border-0 bg-fill py-0 pr-3 pl-10 text-[17px] text-ink outline-none placeholder:text-sub/70"
          />
        </label>
      </form>
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

function lastSearch(queryClient: QueryClient): string {
  // Kept for as long as the app is open, not dropped after the cache's usual 5 minutes.
  queryClient.setQueryDefaults(lastSearchKey, { gcTime: Infinity, staleTime: Infinity })
  return queryClient.getQueryData<string>(lastSearchKey) ?? ''
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
