#!/usr/bin/env node
// Captures screenshots (PNG) and flows (GIF) of nando-web on an iPhone 17, against a fake API.
//
//   node capture.mjs <scenario.mjs> <out-dir> [--root <app-dir>]
//
// Starts Vite from <app-dir> (default: this repo) on its own port, so a running `bun run dev` is
// untouched. See SKILL.md for the scenario format.
import { execFileSync, spawn } from 'node:child_process'
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const rootFlag = args.indexOf('--root')
const root = path.resolve(
  rootFlag === -1 ? path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..') : args.splice(rootFlag, 2)[1],
)
const [scenarioPath, outArg] = args
if (!scenarioPath || !outArg) {
  console.error('usage: node capture.mjs <scenario.mjs> <out-dir> [--root <app-dir>]')
  process.exit(2)
}
const outDir = path.resolve(outArg)
mkdirSync(outDir, { recursive: true })

// The app's own Playwright if it has one, else a global install (NODE_PATH).
const { chromium, devices } = createRequire(path.join(root, 'package.json'))('playwright')

const PORT = 5199
const origin = `http://localhost:${PORT}`

// Nando's main phone. It runs as a Home Screen PWA (standalone, content under the status bar),
// so the viewport is the whole screen rather than Safari's, with the Dynamic Island's safe area.
const { defaultBrowserType: _, ...iPhone17 } = devices['iPhone 17']
const device = { ...iPhone17, viewport: iPhone17.screen }
const safeArea = { top: 62, bottom: 34, left: 0, right: 0 }

// ---- fake API ------------------------------------------------------------------------------
// The API is served from the app's own origin (VITE_API_BASE_URL), so no CORS is involved.
// Each answer is { status?, body? } or a function of the Playwright Request returning one.
const rpId = 'localhost'
const userHandle = randomBytes(16)
const challenge = () => randomBytes(32).toString('base64url')
const defaultApi = {
  'POST /auth/register/begin': () => ({
    body: {
      publicKey: {
        challenge: challenge(),
        rp: { id: rpId, name: 'Nando' },
        user: { id: userHandle.toString('base64url'), name: 'owner', displayName: 'Owner' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        timeout: 60000,
      },
    },
  }),
  'POST /auth/register/finish': { status: 204 },
  'POST /auth/signin/begin': () => ({
    body: { publicKey: { challenge: challenge(), rpId, userVerification: 'required', timeout: 60000 } },
  }),
  'POST /auth/signin/finish': { status: 204 },
}

const scenario = await import(pathToFileURL(path.resolve(scenarioPath)).href)
const api = { ...defaultApi, ...scenario.api }

async function answer(route) {
  const request = route.request()
  const key = `${request.method()} ${new URL(request.url()).pathname}`
  const spec = api[key]
  if (!spec) {
    console.error(`fake API: no answer for ${key}; add it to the scenario's \`api\``)
    return route.fulfill({ status: 501 })
  }
  const { status, body } = typeof spec === 'function' ? await spec(request) : spec
  return route.fulfill({
    status: status ?? (body === undefined ? 204 : 200),
    contentType: 'application/json',
    body: body === undefined ? '' : JSON.stringify(body),
  })
}
const isApi = (url) => url.origin === origin && /^\/(api|auth)\//.test(url.pathname)

// ---- one fresh page per shot or flow -------------------------------------------------------
async function open(browser, extra = {}) {
  const context = await browser.newContext({ ...device, baseURL: origin, serviceWorkers: 'block', ...extra })
  await context.route(isApi, answer)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: safeArea }).catch(() => {})

  // The device's Passkeys: a virtual Face ID that always succeeds, already holding one Passkey for
  // Nando so sign-in works without enrolling first.
  await cdp.send('WebAuthn.enable', { enableUI: false })
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  await cdp.send('WebAuthn.addCredential', {
    authenticatorId,
    credential: {
      credentialId: randomBytes(16).toString('base64'),
      isResidentCredential: true,
      rpId,
      privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
      userHandle: userHandle.toString('base64'),
      signCount: 0,
    },
  })
  const passkeys = {
    // The Owner cancels Face ID: the next ceremony fails with NotAllowedError.
    refuse: () => cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false }),
    // The device holds no Passkey for Nando.
    forget: () => cdp.send('WebAuthn.clearCredentials', { authenticatorId }),
  }
  return { context, page, passkeys }
}

async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

const captured = []
const failed = []

// A shot or flow that throws is reported and skipped, so the rest still run (on a base branch,
// a screen the PR adds doesn't exist yet).
async function attempt(name, work) {
  try {
    await work()
  } catch (error) {
    failed.push(name)
    const message = error instanceof Error ? error.message : String(error)
    console.error(`✗ ${name}: ${message.split('\n')[0]}`)
  }
}

const shot = (name, run, { fullPage = false } = {}) =>
  attempt(name, async () => {
    const { context, page, passkeys } = await open(browser)
    try {
      await run(page, { passkeys })
      await settle(page)
      await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage })
      captured.push(`${name}.png`)
    } finally {
      await context.close()
    }
  })

// Records `run` as a GIF. `start` is opened first and trimmed off the front, so the GIF opens on
// the app rather than a blank page.
const flow = (name, run, { start = '/' } = {}) =>
  attempt(name, async () => {
    const videoDir = mkdtempSync(path.join(tmpdir(), 'pr-media-'))
    try {
      const { context, page, passkeys } = await open(browser, {
        recordVideo: { dir: videoDir, size: device.viewport },
      })
      const opened = Date.now()
      let skip
      try {
        await page.goto(start)
        await settle(page)
        skip = (Date.now() - opened) / 1000
        await run(page, { passkeys })
        await settle(page)
        await page.waitForTimeout(1200) // hold the end state
      } finally {
        await context.close()
      }
      const webm = await page.video().path()
      const filter = 'fps=12,scale=402:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse'
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(skip), '-i', webm, '-vf', filter, path.join(outDir, `${name}.gif`)])
      captured.push(`${name}.gif`)
    } finally {
      rmSync(videoDir, { recursive: true, force: true })
    }
  })

// ---- run -----------------------------------------------------------------------------------
const answers = async () => {
  try {
    return (await fetch(origin)).ok
  } catch {
    return false
  }
}
// Something else on the port (often a Vite left by an interrupted run) would be captured instead.
if (await answers()) {
  console.error(`port ${PORT} is already in use; stop what's on it (\`lsof -ti :${PORT} | xargs kill\`) and retry`)
  process.exit(1)
}
const vite = spawn(path.join(root, 'node_modules/.bin/vite'), ['--port', String(PORT), '--strictPort'], {
  cwd: root,
  env: { ...process.env, VITE_API_BASE_URL: origin },
  stdio: ['ignore', 'ignore', 'inherit'],
  detached: true,
})
const stopVite = () => {
  try {
    process.kill(-vite.pid)
  } catch {}
}
process.on('exit', stopVite)
// Vite runs in its own process group, so Ctrl-C doesn't reach it: stop it here.
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130))
let viteExit = null
vite.on('exit', (code) => (viteExit = code))

let browser
try {
  for (let tries = 0; ; tries++) {
    if (viteExit !== null) throw new Error(`Vite exited (code ${viteExit}) before it was up`)
    if (await answers()) break
    if (tries > 100) throw new Error(`Vite did not start on ${origin} (is ${PORT} free, and \`bun install\` done in ${root}?)`)
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  browser = await chromium.launch()
  await scenario.default({ shot, flow })
  writeFileSync(path.join(outDir, 'captured.json'), JSON.stringify(captured, null, 2)) // order for publish.mjs
  console.log(`${captured.length} file(s) in ${outDir}:\n${captured.map((file) => `  ${file}`).join('\n')}`)
  if (failed.length) process.exitCode = 1
} finally {
  await browser?.close()
  stopVite()
}
