import { core } from './core/core'
import type { Registry } from './core/module'
import { calories } from './modules/calories'

// The only place that knows every Module: Core never imports a Module, and Modules never import each other.
export const registry: Registry = {
  core,
  modules: [calories],
}
