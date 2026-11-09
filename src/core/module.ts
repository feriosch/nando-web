import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'

// A small summary shown on Home.
export type HomeCard = {
  id: string
  Component: ComponentType
}

// One part of the single Settings screen.
export type SettingsSection = {
  id: string
  title: string
  Component: ComponentType
}

// What Core or a Module adds to Home and Settings.
export type Contributions = {
  homeCards: HomeCard[]
  settingsSections: SettingsSection[]
}

// A 24px line icon, drawn like the lucide icons (stroke 1.8): see `Icon` in core/ui.
export type ModuleIcon = ComponentType<{ className?: string }>

// A Module also gets its own screens under `path` and a tab (or a row under More). It brings its own
// theme, the class that sets its palette and display font (see src/index.css), and its own icon.
// The shell applies both to the Module's screens, its tab and its Home Cards.
export type Module = Contributions & {
  id: string
  name: string
  path: string
  theme: string
  icon: ModuleIcon
  routes: RouteObject[]
}

export type Registry = {
  core: Contributions
  modules: Module[]
}
