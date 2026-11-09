---
name: nando-design
description: How Nando's screens are built and styled: themes and tokens, the shell's building blocks, React Aria with Tailwind, motion, Japanese text. Use when building or restyling a screen, Home Card, Settings Section or sheet, or adding a Module.
---

# Nando design

Nando looks like an iPhone app: large titles, grouped inset lists, a bottom tab bar, bottom sheets. Paths are relative to the repo root.

## Building a screen

1. **Theme.** The screen sits in its theme already: the shell puts Core's screens in `theme-paper` and a Module's screens, tab and Home Cards in that Module's `theme`. Colour everything with the token utilities below and nothing else.
2. **Compose** from the building blocks. A screen is a `ScreenHeader`, then `SectionHeader` + `GroupedList` pairs, then actions as `Button`s; choices in a sheet are a `Sheet`. Reach for an ad-hoc style only for what the blocks don't cover, and when two screens need the same thing, make it a block in `src/core/ui/`.
3. **Check** every screen you touched with the `pr-media` skill at 402×874 (iPhone 17), in light **and** dark: for dark, start the shot with `await page.emulateMedia({ colorScheme: 'dark' })`. Done when every changed screen, in every state, has a light and a dark shot that you have opened and that reads well: text legible on its background, nothing under the tab bar or the status bar.

## Themes and tokens

A **theme** is a palette plus a display font, applied by a class on a container and switched for dark by the `dark` class that Appearance (see the glossary) puts on `<html>`. The values live in `src/index.css`, the single source of truth; this is what each token is for:

| Token | Tailwind | Use |
| --- | --- | --- |
| bg | `bg-bg` | screen background |
| surface | `bg-surface` | lists, cards, sheets, the tab bar (at 80%) |
| ink | `text-ink` | main text |
| sub | `text-sub` | secondary text, section headers, footers |
| line | `border-line`, `divide-line` | hairline separators (0.5px) |
| fill | `bg-fill` | tiles, steppers, quiet buttons, segmented-control track |
| accent | `bg-accent`, `text-accent` | the main action, links, the current tab |
| accent-ink | `text-accent-ink` | text on accent |
| display font | `font-display` | large titles and other display text |

Calories adds `board`, `board-ink`, `board-sub`, `board-track` (the summary card), `bar-fill` and `warn-bar` (over the Daily Limit). Body text is always `font-sans`, the system font.

Themes today: **Paper** (`theme-paper`, Core) and **Kitchen wood** (`theme-calories`, Zen Maru Gothic display font).

## A Module's theme and icon

Every Module brings its own theme. Its `Module` object (`src/core/module.ts`) declares:

- `theme`: its class, defined in `src/index.css` with the same token names for light and under `.dark` for dark. Fonts come from Fontsource, imported in `src/main.tsx`; the service worker keeps font files for offline.
- `icon`: one custom 24px icon in the lucide style, drawn with `Icon` from `src/core/ui/Icon.tsx` (stroke 1.8, round caps). Calories' bowl is `src/modules/calories/icon.tsx`.

Core never names a Module's theme; the shell reads it from the `Module`. On the Settings screen, a Module's Settings Section takes its theme as a **tint**: its header in the Module's accent after its icon, and its `GroupedList`s on the Module's surface with a hairline border (they draw it inside any `data-tint` ancestor). The screen around it stays Paper. Planned palettes for future Modules, as references only: **Slate** and **Washi & sumi**.

## Building blocks

All in `src/core/ui/`:

- `ScreenHeader`: 44px top bar (`back` link or a `leading` text button on the left, `actions` text buttons on the right), 34px bold display-font title, optional `subtitle`. `HeaderLink` is a top-bar text button that opens another screen.
- `SectionHeader`: 13px uppercase in `sub`; an `h2`. `tone="accent"` and an `icon` for a Module's Settings Section.
- `GroupedList` + `ListRow`: surface, 14px corners, 0.5px separators, rows at least 52px, optional `footer`. The 16px side margins are the screen's own padding (the shell's `<main>`). Inside a `Sheet`, which is on the surface itself, its rows are on `bg`.
- `Sheet`: React Aria `Modal` sliding up over a scrim, 22px top corners, grab handle, `title` as its heading. `role="alertdialog"` for one that asks before going on or says what went wrong. A sheet opened over another stacks on top of it. `useLastShown` (`useLastShown.ts`) keeps a sheet's content while it slides away after its value is gone.
- `Button`: pill, `variant="accent"` for the one main action, `quiet` (fill) for the rest; `size="large"` is full width and 50px tall, for the action that ends a screen or sheet.
- `Switch`, `SegmentedControl` (React Aria `ToggleButtonGroup`).
- `PickerRow` (label left, value right in `sub`, the whole row opens the native picker) and `Picker` (the same, inline, named by `label`): a transparent native `<select>` over the value, so a tap opens the iPhone's wheel. Use them for any pick-one-of-many value in a row.
- `saveFooter(saved, problem)` (`saveFooter.tsx`): a form's footer, "Saved." as a status or the problem as an alert, passed as the `GroupedList`'s `footer`. Validation and save errors go under the group they belong to.
- `pillClasses` (`pill.ts`): the pill's look for the rare native `<button>` that must handle its own click, such as one asking for a permission Safari grants only within a tap's click.
- `lucideProps` (`icons.ts`): spread on every lucide icon so it is 24px, stroke 1.8, hidden from screen readers.

## React Aria and Tailwind

Interactive parts are React Aria Components (`Modal`/`Dialog`, `Switch`, `NumberField` for steppers, `ToggleButtonGroup`), styled with Tailwind utilities and their `data-[selected]`, `data-[pressed]`, `data-[entering]` states. They render native elements with native roles (a segmented control is a radio group, a switch a `role="switch"` checkbox), so tests find them with `getByRole` and `getByLabelText`; keep every control reachable that way.

- An icon-only button carries its name: `aria-label="Delete Entry"`, the icon itself `aria-hidden`.
- Touch targets are at least 44px; fields keep a 16px font so iOS doesn't zoom.
- Respect the safe areas: `env(safe-area-inset-top)` / `-bottom` on anything pinned to an edge.

## Motion

- Screen changes are View Transitions with a short slide: put `viewTransition` on every `Link` that changes screens (the tab bar, `ScreenHeader`'s back link and More already do). Where the API is missing, the change is instant.
- Sheets slide up and switches slide; keep any new motion under 300ms.
- Everything is off under `prefers-reduced-motion`: `src/index.css` zeroes animations and transitions, so new motion needs nothing extra as long as it is CSS.

## Japanese text

Put `lang="ja"` on the element holding Japanese content (a Meal's name, a store), so iOS picks Japanese glyphs. Body text stays the system font, which already covers Japanese (Hiragino); a display font is for titles only.
