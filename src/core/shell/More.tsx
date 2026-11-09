import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { Module } from '../module'
import { lucideProps } from '../ui/icons'
import { GroupedList } from '../ui/List'
import { ScreenHeader } from '../ui/ScreenHeader'

// The Modules that don't fit in the tab bar.
export function More({ modules }: { modules: Module[] }) {
  return (
    <>
      <ScreenHeader title="More" />
      <GroupedList>
        {modules.map(({ id, path, name, theme, icon: ModuleIcon }) => (
          <Link
            key={id}
            to={path}
            viewTransition
            className="flex min-h-[52px] items-center gap-3 px-4 text-[17px] text-ink no-underline"
          >
            <span className={`${theme} text-accent`}>
              <ModuleIcon />
            </span>
            <span className="flex-1">{name}</span>
            <ChevronRight {...lucideProps} className="text-sub" />
          </Link>
        ))}
      </GroupedList>
    </>
  )
}
