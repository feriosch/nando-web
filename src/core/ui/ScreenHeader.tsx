import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { lucideProps } from './icons'

// The large-title header at the top of a screen: a 44px top bar (a back link on the left, text
// buttons on the right), then the title in the theme's display font and an optional line under it.
export function ScreenHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: { to: string; label: string }
  actions?: ReactNode
}) {
  return (
    <header className="pb-2">
      <div className="flex h-11 items-center justify-between gap-2">
        {back ? (
          <Link
            to={back.to}
            viewTransition
            className="-ml-2 flex min-h-11 items-center pr-2 text-[17px] text-accent no-underline"
          >
            <ChevronLeft {...lucideProps} />
            {back.label}
          </Link>
        ) : (
          <span />
        )}
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      <h1 className="my-0 font-display text-[34px] leading-[1.15] font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 mb-0 text-[15px] text-sub">{subtitle}</p>}
    </header>
  )
}
