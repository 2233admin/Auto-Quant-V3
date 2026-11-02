import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CompareSelection } from '../src/library/RunHistory'
import { compareReason, deltaText, fieldLabel } from '../src/pages/compare/comparisonCopy'
import { comparisonMetrics } from '../src/pages/compare/comparisonMetrics'
import { ComparisonResults, ProtocolFacts } from '../src/pages/compare/ComparisonResults'
import { PairedCurve } from '../src/pages/compare/PairedCurve'
import { emptyFilters, matchesRun } from '../src/library/RunFilters'
import type { Comparison, HistoryRun, FactorComparison } from '../src/library/runHistoryApi'
import { setLanguage } from '../src/i18n'
import { parseRoute, routeHref } from '../src/route'

const row = { id: 'run-a', project: { id: 'project', name: 'Momentum' }, studyId: 'factor-study', subject: 'signal', objectKind: 'factor', lane: 'Factor', verdict: 'KEEP', primaryMetric: 'validation_mean_ic', primaryValue: 0.2, startedAt: '2026-11-01T12:00:00Z', sourceHash: 'abcd', protocol: { datasetId: 'same-data' } } as HistoryRun
const decision = { status: 'comparable', differences: [], a: row, b: { ...row, id: 'run-b', primaryValue: 0.3 } } as Comparison
const factor = { protocol: { testRole: 'visible-diagnostic' }, summary: { validation: { meanRankIc: 0.2 }, testAudit: { meanRankIc: 987654.321 } }, points: [] } as unknown as FactorComparison

test('every protocol mismatch reason names the exact differing field in both locales', () => {
  for (const language of ['en', 'zh'] as const) {
    setLanguage(language)
    for (const field of ['objectKind', 'lane', 'study', 'datasetId', 'datasetHash', 'splitWindows', 'horizon', 'costModel', 'objective']) {
      const c = { ...decision, status: 'not-comparable', differences: [{ field, reason: 'different', a: 'a', b: 'b' }] } as Comparison
      assert.ok(compareReason(2, c).includes(fieldLabel(field)))
      const html = renderToStaticMarkup(<CompareSelection count={2} decision={c} onCompare={() => {}} />)
      assert.match(html, /disabled=""/)
      assert.match(html, /aria-describedby="compare-reason"/)
      assert.ok(html.includes(fieldLabel(field)))
    }
  }
  setLanguage('en')
})

test('compare remains disabled with a visible reason for selection, loading and errors', () => {
  for (const count of [0, 1, 3]) {
    const html = renderToStaticMarkup(<CompareSelection count={count} onCompare={() => {}} />)
    assert.match(html, /disabled=""/)
    assert.match(html, /Select exactly two Runs/)
  }
  assert.match(compareReason(2), /Checking/)
  assert.match(compareReason(2, undefined, 'network'), /network/)
  assert.doesNotMatch(renderToStaticMarkup(<CompareSelection count={2} decision={decision} onCompare={() => {}} />), /disabled=""/)
})

test('filters intersect object, lane, verdict, Project, inclusive UTC dates and case-insensitive search', () => {
  const all = { ...emptyFilters, object: 'factor', lane: 'Factor', verdict: 'KEEP', project: 'project', from: '2026-11-01', to: '2026-11-01', q: 'MOMENTUM' }
  assert.equal(matchesRun(row, all), true)
  for (const key of ['object', 'lane', 'verdict', 'project', 'from', 'to', 'q'] as const) {
    assert.equal(matchesRun(row, { ...all, [key]: key === 'to' ? '2026-10-01' : 'zzzz' }), false, key)
  }
})

test('test values require both actual audits and both visible roles', () => {
  for (const hidden of [{ ...factor, protocol: { testRole: 'hidden' } }, { ...factor, summary: { ...factor.summary, testAudit: null } }]) {
    const c = { ...decision, factors: [factor, hidden] } as Comparison
    assert.equal(comparisonMetrics(c).some(r => r.scope === 'Test audit'), false)
    assert.doesNotMatch(renderToStaticMarkup(<ComparisonResults comparison={c} />), /987654/)
  }
  assert.equal(comparisonMetrics({ ...decision, factors: [factor, factor] }).some(r => r.scope === 'Test audit'), true)
})

test('refused comparison has no numeric rows and highlighted facts retain both values', () => {
  const c = { ...decision, status: 'not-comparable', b: { ...row, protocol: { datasetId: 'other-data' } }, differences: [{ field: 'datasetId', reason: 'different', a: 'same-data', b: 'other-data' }] } as Comparison
  assert.deepEqual(comparisonMetrics(c), [])
  const html = renderToStaticMarkup(<ProtocolFacts comparison={c} />)
  assert.match(html, /cmp-different/)
  assert.match(html, /same-data/)
  assert.match(html, /other-data/)
})

test('every metric has catalogue help; only focal deltas carry sign colour; signs include zero', () => {
  const html = renderToStaticMarkup(<ComparisonResults comparison={{ ...decision, factors: [factor, factor] }} />)
  assert.match(html, /meanRankIc/)
  assert.equal((html.match(/data-sign=/g) ?? []).length, 1)
  assert.equal(deltaText(0), '+0.0000')
  assert.equal(deltaText(-0.2), '−0.2000')
  assert.equal(deltaText(0.1), '+0.1000')
})

test('paired curve uses grey baseline and one accent without sign-coloured marks', () => {
  const point = { timestamp: '2026-01-01', split: 'validation', role: 'development', low: 1, middle: 1.1, high: 1.2, spread: 1.2 } as const
  const html = renderToStaticMarkup(<PairedCurve a={[point]} b={[{ ...point, spread: 1.4 }]} group="spread" width={500} height={220} />)
  assert.match(html, /var\(--stroke\)/)
  assert.match(html, /var\(--signal-graphic\)/)
  assert.doesNotMatch(html, /sign-positive|sign-negative/)
})

test('cross-Project compare route preserves both exact Run owners', () => {
  const route = { view: 'compare', id: 'p-a', projectB: 'p-b', a: 'run-a', b: 'run-b' } as const
  assert.deepEqual(parseRoute(routeHref(route).slice(1)), route)
})
