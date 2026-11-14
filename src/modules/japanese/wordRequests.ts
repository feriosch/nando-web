import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, type ApiClient } from '../../core/api/client'
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ask: Ask): Promise<Asked> => {
      const { status, body } = await api.postWithStatus<WordRequest>('/api/japanese/word-requests', ask)
      return { wordRequest: body, alreadyAsked: status === 200 }
    },
    // The Pending strip shows the new Word Request at once.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wordRequestsKey }),
  })
}

// Why Claude couldn't be asked: the server's own message if it gave one, such as "text is blank".
export function askProblem(error: unknown): string {
  if (error instanceof ApiError && error.detail) return `Couldn't ask Claude: ${error.detail}`
  if (error instanceof ApiError) return "Couldn't ask Claude."
  return "Couldn't ask Claude. Check the connection."
}

const wordRequestsKey = ['japanese', 'word-requests']

// The Word Requests for the Pending strip, newest first: the open ones, and those done or failed in
// the last 7 days that the Owner hasn't dismissed. Loaded again whenever Japanese search opens and
// whenever Nando comes back to the foreground (React Query's refetchOnMount and refetchOnWindowFocus,
// which follows visibilitychange), never polled.
export function useWordRequests() {
  const api = useApi()
  return useQuery({ queryKey: wordRequestsKey, queryFn: () => api.get<WordRequest[]>('/api/japanese/word-requests') })
}

// Answers Claude's question on a Word Request, with one of its choices or the Owner's own words,
// which sends it back to waiting for a Claude run.
export function useAnswerWordRequest() {
  return useWordRequestChange((api, { id, answer }: { id: string; answer: string }) =>
    api.post<WordRequest>(`/api/japanese/word-requests/${encodeURIComponent(id)}/answer`, { answer }),
  )
}

// Sends a failed Word Request back to waiting, for 3 fresh Claude runs.
export function useRetryWordRequest() {
  return useWordRequestChange((api, id: string) => api.post<WordRequest>(`/api/japanese/word-requests/${encodeURIComponent(id)}/retry`))
}

// Takes a done or failed Word Request off the Pending strip, as when the Owner opens it.
export function useDismissWordRequest() {
  return useWordRequestChange((api, id: string) => api.post<WordRequest>(`/api/japanese/word-requests/${encodeURIComponent(id)}/dismiss`))
}

// A change the Owner makes to a Word Request, sent with `send`; the strip then loads again, so it
// shows the Word Request as the server has it, whether the change went through or not.
function useWordRequestChange<Change>(send: (api: ApiClient, change: Change) => Promise<WordRequest>) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (change: Change) => send(api, change),
    onSettled: () => queryClient.invalidateQueries({ queryKey: wordRequestsKey }),
  })
}
