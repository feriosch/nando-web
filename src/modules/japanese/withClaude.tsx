import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../core/ui/Button'
import { FieldRow } from '../../core/ui/FieldRow'
import { GroupedList } from '../../core/ui/List'
import { PickerRow } from '../../core/ui/Picker'
import { saveFooter } from '../../core/ui/saveFooter'
import { groupName } from './japanese'
import { askProblem, useAskClaude, type Asked } from './wordRequests'

// The Groups the Owner picks from, for where they found a word. JLPT N2, N3 and Basic are Claude's
// to pick, from jisho.org's JLPT level.
const groups = ['literature', 'gaming', 'anime', 'movie', 'miscellaneous', 'jlpt_n1'].map((key) => ({ value: key, label: groupName(key) }))

// The "Add with Claude" sheet's form: the word as typed, which Claude turns into its dictionary form,
// and the Group it was found in. `done` closes the sheet once the Word Request is made.
export function AddWithClaudeForm({ text: typed, done }: { text: string; done: (asked: Asked) => void }) {
  const ask = useAskClaude()
  const [text, setText] = useState(typed)
  const [group, setGroup] = useState(lastGroup)

  function submit(event: FormEvent) {
    event.preventDefault()
    ask.mutate(
      { kind: 'add', text: text.trim(), group },
      {
        onSuccess: (asked) => {
          keepGroup(group)
          done(asked)
        },
      },
    )
  }

  return (
    <form aria-label="Add with Claude" onSubmit={submit} className="my-0">
      <GroupedList footer={ask.isError ? saveFooter(false, askProblem(ask.error)) : 'Conjugated or in kana is fine: Claude adds its dictionary form.'}>
        <FieldRow label="Word" value={text} onChange={setText} maxLength={100} lang="ja" />
        <PickerRow label="Group" value={group} options={groups} onChange={setGroup} />
      </GroupedList>
      <Button type="submit" variant="accent" size="large" className="mt-4" isDisabled={ask.isPending || text.trim() === ''}>
        Add
      </Button>
    </form>
  )
}

// What came of asking Claude about `children` (such as "add 「食べた」"): asked, or already asked
// and waiting on Claude, or already asked and waiting on the Owner's answer to Claude's question.
export function AskedStatus({ asked, className, children }: { asked: Asked; className: string; children: ReactNode }) {
  let ending = '.'
  if (asked.alreadyAsked) ending = asked.wordRequest.state === 'needs_answer' ? ': it has a question for you.' : ', still waiting.'
  return (
    <p role="status" className={`${className} text-[15px] text-sub`}>
      {asked.alreadyAsked ? 'Already asked' : 'Asked'} Claude to {children}
      {ending}
    </p>
  )
}

// The Group last added to is kept on this device, for the next word, which was likely found in the
// same place. localStorage can throw (blocked storage, private browsing): then it is Miscellaneous.
const groupKey = 'nando.japanese.addGroup'

function lastGroup(): string {
  try {
    const stored = localStorage.getItem(groupKey)
    if (stored && groups.some((option) => option.value === stored)) return stored
  } catch {
    // Fall through to Miscellaneous.
  }
  return 'miscellaneous'
}

function keepGroup(group: string) {
  try {
    localStorage.setItem(groupKey, group)
  } catch {
    // Not kept: the next word starts from Miscellaneous.
  }
}

// Asks Claude to improve the Word `word` (its id and spelling), then says it asked.
export function ImproveWithClaude({ word }: { word: { id: string; word: string } }) {
  const ask = useAskClaude()
  if (ask.isSuccess) {
    return (
      <AskedStatus asked={ask.data} className="mx-4 my-4">
        improve <span lang="ja">{word.word}</span>
      </AskedStatus>
    )
  }
  const improve = () => ask.mutate({ kind: 'improve', wordId: word.id })
  if (ask.isError) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 px-4 text-center">
        <p role="alert" className="my-0 text-[15px] text-sub">
          {askProblem(ask.error)}
        </p>
        <Button onPress={improve}>Try again</Button>
      </div>
    )
  }
  return (
    <Button variant="accent" size="large" className="mt-6" isDisabled={ask.isPending} onPress={improve}>
      Improve with Claude
    </Button>
  )
}
