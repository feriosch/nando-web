import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { Eraser, Undo2 } from 'lucide-react'
import { ApiError } from '../../core/api/client'
import { useApi } from '../../core/services'
import { Button } from '../../core/ui/Button'
import { lucideProps } from '../../core/ui/icons'
import { EmptyNote } from '../../core/ui/Notice'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import type { Drawing } from './drawing'
import type { CandidateKanji } from './japanese'
import type { Recognizer } from './recognizer'

// The Drawing on screen, kept in the query cache (never fetched) so that coming back from a
// Candidate's Kanji, or another tab, finds it as it was.
const lastDrawingKey = ['japanese', 'last-drawing']

// Where a Kanji page was opened from, as its link's state, so its back link returns there.
export type KanjiPageFrom = { from: 'draw' }

// Draw, at /japanese/draw: a kanji drawn by finger, and the Candidates it may be.
export function Draw({ recognizer }: { recognizer: Recognizer }) {
  const queryClient = useQueryClient()
  const [drawing, setDrawingState] = useState<Drawing>(() => queryClient.getQueryData<Drawing>(lastDrawingKey) ?? [])
  const setDrawing = (change: (drawing: Drawing) => Drawing) =>
    setDrawingState((current) => {
      const next = change(current)
      queryClient.setQueryData(lastDrawingKey, next)
      return next
    })
  useEffect(() => recognizer.prepare?.(), [recognizer])
  const { candidates, failed } = useCandidates(recognizer, drawing)
  const { stored, unknown } = useStoredKanji(candidates)
  const note = failed ? 'Couldn’t read the Drawing. Draw again to retry.' : candidates.length > 0 ? unknown : null

  return (
    <>
      <ScreenHeader back={{ to: '/japanese', label: 'Search' }} title="Draw" />
      <div className="relative">
        <DrawingArea onStroke={(stroke) => setDrawing((strokes) => [...strokes, stroke])} drawing={drawing} />
        {/* Inside the square's foot, so it's always in view and nothing moves under the finger. */}
        {note && (
          <p role="status" className="pointer-events-none absolute inset-x-0 bottom-3 m-0 text-center text-[13px] text-sub">
            {note}
          </p>
        )}
      </div>
      <div className="mt-3 flex justify-center gap-3">
        <Button isDisabled={drawing.length === 0} onPress={() => setDrawing((strokes) => strokes.slice(0, -1))} className="gap-1.5">
          <Undo2 {...lucideProps} className="size-5" />
          Undo
        </Button>
        <Button isDisabled={drawing.length === 0} onPress={() => setDrawing(() => [])} className="gap-1.5">
          <Eraser {...lucideProps} className="size-5" />
          Clear
        </Button>
      </div>
      {drawing.length === 0 && (
        <div className="mt-4 text-center">
          <EmptyNote>Draw a kanji to find it among yours.</EmptyNote>
        </div>
      )}
      {candidates.length > 0 && (
        <ul aria-label="Candidates" className="m-0 mt-4 grid list-none grid-cols-4 gap-2 p-0">
          {candidates.map((kanji) => (
            <li key={kanji}>
              <CandidateTile kanji={kanji} stored={unknown ? 'unknown' : stored.get(kanji)} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// The stored Kanji among `candidates`, by character, or why it isn't known which they are. Offline the
// lookup fails at once, and is made again once the connection is back (src/core/queries.ts).
function useStoredKanji(candidates: string[]): { stored: Map<string, CandidateKanji>; unknown: string | null } {
  const api = useApi()
  const asked = candidates.join('')
  const lookup = useQuery({
    queryKey: ['japanese', 'candidates', asked],
    queryFn: () => api.get<CandidateKanji[]>(`/api/japanese/kanji?kanji=${encodeURIComponent(asked)}`),
    enabled: asked !== '',
  })
  // A request that never reached the server.
  const offline = lookup.isError && !(lookup.error instanceof ApiError)
  const unknown = offline ? 'Offline: can’t check your kanji.' : lookup.isError ? 'Couldn’t check your kanji.' : null
  return { stored: new Map((lookup.data ?? []).map((kanji) => [kanji.kanji, kanji])), unknown }
}

// A Candidate: a stored Kanji with its meaning and Heisig number, opening its page; a kanji that
// isn't stored, dimmed, opening its Kanji Lookup; or, while that can't be checked, the kanji alone.
function CandidateTile({ kanji, stored }: { kanji: string; stored: CandidateKanji | 'unknown' | undefined }) {
  if (stored === 'unknown') {
    return (
      <div className={`${tileClasses} text-ink`}>
        <span lang="ja" className="font-display text-[32px] leading-none">
          {kanji}
        </span>
      </div>
    )
  }
  if (!stored) {
    // Dimmed, as not one of the Owner's, and opening what Nando can find out about it.
    return (
      <Link
        to={`/japanese/lookup/${kanji}`}
        state={{ from: 'draw' } satisfies KanjiPageFrom}
        viewTransition
        aria-label={`${kanji}, not stored`}
        className={`${tileClasses} text-sub no-underline opacity-50 active:opacity-30`}>
        <span lang="ja" className="font-display text-[32px] leading-none">
          {kanji}
        </span>
      </Link>
    )
  }
  return (
    <Link
      to={`/japanese/kanji/${stored.id}`}
      state={{ from: 'draw' } satisfies KanjiPageFrom}
      viewTransition
      aria-label={`${kanji} ${stored.spanish} ${stored.v1}`}
      className={`${tileClasses} text-ink no-underline active:opacity-60`}>
      <span lang="ja" className="font-display text-[32px] leading-none text-accent">
        {kanji}
      </span>
      <span lang="es" className="mt-1 max-w-full truncate text-[12px] leading-tight">
        {stored.spanish}
      </span>
      <span className="text-[11px] leading-tight text-sub tabular-nums">{stored.v1}</span>
    </Link>
  )
}

const tileClasses = 'flex h-[88px] flex-col items-center justify-center rounded-[14px] bg-surface px-1'

// What `recognizer` read a Drawing as: its Candidates, or null when it couldn't read it.
type Answer = { drawing: Drawing; candidates: string[] | null }

// What `recognizer` reads `drawing` as, once each stroke has ended, and whether reading it failed.
// An answer still shows while strokes are added, until the next one arrives; after Undo or Clear it
// belongs to another Drawing and doesn't. A late answer for an older Drawing is dropped.
function useCandidates(recognizer: Recognizer, drawing: Drawing): { candidates: string[]; failed: boolean } {
  const [answer, setAnswer] = useState<Answer | null>(null)
  useEffect(() => {
    if (drawing.length === 0) return
    let current = true
    recognizer.recognize(drawing).then(
      (candidates) => current && setAnswer({ drawing, candidates }),
      () => current && setAnswer({ drawing, candidates: null }),
    )
    return () => {
      current = false
    }
  }, [recognizer, drawing])
  const applies = answer !== null && answer.drawing.length <= drawing.length && answer.drawing.every((stroke, i) => stroke === drawing[i])
  if (!applies) return { candidates: [], failed: false }
  return { candidates: answer.candidates ?? [], failed: answer.candidates === null && answer.drawing === drawing }
}

// The square the Owner draws in. Each stroke is recorded in CSS pixels from its top left and handed
// to `onStroke` when the finger lifts.
function DrawingArea({ drawing, onStroke }: { drawing: Drawing; onStroke: (stroke: number[][]) => void }) {
  // The stroke being drawn: in a ref, so a finger lifting before React re-renders still hands over
  // every point, and copied to state only to show it.
  const live = useRef<number[][] | null>(null)
  // The finger drawing it: another touching the square meanwhile, such as a thumb, is ignored.
  const finger = useRef<number | null>(null)
  const [stroke, setStroke] = useState<number[][] | null>(null)
  const area = useRef<SVGSVGElement>(null)
  const pointAt = (event: PointerEvent) => {
    const box = area.current!.getBoundingClientRect()
    return [event.clientX - box.left, event.clientY - box.top]
  }
  const end = (event: PointerEvent) => {
    if (event.pointerId !== finger.current) return
    if (live.current) onStroke(live.current)
    live.current = null
    finger.current = null
    setStroke(null)
  }

  return (
    <svg
      ref={area}
      aria-label="Drawing"
      role="img"
      className="block aspect-square w-full touch-none rounded-[22px] bg-surface text-ink select-none"
      onPointerDown={(event) => {
        if (finger.current !== null) return
        finger.current = event.pointerId
        // Keeps the stroke's moves coming even when the finger slides off the square.
        if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId)
        live.current = [pointAt(event)]
        setStroke(live.current)
      }}
      onPointerMove={(event) => {
        if (event.pointerId !== finger.current || !live.current) return
        live.current = [...live.current, pointAt(event)]
        setStroke(live.current)
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {/* Faint guides through the middle, as on squared writing paper. */}
      <g className="text-line" stroke="currentColor" strokeDasharray="6 6" strokeWidth={1}>
        <line x1="50%" y1="8%" x2="50%" y2="92%" />
        <line x1="8%" y1="50%" x2="92%" y2="50%" />
      </g>
      {[...drawing, ...(stroke ? [stroke] : [])].map((points, i) => (
        <polyline
          key={i}
          // A tap is a dot: a line from the point to itself, drawn with round caps.
          points={(points.length === 1 ? [points[0], points[0]] : points).map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
