import type { ReactNode } from 'react'

// A note about the whole screen, in a rounded box on the fill colour, such as why a form is
// read-only or why nothing was saved. `role="alert"` for one that says what went wrong.
export function Notice({ role, children }: { role?: 'alert'; children: ReactNode }) {
  return (
    <p role={role} className="my-2 rounded-[14px] bg-fill px-4 py-3 text-[15px]">
      {children}
    </p>
  )
}

// What a screen or section shows in place of an empty list, or of something that isn't there,
// such as "No Weigh-ins yet.", in the secondary colour.
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="mx-4 my-2 text-[15px] text-sub">{children}</p>
}
