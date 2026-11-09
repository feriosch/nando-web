import type { ReactNode } from 'react'

// A 24px line icon in the lucide style (stroke 1.8, round caps), for a Module's own icon:
// `<Icon className={className}><path d="…" /></Icon>`. Decorative: the label next to it names it.
export function Icon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}
