import { House, LayoutGrid, Settings } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Link, useLocation } from 'react-router'
import { lucideProps } from '../ui/icons'
import type { Module } from '../module'
import { isWithin } from './tabs'

type Tab = { to: string; label: string; icon: ComponentType<{ className?: string }>; current: boolean }

const HomeIcon = (props: { className?: string }) => <House {...lucideProps} {...props} />
const ModulesIcon = (props: { className?: string }) => <LayoutGrid {...lucideProps} {...props} />
const SettingsIcon = (props: { className?: string }) => <Settings {...lucideProps} {...props} />

// The tabs along the bottom of the screen: Home, Modules and Settings, whatever the number of Modules.
// It sits in the theme of the screen on view: translucent surface, a hairline on top, the accent on the
// current tab.
export function TabBar({ modules }: { modules: Module[] }) {
  const { pathname, search } = useLocation()
  const onModuleScreen = modules.some((module) => isWithin(pathname, module.path))
  const onModules = isWithin(pathname, '/modules') || onModuleScreen

  // As iOS tabs do, Modules remembers where the Owner was under it: away from it, it returns to the
  // last Module screen open (or the Modules screen); on a Module's screen, it opens the Modules screen.
  const [lastUnderModules, setLastUnderModules] = useState('/modules')
  const here = onModuleScreen ? `${pathname}${search}` : onModules ? '/modules' : null
  if (here && here !== lastUnderModules) setLastUnderModules(here)

  const others: Tab[] = [
    { to: onModules ? '/modules' : lastUnderModules, label: 'Modules', icon: ModulesIcon, current: onModules },
    { to: '/settings', label: 'Settings', icon: SettingsIcon, current: isWithin(pathname, '/settings') },
  ]
  // Home is current on Home and on every screen no other tab claims.
  const tabs: Tab[] = [{ to: '/', label: 'Home', icon: HomeIcon, current: !others.some((tab) => tab.current) }, ...others]

  return (
    <nav
      aria-label="Tabs"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t-[0.5px] border-line bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 [view-transition-name:tab-bar]"
    >
      {tabs.map(({ to, label, icon: TabIcon, current }) => (
        <Link
          key={to}
          to={to}
          viewTransition
          aria-current={current ? 'page' : undefined}
          className={`flex min-h-[50px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10px] font-medium no-underline ${current ? 'text-accent' : 'text-sub'}`}
        >
          <TabIcon />
          {label}
        </Link>
      ))}
    </nav>
  )
}
