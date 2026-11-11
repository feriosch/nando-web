import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { lucideProps } from '../../core/ui/icons'
import { Chip } from './chips'
import { groupName, type KanjiRow, type WordRow } from './japanese'

// A grouped-list row as one link, to the page it opens.
export const rowLinkClasses =
  'flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left text-ink no-underline active:bg-fill focus-visible:-outline-offset-2'

// A Word as a list row opening its Word page: spelling and reading, its Spanish meaning under them,
// and its Group on the right.
export function WordRowLink({ word }: { word: WordRow }) {
  return (
    <Link to={`/japanese/words/${word.id}`} viewTransition className={rowLinkClasses}>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span lang="ja" className="text-[19px] leading-snug">
            {word.word}
          </span>
          {word.hiragana && (
            <span lang="ja" className="text-[14px] text-sub">
              {word.hiragana}
            </span>
          )}
        </span>
        <span lang="es" className="block truncate text-[15px] text-sub">
          {word.spanish}
        </span>
      </span>
      <Chip>{groupName(word.group)}</Chip>
      <ChevronRight {...lucideProps} className="-mr-1.5 size-5 shrink-0 text-sub" />
    </Link>
  )
}

// A Kanji as a list row opening its Kanji page: the character on a tile, then its Spanish meaning.
export function KanjiRowLink({ kanji }: { kanji: KanjiRow }) {
  return (
    <Link to={`/japanese/kanji/${kanji.id}`} viewTransition className={rowLinkClasses}>
      <KanjiTile>{kanji.kanji}</KanjiTile>
      <span lang="es" className="min-w-0 flex-1 truncate text-[17px]">
        {kanji.spanish}
      </span>
      <ChevronRight {...lucideProps} className="-mr-1.5 size-5 shrink-0 text-sub" />
    </Link>
  )
}

// The 40px tile a Kanji's character sits on at the start of a row. An irregular Component has no
// character to show: its tile is an empty outline.
export function KanjiTile({ children, irregular = false }: { children?: ReactNode; irregular?: boolean }) {
  if (irregular) return <span aria-hidden="true" className="size-10 shrink-0 rounded-[10px] border border-dashed border-sub/50" />
  return (
    <span lang="ja" className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent/10 font-display text-[24px] leading-none text-accent">
      {children}
    </span>
  )
}
