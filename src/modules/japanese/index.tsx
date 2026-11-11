import type { Module } from '../../core/module'
import { BrushIcon } from './icon'
import { KanjiPage } from './KanjiPage'
import { Search } from './Search'
import { WordPage } from './WordPage'

export const japanese: Module = {
  id: 'japanese',
  name: 'Japanese',
  path: '/japanese',
  // Washi and indigo (src/index.css).
  theme: 'theme-japanese',
  icon: BrushIcon,
  routes: [
    { index: true, element: <Search /> },
    { path: 'words/:id', element: <WordPage /> },
    { path: 'kanji/:id', element: <KanjiPage /> },
  ],
  homeCards: [],
  settingsSections: [],
}
