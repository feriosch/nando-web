---
name: pr-media
description: Screenshots and GIFs of nando-web on an iPhone 17, posted as a PR comment. Use when opening or updating a PR that changes what a screen shows, or when asked for screenshots, a GIF or a video of the app.
---

# PR media

Capture the screens a PR changes on Nando's main phone, the **iPhone 17**, against a fake API, and show them in one comment on the PR. Paths below are relative to the repo root.

## 1. Shot list

Read the PR's diff (`git diff origin/main...HEAD -- src`) and write the **shot list**: every screen whose look or behaviour changes, each state it can show (loaded, empty, busy, every error message), and every multi-step interaction worth watching as a flow. Done when every changed screen and every state the diff adds or alters is on the list. A diff that changes no screen has nothing to show: stop here and say so.

## 2. Scenario

Write the shot list as a scenario file **outside the repo** (the scratchpad, or `${TMPDIR:-/tmp}`). Format under **Scenario reference** below. Give each API call the screens make (`api.get` / `api.post` in the diff) a realistic answer, named in the Glossary's terms.

## 3. Capture

```sh
bun install    # only if node_modules is missing
node .claude/skills/pr-media/capture.mjs <scenario.mjs> <out-dir>
```

It starts its own Vite on port 5199 and writes `<name>.png` / `<name>.gif` to `<out-dir>`. `fake API: no answer for …` names a call the scenario still has to answer; `✗ <name>` is a shot that threw. Open every PNG, and every GIF's frames, and check each shows the state its name says. Done when every item on the shot list has a file that shows it; until then, fix the scenario and capture again.

## 4. Before (PRs that change existing screens)

Capture the same scenario on the base branch so the comment shows Before and After side by side. Skip this when the PR only adds screens.

```sh
base="${TMPDIR:-/tmp}/pr-media-base"
git fetch origin main
git worktree add --detach "$base" origin/main
ln -s "$PWD/node_modules" "$base/node_modules"   # if bun.lock differs, `bun install` there instead
node .claude/skills/pr-media/capture.mjs <scenario.mjs> <base-out-dir> --root "$base"
git worktree remove --force "$base"
```

Shots of screens the base doesn't have yet fail with `✗` and show as _new_. That is expected.

## 5. Publish

```sh
node .claude/skills/pr-media/publish.mjs <pr-number> <out-dir> [--before <base-out-dir>] [--trailer "<Key: value>"]...
```

It commits the files to `pr-<n>/` on the **`pr-media`** branch, the one branch besides the PR's own that this skill pushes to. It is never merged. The script prints the comment body. Pass the session's commit attribution lines as `--trailer`s.

Post the body as a comment on the PR. If the PR already has a comment starting with `<!-- pr-media -->`, edit that comment instead, so the PR keeps one media comment. With `gh`: find it with `gh api repos/{owner}/{repo}/issues/<n>/comments --jq '.[] | select(.body | startswith("<!-- pr-media -->")) | .id'`, then `gh api -X PATCH repos/{owner}/{repo}/issues/comments/<id> -F body=@<file>`, or if there is none, `gh pr comment <n> --body-file <file>`. With the GitHub MCP tools: `pull_request_read` (`get_comments`) to find it, then `update_issue_comment` or `add_issue_comment`. Add the footer your session requires on GitHub posts.

## Scenario reference

```js
// scenario.mjs
// Extra fake API answers, keyed "METHOD /path": { status?, body? }, or a function of the
// Playwright Request returning one. Status defaults to 200 with a body, 204 without.
export const api = {
  'GET /api/calories/today': { body: { eaten: 1450, goal: 2200 } },
}

export default async function ({ shot, flow }) {
  // shot(name, run, { fullPage? }): a fresh page; `run` gets it there, then a PNG is taken.
  await shot('home', (page) => page.goto('/'))
  await shot('sign-in-cancelled', async (page, { passkeys }) => {
    await page.goto('/sign-in')
    await passkeys.refuse()
    await page.getByRole('button', { name: 'Sign in with Face ID' }).click()
    await page.getByRole('alert').waitFor()
  })
  // flow(name, run, { start }): opens `start`, records `run` as a GIF, holds the end state.
  await flow('enroll', async (page) => {
    await page.getByLabel('Enrollment Code').pressSequentially('abcd-1234', { delay: 80 })
    await page.getByRole('button', { name: 'Create Passkey' }).click()
    await page.waitForURL('/')
  }, { start: '/enroll' })
}
```

- Each shot and flow gets a fresh browser context: no cookies, nothing left over from the one before.
- One answer for a single shot: `await page.route('**/auth/register/begin', (route) => route.fulfill({ status: 401 }))` before the action.
- `/auth/register/*` and `/auth/signin/*` already have answers that succeed. Override them in `api` for failures.
- Wait for the state being shown (`getByRole(...).waitFor()`, `waitForURL`) before `run` returns. The page is only shot once it's idle.

## The device

- Playwright's `iPhone 17` preset (402×874 pt, @3x, touch, iOS Safari user agent), rendered by Chromium. The viewport is the whole screen because Nando runs as a Home Screen PWA, and the safe area is 62 pt at the top and 34 pt at the bottom.
- The device's Passkeys are a virtual Face ID that always succeeds and already holds one Passkey for Nando. In a scenario, `passkeys.refuse()` makes the next ceremony fail as a cancelled Face ID (`NotAllowedError`); `passkeys.forget()` removes the Passkey.
- The API is faked on the app's own origin (`VITE_API_BASE_URL`), so nando-server isn't needed.

## Running it locally

Cloud sessions have Chromium, Playwright and `ffmpeg` already. On your own machine, `capture.mjs` loads `playwright` from the repo or from `NODE_PATH`, so install it globally with `npm i -g playwright && npx playwright install chromium`, set `NODE_PATH` to the global `node_modules`, and install `ffmpeg`.
