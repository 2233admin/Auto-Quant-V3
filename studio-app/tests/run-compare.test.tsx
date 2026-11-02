import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CompareSelection } from '../src/library/RunHistory'
import { compareReason, deltaText, fieldLabel } from '../src/pages/compare/comparisonCopy'
import { comparisonMetrics } from '../src/pages/compare/comparisonMetrics'
import { ComparisonResults, ProtocolFacts } from '../src/pages/compare/ComparisonResults'
import { PairedCurve } from '../src/pages/compare/PairedCurve'
import { protocolFactRows, shortHash, splitWindowsText } from '../src/pages/compare/protocolFacts'
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

const H = (c: string) => c.repeat(64)
const windows = { train: { start: '2024-01-02', end: '2024-05-30' }, validation: { start: '2024-05-31', end: '2024-07-19' }, test: { start: '2024-07-22', end: '2024-09-09' } }
const fullProtocol = {
  objectKind: 'factor', lane: 'Factor', study: { id: 'ohlcv-factor-quality', hash: H('a'), judgeHash: H('b'), programHash: H('c'), dependenciesHash: H('d') },
  datasetId: 'demo', datasetHash: 'sha256:' + H('e'), splitWindows: windows,
  horizon: { primaryForwardBars: 1, diagnosticForwardBars: [1, 5] }, costModel: null, objective: { direction: 'maximize', metric: 'validation_mean_ic', minimumImprovement: 0.01 },
}
const factRun = { ...row, sourceHash: H('f'), testAuditVisible: true, protocol: fullProtocol } as HistoryRun

test('protocol fact formatter: short hashes, readable split windows, horizon and objective in both locales', () => {
  assert.equal(shortHash(H('a')), 'aaaaaaaa')
  assert.equal(shortHash('sha256:' + H('e')), 'eeeeeeee')
  assert.equal(shortHash(null), '—')
  assert.equal(splitWindowsText(windows, true), 'Train 2024-01-02 → 2024-05-30 · Validation 2024-05-31 → 2024-07-19 · Test 2024-07-22 → 2024-09-09')
  const c = { ...decision, a: factRun, b: { ...factRun, id: 'run-b', sourceHash: H('0') } } as Comparison
  const rows = Object.fromEntries(protocolFactRows(c).map(r => [r.key, r]))
  assert.equal(rows['study.id'].a.text, 'ohlcv-factor-quality')
  assert.equal(rows['study.hash'].a.text, 'aaaaaaaa')
  assert.equal(rows['study.hash'].a.full, H('a'))
  assert.equal(rows.datasetHash.a.full, 'sha256:' + H('e'))
  assert.equal(rows.horizon.a.text, '1 bars primary · diagnostic 5')
  assert.equal(rows.costModel.a.text, 'None (Factor measurement)')
  assert.equal(rows.objective.a.text, 'Maximize validation_mean_ic · minimum improvement 0.01')
  assert.equal(rows.sourceHash.state, 'Intended change')
  assert.ok(protocolFactRows(c).filter(r => r.key !== 'sourceHash').every(r => r.state === 'Same'))
  const html = renderToStaticMarkup(<ProtocolFacts comparison={c} />)
  assert.match(html, /title="aaaaaaaaaaaaaaaa/)
  assert.match(html, />aaaaaaaa</)
  assert.doesNotMatch(html, /<pre/)
  assert.doesNotMatch(html, /cmp-different/)
  assert.equal((html.match(/Copy hash/g) ?? []).length, 12)
  setLanguage('zh')
  assert.equal(splitWindowsText(windows, true), '训练 2024-01-02 → 2024-05-30 · 验证 2024-05-31 → 2024-07-19 · 测试 2024-07-22 → 2024-09-09')
  assert.match(renderToStaticMarkup(<ProtocolFacts comparison={c} />), /研究标识.*复制哈希/s)
  setLanguage('en')
})

test('hidden test split never discloses its window, in rows, hover or expanded values', () => {
  const hiddenB = { ...factRun, id: 'run-b', testAuditVisible: false, protocol: { ...fullProtocol, splitWindows: { ...windows, test: { start: '2024-07-23', end: '2024-09-10' } } } } as HistoryRun
  const c = { ...decision, status: 'not-comparable', a: { ...factRun, testAuditVisible: false }, b: hiddenB, differences: [{ field: 'splitWindows', reason: 'different', a: null, b: null }] } as Comparison
  const html = renderToStaticMarkup(<ProtocolFacts comparison={c} initiallyOpen={['splitWindows']} />)
  assert.doesNotMatch(html, /2024-07-2[23]|2024-09-(09|10)/)
  assert.match(html, /Test Hidden/)
  assert.match(html, /Test split is hidden/)
  // A visible-diagnostic factor payload with a published audit opens the window through testGate.
  assert.match(splitWindowsText(windows, true), /2024-07-22/)
})

test('differing facts are highlighted, expandable and show both complete values', () => {
  const b = { ...factRun, id: 'run-b', protocol: { ...fullProtocol, datasetHash: H('9'), study: { ...fullProtocol.study, judgeHash: H('8') } } } as HistoryRun
  const c = { ...decision, status: 'not-comparable', a: factRun, b, differences: [{ field: 'study', reason: 'different', a: null, b: null }, { field: 'datasetHash', reason: 'different', a: null, b: null }] } as Comparison
  const different = protocolFactRows(c).filter(r => r.state === 'Different').map(r => r.key)
  assert.deepEqual(different, ['study.judgeHash', 'datasetHash'])
  const closed = renderToStaticMarkup(<ProtocolFacts comparison={c} />)
  assert.equal((closed.match(/<tr class="cmp-different" data-fact/g) ?? []).length, 2)
  assert.equal((closed.match(/aria-expanded="false"/g) ?? []).length, 2)
  assert.match(closed, /data-fact="study.id"/)
  assert.doesNotMatch(closed, /class="cmp-different" data-fact="study.id"/)
  const open = renderToStaticMarkup(<ProtocolFacts comparison={c} initiallyOpen={['datasetHash']} />)
  assert.match(open, /aria-expanded="true"/)
  assert.ok(open.includes(`<pre translate="no">sha256:${H('e')}</pre>`))
  assert.ok(open.includes(`<pre translate="no">${H('9')}</pre>`))
})
