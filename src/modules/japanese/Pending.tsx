import { ChevronRight } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Link } from 'react-router'
import { Button } from '../../core/ui/Button'
import { lucideProps } from '../../core/ui/icons'
import { GroupedList, ListRow, SectionHeader } from '../../core/ui/List'
import { pillClasses } from '../../core/ui/pill'
import { Sheet } from '../../core/ui/Sheet'
import { useLastShown } from '../../core/ui/useLastShown'
import { useAnswerWordRequest, useDismissWordRequest, useRetryWordRequest, useWordRequests, type WordRequest } from './japanese'
import { rowLinkClasses } from './rows'

// The Pending strip at the top of Japanese search: the Owner's Word Requests, newest first, each as
// it stands. Shown only when there are some; a list that couldn't load shows nothing either, as the
// search under it is what the screen is for. A done one opens in a sheet, which dismisses it.
export function Pending() {
  const wordRequests = useWordRequests()
  const dismiss = useDismissWordRequest()
  const [opened, setOpened] = useState<WordRequest | null>(null)
  const id = useId()
  const open = (request: WordRequest) => {
    setOpened(request)
    dismiss.mutate(request.id)
  }
  const requests = wordRequests.data ?? []
  return (
    <>
      {requests.length > 0 && (
        <>
          <SectionHeader id={id}>Pending</SectionHeader>
          <GroupedList as="ul" labelledBy={id}>
            {requests.map((request) => (
              <li key={request.id}>
                <PendingRow request={request} open={() => open(request)} />
              </li>
            ))}
          </GroupedList>
        </>
      )}
      <DoneSheet request={opened} close={() => setOpened(null)} />
    </>
  )
}

function PendingRow({ request, open }: { request: WordRequest; open: () => void }) {
  switch (request.state) {
    case 'pending':
      return <Row text={request.text} status="Waiting" />
    case 'working':
      return <Row text={request.text} status="Claude is on it" />
    case 'done':
      return (
        <AriaButton onPress={open} className={`${rowLinkClasses} cursor-default rounded-none border-0 bg-transparent font-normal`}>
          <span className="min-w-0 flex-1">
            <Lines text={request.text} status={request.summary ?? 'Done'} />
          </span>
          <ChevronRight {...lucideProps} className="-mr-1.5 size-5 shrink-0 text-sub" />
        </AriaButton>
      )
    case 'needs_answer':
      return <Question request={request} />
    case 'failed':
      return <Failed request={request} />
  }
}

// A Word Request Claude gave up on: why, when it says, and Retry.
function Failed({ request }: { request: WordRequest }) {
  const retry = useRetryWordRequest()
  return (
    <Row text={request.text}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="my-0 text-[15px]">{request.kind === 'add' ? "Couldn't add" : "Couldn't improve"}</p>
          {request.summary && <p className="my-0 text-[15px] text-sub">{request.summary}</p>}
        </div>
        <Button isDisabled={retry.isPending} onPress={() => retry.mutate(request.id)}>
          Retry
        </Button>
      </div>
    </Row>
  )
}

// A Word Request Claude asks about: its question, a button for each of its choices, and Other… for
// a field to answer in the Owner's own words.
function Question({ request }: { request: WordRequest }) {
  const answer = useAnswerWordRequest()
  const [other, setOther] = useState<string | null>(null)
  const fieldId = useId()
  const send = (text: string) => answer.mutate({ id: request.id, answer: text })
  return (
    <Row text={request.text}>
      <p className="my-0 text-[15px]">{request.question}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {request.choices.map((choice) => (
          <Button key={choice} isDisabled={answer.isPending} onPress={() => send(choice)}>
            <span lang="ja">{choice}</span>
          </Button>
        ))}
        {other === null && (
          <Button isDisabled={answer.isPending} onPress={() => setOther('')}>
            Other…
          </Button>
        )}
      </div>
      {other !== null && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (other.trim() !== '') send(other.trim())
          }}
        >
          <label htmlFor={fieldId} className="sr-only">
            Your answer
          </label>
          <input
            id={fieldId}
            value={other}
            onChange={(event) => setOther(event.target.value)}
            autoFocus
            lang="ja"
            enterKeyHint="send"
            placeholder="Your answer"
            className="m-0 min-h-11 min-w-0 flex-1 rounded-[12px] border-0 bg-fill px-3 py-0 text-[16px] text-ink outline-none placeholder:text-sub/70"
          />
          <Button type="submit" variant="accent" isDisabled={answer.isPending || other.trim() === ''}>
            Send
          </Button>
        </form>
      )}
    </Row>
  )
}

// A Word Request's row: the word as the Owner asked for it, then where it stands.
function Row({ text, status, children }: { text: string; status?: string; children?: ReactNode }) {
  return (
    <div className="min-h-[52px] px-4 py-2.5">
      <Lines text={text} status={status} />
      {children}
    </div>
  )
}

function Lines({ text, status }: { text: string; status?: string }) {
  return (
    <>
      <span lang="ja" className="block text-[17px] leading-snug">
        {text}
      </span>
      {status && <span className="block text-[15px] text-sub">{status}</span>}
    </>
  )
}

// A done Word Request, opened: what Claude did, what it suggests doing in Claude Code, and its Word.
function DoneSheet({ request, close }: { request: WordRequest | null; close: () => void }) {
  const shown = useLastShown(request)
  const suggestionsId = useId()
  return (
    <Sheet isOpen={request !== null} onOpenChange={(isOpen) => !isOpen && close()} title={shown?.text ?? ''}>
      {shown && (
        <>
          {shown.summary && <p className="mt-0 mb-2 text-[17px]">{shown.summary}</p>}
          {shown.suggestions.length > 0 && (
            <>
              <SectionHeader id={suggestionsId}>To do in Claude Code</SectionHeader>
              <GroupedList as="ul" labelledBy={suggestionsId}>
                {shown.suggestions.map((suggestion) => (
                  <ListRow as="li" key={suggestion}>
                    {suggestion}
                  </ListRow>
                ))}
              </GroupedList>
            </>
          )}
          {shown.wordId && (
            <Link to={`/japanese/words/${shown.wordId}`} viewTransition className={`${pillClasses('accent', 'large')} mt-4 no-underline`}>
              Open word
            </Link>
          )}
        </>
      )}
    </Sheet>
  )
}
