import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FactorDiagnostics, ProjectSnapshot, RunRow } from '../src/api'
import type { Idea } from '../src/actions/ideaApi'
import type { Job } from '../src/actions/types'
import { IdeaVerdict, ideaMetricGroups, ideaVerdict } from '../src/pages/IdeaVerdict'
import { FactorHero } from '../src/pages/GroupReturn'
import { IcByHorizonPlot } from '../src/pages/FactorCharts'
import { studyTestVisible } from '../src/pages/testGate'
import { candidateExpression, expressionSource } from '../src/pages/ideaEditor'
import { ParamGrid, StatusLine, TitleCard } from '../src/components/workbench'
import type { FactorSummary, StrategySummary } from '../src/api'
import { FACTOR_FILTERS, factorMetricLine, factorPoints, filterCounts, LibraryCard, strategyMetricLine } from '../src/library/LibraryCards'
import { SessionRecovery } from '../src/pages/FactorEditorState'
import { parseRoute } from '../src/route'

test('landing and legacy projects alias both open Factors', () => {
  for (const query of ['', '?view=projects', '?view=factors']) assert.equal(parseRoute(query).view, 'factors')
})

test('library filter counts include every verdict and zero-result categories', () => {
  assert.deepEqual(filterCounts(['Supported', 'Supported', 'Inconclusive', 'Could not be tested'], FACTOR_FILTERS, x => x), {
    All: 4, Supported: 2, Inconclusive: 1, 'Not tested': 0, 'Could not be tested': 1,
  })
})

test('Factor card uses the idea name, a single validation metric line, and retained trials', () => {
  const summary = { validation: { meanRankIc: 0.8086, hacTStatistic: 17.42 }, trials: 1 } as FactorSummary
  const metric = factorMetricLine(summary)
  assert.equal(metric, 'Validation rank IC +0.809 · HAC t 17.4 · Trials 1')
  const html = renderToStaticMarkup(<LibraryCard name="Five-day momentum" badge="Supported" metric={metric} points={[]} updated={null} href="/?view=factor&id=momentum&idea=1" go={() => {}} />)
  assert.match(html, /Five-day momentum/)
  assert.match(html, /Factor expression/)
  assert.match(html, /Last updated: Not run/)
  assert.doesNotMatch(html, /OHLCV Factor Quality|Across Runs/)
})

test('library sparkline uses the shared two-part test gate', () => {
  for (const audit of [false,true]) for (const role of ['sealed','visible-diagnostic']) {
    const summary = { protocol: { testRole: role }, testAudit: audit, points: [{ split: 'train', value: 1 }, { split: 'validation', value: 1.2 }, { split: 'test', value: 999 }] } as FactorSummary
    assert.equal(factorPoints(summary).some(p => p.value === 999), audit && role === 'visible-diagnostic')
  }
})

test('strategy line preserves net metrics and missing values', () => {
  assert.equal(strategyMetricLine({ net: { totalReturn: -.08265, sharpe: -2.656, maximumDrawdown: -.08016 } } as StrategySummary), 'Net total return -8.27% · Net Sharpe -2.66 · Max drawdown -8.02%')
  assert.equal(strategyMetricLine({ net: null } as StrategySummary), 'No Portfolio Run metrics yet')
})

test('stale recovery exposes exact reason and restart, while read-only supplies a copyable enable command', () => {
  const reason = 'Blocked: Session retained is stale (Installed Harness differs from the Session baseline)'
  const command = "aq studio serve 'D:/tmp/example' --allow-actions --port 8881"
  const stale = renderToStaticMarkup(<SessionRecovery reason={reason} actions command={command} onRestart={() => {}} />)
  assert.match(stale, /Restart session/)
  assert.match(stale, /Installed Harness differs from the Session baseline/)
  assert.doesNotMatch(stale, /Candidate is read-only/)
  const off = renderToStaticMarkup(<SessionRecovery reason="Actions are off" actions={false} command={command} onRestart={() => {}} />)
  assert.match(off, /Copy enable command/)
  assert.match(off, /--allow-actions --port 8881/)
  assert.doesNotMatch(off, /Restart session/)
})

const rank = { meanRankIc: 0.12, meanPearsonIc: 0.11, hacTStatistic: 2.5, hacNormalPValue: 0.01, rankHitRate: 0.6, rankIcir: 0.5, rankIcStandardDeviation: 0.2, observations: 30, minimumObservations: 20, sufficient: true }
const testRank = { ...rank, meanRankIc: 876.5432 }
function study(): FactorDiagnostics {
  return {
    run: { id: 'run-one' },
    protocol: { primaryHorizon: 1, testRole: 'visible-diagnostic', semantics: {}, splits: { splits: { validation: { start: '2024-02-01', end: '2024-02-28' } } } },
    summary: { validation: rank, testAudit: testRank },
    predictionUniverse: { evaluationMode: 'cross-sectional', predictionAssets: ['A', 'B', 'C'] },
    factorQualification: { available: true, diagnosis: { stage: 'decision-signal-positive', explanation: 'Development diagnosis.' }, claim: { claim: 'decision-signal', outcome: 'forward-return' } },
    quantileEvidence: { status: 'available' },
    quantilePath: { cumulative: { horizon: 1, totalRows: 3, points: [
      { timestamp: '2024-01-01', split: 'train', high: 1, middle: 1, low: 1, spread: 1 },
      { timestamp: '2024-02-01', split: 'validation', high: 1.2, middle: 1.1, low: 0.9, spread: 1.3 },
      { timestamp: '2099-12-31', split: 'test', high: 9876.543, middle: 9876.543, low: 9876.543, spread: 9876.543 },
    ] } },
    spreadSummary: { status: 'available', basis: 'Gross per-bar spread.', splits: [
      { split: 'validation', totalReturn: 0.2, maximumDrawdown: -0.1, sharpePerBar: 0.5, hitRate: 0.6, meanPerBar: 0.01, observations: 30 },
      { split: 'test', totalReturn: 9876.543, observations: 99999 },
    ] },
    horizonProfile: [{ horizon: 1, train: rank, validation: rank, test: testRank }],
  } as FactorDiagnostics
}
const project = { id: 'idea', sessions: [], runs: [] } as unknown as ProjectSnapshot
const run = { id: 'run-one', studyId: 'ohlcv-factor-quality', status: 'succeeded' } as RunRow
const idea = { hypothesis: 'Does this ranking help?', hypothesisSha256: 'question-digest', verdictPolicy: 'factor-idea-development-v1', bindings: [], evidence: { runId: 'run-one', selectionAdjustment: { passes: true } } } as unknown as Idea
const answer = (overrides = {}) => renderToStaticMarkup(<IdeaVerdict project={project} idea={idea} study={study()} run={run} job={null} busy="" {...overrides} />)

test('support requires exact development diagnosis and passing adjustment', () => {
  assert.equal(ideaVerdict(study(), true), 'Supported')
  for (const adjustment of [false, null, undefined]) assert.equal(ideaVerdict(study(), adjustment), 'Inconclusive')
  const s = study(); s.factorQualification.diagnosis!.stage = 'negative'
  assert.equal(ideaVerdict(s, true), 'Inconclusive')
  const html = answer({ idea: { ...idea, evidence: { ...idea.evidence, runId: 'other-run' } } })
  assert.match(html, /Inconclusive/)
  assert.doesNotMatch(html, />Supported</)
})

test('answer metrics remain validation-only even after a published test audit', () => {
  const groups = ideaMetricGroups(study(), project)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups.map(g => g.tiles.length), [6, 6])
  assert.ok(groups.every(g => g.heading.toLowerCase().includes('validation')))
  assert.doesNotMatch(JSON.stringify(groups.map(g => g.tiles.map(t => t.value))), /876\.5432|9876|99999/)
  assert.ok(!groups.flatMap(g => g.tiles).some(t => t.label === 'Trials counted'))
})

for (const [label, audit, role] of [
  ['missing audit', false, 'visible-diagnostic'],
  ['non-diagnostic role', true, 'sealed'],
  ['allowed audit', true, 'visible-diagnostic'],
] as const) {
  test(`group chart and Rank IC table/plot gate: ${label}`, () => {
    const s = study(); s.protocol.testRole = role
    if (!audit) delete s.summary.testAudit
    const visible = audit && role === 'visible-diagnostic'
    assert.equal(studyTestVisible(s), visible)
    const group = renderToStaticMarkup(<FactorHero study={s} />)
    assert.equal(group.includes('2099-12-31'), visible)
    assert.equal(group.includes('9876.543'), visible)
    s.quantileEvidence.status = 'unavailable'
    const ic = renderToStaticMarkup(<FactorHero study={s} />)
    assert.match(ic, /Rank IC by horizon and split/)
    assert.equal(ic.includes('876.5432'), visible)
    const plot = renderToStaticMarkup(<IcByHorizonPlot study={s} width={600} height={260} />)
    assert.equal(plot.includes('876.5432'), visible)
  })
}

test('single-asset and missing cumulative quantiles use Rank IC', () => {
  for (const temporal of [false, true]) {
    const s = study()
    if (temporal) s.predictionUniverse.evaluationMode = 'single-asset-temporal'
    else delete s.quantilePath
    const html = renderToStaticMarkup(<FactorHero study={s} />)
    assert.match(html, /Rank IC by horizon and split/)
    assert.doesNotMatch(html, /Group cumulative return/)
  }
})

test('failed, unavailable, pending and untested answers never mount charts or metrics', () => {
  const unsupported = study(); unsupported.factorQualification.available = false
  for (const overrides of [
    { run: { ...run, status: 'failed', summary: 'Missing input.' } },
    { job: { status: 'failed', actionId: 'session.start', result: { error: { message: 'Missing feature.' } } } as Job },
    { study: unsupported }, { busy: 'Running' }, { study: null, run: null },
  ]) {
    const html = answer(overrides)
    assert.doesNotMatch(html, /wb-chart|wb-metrics/)
  }
  assert.match(answer({ job: { status: 'failed', actionId: 'session.start', result: { error: { message: 'Missing feature.' } } } }), /Missing feature/)
})

test('result keeps every action secondary; editor always owns the primary', () => {
  assert.equal((answer().match(/abtn--primary/g) ?? []).length, 0)
  assert.doesNotMatch(answer(), /Declare another trial/)
  assert.match(answer({ onDeclareTrial: () => {} }), /Declare another trial/)
  assert.match(answer(), /<details class="idea-evidence"><summary>Question identity and evidence/)
})

test('result order is selector, actions, status, one-line verdict, chart, metrics', () => {
  const html = answer()
  const markers = ['idea-run-selector', 'idea-action-chips', 'idea-status', 'wb-verdict', 'wb-chart', 'idea-core-metrics']
  const positions = markers.map(m => html.indexOf(m))
  assert.ok(positions.every((n, i) => n >= 0 && (!i || n > positions[i - 1])))
  assert.match(html, /Analysis Run/)
  assert.match(html, /Supported · Trial 1/)
  assert.match(html, /Stage count not recorded/)
  assert.doesNotMatch(html, /<h2 class="idea-conclusion"/)
})

test('history options preserve Run identity and never reuse the latest Supported word', () => {
  const old = { ...run, id: 'older-run' }
  const html = answer({ runs: [run, old] })
  assert.match(html, /value="older-run">older-run · Completed · Trial 1/)
  assert.match(html, /value="run-one" selected="">run-one · Supported · Trial 2/)
})

test('expression adapter round-trips only its exact authored wrapper', () => {
  const expression = 'panel.groupby("asset")["close"].pct_change(5, fill_method=None)'
  const source = expressionSource(expression, '')
  assert.equal(candidateExpression(source), expression)
  assert.equal(expressionSource(candidateExpression(source), source), source)
  const arbitrary = 'import pandas as pd\n# another implementation\ndef compute_factor(panel):\n    return panel.close\n'
  assert.equal(candidateExpression(arbitrary), '')
  assert.equal(expressionSource('', arbitrary), arbitrary)
})

test('locked parameters are read-only inputs and title owns the Ideas return link', () => {
  const html = renderToStaticMarkup(<ParamGrid params={[{ label: 'Assets', value: 'A, B' }]} />)
  assert.match(html, /readOnly=""/)
  assert.match(html, /Locked by the Study/)
  assert.match(renderToStaticMarkup(<TitleCard title="Momentum" subtitle="Question" backHref="/" type="Factor" />), /aria-label="Back to Ideas"/)
})

test('completed status retains progress; whole-action jobs do not invent stage counts', () => {
  assert.match(renderToStaticMarkup(<StatusLine state="done" text="Analysis complete" percent={100} />), /100%/)
  const html = answer({ job: { status: 'succeeded', stageMode: 'whole-action', stages: [{ state: 'pending' }] } })
  assert.match(html, /Command-level progress/)
  assert.doesNotMatch(html, /0\/1 stages complete/)
})
