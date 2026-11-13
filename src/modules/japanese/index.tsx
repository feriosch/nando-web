import type { Module } from '../../core/module'
import { Draw } from './Draw'
import { BrushIcon } from './icon'
import { KanjiPage } from './KanjiPage'
import { Search } from './Search'
import { JapaneseSettingsSection } from './SettingsSection'
import { liteRtRecognizer } from './liteRtRecognizer'
import type { Recognizer } from './recognizer'
import { WordPage } from './WordPage'

// The Japanese Module, reading Drawings with `recognizer`: the kanji model in the app, a fake in tests.
export function createJapanese({ recognizer }: { recognizer: Recognizer }): Module {
  return {
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
      { path: 'draw', element: <Draw recognizer={recognizer} /> },
    ],
    homeCards: [],
    settingsSections: [{ id: 'japanese', title: 'Japanese', Component: JapaneseSettingsSection }],
  }
}

export const japanese = createJapanese({ recognizer: liteRtRecognizer })
