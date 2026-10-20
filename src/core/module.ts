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

// A Module also gets its own screens under `path` and an entry in the menu.
export type Module = Contributions & {
  id: string
  name: string
  path: string
  routes: RouteObject[]
}

export type Registry = {
  core: Contributions
  modules: Module[]
}
