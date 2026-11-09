import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { lucideProps } from './icons'

// A Home Card's frame: 22px corners, 18px padding, dimmed while its `CardLink` is pressed. Add the
// card's own colours (`bg-surface`, or a Module's own, such as the walnut board).
export const cardClasses = 'relative rounded-[22px] p-[18px] transition-opacity has-[[data-card-link]:active]:opacity-70'

// The row at the top of a Home Card, in the secondary colour: the card's icon, its title as an `h2`,
// and a chevron when the whole card opens a screen.
export function CardHeader({ icon, chevron = true, children }: { icon: ReactNode; chevron?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sub">
      {icon}
      <h2 className="my-0 text-[15px] font-semibold text-sub">{children}</h2>
      {chevron && <ChevronRight {...lucideProps} className="ml-auto" />}
    </div>
  )
}

// A link stretched over the whole card, so a tap anywhere on it opens `to`. Whatever else in the card
// must stay tappable sits above it (`relative z-10`).
export function CardLink({ to, className = '', children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      viewTransition
      data-card-link
      className={`outline-none after:absolute after:inset-0 after:rounded-[22px] focus-visible:after:outline-2 focus-visible:after:outline-accent ${className}`}
    >
      {children}
    </Link>
  )
}
