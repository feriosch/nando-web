import type { ReactNode } from 'react'

// A grouped list's footer for a form that saves: what was saved (`saved`, a status) or why not
// (`problem`, an alert). Nothing when there is neither.
export function saveFooter(saved: string | false, problem: string | null): ReactNode {
  if (!saved && !problem) return null
  return (
    <>
      {saved && (
        <p role="status" className="my-0">
          {saved}
        </p>
      )}
      {problem && (
        <p role="alert" className="my-0 text-ink">
          {problem}
        </p>
      )}
    </>
  )
}
