#!/usr/bin/env node
// Commits captured media to the `pr-media` branch and prints the PR comment that shows it.
//
//   node publish.mjs <pr-number> <dir> [--before <base-dir>] [--trailer "<Key: value>"]...
//
// <dir> (and <base-dir>) are capture.mjs output folders. Files land in pr-<n>/after/ and
// pr-<n>/before/, replacing that PR's earlier media. Links pin the commit, so an older comment
// keeps showing what it showed. Prints the comment body (Markdown) on stdout.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const BRANCH = 'pr-media'
const MARKER = '<!-- pr-media -->'

const args = process.argv.slice(2)
const take = (flag) => {
  const values = []
  for (let i; (i = args.indexOf(flag)) !== -1; ) values.push(args.splice(i, 2)[1])
  return values
}
const [beforeArg] = take('--before')
const trailers = take('--trailer')
const [pr, afterArg] = args
if (!/^\d+$/.test(pr ?? '') || !afterArg) {
  console.error('usage: node publish.mjs <pr-number> <dir> [--before <base-dir>] [--trailer "<Key: value>"]...')
  process.exit(2)
}

const git = (cwd, ...gitArgs) => execFileSync('git', gitArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const repo = git(process.cwd(), 'rev-parse', '--show-toplevel')
const slug = git(repo, 'remote', 'get-url', 'origin')
  .replace(/\.git$/, '')
  .split(/[/:]/)
  .slice(-2)
  .join('/')

// The files a capture produced, in the order the scenario took them.
function media(dir) {
  const manifest = path.join(dir, 'captured.json')
  if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, 'utf8'))
  return readdirSync(dir).filter((file) => /\.(png|gif)$/.test(file)).sort()
}
const afterDir = path.resolve(afterArg)
const beforeDir = beforeArg && path.resolve(beforeArg)
const after = media(afterDir)
const before = beforeDir ? media(beforeDir) : []

// ---- commit to pr-media in a throwaway worktree ----------------------------------------------
const work = mkdtempSync(path.join(tmpdir(), 'pr-media-'))
const scratchBranch = `pr-media-publish-${process.pid}`
let sha
let added = false
try {
  // Only a missing branch (ls-remote exit 2) starts a new history; any other failure stops here.
  let exists = true
  try {
    git(repo, 'ls-remote', '--exit-code', '--heads', 'origin', BRANCH)
  } catch (error) {
    if (error.status !== 2) throw error
    exists = false
  }
  if (exists) {
    git(repo, 'fetch', '--quiet', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`)
    git(repo, 'worktree', 'add', '--quiet', '--detach', work, `origin/${BRANCH}`)
    added = true
  } else {
    git(repo, 'worktree', 'add', '--quiet', '--detach', work)
    added = true
    git(work, 'switch', '--quiet', '--orphan', scratchBranch)
    writeFileSync(
      path.join(work, 'README.md'),
      '# pr-media\n\nScreenshots and GIFs shown in PR comments, posted by `.claude/skills/pr-media` on `main`. ' +
        'Not code: never merge this branch. One folder per PR (`pr-<n>/`).\n',
    )
  }

  const prDir = path.join(work, `pr-${pr}`)
  rmSync(prDir, { recursive: true, force: true })
  for (const [side, dir, files] of [
    ['after', afterDir, after],
    ['before', beforeDir, before],
  ]) {
    if (!files.length) continue
    mkdirSync(path.join(prDir, side), { recursive: true })
    for (const file of files) copyFileSync(path.join(dir, file), path.join(prDir, side, file))
  }

  git(work, 'add', '--all')
  const message = [`PR #${pr} media`, ...trailers.flatMap((trailer) => ['--trailer', trailer])]
  git(work, 'commit', '--quiet', '--allow-empty', '-m', ...message)
  git(work, 'push', '--quiet', 'origin', `HEAD:refs/heads/${BRANCH}`)
  sha = git(work, 'rev-parse', 'HEAD')
} finally {
  if (added) git(repo, 'worktree', 'remove', '--force', work)
  else rmSync(work, { recursive: true, force: true })
  try {
    git(repo, 'branch', '-D', scratchBranch)
  } catch {}
}

// ---- the comment -----------------------------------------------------------------------------
const url = (side, file) => `https://github.com/${slug}/blob/${sha}/pr-${pr}/${side}/${encodeURIComponent(file)}?raw=true`
const img = (side, file) => `<img src="${url(side, file)}" width="260">`
const label = (file) => `<b>${file.replace(/\.(png|gif)$/, '')}</b>${file.endsWith('.gif') ? ' (GIF)' : ''}`

const lines = [MARKER, '### Screenshots · iPhone 17', '']
if (before.length) {
  lines.push('<table>', '<tr><th></th><th>Before</th><th>After</th></tr>')
  for (const file of after) {
    const old = before.includes(file) ? img('before', file) : '<i>new</i>'
    lines.push(`<tr><td>${label(file)}</td><td>${old}</td><td>${img('after', file)}</td></tr>`)
  }
  lines.push('</table>')
} else {
  lines.push('<table>')
  for (let i = 0; i < after.length; i += 3) {
    const row = after.slice(i, i + 3)
    lines.push(`<tr>${row.map((file) => `<td>${label(file)}<br>${img('after', file)}</td>`).join('')}</tr>`)
  }
  lines.push('</table>')
}
const captured = git(repo, 'rev-parse', '--short', 'HEAD')
lines.push('', `<sub>Captured from ${captured} against a fake API by <code>.claude/skills/pr-media</code>.</sub>`)
console.log(lines.join('\n'))
