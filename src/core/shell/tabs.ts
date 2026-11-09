import type { Module } from '../module'

// At most 5 tabs: Home, Modules, Settings. With more than 3 Modules, the 4th slot is More, which lists the rest.
const maxModuleTabs = 3

export function splitTabs(modules: Module[]): { tabbed: Module[]; more: Module[] } {
  if (modules.length <= maxModuleTabs) return { tabbed: modules, more: [] }
  return { tabbed: modules.slice(0, maxModuleTabs - 1), more: modules.slice(maxModuleTabs - 1) }
}

// Whether `pathname` is `path` or one of the screens under it.
export function isWithin(pathname: string, path: string) {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}
