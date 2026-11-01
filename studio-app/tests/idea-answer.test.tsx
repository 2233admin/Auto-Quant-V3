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

test('result has one primary; editing moves primary ownership to the editor', () => {
  assert.equal((answer().match(/abtn--primary/g) ?? []).length, 1)
  assert.equal((answer({ editing: true }).match(/abtn--primary/g) ?? []).length, 0)
  assert.doesNotMatch(answer(), /Declare another trial/)
  assert.match(answer({ onDeclareTrial: () => {} }), /Declare another trial/)
  assert.match(answer(), /<details class="idea-evidence"><summary>Question identity and evidence/)
})
