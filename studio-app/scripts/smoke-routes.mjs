// Route smoke test for the built Studio against a real `aq studio serve`.
//
// Starts the server on the given Workspace (default: the repository's sample desk), opens every Studio route in the
// system Chrome over the DevTools protocol, and fails on: an uncaught page error or console error, an /api/ response of
// 400 or above, a route that never leaves "Loading…", horizontal page overflow at 1440x900, the "Could not load" error
// state, or a Workspace-level page whose empty state claims "No evidence in this Project". No npm dependency: Node 22's
// global WebSocket and fetch drive Chrome directly.
//
//   node scripts/smoke-routes.mjs [--workspace <dir>] [--port 8799] [--chrome <path>]
//   CHROME_PATH=... node scripts/smoke-routes.mjs
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const argv = process.argv.slice(2)
const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined }
const workspace = resolve(arg('workspace') ?? join(import.meta.dirname, '..', '..'))
const port = Number(arg('port') ?? 8799)
const base = `http://127.0.0.1:${port}`
const NO_EVIDENCE = 'No evidence in this Project'
const COULD_NOT_LOAD = 'Could not load this Project'
const WORKSPACE_VIEWS = ['factors', 'runs', 'strategies', 'attention', 'settings', 'knowledge', 'assistant', 'projects', 'data-intake', 'tuning', 'research']
const PROJECT_VIEWS = ['project', 'portfolio', 'strategy', 'bookrisk', 'bookstress', 'allocation', 'rl', 'tuning', 'research', 'factor']

function findChrome() {
  const explicit = arg('chrome') ?? process.env.CHROME_PATH
  if (explicit) return explicit
  const candidates = process.platform === 'win32'
    ? [
        join(process.env.PROGRAMFILES ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
        join(process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
        join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
        join(process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map((name) => spawnSync('which', [name], { encoding: 'utf8' }).stdout.trim())
  const found = candidates.find((path) => path && existsSync(path))
  if (!found) throw new Error('No Chrome found; pass --chrome <path> or set CHROME_PATH.')
  return found
}

async function waitFor(check, what, ms = 120_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      const value = await check()
      if (value) return value
    } catch {
      // Not ready yet.
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${what}`)
}

class Cdp {
  static async open(url) {
    const cdp = new Cdp(new WebSocket(url))
    await new Promise((ok, fail) => {
      cdp.ws.onopen = ok
      cdp.ws.onerror = () => fail(new Error(`Cannot open ${url}`))
    })
    return cdp
  }

  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.listeners = []
    ws.onmessage = ({ data }) => {
      const message = JSON.parse(data)
      if (message.id && this.pending.has(message.id)) {
        const { ok, fail } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) fail(new Error(message.error.message))
        else ok(message.result)
      } else if (message.method) {
        for (const listener of this.listeners) listener(message)
      }
    }
  }

  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((ok, fail) => this.pending.set(id, { ok, fail }))
  }

  on(listener) {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter((l) => l !== listener) }
  }

  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (exceptionDetails) throw new Error(exceptionDetails.text)
    return result.value
  }
}

async function routesFor() {
  const summary = await (await fetch(`${base}/api/v1/workspace`)).json()
  const runs = (await (await fetch(`${base}/api/v1/runs?offset=0&limit=200`)).json()).rows ?? []
  const routes = WORKSPACE_VIEWS.map((view) => ({ query: `?view=${view}`, scope: 'workspace' }))
  for (const project of summary.projects ?? []) {
    const id = encodeURIComponent(project.id)
    for (const view of PROJECT_VIEWS) routes.push({ query: `?view=${view}&id=${id}`, scope: 'project' })
    routes.push({ query: `?view=compare&project=${id}`, scope: 'project' })
    // One Run page per lane the Project published.
    const lanes = new Map()
    for (const run of runs) if (run.project?.id === project.id && !lanes.has(run.lane)) lanes.set(run.lane, run.id)
    for (const run of lanes.values()) routes.push({ query: `?view=run&project=${id}&id=${encodeURIComponent(run)}`, scope: 'project' })
  }
  return routes
}

const CHECK = `(async () => {
  const end = Date.now() + 15000
  while (Date.now() < end && (document.querySelector('.st--loading') || !document.querySelector('h1, h2'))) {
    await new Promise((r) => setTimeout(r, 100))
  }
  return {
    heading: document.querySelector('h1, h2')?.textContent.trim() ?? null,
    stillLoading: !!document.querySelector('.st--loading'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    titles: [...document.querySelectorAll('.st-title')].map((n) => n.textContent.trim()),
    couldNotLoad: document.body.innerText.includes(${JSON.stringify(COULD_NOT_LOAD)}),
  }
})()`

async function checkRoute(page, route) {
  const problems = []
  const stop = page.on(({ method, params }) => {
    if (method === 'Runtime.exceptionThrown') {
      problems.push(`page error: ${params.exceptionDetails.exception?.description?.split('\n')[0] ?? params.exceptionDetails.text}`)
    } else if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      problems.push(`console error: ${params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160)}`)
    } else if (method === 'Log.entryAdded' && params.entry.level === 'error' && !/favicon/.test(params.entry.url ?? '')) {
      problems.push(`browser error: ${params.entry.text.slice(0, 160)}`)
    } else if (method === 'Network.responseReceived' && params.response.url.includes('/api/') && params.response.status >= 400) {
      problems.push(`HTTP ${params.response.status} ${params.response.url.replace(base, '')}`)
    }
  })
  const loaded = new Promise((ok) => {
    const off = page.on(({ method }) => {
      if (method === 'Page.loadEventFired') { off(); ok() }
    })
  })
  await page.send('Page.navigate', { url: `${base}/${route.query}` })
  await Promise.race([loaded, sleep(20_000)])
  const state = await page.evaluate(CHECK)
  await sleep(300)
  stop()
  if (!state.heading) problems.push('no page heading')
  if (state.stillLoading) problems.push('still loading after 15 s')
  if (state.overflow > 1) problems.push(`horizontal overflow ${state.overflow}px at 1440px`)
  if (state.couldNotLoad) problems.push(`shows "${COULD_NOT_LOAD}"`)
  if (route.scope === 'workspace' && state.titles.includes(NO_EVIDENCE)) problems.push(`Workspace page says "${NO_EVIDENCE}"`)
  return { heading: state.heading, problems }
}

async function main() {
  const server = spawn('uv', ['run', 'aq', 'studio', 'serve', workspace, '--port', String(port), '--no-open'], {
    cwd: workspace,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverLog = ''
  server.stdout.on('data', (chunk) => { serverLog += chunk })
  server.stderr.on('data', (chunk) => { serverLog += chunk })
  const profile = mkdtempSync(join(tmpdir(), 'aq-smoke-'))
  let chrome
  try {
    await waitFor(async () => (await fetch(`${base}/api/v1/workspace`)).ok, `aq studio serve on ${base}`, 300_000).catch((error) => {
      throw new Error(`${error.message}\n${serverLog}`)
    })
    chrome = spawn(findChrome(), [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: 'ignore' })
    const devtoolsPort = await waitFor(() => readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0], 'Chrome DevTools port', 30_000)
    const target = await waitFor(
      async () => (await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)).json()).find((t) => t.type === 'page'),
      'a Chrome page',
      30_000,
    )
    const page = await Cdp.open(target.webSocketDebuggerUrl)
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable']) await page.send(method)
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    // English copy makes the catalogue headline checkable by its exact text.
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('aq-language', 'en') } catch {}" })

    const routes = await routesFor()
    const failures = []
    for (const route of routes) {
      const { heading, problems } = await checkRoute(page, route)
      console.log(`${problems.length ? 'FAIL' : 'ok  '} ${route.query}  ${heading ?? ''}`)
      for (const problem of problems) console.log(`       ${problem}`)
      if (problems.length) failures.push(route.query)
    }
    page.ws.close()
    console.log(`\n${routes.length - failures.length}/${routes.length} routes passed`)
    process.exitCode = failures.length ? 1 : 0
  } finally {
    chrome?.kill()
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' })
    else server.kill('SIGTERM')
    await sleep(500)
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
