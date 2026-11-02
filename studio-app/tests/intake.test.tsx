import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { WorkspaceSummary } from '../src/api'
import { ActionsProvider } from '../src/actions/ActionsContext'
import { DataIntake } from '../src/pages/intake/DataIntake'
import { QualityTable } from '../src/pages/intake/QualityTable'
import type { QualityReport } from '../src/pages/intake/intakeApi'
import { parseRoute, routeHref, routeProjectId } from '../src/route'
import { setLanguage } from '../src/i18n'

const check = { id: 'duplicates', verdict: 'fail' as const, count: 1, examples: [{ row: 5, timestamp: '2024-01-02T00:00:00Z' }] }
const report: QualityReport = {
  schemaVersion: 1, sourceHash: 'source-hash', verdict: 'fail', jumpThreshold: .3, longGapBars: 5, universeStatus: 'unknown', frequency: '1d',
  summary: [check], assets: [{ asset: 'User-Asset', rows: 4, dateRange: { start: '2024-01-02T00:00:00Z', end: '2024-01-04T00:00:00Z' },
    market: { calendar: 'XNYS', timezone: 'America/New_York' }, missingBarRate: null, checks: [check], verdict: 'fail' }],
}

test('data intake route retains one object-independent home', () => {
  assert.deepEqual(parseRoute('?view=data-intake'), { view: 'data-intake' })
  assert.equal(routeHref({ view: 'data-intake' }), '/?view=data-intake')
  assert.equal(routeProjectId({ view: 'data-intake' }), null)
})

test('quality table preserves diagnostics and unknown missing rate in both languages', () => {
  for (const language of ['en', 'zh'] as const) {
    setLanguage(language)
    const html = renderToStaticMarkup(<QualityTable report={report} />)
    assert.match(html, /data-verdict="fail"/)
    assert.match(html, /<details>/)
    assert.match(html, /2024-01-02T00:00:00Z/)
    assert.match(html, /User-Asset/)
    assert.match(html, /America\/New_York/)
    assert.match(html, language === 'zh' ? /未知/ : /Unknown/)
    assert.match(html, language === 'zh' ? /重复时间戳/ : /Duplicate timestamps/)
    assert.doesNotMatch(html, /0\.00%/)
  }
  setLanguage('en')
})

test('data intake actions-off state supplies a visible reason and no staging picker', () => {
  const workspace: WorkspaceSummary = { kind: 'autoquant-studio-workspace-summary', generatedAt: '2026-11-03T00:00:00Z',
    harness: { id: 'test', version: '0', commit: null, dirty: false }, source: { scope: 'workspace', rootDir: 'D:/test', workspace: null },
    valid: true, diagnostics: [], projects: [] }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { hash: '' } } })
  try {
    const html = renderToStaticMarkup(<ActionsProvider workspace={workspace} routeKey="intake" go={() => {}} refresh={() => {}}><DataIntake workspace={workspace} /></ActionsProvider>)
    assert.match(html, /Read-only session: actions are off\./)
    assert.match(html, /--allow-actions/)
    assert.match(html, /aria-disabled="true"/)
    assert.doesNotMatch(html, /<select/)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
