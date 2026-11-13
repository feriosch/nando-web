import { useQuery } from '@tanstack/react-query'
import { Navigate, useLocation, useParams } from 'react-router'
import { ApiError } from '../../core/api/client'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import type { KanjiPageFrom } from './Draw'
import type { KanjiLookup as Lookup } from './japanese'
import { Detail, Section } from './Section'

// A Kanji Lookup, at /japanese/lookup/:kanji: what Nando finds out about a kanji the Owner hasn't
// stored (a dimmed Candidate on Draw), laid out like a Kanji page, with English meanings.
export function KanjiLookup() {
  const kanji = useParams().kanji ?? ''
  const api = useApi()
  const lookup = useQuery({
    queryKey: ['japanese', 'lookup', kanji],
    queryFn: () => api.get<Lookup>(`/api/japanese/lookup/kanji/${encodeURIComponent(kanji)}`),
  })
  // Opened from a Drawing's Candidates, it goes back to the Drawing; otherwise, to Search.
  const { state } = useLocation()
  const fromDraw = (state as KanjiPageFrom | null)?.from === 'draw'
  const back = fromDraw ? { to: '/japanese/draw', label: 'Draw' } : { to: '/japanese', label: 'Search' }

  // Stored after all (added since the Candidates were checked): its Kanji page instead, which goes
  // back to the same place.
  const storedId = lookup.error instanceof ApiError && lookup.error.status === 409 ? storedKanjiId(lookup.error) : null
  if (storedId) return <Navigate to={`/japanese/kanji/${storedId}`} replace state={state} />

  if (!lookup.data) {
    const status = lookup.error instanceof ApiError ? lookup.error.status : null
    return (
      <>
        <ScreenHeader back={back} />
        {status === 404 && <EmptyNote>Nothing is known about this kanji.</EmptyNote>}
        {lookup.isError && status !== 404 && (
          <LoadProblem
            // A request that never reached the server, rather than one it answered with an error.
            message={status === null ? 'Offline: can’t look this kanji up.' : 'Couldn’t look this kanji up.'}
            retry={() => lookup.refetch()}
          />
        )}
      </>
    )
  }
  const k = lookup.data
  return (
    <>
      <ScreenHeader
        back={back}
        overline="Not one of your Kanji yet."
        title={
          <span lang="ja" className="mt-2 block text-[96px] leading-none font-normal">
            {k.kanji}
          </span>
        }
        subtitle={
          <span lang="en" className="text-[20px] text-ink">
            {k.meanings.join(', ')}
          </span>
        }
      />
      {(k.on.length > 0 || k.kun.length > 0) && (
        <Section title="Readings" list>
          {k.on.length > 0 && (
            <Detail label="On" lang="ja">
              {k.on.join('、')}
            </Detail>
          )}
          {k.kun.length > 0 && (
            <Detail label="Kun" lang="ja">
              {k.kun.join('、')}
            </Detail>
          )}
        </Section>
      )}
      <Section title="Details" list>
        {k.strokes > 0 && <Detail label="Strokes">{k.strokes}</Detail>}
        <Detail label="Jōyō">{joyo(k.grade)}</Detail>
        {k.jlpt !== null && <Detail label="JLPT">N{k.jlpt}</Detail>}
      </Section>
      {k.words.length > 0 && (
        <Section title="Words" list>
          {k.words.map((word) => (
            <li key={word.word} className="flex min-h-[52px] flex-col justify-center px-4 py-2.5">
              <span className="flex items-baseline gap-2">
                <span lang="ja" className="text-[17px]">
                  {word.word}
                </span>
                <span lang="ja" className="text-[15px] text-sub">
                  {word.reading}
                </span>
              </span>
              <span lang="en" className="text-[15px] text-sub">
                {word.meanings.join(', ')}
              </span>
            </li>
          ))}
        </Section>
      )}
    </>
  )
}

// The id in a 409's answer, {"id": "..."}: the stored Kanji the lookup was asked for.
function storedKanjiId(error: ApiError): string | null {
  try {
    const { id } = JSON.parse(error.detail) as { id?: unknown }
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

// Whether it is jōyō, by its school grade.
function joyo(grade: number | null): string {
  if (grade !== null && grade >= 1 && grade <= 6) return `Yes, grade ${grade}`
  if (grade === 8) return 'Yes, secondary school'
  if (grade === 9 || grade === 10) return 'No, jinmeiyō'
  return 'No'
}
