import { core } from './core/core'
import type { Registry } from './core/module'
import { calories } from './modules/calories'
import { career } from './modules/career'
import { japanese } from './modules/japanese'
import { money } from './modules/money'
import { travel } from './modules/travel'

// The only place that knows every Module: Core never imports a Module, and Modules never import each other.
export const registry: Registry = {
  core,
  modules: [calories, japanese, career, travel, money],
}
