# nando-web

Web app for Nando: Bun, Vite, React, TypeScript, React Router and TanStack Query, served as a static build by nginx. Domain language: [`nando-server/GLOSSARY.md`](https://github.com/feriosch/nando-server/blob/main/GLOSSARY.md). Decisions: [`nando-server/docs/adr/`](https://github.com/feriosch/nando-server/tree/main/docs/adr).

## Layout

- `src/core`: Core.
  - `module.ts`: the types Core and Modules use to add to the shell: a **Home Card**, a **Settings Section**, and a `Module` (its name and `path` for the menu, its own `routes`, plus its Home Cards and Settings Sections).
  - `shell/`: the hamburger menu listing Modules, **Home** (every Home Card, Core's first) and the single **Settings** screen (every Settings Section, Core's first). `createRoutes(registry)` builds all routes.
  - `api/`: the API client. Every request is sent with `credentials: "include"` so the session cookie goes along; a non-2xx response throws `ApiError` with its `status`.
  - `core.ts`: Core's own Home Cards and Settings Sections.
- `src/modules/<module>`: one Module each (`calories`), exporting its `Module`.
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
bun run typecheck
bun run lint
```

## Container image

```sh
docker build --build-arg VITE_API_BASE_URL=https://api.<domain> -t nando-web .
docker run -p 8080:8080 nando-web
```

nginx listens on `PORT` (default `8080`; Cloud Run sets it). Unknown paths fall back to `index.html` so client-side routes work. `index.html`, `sw.js` and `manifest.webmanifest` are sent with `Cache-Control: no-cache`, and hashed files under `/assets/` are cached for a year.

## APIs

What the server offers each area of the app:

- Core: [`nando-server/internal/core/API.md`](https://github.com/feriosch/nando-server/blob/main/internal/core/API.md)
- Calories: [`nando-server/internal/calories/API.md`](https://github.com/feriosch/nando-server/blob/main/internal/calories/API.md)
