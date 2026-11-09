import type { Module } from '../module'
import { isWithin } from './tabs'

// Core's theme: every screen that isn't a Module's.
export const coreTheme = 'theme-paper'

// The theme of the screen at `pathname`: its Module's, or Core's.
export function themeAt(pathname: string, modules: Module[]) {
  return modules.find((module) => isWithin(pathname, module.path))?.theme ?? coreTheme
}
