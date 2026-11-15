import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { useParams } from 'react-router'
import { useApi, useClipboard } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { Button } from '../../core/ui/Button'
import { GroupedList, SectionHeader } from '../../core/ui/List'
import { pillClasses } from '../../core/ui/pill'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { langOf, type LanguageNote, type Message, type RecruiterConversation, type RecruiterPage as Page, type SuggestedReply } from './career'

// A Recruiter's page, at /career/recruiters/:id: for each of their Conversations, its last messages
// and its Suggested Reply.
export function RecruiterPage() {
  const { id } = useParams()
  const api = useApi()
  const page = useQuery({ queryKey: ['career', 'recruiters', id], queryFn: () => api.get<Page>(`/api/career/recruiters/${id}`) })
  const back = { to: '/career', label: 'Career' }

  if (!page.data) {
    return (
      <>
        <ScreenHeader back={back} />
        {page.isError && <LoadProblem message="Couldn't load this Recruiter." retry={() => page.refetch()} />}
      </>
    )
  }
  const r = page.data
  return (
    <>
      <ScreenHeader back={back} title={<span lang="ja">{r.name}</span>} subtitle={<span lang="ja">{r.organisation}</span>} />
      {r.conversations.map((c) => (
        <ConversationView key={c.id} recruiter={r.name} conversation={c} />
      ))}
    </>
  )
}

function ConversationView({ recruiter, conversation: c }: { recruiter: string; conversation: RecruiterConversation }) {
  const messagesId = useId()
  return (
    <>
      <SectionHeader id={messagesId}>Messages</SectionHeader>
      <ul aria-labelledby={messagesId} className="my-2 flex list-none flex-col gap-2 p-0">
        {c.messages.map((m) => (
          <MessageBubble key={m.id} recruiter={recruiter} message={m} />
        ))}
      </ul>
      {c.suggestedReply && <ReplyView reply={c.suggestedReply} url={c.url} />}
      {c.suggestedReply && c.suggestedReply.notes.length > 0 && <NotesView notes={c.suggestedReply.notes} />}
    </>
  )
}

// One message: the Recruiter's on the left, on the surface; the Owner's on the right, in the accent.
function MessageBubble({ recruiter, message: m }: { recruiter: string; message: Message }) {
  const own = m.from === 'owner'
  return (
    <li className={`my-0 flex ${own ? 'justify-end' : 'justify-start'}`}>
      <span className="sr-only">{own ? 'You' : recruiter}: </span>
      <span
        lang={langOf(m.text)}
        className={`max-w-[85%] rounded-[18px] px-3.5 py-2 text-[16px] leading-snug whitespace-pre-line ${
          own ? 'rounded-br-[6px] bg-accent text-accent-ink' : 'rounded-bl-[6px] bg-surface text-ink'
        }`}
      >
        {m.text}
      </span>
    </li>
  )
}

// How a Suggested Reply other than an answer is labelled.
const kindLabels: Record<SuggestedReply['kind'], string | null> = { answer: null, follow_up: 'Follow-up', late: 'Late Reply' }

// The Suggested Reply, in its language, labelled when it is a follow-up or a Late Reply, with Copy, which says "Copied" for a moment, and Open in
// LinkedIn, the Conversation's URL, which the iPhone opens in the LinkedIn app.
function ReplyView({ reply, url }: { reply: SuggestedReply; url: string }) {
  const headingId = useId()
  const clipboard = useClipboard()
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (copy !== 'copied') return
    const timer = setTimeout(() => setCopy('idle'), 2000)
    return () => clearTimeout(timer)
  }, [copy])

  return (
    <section aria-labelledby={headingId}>
      <SectionHeader id={headingId}>
        Suggested Reply
        {kindLabels[reply.kind] && (
          <>
            <span className="sr-only">,</span>{' '}
            <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold text-ink">{kindLabels[reply.kind]}</span>
          </>
        )}
      </SectionHeader>
      <div className="my-2 rounded-[14px] bg-surface px-4 py-3">
        <p lang={reply.language} className="my-0 text-[17px] leading-relaxed whitespace-pre-line select-text">
          {reply.text}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="accent"
            onPress={() =>
              clipboard.copy(reply.text).then(
                () => setCopy('copied'),
                () => setCopy('failed'),
              )
            }
          >
            Copy
          </Button>
          <a href={url} target="_blank" rel="noreferrer" className={`${pillClasses('quiet', 'regular')} no-underline active:opacity-70`}>
            Open in LinkedIn
          </a>
          <span role="status" className="text-[15px] text-sub">
            {copy === 'copied' && 'Copied'}
          </span>
        </div>
        {copy === 'failed' && (
          <p role="alert" className="mt-2 mb-0 text-[13px] text-sub">
            Couldn't copy. Select the text and copy it instead.
          </p>
        )}
      </div>
    </section>
  )
}

// About your last message: Claude's notes on the Owner's last message, each with what they wrote,
// struck through, what is natural, and why.
function NotesView({ notes }: { notes: LanguageNote[] }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <SectionHeader id={headingId}>About your last message</SectionHeader>
      <GroupedList as="ul">
        {notes.map((note, i) => (
          <li key={i} className="my-0 flex flex-col gap-1 px-4 py-3">
            <span className="text-[15px] text-sub">
              <span className="sr-only">You wrote: </span>
              <s lang={langOf(note.wrote)}>{note.wrote}</s>
            </span>
            <span className="text-[17px] font-semibold">
              <span className="sr-only">More natural: </span>
              <span lang={langOf(note.natural)}>{note.natural}</span>
            </span>
            <span className="text-[15px] text-sub">{note.why}</span>
          </li>
        ))}
      </GroupedList>
    </section>
  )
}
