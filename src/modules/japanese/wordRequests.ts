import { useMutation } from '@tanstack/react-query'
import { ApiError } from '../../core/api/client'
import { useApi } from '../../core/services'

// Word Requests: the Owner's asks for Claude to add a word or improve a Word, as nando-server's
// internal/japanese/API.md documents them (ADR 0006).

export type WordRequest = {
  id: string
  // As the Owner typed it, to add; the Word's spelling, to improve.
  text: string
  kind: 'add' | 'improve'
  // To add: the Group the Owner found the word in. Null to improve.
  group: string | null
  wordId: string | null
  state: 'pending' | 'working' | 'done' | 'needs_answer' | 'failed'
  attempts: number
  answer: string | null
  summary: string | null
  suggestions: string[]
  question: string | null
  choices: string[]
}

// What the Owner asks: to add `text`, found in `group`, or to improve the Word `wordId`.
export type Ask = { kind: 'add'; text: string; group: string } | { kind: 'improve'; wordId: string }

// What came of asking: the Word Request, and whether an open one already asked the same, in which
// case it is that one, as it is, and no second one was made.
export type Asked = { wordRequest: WordRequest; alreadyAsked: boolean }

// Asks Claude, by creating a Word Request.
export function useAskClaude() {
  const api = useApi()
  return useMutation({
    mutationFn: async (ask: Ask): Promise<Asked> => {
      const { status, body } = await api.postWithStatus<WordRequest>('/api/japanese/word-requests', ask)
      return { wordRequest: body, alreadyAsked: status === 200 }
    },
  })
}

// Why Claude couldn't be asked: the server's own message if it gave one, such as "text is blank".
export function askProblem(error: unknown): string {
  if (error instanceof ApiError && error.detail) return `Couldn't ask Claude: ${error.detail}`
  if (error instanceof ApiError) return "Couldn't ask Claude."
  return "Couldn't ask Claude. Check the connection."
}
