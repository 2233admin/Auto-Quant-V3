import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { setLanguage } from '../src/i18n'
import { parseRoute, routeHref } from '../src/route'
import { ProgramInspector } from '../src/research/ProgramInspector'
import { Throughput } from '../src/research/EvolutionParts'
import type { EvoProgram, ProgramResponse } from '../src/research/evolutionApi'

const base: EvoProgram = { id: 'p1', parent: 'p0', generation: 3, timestamp: 1, score: 0.9, correct: true, island: 1, children: 1, archive: false, copy: false, patchType: 'diff', patchName: 'add_brake', model: 'demo/model', cost: 0.12 }

test('an evolution run route keeps project, hypothesis, experiment and program', () => {
  const route = { view: 'research' as const, id: 'momentum-regimes', h: 'h001', e: 'e01', p: 'abc-123' }
  const url = new URL(routeHref(route), 'http://x')
  assert.deepEqual(parseRoute(url.search, url.pathname), route)
})

test('the inspector marks diff lines by prefix, lists offspring with their change and never shows private values', () => {
  setLanguage('en')
  const data: ProgramResponse = {
    projectId: 'p', hypothesis: 'h001', experiment: 'e01', state: 'ready', reason: null, demo: null,
    program: { ...base, language: 'python', code: 'x = 1\n', diff: '--- a\n+++ b\n@@ -1 +1 @@\n-x = 0\n+x = 1', feedback: 'fold Sharpe 0.9', publicMetrics: { is_turnover: 0.12 }, privateMetrics: 'hidden', description: null, thought: null, stdout: null, stderr: null, failure: null, timings: { evaluation: 4.5 }, systemPrompt: null },
    parent: { ...base, id: 'p0', parent: null, score: 0.8 },
    offspring: [{ ...base, id: 'p2', parent: 'p1', score: 0.95, patchName: 'child' }],
  }
  const html = renderToStaticMarkup(<ProgramInspector data={data} onSelect={() => {}} />)
  assert.match(html, /class="is-add">\+x = 1/)
  assert.match(html, /class="is-del">-x = 0/)
  assert.match(html, /\+0\.050/)
  assert.match(html, /Recorded, never shown/)
  assert.doesNotMatch(html, /private_metrics/)
})

test('throughput lays out the server stage durations', () => {
  setLanguage('en')
  const html = renderToStaticMarkup(<Throughput stages={[{ stage: 'evaluation', p50: 97.2, p95: 158.1, max: 300, n: 320 }]} perHour={104.3} wallHours={3.07} />)
  assert.match(html, /104\.3 programs per hour/)
  assert.match(html, /158\.1/)
})

test('an aborted or bodiless response never replaces the shown state (no black screen on fast route changes)', async () => {
  const { settle } = await import('../src/research/researchApi')
  const ready = { url: '/a', load: { state: 'ready' as const, data: { demo: null } } }
  assert.equal(settle(ready, '/b', true, { data: null }), ready)
  assert.deepEqual(settle({ url: null, load: { state: 'loading' } }, '/b', false, { data: null }).load.state, 'error')
  assert.equal(settle(ready, '/a', false, { error: 'HTTP 500' }).load, ready.load)
  assert.deepEqual(settle(ready, '/b', false, { data: { demo: 'x' } }), { url: '/b', load: { state: 'ready', data: { demo: 'x' } } })
})
