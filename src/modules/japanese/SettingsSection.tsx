import { useMutation } from '@tanstack/react-query'
import { Share as ShareIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { ApiError } from '../../core/api/client'
import { useApi, useShare } from '../../core/services'
import { lucideProps } from '../../core/ui/icons'
import { GroupedList, SectionHeader } from '../../core/ui/List'
import { pillClasses } from '../../core/ui/pill'
import { saveFooter } from '../../core/ui/saveFooter'
import { rowLinkClasses } from './rows'

// Where the JLPT deck comes from: every Word studied for the JLPT, for AnkiMobile's import.
const deckPath = '/api/japanese/anki/jlpt.csv'

// The Japanese Settings Section: the Anki group, with the JLPT deck's export.
export function JapaneseSettingsSection() {
  return <AnkiExport />
}

// "Export JLPT deck": fetches the deck and hands it to the share sheet, for AnkiMobile, or to the
// downloads on a desktop. Safari opens the share sheet only within a tap; if fetching took too long
// for that, the row offers the fetched deck to share with another tap.
function AnkiExport() {
  const api = useApi()
  const share = useShare()
  // The deck, fetched but refused by Safari, waiting for a tap to share it.
  const [ready, setReady] = useState<File | null>(null)
  // Set straight from the tap, so a quick second tap can't start again before `isPending` reaches
  // the row.
  const working = useRef(false)
  const exportDeck = useMutation({
    mutationFn: (job: () => Promise<void>) => job(),
    onSettled: () => {
      working.current = false
    },
  })

  // Both taps are native buttons' onClick, so the share sheet opens within the tap.
  function start(job: () => Promise<void>) {
    if (working.current) return
    working.current = true
    exportDeck.mutate(job)
  }

  function tapExport() {
    start(async () => {
      const file = await api.file(deckPath)
      // A desktop has no share sheet for files: the deck goes to its downloads.
      if (!share.canShareFiles([file])) {
        share.download(file)
        return
      }
      await settle(share.shareFiles([file]), file)
    })
  }

  function tapShare(file: File) {
    // Asked for before anything is awaited, while the tap still counts.
    const sharing = share.shareFiles([file])
    start(() => settle(sharing, file))
  }

  // How a share sheet ended: shared, or closed by the Owner, which is not a problem either way; or
  // refused by Safari, keeping `file` ready for another tap.
  async function settle(sharing: Promise<void>, file: File) {
    try {
      await sharing
      setReady(null)
    } catch (error) {
      if (isNamed(error, 'AbortError')) return setReady(null)
      if (isNamed(error, 'NotAllowedError')) return setReady(file)
      throw error
    }
  }

  const rowClasses = `${rowLinkClasses} m-0 rounded-none bg-transparent text-[17px] font-normal`
  return (
    <>
      <SectionHeader as="h3">Anki</SectionHeader>
      <GroupedList
        footer={
          <>
            <p className="my-0">In AnkiMobile, set Existing notes to Update.</p>
            {saveFooter(false, exportDeck.isError ? describe(exportDeck.error) : null)}
          </>
        }
      >
        {ready ? (
          <button type="button" onClick={() => tapShare(ready)} disabled={exportDeck.isPending} className={rowClasses}>
            <span className="min-w-0 flex-1 truncate text-accent">Share {ready.name}</span>
            <ShareIcon {...lucideProps} className="size-5 shrink-0 text-accent" />
          </button>
        ) : (
          <button type="button" onClick={tapExport} disabled={exportDeck.isPending} className={rowClasses}>
            <span className="flex-1">Export JLPT deck</span>
            {exportDeck.isPending ? (
              <span className="text-[15px] text-sub">Preparing…</span>
            ) : (
              <ShareIcon {...lucideProps} className="size-5 shrink-0 text-accent" />
            )}
          </button>
        )}
      </GroupedList>
      {exportDeck.isError && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={tapExport} className={pillClasses('quiet')}>
            Try again
          </button>
        </div>
      )}
    </>
  )
}

// Why the deck couldn't be fetched: the server's own message if it gave one.
function describe(error: unknown): string {
  if (error instanceof ApiError && error.detail) return `Couldn't get the JLPT deck: ${error.detail}`
  if (error instanceof ApiError) return "Couldn't get the JLPT deck."
  return "Couldn't get the JLPT deck. Check the connection."
}

function isNamed(error: unknown, name: string): boolean {
  return error instanceof DOMException && error.name === name
}
