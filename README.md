# nando-web

Web app for Nando: Bun, Vite, React, TypeScript, React Router and TanStack Query, served as a static build by nginx. Styled with Tailwind CSS v4 (`@tailwindcss/vite`), React Aria Components for interactive parts, `lucide-react` icons, and Zen Maru Gothic and Zen Kaku Gothic New self-hosted with Fontsource; body text is the system font, Japanese-ready. How screens are built: the `nando-design` skill (`.claude/skills/nando-design/`). Domain language: [`nando-server/GLOSSARY.md`](https://github.com/feriosch/nando-server/blob/main/GLOSSARY.md). Decisions: [`nando-server/docs/adr/`](https://github.com/feriosch/nando-server/tree/main/docs/adr).

## Layout

- `src/core`: Core.
  - `module.ts`: the types Core and Modules use to add to the shell: a **Home Card**, a **Settings Section**, and a `Module` (its name and `path` for its tab, its `theme` and `icon`, its own `routes`, plus its Home Cards and Settings Sections).
  - `shell/`: the bottom **tab bar** (Home, one tab per Module in `registry.ts` order, Settings; with more than 3 Modules the 4th tab is **More**, listing the rest at `/more`), **Home** (today's date in the Owner Time Zone, then every Home Card, Core's first, each drawing its own card in its contributor's theme) and the single **Settings** screen (every Settings Section, Core's first; a Module's section is tinted with its Module's theme: its header in the Module's accent after its icon, its grouped lists on the Module's surface with a hairline border; the app's version closes the screen). Each screen and the tab bar take the theme of the screen on view: its Module's, or Core's Paper. `createRoutes(registry)` builds all routes. `<LoadProblem>` is what a screen or card shows when it couldn't load: a message and "Try again". As on an iPhone, a newly opened screen (from a link or the tab bar) starts at its top, and going back returns to where it was scrolled: React Router's `<ScrollRestoration />`, in the shell. A back link to the screen this one was opened from goes back through history, as the back gesture does, so it too returns to where that screen was (`useOpenedFrom`, `ui/cameFrom.ts`); to any other screen, it opens that screen afresh.
  - `ui/`: the shared building blocks every screen is made of: the large-title `ScreenHeader` (with an optional line over the title, such as a Word's reading), `SectionHeader` (an `h3` for a group within a Settings Section), `GroupedList` and `ListRow`, the bottom `Sheet`, `Button`, `Switch`, `SegmentedControl`, `Picker` and `PickerRow` (a value that opens the native picker when tapped), `saveFooter` (a form's saved message or problem under its list) and `Icon`.
  - `appearance/`: **Appearance** (System · Light · Dark, first in Settings → General), kept in this device's `localStorage` and applied to the whole page at once; System follows the device as it changes. A script in `index.html` applies it before first paint, so the screen never flashes the wrong colours.
  - `api/`: the API client. Every request is sent with `credentials: "include"` so the session cookie goes along; `get`, `post`, `put` and `delete` send and read JSON; `file` GETs a file as a `File` named from its `Content-Disposition`; a non-2xx response throws `ApiError` with its `status` and the server's plain-text message as `detail`. A `401` from any `/api/` route is also reported to `onUnauthorized` listeners, and the shell answers it by going to sign-in. `useLoadedSinceMount(query)` says whether a query has loaded since the screen opened, so a form starts from what the server has now, not a cached copy.
  - `identity/`: sign-in. `/sign-in` has the "Sign in with Face ID" button, and `/enroll` registers a new Passkey with an Enrollment Code from `nando-server enroll`. Either one starts a Session and opens Home. WebAuthn only ever starts from a tap. `passkeys.ts` wraps `navigator.credentials`.
  - `services.ts`: `useApi()`, `usePasskeys()`, `usePush()`, `useShare()` and `useLeave()`, which every screen, Core's and every Module's, uses to reach the API, the device's Passkeys, its Notification permission and Push Subscription, its share sheet (`share/share.ts`: files to the share sheet, or to the downloads where it takes none), and other sites (`leave.ts`: leaves Nando for a URL, such as back to a Connector). `<CoreProvider>` provides them, so tests can pass fakes.
  - `body/`: the **Body Home Card** (latest Weigh-in, BMI, change since the week before; the whole card opens Weigh-ins) and the **Weigh-ins** screen at `/weigh-ins`, opened from that card: log or change this week's and last week's Weigh-in, in the Owner Time Zone (checked again every minute, on coming back to the app and on Save, so a Save never lands in the wrong week), and see every Weigh-in. Core has no tab of its own for it.
  - `settings/`: Core's Settings Section ("General"): the Owner Time Zone, height, and the Weigh-in reminder, a switch with its weekday and time (on the hour or half hour) shown while it is on.
  - `notifications/`: Core's **Notifications** Settings Section: says whether this device gets Notifications and has the "Enable Notifications" button, which asks for the permission (only ever from a tap), subscribes with Core's VAPID public key and registers the Push Subscription with Core. A device that is already subscribed registers its Push Subscription again whenever the section opens, since Core deletes one a push service stopped knowing. `push.ts` wraps `Notification` and `pushManager`.
  - `days.ts` and `now.ts`: Days (YYYY-MM-DD in the Owner Time Zone) and `useNow()`, the time re-read every minute and on coming back to the app (the Day view and the Weigh-ins screen use it). `today.ts`: `useToday()`, today in the Owner Time Zone from the settings and `useNow()` (Home, the Body Home Card, the Day view, History and the Calories Home Card use it).
  - `connectors/`: **Connectors** ([ADR 0004](https://github.com/feriosch/nando-server/blob/main/docs/adr/0004-connectors-over-oauth.md)). The **consent page** at `/connect?request=<id>`, where the server's OAuth authorize sends the browser when the Owner adds Nando as a connector in an app such as Claude. Like `/sign-in` it has no tab bar, and it needs no Session, since on the iPhone it usually opens in a browser rather than the Home Screen app. It says who asks and what they get ("**Claude** wants to use Nando. It will be able to search, add and change your Words, and use every other Tool Nando offers.") and the host it returns to. **Allow with Face ID** approves the request with a Passkey, starting WebAuthn only from the tap, and leaves for the URL the server returns, back to the app; **Don't allow** leaves for the server's deny URL. A cancelled Face ID or a refused Passkey stays on the page with the reason and both buttons; an unknown or expired request says so with no buttons. The **Connectors** Settings Section, after Notifications, lists each Connector with when it was approved and last used, in the Owner Time Zone ("Last used today", "Never used"); **Remove** asks first ("Claude will lose access to Nando until you connect it again."), then deletes it. With none, it says how to add one: a custom connector in the Claude app with the API's `/mcp` address.
  - `core.ts`: Core's own Home Cards and Settings Sections.
  - `version.ts`: the version at the foot of Settings (see **Version** under Deploy).
  - `sw/`: what the service worker does with Notifications (see **PWA** below).
- `src/index.css`: Tailwind, the themes (Paper for Core, Kitchen wood for Calories, Ai-zome for Japanese) as CSS variables for light and dark, plain defaults for screens not restyled yet, and the View Transitions slide. Motion is off under `prefers-reduced-motion`.
- `src/modules/<module>`: one Module each (`calories`, `japanese`), exporting its `Module`.
  - `calories/`: the **Day view** at `/calories` (today in the Owner Time Zone, moving on at midnight like the Weigh-ins screen; `?day=YYYY-MM-DD` for another Day, and a date picker within the Editable Window). It shows the Day's Entries, Consumed Calories, Daily Limit and what's left; a Day outside the Editable Window is read-only. On an editable Day, the quick list logs a Meal in one tap with the Servings on its stepper, "Something else" logs a one-off Entry (optionally saving it as a Meal), and each Entry can be changed or deleted. Every log or change first asks the server's preview, and only if it would take the Day over the Daily Limit does it ask ("This takes you to 2,300 / 2,150 kcal.") before going ahead. That question, and why a log or change failed, show in a sheet at the bottom of the screen, and a second tap while a log is under way does nothing. **Meals** at `/calories/meals`: the Meals in use with their photo, store and Meal Tags, and the archived ones to restore; `/calories/meals/new` and `/calories/meals/<id>` create and change one (name, kcal, store, emoji, Meal Tags, pinned), archive or restore it. A Meal's photo (`imageUrl`) is set by hand on the server and kept as it is. **History** at `/calories/history`, opened from the Day view: today and the 29 Days before it, newest first, each with its Consumed Calories against the Daily Limit that Day had (an Unlogged Day says "not logged", never 0 kcal), and "Show older" adds the 30 Days before; each Day opens in the Day view. The **Calories Home Card** shows today's Consumed Calories against the Daily Limit and opens the Day view. The **Calories Settings Section** sets the Daily Limit, which applies from today, and, saved separately, the nothing-logged reminder and the evening summary: each switched on or off, at a time on the hour or half hour.
  - `japanese/`: the Owner's Words and Kanji, read-only (Claude adds and improves them through the Module's Tools). It has a tab and no Home Card, and its theme is **Ai-zome**: washi paper in indigo ink, with Calories' Zen Maru Gothic for display text and Zen Kaku Gothic New for Japanese display text. **Search** at `/japanese`: one search field, focused, that takes kanji, kana or Spanish (no romaji) and searches as the typing pauses; the Words found come first, each with its spelling, reading, Spanish meaning and Group (Basic, JLPT N3, N2 and N1 in green, blue, purple and red, easiest to hardest), then the Kanji, each with its character and meaning. An empty field shows a hint of what can be searched, and a search that finds nothing says so. The **Word page** at `/japanese/words/<id>`: its reading over its spelling, its Spanish meaning, Word Tags written for display (`usually_kana` as "usually kana"), type, Group with its picture, notes and example sentences; its Word Links by kind (Synonyms, Antonyms, Related), each with the other Word, this side's note and Nuance Tags, opening the other Word; its Hints as plain text; and the Kanji in its spelling, each opening its Kanji page. The **Kanji page** at `/japanese/kanji/<id>`: the character, large, its Spanish meaning, on and kun readings, Heisig numbers and story; its Components, where a stored Kanji opens its page and an irregular shape is shown by its keyword; and the Words spelled with it, each opening its Word page. The **Japanese Settings Section** has an **Anki** group with one row, **Export JLPT deck**: it fetches the JLPT deck (`GET /api/japanese/anki/jlpt.csv`, named from its `Content-Disposition`, such as `jlpt-2026-11-11.csv`) and hands it to the share sheet, for AnkiMobile, whose import screen comes up with the note type and deck set from the file's header; a device with no share sheet for files (a desktop) downloads it instead. The row says "Preparing…" while the deck is fetched, and a second tap does nothing. Safari opens the share sheet only within a tap, so if the fetch took too long for that, the row turns into "Share jlpt-….csv" for a second tap. Closing the share sheet is not a problem; a failed fetch says why under the list, with "Try again". Under the row: "In AnkiMobile, set Existing notes to Update.", so re-importing updates notes by their Id instead of adding them again.
- `src/sw.ts`: the service worker's entry point.
- `src/registry.ts`: the only file that lists every Module. Core never imports a Module, and a Module imports only Core, never another Module.

UI strings are English only and kept simple so i18n can be layered on later.

## Run locally

Requires Bun. Start [`nando-server`](https://github.com/feriosch/nando-server) with `ALLOWED_ORIGINS=http://localhost:5173`, then:

```sh
bun install
bun run dev        # http://localhost:5173
```

| Env var             | Meaning |
| ------------------- | --- |
| `VITE_API_BASE_URL` | API origin, baked in at build time (default `http://localhost:8080` for `bun run dev`; required when building the image) |

## Test

```sh
bun run test       # Vitest + Testing Library
bun run e2e        # Playwright: the app in Chromium on an iPhone 17, against a fake API
bun run typecheck
bun run lint
```

`e2e/` is for what only a real browser shows, such as where a sheet lands when the keyboard is up; it starts its own Vite. The first time, run `bunx playwright install chromium`.

Every pull request runs these (with the Dockerfile's Bun and Node 22), and builds the container image (`.github/workflows/pr.yml`).

## PWA

Nando is installed from Safari's Share → Add to Home Screen and opens standalone. `vite-plugin-pwa` builds `manifest.webmanifest` and `sw.js` from `src/sw.ts`, and the iOS tags are in `index.html`.

- **Offline shell**: the build is precached and every navigation is answered with `index.html`, so the app opens without a connection. Font files are kept the first time a screen uses them (Zen Maru Gothic comes in many small unicode-range files, too many to precache). API calls are never cached; logging needs a connection.
- **Notifications**: enabled per device from Settings → Notifications. On iPhone only Nando added to the Home Screen can get them, so in Safari the section says to add it first. Each push message Core sends carries one Notification as JSON `{ "title", "body", "url" }`, where `url` is a path in the app such as `/calories` (default `/`). Tapping the Notification focuses an open Nando window and goes to `url`, or opens a new one there. A push message that can't be read still shows a plain "Nando" Notification, because Safari revokes a Push Subscription whose push message shows nothing.
- **Icons**: `public/icon.svg` is the source: full-bleed (iOS rounds the corners) with its content inside the maskable safe zone. After changing it, run `bun run icons` to regenerate the PNGs and `favicon.ico` in `public/`, and commit them. The manifest's `theme_color` is Paper's accent `#8E4A49` and its `background_color` Paper's light background `#F6F4EF`.

## Container image

```sh
docker build --build-arg VITE_API_BASE_URL=https://api.<domain> -t nando-web .
docker run -p 8080:8080 nando-web
```

nginx listens on `PORT` (default `8080`; Cloud Run sets it). Unknown paths fall back to `index.html` so client-side routes work. `index.html`, `sw.js` and `manifest.webmanifest` are sent with `Cache-Control: no-cache`, and hashed files under `/assets/` are cached for a year.

## Deploy

Every push to `main` deploys to the `nando-web` Cloud Run service (`.github/workflows/deploy.yml`; also runnable by hand from the Actions tab). It signs in through Workload Identity Federation, builds the image with `VITE_API_BASE_URL=https://api.nanders.app` and `VITE_APP_BUILD` set to main's commit count, pushes it to Artifact Registry tagged with the commit, deploys it, and ends by checking that `https://web.nanders.app/` serves this build's `index.html`. Project, region, registry and deploy service account come from the repo variables `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_AR_REPO`, `GCP_WIF_PROVIDER` and `GCP_DEPLOY_SA`.

If the new revision doesn't start, the deploy fails and traffic stays on the previous revision.

### Version

The foot of Settings shows the version, such as `Version 0.1.0 (45)`: `version` in `package.json`, then the build number, the number of commits on main when it was deployed. Every merge to main deploys, so the build number goes up by itself; bump `version` by hand for a release worth naming. Local and PR builds have no build number and show the version alone.

## APIs

What the server offers each area of the app:

- Core: [`nando-server/internal/core/API.md`](https://github.com/feriosch/nando-server/blob/main/internal/core/API.md)
- Calories: [`nando-server/internal/calories/API.md`](https://github.com/feriosch/nando-server/blob/main/internal/calories/API.md)
- Japanese: [`nando-server/internal/japanese/API.md`](https://github.com/feriosch/nando-server/blob/main/internal/japanese/API.md)
