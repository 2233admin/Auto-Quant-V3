import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProjectSummary, WorkspaceSummary } from '../src/api'
import { ActionsProvider } from '../src/actions/ActionsContext'
import { setLanguage } from '../src/i18n'
import { Projects } from '../src/pages/Projects'
import { parseRoute, routeHref, routeProjectId } from '../src/route'

const SRC = resolve(process.cwd(), 'studio-app/src')

/** The page reads window.location through the action provider; give the server render a minimal window. */
function withWindow<T>(render: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { hash: '', search: '' }, addEventListener() {}, removeEventListener() {} } })
  try { return render() } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete (globalThis as { window?: unknown }).window }
}

const project = (id: string, name: string, runCount: number): ProjectSummary => ({
  id, name, description: `${name} question`, valid: true, diagnostics: 0, counts: {},
  studies: [{ id: 'ohlcv-factor-quality', name: 'Factor quality', subjectKind: 'factor' }],
  runCount, latestRunAt: runCount ? '2026-11-20T08:00:00Z' : null,
  brief: { headline: null, lane: null, stage: null, mode: null },
  externalHoldout: { present: false, status: null },
})

const workspace = {
  kind: 'autoquant-studio-workspace-summary', generatedAt: '2026-11-23T00:00:00Z', valid: true, diagnostics: [],
  harness: { id: 'autoquant', version: 'test', commit: null, dirty: false },
  source: { scope: 'workspace', rootDir: '.', workspace: { name: 'Desk' } },
  projects: [project('momentum', 'Momentum factor', 2), project('fresh', 'Fresh question', 0)],
} as unknown as WorkspaceSummary

test('?view=projects is its own route and round-trips; the landing and ?view=factors stay on Factors', () => {
  assert.deepEqual(parseRoute('?view=projects'), { view: 'projects' })
  assert.equal(routeHref({ view: 'projects' }), '/?view=projects')
  assert.deepEqual(parseRoute(routeHref({ view: 'projects' }).slice(1)), { view: 'projects' })
  for (const query of ['', '?view=factors', '?view=unknown']) assert.equal(parseRoute(query).view, 'factors')
  assert.equal(routeHref({ view: 'factors' }), '/?view=factors')
  // A malformed event-study path used to land on the Factor library through the projects view; it still does.
  assert.deepEqual(parseRoute('', '/projects/%E0%A4%A/event-study'), { view: 'factors' })
  assert.equal(routeProjectId({ view: 'projects' }), null)
})

test('the Projects page lists every Project of the Workspace with its link, and a Chinese heading', () => {
  const render = () => withWindow(() => renderToStaticMarkup(
    <ActionsProvider workspace={workspace} routeKey="projects" go={() => {}} refresh={() => {}}>
      <Projects workspace={workspace} freshness={<span>fresh</span>} error={null} go={() => {}} />
    </ActionsProvider>,
  ))
  setLanguage('en')
  const html = render()
  assert.match(html, /<h1>Projects<\/h1>/)
  assert.match(html, />Momentum factor<\/a>/)
  assert.match(html, />Fresh question<\/a>/)
  assert.match(html, /href="\/\?view=factor&amp;id=momentum&amp;idea=1"/)
  setLanguage('zh')
  try {
    assert.match(render(), /<h1>项目<\/h1>/)
  } finally {
    setLanguage('en')
  }
})

test('the brand, top-bar mark, back links and crumbs that mean the Factors library link to ?view=factors, not the projects route', () => {
  for (const file of ['App.tsx', 'shell/Rail.tsx', 'shell/TopBar.tsx', 'pages/IdeaWorkbench.tsx']) {
    const source = readFileSync(resolve(SRC, file), 'utf8')
    assert.doesNotMatch(source, /routeHref\(\{ view: 'projects' \}\)/, file)
  }
})
