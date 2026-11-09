import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { ApiError } from '../../core/api/client'
import { useApi } from '../../core/services'
import { Button } from '../../core/ui/Button'
import { Sheet } from '../../core/ui/Sheet'
import { useLastShown } from '../../core/ui/useLastShown'
import { kcal, type DaySummary, type NewEntry } from './calories'

// What didn't go through: logging an Entry, changing one or deleting one.
export type Failed = 'log' | 'change' | 'delete'

type Problem = { title: string; message: string }

const failures: Record<Failed, Problem> = {
  log: { title: 'Not logged', message: "Couldn't log the Entry." },
  change: { title: 'Not changed', message: "Couldn't change the Entry." },
  delete: { title: 'Not deleted', message: "Couldn't delete the Entry." },
}

// The Day left the Editable Window while the screen was open.
const noLongerEditable: Problem = {
  title: 'Can’t change this Day',
  message: 'That Day can no longer be changed. Only today and the 7 Days before it can.',
}

// Asks the server what an Entry of `kcal` (or, with `replacing`, that Entry changed to `kcal`)
// would make of `day`, and goes ahead only if that stays within the Daily Limit. Otherwise it asks
// the Owner first, in a sheet. One log or change at a time: a second tap while one is under way does
// nothing. `sheets` are the over-limit question and the sheet saying why a log or change failed.
export function useGuard(day: string) {
  const api = useApi()
  const busy = useRef(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const fail = (error: unknown, failed: Failed) => {
    setProblem(error instanceof ApiError && error.status === 409 ? noLongerEditable : failures[failed])
  }
  type Proceed = () => Promise<unknown>
  const [pending, setPending] = useState<{ after: DaySummary; proceed: Proceed; replacing?: string } | null>(null)
  const shownPending = useLastShown(pending)
  const shownProblem = useLastShown(problem)

  // Runs `proceed`, whose own failure is reported by its mutation, then takes the next tap.
  async function run(proceed: Proceed) {
    try {
      await proceed()
    } catch {
      // Already said in `problem`.
    } finally {
      busy.current = false
    }
  }

  async function check(entryKcal: number, proceed: Proceed, { replacing }: { replacing?: string } = {}) {
    if (busy.current) return
    busy.current = true
    const query = new URLSearchParams({ kcal: String(entryKcal) })
    if (replacing) query.set('replacing', replacing)
    setProblem(null)
    let after: DaySummary
    try {
      after = await api.get<DaySummary>(`/api/calories/days/${day}/preview?${query}`)
    } catch (error) {
      fail(error, replacing ? 'change' : 'log')
      busy.current = false
      return
    }
    // Still busy while the Owner is asked.
    if (after.overLimit) setPending({ after, proceed, replacing })
    else await run(proceed)
  }

  function cancel() {
    setPending(null)
    busy.current = false
  }

  const sheets = (
    <>
      <Sheet
        isOpen={pending !== null}
        onOpenChange={(open) => !open && cancel()}
        title="Over your Daily Limit"
        role="alertdialog"
      >
        {shownPending && (
          <>
            <p className="mt-0 mb-5 text-[17px]">
              This takes you to {kcal(shownPending.after.consumedCalories!)} / {kcal(shownPending.after.dailyLimit!)} kcal.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" onPress={cancel}>
                Cancel
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                onPress={() => {
                  if (!pending) return
                  setPending(null)
                  run(pending.proceed)
                }}
              >
                {shownPending.replacing ? 'Save anyway' : 'Log anyway'}
              </Button>
            </div>
          </>
        )}
      </Sheet>
      <Sheet
        isOpen={problem !== null}
        onOpenChange={(open) => !open && setProblem(null)}
        title={shownProblem?.title ?? ''}
        role="alertdialog"
      >
        <p role="alert" className="mt-0 mb-5 text-[17px]">
          {shownProblem?.message}
        </p>
        <Button variant="accent" size="large" onPress={() => setProblem(null)}>
          OK
        </Button>
      </Sheet>
    </>
  )

  return { check, sheets, fail }
}

export type Guard = ReturnType<typeof useGuard>

// Logs Entries on `day`, and has every list showing the Day load it again.
export function useLog(day: string, guard: Guard) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entry: NewEntry) => api.post<{ id: string }>(`/api/calories/days/${day}/entries`, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calories'] })
    },
    onError: (error) => guard.fail(error, 'log'),
  })
}
