import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import type { FactorCumulativePoint, ProjectSnapshot } from '../src/api'
import { setLanguage } from '../src/i18n'
import { parseRoute, routeHref } from '../src/route'
import { Confirmation } from '../src/pages/Assistant'
import { GroupPlot, groupCurvePoints } from '../src/pages/GroupReturn'
import { BeforeAfterView, confirmationTable } from '../src/pages/assistant/BeforeAfter'
import { cardStateFor, MAX_CARDS_PER_TURN, PortfolioNetPlot, ResultCardView, TurnCards } from '../src/pages/assistant/ResultCard'
import {
  completedTrialTable, factorCardMetrics, pendingTrialTable, portfolioCurvePoints, refsByTurn, runRefsOf,
  type RunRef,
} from '../src/pages/assistant/resultModel'
import type { SnapshotLoad } from '../src/pages/assistant/useProjectSnapshots'
import type { RunLoad } from '../src/pages/run/useRun'
import type { RunPayload } from '../src/pages/run/runTypes'

/**
 * The Assistant's result card and before/after table. Rendering is server-side (no DOM), so the chart box (which needs a
 * measured height) is checked through its data table and the plot components are rendered directly.
 */

/** Render in a language. Pass a function when the element's own props (card state, table) are language-dependent: they are built after the switch, as the app builds them. */
const html = (node: ReactElement | (() => ReactElement), language: 'en' | 'zh' = 'en'): string => {
  setLanguage(language)
  try { return renderToStaticMarkup(typeof node === 'function' ? node() : node) } finally { setLanguage('en') }
}

// ---------------------------------------------------------------------------------------------
// Fixtures: plain objects shaped like the server projections (never research evidence)

const point = (timestamp: string, split: FactorCumulativePoint['split'], k: number): FactorCumulativePoint =>
  ({ timestamp, split, role: 'x', low: 1 - k / 100, middle: 1, high: 1 + k / 100, spread: 1 + k / 50 })
const GROUP_POINTS = [
  point('2024-01-02', 'train', 1),
  point('2024-06-03', 'validation', 2),
  point('2024-09-02', 'validation', 3),
  point('2099-01-02', 'test', 4),
]

type Overrides = Record<string, unknown>
const factorPayload = (over: Overrides = {}): RunLoad => ({
  state: 'ready',
  payload: {
    schemaVersion: 1, kind: 'autoquant-studio-run', projectId: 'p1', runId: 'run-1',
    factorExplorer: {
      run: { status: 'succeeded' },
      protocol: { testRole: 'sealed' },
      summary: { validation: { meanRankIc: 0.0523, hacTStatistic: 2.5 } },
      quantileEvidence: { status: 'available' },
      predictionUniverse: { evaluationMode: 'cross-sectional', predictionAssets: ['a', 'b'] },
      quantilePath: { cumulative: { horizon: 5, basis: 'Compounded.', totalRows: 4, points: GROUP_POINTS } },
      spreadSummary: { status: 'available', basis: 'Gross.', splits: [{ split: 'validation', totalReturn: 0.1234 }, { split: 'test', totalReturn: 0.9876 }] },
      ...over,
    },
  } as unknown as RunPayload,
})

const FACTOR_SESSION = {
  id: 's1',
  session: { id: 's1', leader: { runId: 'run-1' } },
  selectionIntegrity: {
    selectionMetric: 'validation_mean_ic',
    researchFamily: { totalExecutions: 12 },
    selectionAdjustment: { passes: true, statistics: { familywiseAdjustedPValue: 0.031 } },
  },
}

const projectOf = (over: Overrides = {}): ProjectSnapshot => ({
  id: 'p1', name: 'P1', runs: [{ id: 'run-1', status: 'succeeded' }], sessions: [FACTOR_SESSION],
  portfolioExplorer: null, rlExplorer: null, bookRiskExplorer: null, bookPathStressExplorer: null, allocationExplorer: null, eventStudyExplorer: null,
  ...over,
}) as unknown as ProjectSnapshot
const ready = (project: ProjectSnapshot): SnapshotLoad => ({ state: 'ready', project })
const IDLE: RunLoad = { state: 'idle' }

const card = (state: ReturnType<typeof cardStateFor>, table?: Parameters<typeof ResultCardView>[0]['table'], run = 'run-1') =>
  <ResultCardView project="p1" run={run} state={state} table={table} />

// ---------------------------------------------------------------------------------------------
// Which Runs a turn produced

test('runRefsOf collects each Run once from created refs and direct run ids, keeping the Experiment', () => {
  const events = [
    { id: 'e1', type: 'text', at: '2026-11-22T10:00:00Z', data: { text: 'hello' } },
    { id: 'e2', type: 'artifact', at: '2026-11-22T10:01:00Z', data: { project: 'p1', createdRefs: { runId: 'run-1' } } },
    { id: 'e3', type: 'artifact', at: '2026-11-22T10:02:00Z', data: { project: 'p1', createdRefs: { runId: 'run-1', experimentId: 'exp-1', sessionId: 's1' } } },
    { id: 'e4', type: 'tool_result', at: '2026-11-22T10:03:00Z', data: { runId: 'run-2' } },
    { id: 'e5', type: 'artifact', at: '2026-11-22T10:04:00Z', data: { createdRefs: { runId: 'run-3' } } },
  ]
  assert.deepEqual(runRefsOf(events, 'pf'), [
    { project: 'p1', run: 'run-1', at: '2026-11-22T10:01:00Z', experimentId: 'exp-1' },
    { project: 'pf', run: 'run-2', at: '2026-11-22T10:03:00Z' },
    { project: 'pf', run: 'run-3', at: '2026-11-22T10:04:00Z' },
  ])
  assert.deepEqual(runRefsOf(events, null).map((ref) => ref.run), ['run-1'], 'a Run with no Project is not linkable, so it is not listed')
})

test('refsByTurn puts a turn\'s cards after its last message and never invents a turn', () => {
  const messages = [
    { id: 'm1', role: 'user', at: '2026-11-22T10:00:00Z' },
    { id: 'm2', role: 'assistant', at: '2026-11-22T10:00:30Z' },
    { id: 'm3', role: 'user', at: '2026-11-22T11:00:00Z' },
    { id: 'm4', role: 'assistant', at: '2026-11-22T11:00:30Z' },
    { id: 'm5', role: 'assistant', at: '2026-11-22T11:01:00Z' },
  ]
  const ref = (run: string, at: string): RunRef => ({ project: 'p1', run, at })
  const groups = refsByTurn(messages, [ref('a', '2026-11-22T10:00:10Z'), ref('b', '2026-11-22T11:00:10Z'), ref('c', '2026-11-22T11:00:40Z')])
  assert.deepEqual(groups.map((group) => [group.anchor, group.refs.map((r) => r.run)]), [['m2', ['a']], ['m5', ['b', 'c']]])
  assert.deepEqual(refsByTurn([], [ref('a', '2026-11-22T10:00:10Z')]).map((group) => group.anchor), [null])
  assert.deepEqual(refsByTurn(messages, []), [])
})

// ---------------------------------------------------------------------------------------------
// The card

test('Factor card with full data shows five published numbers, the group chart data and the evidence link', () => {
  const markup = html(card(cardStateFor('run-1', ready(projectOf()), factorPayload())))
  for (const label of ['Mean rank IC', 'HAC t', 'Adj[.] p', 'Long-short return \\(gross\\)', 'Trials counted']) assert.match(markup, new RegExp(label), label)
  for (const value of ['0\\.0523', '2\\.50', '0\\.031', '\\+12\\.3%', '>12<']) assert.match(markup, new RegExp(value), value)
  assert.match(markup, /passes/, 'the server-stated adjustment verdict sits beside the adjusted p')
  assert.equal((markup.match(/class="ct"/g) ?? []).length, 5)
  assert.doesNotMatch(markup, /Not published/, 'nothing is missing, so nothing says so')
  assert.match(markup, /Factor Run/)
  assert.match(markup, /succeeded/)
  assert.match(markup, /Group cumulative return/)
  assert.match(markup, /How to read|how to read/i, 'each metric keeps its catalogue explanation')
  // The chart's text alternative lists the drawn bars; the sealed test bar is not among them.
  assert.match(markup, /2024-06-03/)
  assert.match(markup, /2024-09-02/)
  assert.doesNotMatch(markup, /2099-01-02/)
  assert.doesNotMatch(markup, /0\.9876|98\.8/, 'no test number reaches the card')
})

test('the group chart draws the points of the card: validation and train bars, never a sealed test bar', () => {
  const load = factorPayload()
  assert.equal(load.state, 'ready')
  if (load.state !== 'ready') return
  const points = groupCurvePoints(load.payload.factorExplorer)
  assert.deepEqual(points.map((p) => p.timestamp.slice(0, 10)), ['2024-01-02', '2024-06-03', '2024-09-02'])
  const svg = html(<GroupPlot points={points} width={480} height={240} label="Group curves" />)
  assert.match(svg, /role="img"/)
  assert.match(svg, /aria-label="Group curves"/)
  assert.match(svg, /1\.060×/, 'the end label is the last published long-short growth')
  assert.doesNotMatch(svg, /2099|1\.080×/)
})

test('Factor card draws test bars and numbers only under the same rule as the Run page', () => {
  const visible = factorPayload({ protocol: { testRole: 'visible-diagnostic' }, summary: { validation: { meanRankIc: 0.0523, hacTStatistic: 2.5 }, testAudit: { meanRankIc: 0.4 } } })
  const markup = html(card(cardStateFor('run-1', ready(projectOf()), visible)))
  assert.match(markup, /2099-01-02/, 'a visible test audit shows its bar like the Factor page does')
  assert.doesNotMatch(markup, /0\.4000/, 'the card still lists validation numbers only')
})

test('Factor card with partial data says Not published and never shows a placeholder number', () => {
  const partial = factorPayload({
    summary: { validation: { meanRankIc: 0.0523 } },
    spreadSummary: { status: 'unavailable', splits: [] },
    quantileEvidence: { status: 'unavailable' },
    quantilePath: undefined,
  })
  const project = projectOf({ sessions: [{ id: 's2', session: { id: 's2', leader: { runId: 'another-run' } }, selectionIntegrity: FACTOR_SESSION.selectionIntegrity }] })
  const markup = html(card(cardStateFor('run-1', ready(project), partial)))
  assert.match(markup, /0\.0523/)
  // HAC t, adjusted p (not this Session's leader) and long-short return are missing; trials counted is published.
  assert.equal((markup.match(/Not published/g) ?? []).length, 3 + 1, 'three tiles and the chart say so')
  assert.match(markup, /The server does not publish group return curves for this Run\./)
  assert.doesNotMatch(markup, /NaN|undefined|null|>0\.000</)
  assert.doesNotMatch(markup, /Group cumulative return/, 'no empty chart frame is drawn')
  assert.match(markup, /Open full evidence/, 'the evidence page stays one click away')
})

test('a Run no published metric describes still gets a header and the evidence link', () => {
  const metrics = factorCardMetrics({} as never, null, 'run-1')
  assert.equal(metrics.length, 5)
  assert.ok(metrics.every((metric) => metric.value === null), 'an empty payload publishes nothing')
  const none = factorPayload({ summary: {}, spreadSummary: undefined, quantileEvidence: { status: 'unavailable' } })
  const markup = html(card(cardStateFor('run-1', ready(projectOf({ runs: [] })), none)))
  assert.equal((markup.match(/Not published/g) ?? []).length, 3 + 1, 'mean IC, HAC t and long-short return, plus the chart (adjusted p and trials are published for this leader)')
  assert.match(markup, /succeeded/, 'the status falls back to the one in the Run payload')
})

test('the deep link opens the Run on the full evidence page', () => {
  const markup = html(card(cardStateFor('run-1', ready(projectOf()), factorPayload())))
  const href = routeHref({ view: 'run', id: 'p1', run: 'run-1' })
  assert.match(markup, new RegExp(`<a class="abtn abtn--primary assistant-result-link" href="${href.replaceAll('&', '&amp;').replaceAll('?', '\\?')}"`))
  assert.deepEqual(parseRoute(new URL(href, 'http://studio.test').search), { view: 'run', id: 'p1', run: 'run-1' })
})

test('loading and error states keep the header and the link', () => {
  const loading = html(card(cardStateFor('run-1', undefined, IDLE)))
  assert.match(loading, /Loading the published result/)
  assert.match(loading, /Open full evidence/)
  const waiting = html(card(cardStateFor('run-1', ready(projectOf()), { state: 'loading' })))
  assert.match(waiting, /Loading the published result/)
  const failed = html(card(cardStateFor('run-1', { state: 'error', message: 'Unknown Project: p1' }, IDLE)))
  assert.match(failed, /This result could not be loaded/)
  assert.match(failed, /Unknown Project: p1/)
  const runFailed = html(card(cardStateFor('run-1', ready(projectOf()), { state: 'error', message: '422 not a factor', unsupported: true })))
  assert.match(runFailed, /This result could not be loaded/)
  assert.match(runFailed, /Open full evidence/)
})

const PF_POINTS = [
  { timestamp: '2024-01-02', split: 'train', netGrowth: 1.0 },
  { timestamp: '2024-06-03', split: 'validation', netGrowth: 1.08 },
  { timestamp: '2024-09-02', split: 'validation', netGrowth: 1.15 },
  { timestamp: '2099-01-02', split: 'test', netGrowth: 1.77 },
]
const portfolioProject = (over: Overrides = {}) => projectOf({
  runs: [{ id: 'run-pf', status: 'succeeded' }, { id: 'run-old', status: 'succeeded' }],
  portfolioExplorer: {
    run: { id: 'run-pf' },
    selection: { testRole: 'sealed', splits: { test: { start: '2099-01-01' } } },
    strategyViability: {
      validation: { net: { sharpe: 1.234, annualReturn: 0.0876, maximumDrawdown: -0.0912 }, friction: { annualizedOneWayTurnover: 3.4 } },
      test: { net: { sharpe: 9.99 } },
    },
    path: { points: PF_POINTS },
  },
  library: { strategy: { evidence: { runId: 'run-pf', selectionAdjustment: { statistics: { deflatedSharpeProbability: 0.834 } } } } },
  ...over,
})

test('Portfolio card shows the latest Run\'s validation net numbers, the run-matched DSR and the net curve points', () => {
  const markup = html(card(cardStateFor('run-pf', ready(portfolioProject()), IDLE), undefined, 'run-pf'))
  for (const label of ['Net Sharpe', 'Net annual return', 'Max drawdown', 'Deflated Sharpe']) assert.match(markup, new RegExp(label), label)
  for (const value of ['1\\.23', '\\+8\\.76%', '−9\\.12%', '83\\.4%', '3\\.4x']) assert.match(markup, new RegExp(value), value)
  assert.match(markup, /Portfolio Run/)
  assert.match(markup, /Net growth/)
  assert.doesNotMatch(markup, /Not published/)
  assert.match(markup, /2024-06-03/)
  assert.doesNotMatch(markup, /2099-01-02|1\.770|9\.99/, 'the sealed test bar and test numbers are never drawn')
  assert.deepEqual(portfolioCurvePoints(portfolioProject().portfolioExplorer).map((p) => p.timestamp), ['2024-01-02', '2024-06-03', '2024-09-02'])
})

test('Portfolio card for any other Run, or without a run-matched DSR, does not borrow the latest Run\'s numbers', () => {
  // run-old is not the latest Portfolio Run and the snapshot does not mark it a portfolio, so it is a Factor Run still waiting for its payload.
  const other = html(card(cardStateFor('run-old', ready(portfolioProject()), IDLE), undefined, 'run-old'))
  assert.match(other, /Loading the published result/)
  assert.doesNotMatch(other, /1\.23|8\.76|83\.4/)
  const project = portfolioProject({ library: { strategy: { evidence: { runId: 'run-other', selectionAdjustment: { statistics: { deflatedSharpeProbability: 0.5 } } } } } })
  const markup = html(card(cardStateFor('run-pf', ready(project), IDLE), undefined, 'run-pf'))
  assert.match(markup, /1\.23/)
  assert.doesNotMatch(markup, /50\.0%/, 'a DSR computed for another Run is not shown for this one')
  assert.equal((markup.match(/Not published/g) ?? []).length, 1, 'only the deflated Sharpe is missing')
})

test('a Portfolio Run the snapshot only lists (not its latest) shows Not published for every figure and says why', () => {
  const project = portfolioProject({
    runs: [{ id: 'run-pf', status: 'succeeded' }, { id: 'run-old', status: 'succeeded', metricLayers: { kind: 'portfolio' } }],
  })
  const markup = html(card(cardStateFor('run-old', ready(project), IDLE), undefined, 'run-old'))
  assert.equal((markup.match(/Not published/g) ?? []).length, 5 + 1, 'five tiles and the chart')
  assert.match(markup, /carries only the latest Portfolio Run/)
  assert.doesNotMatch(markup, /1\.23|8\.76|83\.4/)
})

test('another lane gets a header and the link, with no figures the page does not publish', () => {
  const project = projectOf({ runs: [{ id: 'run-rl', status: 'succeeded' }], rlExplorer: { run: { id: 'run-rl' } } })
  const markup = html(card(cardStateFor('run-rl', ready(project), IDLE), undefined, 'run-rl'))
  assert.match(markup, /RL policy/)
  assert.doesNotMatch(markup, /class="ct"/)
  assert.match(markup, /full evidence page/)
  assert.match(markup, /Open full evidence/)
})

test('PortfolioNetPlot draws the published net points and nothing else', () => {
  const points = portfolioCurvePoints(portfolioProject().portfolioExplorer)
  const svg = html(<PortfolioNetPlot points={points} width={480} height={240} label="Net growth" />)
  assert.match(svg, /role="img"/)
  assert.match(svg, /aria-label="Net growth"/)
  assert.match(svg, /2024-01-02/)
  assert.match(svg, /1\.150/, 'the end label is the last published net growth')
  assert.doesNotMatch(svg, /1\.770/)
})

test('the card is Chinese in zh and keeps the same numbers', () => {
  const markup = html(() => card(cardStateFor('run-1', ready(projectOf()), factorPayload())), 'zh')
  for (const text of ['因子运行', '打开完整证据', '结果指标', '验证集', '多空收益（毛）', '分组累计收益']) assert.match(markup, new RegExp(text), text)
  assert.match(markup, /0\.0523/)
  assert.doesNotMatch(markup, /Open full evidence|Result metrics/)
  const missing = html(() => card(cardStateFor('run-1', ready(projectOf({ sessions: [] })), factorPayload({ summary: {}, quantileEvidence: { status: 'unavailable' } }))), 'zh')
  assert.match(missing, /未发布/)
  assert.match(missing, /服务端没有发布这次运行的分组收益曲线/)
})

test('only the latest cards of a turn are shown and the rest point to Artifacts', () => {
  const refs: RunRef[] = Array.from({ length: MAX_CARDS_PER_TURN + 2 }, (_, i) => ({ project: 'p1', run: `run-${i + 1}`, at: '2026-11-22T10:00:00Z' }))
  const markup = html(<TurnCards refs={refs} snapshots={{}} />)
  assert.equal((markup.match(/class="assistant-result /g) ?? []).length, MAX_CARDS_PER_TURN)
  assert.doesNotMatch(markup, />run-1</)
  assert.match(markup, new RegExp(`>run-${MAX_CARDS_PER_TURN + 2}<`))
  assert.match(markup, /2 earlier Runs from this turn are listed under Artifacts\./)
  assert.match(markup, /aria-live="off"/)
  assert.match(html(<TurnCards refs={refs.slice(0, 1)} snapshots={{}} />), /^(?!.*earlier Run)/)
})

// ---------------------------------------------------------------------------------------------
// Before and after one counted trial

const trial = (over: Overrides) => ({
  role: 'candidate', sequence: 1, experimentId: 'exp-1', runId: 'run-k1', status: 'succeeded', verdict: 'KEEP', hypothesis: 'h',
  primaryValue: 0.05, objectiveImprovementVsBaseline: 0.01, isCurrentLeader: false, errors: [],
  priorLeaderRunId: 'run-base', objectiveImprovementVsPriorLeader: 0.0123,
  metrics: {}, ...over,
})

const MATRIX = {
  objective: { direction: 'maximize', metric: 'validationMeanIc' },
  scope: { trialLimit: 12, totalCandidateTrials: 3, displayedCandidateTrials: 3, omittedCandidateTrials: 0 },
  metrics: [
    { key: 'validationMeanIc', label: 'Mean rank IC', group: 'factor', split: 'validation', unit: 'number', preference: 'higher', selectionEligible: true, primary: true },
    { key: 'validationNetSharpe', label: 'Net Sharpe', group: 'portfolio', split: 'validation', unit: 'ratio', preference: 'higher', selectionEligible: true, primary: false },
    { key: 'validationCostDrag', label: 'Total cost drag', group: 'portfolio', split: 'validation', unit: 'percent', preference: 'lower', selectionEligible: true, primary: false },
    { key: 'validationCapacity', label: 'Context only', group: 'portfolio', split: 'validation', unit: 'number', preference: 'context', selectionEligible: false, primary: false },
    { key: 'testMeanIc', label: 'Test mean IC', group: 'factor', split: 'test', unit: 'number', preference: 'higher', selectionEligible: true, primary: false },
  ],
  trials: [
    trial({ role: 'baseline', sequence: 0, experimentId: null, runId: 'run-base', verdict: 'BASELINE', priorLeaderRunId: null, objectiveImprovementVsPriorLeader: null,
      metrics: { validationMeanIc: 0.03, validationNetSharpe: 0.8, validationCostDrag: 0.012, validationCapacity: 5, testMeanIc: 0.9876 } }),
    trial({ sequence: 1, experimentId: 'exp-1', runId: 'run-k1', verdict: 'KEEP', isCurrentLeader: true, priorLeaderRunId: 'run-base', objectiveImprovementVsPriorLeader: 0.0123,
      metrics: { validationMeanIc: 0.0423, validationNetSharpe: 1.1, validationCostDrag: null, validationCapacity: 6, testMeanIc: 0.1234 } }),
    trial({ sequence: 2, experimentId: 'exp-2', runId: 'run-k2', verdict: 'REVERT', priorLeaderRunId: 'run-k1', objectiveImprovementVsPriorLeader: -0.004,
      metrics: { validationMeanIc: 0.0383, validationNetSharpe: 0.9, validationCostDrag: 0.02, validationCapacity: 4, testMeanIc: 0.5555 } }),
  ],
}
const sessionWith = (matrix: unknown, extra: Overrides = {}) => ({ id: 's1', session: { id: 's1' }, decisionMatrix: matrix, experiments: [], ...extra })
const matrixProject = (matrix: unknown = MATRIX) => projectOf({ sessions: [sessionWith(matrix)] })

test('after a counted trial the table lists the previous kept result beside this trial, same validation metrics', () => {
  const table = completedTrialTable(matrixProject(), 'exp-2')
  assert.equal(table.kind, 'ready')
  if (table.kind !== 'ready') return
  assert.equal(table.mode, 'completed')
  assert.equal(table.beforeRun, 'run-k1')
  assert.equal(table.afterRun, 'run-k2')
  assert.equal(table.verdict, 'REVERT')
  assert.deepEqual(table.rows.map((row) => row.key), ['validationMeanIc', 'validationNetSharpe', 'validationCostDrag'], 'test and context metrics are never listed')
  assert.deepEqual(table.rows.map((row) => [row.before, row.after]), [['0.0423', '0.0383'], ['1.10', '0.90'], [null, '+2.00%']])
  const markup = html(<BeforeAfterView table={table} />)
  assert.match(markup, /Before and after/)
  assert.match(markup, /Kept trial 1/)
  assert.match(markup, /This trial/)
  assert.match(markup, /0\.0423/)
  assert.match(markup, /0\.0383/)
  assert.match(markup, /PRIMARY/)
  assert.match(markup, /Verdict/)
  assert.match(markup, /REVERT/)
  assert.match(markup, /−0\.0040/, 'the primary-objective change is the server\'s own number, formatted only')
  assert.match(markup, /Not published/, 'a value the trial did not publish says so')
  assert.doesNotMatch(markup, /0\.9876|0\.1234|0\.5555|Test mean IC|Context only/, 'no test or context value is listed')
})

test('the first counted trial compares with the baseline; a baseline row has no previous result', () => {
  const table = completedTrialTable(matrixProject(), 'exp-1')
  assert.equal(table.kind, 'ready')
  if (table.kind === 'ready') assert.equal(table.beforeTitle, 'Baseline')
  assert.match(html(<BeforeAfterView table={table} />), /Baseline/)
})

test('without a previous kept result the table says so instead of inventing one', () => {
  const noMatrix = completedTrialTable(projectOf({ sessions: [sessionWith(null, { experiments: [{ id: 'exp-1' }] })] }), 'exp-1')
  assert.equal(noMatrix.kind, 'none')
  const unknown = completedTrialTable(matrixProject({ ...MATRIX, trials: [MATRIX.trials[0]] }), 'exp-9')
  assert.equal(unknown.kind, 'none')
  const baselineOnly = completedTrialTable(matrixProject({ ...MATRIX, trials: [{ ...MATRIX.trials[1], priorLeaderRunId: null }] }), 'exp-1')
  assert.equal(baselineOnly.kind, 'none')
  assert.match(html(<BeforeAfterView table={baselineOnly} />), /No previous kept result exists for this candidate yet\./)
  const older = completedTrialTable(matrixProject({ ...MATRIX, trials: [{ ...MATRIX.trials[1], priorLeaderRunId: undefined }] }), 'exp-1')
  assert.match(html(<BeforeAfterView table={older} />), /does not publish which result was kept/)
  const truncated = completedTrialTable(matrixProject({ ...MATRIX, trials: [MATRIX.trials[2]] }), 'exp-2')
  assert.match(html(<BeforeAfterView table={truncated} />), /outside the 3 displayed trials/)
  assert.match(html(<BeforeAfterView table={{ kind: 'loading' }} />), /Loading the previous kept result/)
})

test('a counted trial\'s card carries the table; a card for any other Run does not', () => {
  const project = matrixProject()
  const withTable = html(card(cardStateFor('run-k2', ready(project), factorPayload()), completedTrialTable(project, 'exp-2'), 'run-k2'))
  assert.match(withTable, /Before and after/)
  assert.doesNotMatch(html(card(cardStateFor('run-1', ready(project), factorPayload()))), /Before and after/)
})

const PREVIEW = {
  actionId: 'a1', project: 'p1', params: { session: 's1', hypothesis: 'x' }, display: 'aq experiment evaluate', commandHash: 'abc123', argv: null,
  trial: { n: 3, m: 14, notice: 'Counts as one trial.', adjustment: null }, requiresSecondConfirm: false,
}
const sessionFor = (preview: Overrides): never => ({
  id: 'chat', title: 't', provider: 'claude', project: 'p1', status: 'awaiting-confirmation', trialBudget: 10, usedTrials: 2,
  messages: [], events: [], pendingAction: { id: 'a1', preview },
}) as never
const confirmation = (preview: Overrides, snapshot?: SnapshotLoad) => <Confirmation session={sessionFor(preview)} busy={false} snapshot={snapshot} onConfirm={() => {}} />

test('the confirmation of a counted trial shows the kept result it will be compared with', () => {
  const markup = html(confirmation(PREVIEW, ready(matrixProject())))
  assert.match(markup, /Review the next action/)
  assert.match(markup, /Before and after/)
  assert.match(markup, /Kept trial 1/, 'the Session\'s current leader is the previous kept result')
  assert.match(markup, /0\.0423/)
  assert.match(markup, /This trial runs only after you confirm/)
  assert.doesNotMatch(markup, /0\.9876|0\.1234|Test mean IC/)
  // Confirmation, budget and the exact command are unchanged.
  assert.match(markup, /Trial 3 of 10 in this chat\./)
  assert.match(markup, /Confirm and run/)
  assert.match(markup, /aq experiment evaluate/)
  assert.match(markup, /Counts as one trial\./)
})

test('the confirmation says when no previous result exists and when it could not be loaded', () => {
  const start = html(confirmation({ ...PREVIEW, params: { project: 'p1' } }, ready(matrixProject())))
  assert.match(start, /No previous kept result exists for this candidate yet\./)
  const loading = html(confirmation(PREVIEW, undefined))
  assert.match(loading, /Loading the previous kept result/)
  const failed = html(confirmation(PREVIEW, { state: 'error', message: 'down' }))
  assert.match(failed, /The previous kept result could not be loaded\./)
  assert.deepEqual(confirmationTable({ state: 'error', message: 'x' }, PREVIEW).kind, 'none')
  assert.equal(pendingTrialTable(matrixProject(), { params: { session: 'no-such' } }).kind, 'none')
})

test('an action that is not a counted trial gets the plain confirmation', () => {
  const markup = html(confirmation({ ...PREVIEW, trial: null }, ready(matrixProject())))
  assert.doesNotMatch(markup, /Before and after/)
  assert.match(markup, /Confirm and run/)
})

test('the before/after table is Chinese in zh', () => {
  const markup = html(() => <BeforeAfterView table={completedTrialTable(matrixProject(), 'exp-2')} />, 'zh')
  for (const text of ['试验前后', '本次试验', '判决', '未发布', '已保留的第 1 次试验', '平均秩 IC']) assert.match(markup, new RegExp(text), text)
  assert.doesNotMatch(markup, /Before and after|This trial/)
})
