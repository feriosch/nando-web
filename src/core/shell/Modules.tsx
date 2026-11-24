import { Link } from 'react-router'
import type { Module } from '../module'
import { ScreenHeader } from '../ui/ScreenHeader'

// Every Module, in `registry.ts` order, as a grid of tiles: each in its Module's own theme, with its
// icon and name. A tile opens its Module.
export function Modules({ modules }: { modules: Module[] }) {
  return (
    <>
      <ScreenHeader title="Modules" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        {modules.map(({ id, path, name, theme, icon: ModuleIcon }) => (
          <Link
            key={id}
            to={path}
            viewTransition
            className={`${theme} flex min-h-[112px] flex-col justify-between rounded-[22px] bg-surface p-[18px] no-underline outline-none transition-opacity focus-visible:outline-2 focus-visible:outline-accent active:opacity-70`}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-fill text-accent">
              <ModuleIcon />
            </span>
            <span className="font-display text-[17px] font-semibold text-ink">{name}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
