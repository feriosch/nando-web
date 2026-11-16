import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { ApiError } from '../../core/api/client'
import { useApi, useClipboard } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { Button } from '../../core/ui/Button'
import { GroupedList, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { pillClasses } from '../../core/ui/pill'
import { useBackLink } from '../../core/ui/cameFrom'
import { ScreenHeader } from '../../core/ui/ScreenHeader'
import { langOf, type LanguageNote, type Message, type RecruiterConversation, type RecruiterWithConversations, type SuggestedReply } from './career'

// A Recruiter's page, at /career/recruiters/:id: for each of their Conversations, its last messages
// and its Suggested Reply.
export function RecruiterPage() {
  const { id } = useParams()
  const api = useApi()
  const pageKey = ['career', 'recruiters', id]
  const page = useQuery({ queryKey: pageKey, queryFn: () => api.get<RecruiterWithConversations>(`/api/career/recruiters/${id}`) })
  // Back to the Career screen, or to the screen it was opened from, such as Late Replies or an
  // Opportunity, named by its role.
  const back = useBackLink({ to: '/career', label: 'Career' })

  if (!page.data) {
    return (
      <>
        <ScreenHeader back={back} />
        {page.isError &&
          (page.error instanceof ApiError && page.error.status === 404 ? (
            <EmptyNote>This Recruiter isn't in Nando.</EmptyNote>
          ) : (
            <LoadProblem message="Couldn't load this Recruiter." retry={() => page.refetch()} />
          ))}
      </>
    )
  }
  const r = page.data
  return (
    <>
      <ScreenHeader back={back} title={<span lang={langOf(r.name)}>{r.name}</span>} subtitle={<span lang={langOf(r.organisation)}>{r.organisation}</span>} />
      {r.conversations.length === 1 ? (
        <ConversationView recruiter={r.name} conversation={r.conversations[0]} pageKey={pageKey} />
      ) : (
        r.conversations.map((c, i) => (
          <NumberedConversation key={c.id} name={`Conversation ${i + 1} of ${r.conversations.length}`}>
            <ConversationView recruiter={r.name} conversation={c} pageKey={pageKey} />
          </NumberedConversation>
        ))
      )}
    </>
  )
}

// One of a Recruiter's several Conversations, set apart under its own heading, newest first.
function NumberedConversation({ name, children }: { name: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="mt-8 border-t-[0.5px] border-line pt-2 first-of-type:mt-4 first-of-type:border-t-0">
      <h2 id={headingId} className="mx-4 mt-3 mb-0 text-[20px] font-semibold">
        {name}
      </h2>
      {children}
    </section>
  )
}

// A Conversation: its last messages, if it has any, and its Suggested Reply with the notes. `pageKey`
// is the Recruiter page's query, which a mark changes.
function ConversationView({ recruiter, conversation: c, pageKey }: { recruiter: string; conversation: RecruiterConversation; pageKey: unknown[] }) {
  const messagesId = useId()
  return (
    <>
      {c.messages.length > 0 && (
        <>
          <SectionHeader id={messagesId}>Messages</SectionHeader>
          <ul aria-labelledby={messagesId} className="my-2 flex list-none flex-col gap-2 p-0">
            {c.messages.map((m) => (
              <MessageBubble key={m.id} recruiter={recruiter} message={m} />
            ))}
          </ul>
        </>
      )}
      {c.suggestedReply && <ReplyView reply={c.suggestedReply} conversationId={c.id} url={c.url} pageKey={pageKey} />}
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

// The Suggested Reply, in its language, labelled when it is a follow-up or a Late Reply, with Copy, which says "Copied" for a moment, Open in
// LinkedIn, the Conversation's URL, which the iPhone opens in the LinkedIn app, and Mark as Replied. Once marked, "Marked as replied"
// with Undo stands in for it.
function ReplyView({ reply, conversationId, url, pageKey }: { reply: SuggestedReply; conversationId: string; url: string; pageKey: unknown[] }) {
  const headingId = useId()
  const api = useApi()
  const queryClient = useQueryClient()
  // Shows the mark on this page at once, and has the Home Card, the Career screen and Late Replies,
  // which a marked reply leaves, read the server again.
  const setMarked = (markedRepliedAt: string | null) => {
    for (const list of ['home-card', 'screen', 'late-replies']) void queryClient.invalidateQueries({ queryKey: ['career', list] })
    queryClient.setQueryData<RecruiterWithConversations>(
      pageKey,
      (page) =>
        page && {
          ...page,
          conversations: page.conversations.map((c) =>
            c.id === conversationId && c.suggestedReply ? { ...c, suggestedReply: { ...c.suggestedReply, markedRepliedAt } } : c,
          ),
        },
    )
  }
  const mark = useMutation({
    mutationFn: () => api.post(`/api/career/conversations/${conversationId}/replied`),
    onSuccess: () => setMarked(new Date().toISOString()),
  })
  const undo = useMutation({
    mutationFn: () => api.delete(`/api/career/conversations/${conversationId}/replied`),
    onSuccess: () => setMarked(null),
  })
  const clipboard = useClipboard()
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  // Counts the copies, so a tap while "Copied" shows keeps it for another moment.
  const [copies, setCopies] = useState(0)
  useEffect(() => {
    if (copy !== 'copied') return
    const timer = setTimeout(() => setCopy('idle'), 2000)
    return () => clearTimeout(timer)
  }, [copy, copies])

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
      {reply.markedRepliedAt ? (
        <div className="my-2 rounded-[14px] bg-surface px-4 py-2">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-[17px] text-sub">Marked as replied</span>
            <Button onPress={() => undo.mutate()}>Undo</Button>
          </div>
          {undo.isError && (
            <p role="alert" className="mt-1 mb-1 text-[13px] text-sub">
              Couldn't undo. Try again.
            </p>
          )}
        </div>
      ) : (
        <div className="my-2 rounded-[14px] bg-surface px-4 py-3">
          <p lang={reply.language} className="my-0 text-[17px] leading-relaxed whitespace-pre-line select-text">
            {reply.text}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="accent"
              onPress={() =>
                clipboard.copy(reply.text).then(
                  () => {
                    setCopy('copied')
                    setCopies((n) => n + 1)
                  },
                  () => setCopy('failed'),
                )
              }
            >
              Copy
            </Button>
            <a href={url} target="_blank" rel="noreferrer" className={`${pillClasses('quiet', 'regular')} no-underline active:opacity-70`}>
              Open in LinkedIn
            </a>
            <Button onPress={() => mark.mutate()}>Mark as Replied</Button>
            <span role="status" className="text-[15px] text-sub">
              {copy === 'copied' && 'Copied'}
            </span>
          </div>
          {copy === 'failed' && (
            <p role="alert" className="mt-2 mb-0 text-[13px] text-sub">
              Couldn't copy. Select the text and copy it instead.
            </p>
          )}
          {mark.isError && (
            <p role="alert" className="mt-2 mb-0 text-[13px] text-sub">
              Couldn't mark it as replied. Try again.
            </p>
          )}
        </div>
      )}
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
