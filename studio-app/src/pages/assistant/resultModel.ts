import { getLanguage, translate, uiValue } from '../../i18n'
import type { ProjectSnapshot, SessionSnapshot, TrialRow } from '../../api'
import { pickIntegrity } from '../../components/TrialCounter'
import { bi, metricEntry, type MetricId } from '../../metrics/catalogue'
import { num } from '../../format'
import { signedNumber } from '../../design/signConvention'
import { fn, finite, sp, up } from '../portfolio/pfmt'
import type { PathPoint, PortfolioDiagnostics } from '../portfolio/portfolioTypes'
import { otherLaneOf, type RunDiagnostics } from '../run/runTypes'

/**
 * Pure view model of the Assistant's result card and before/after table. Every number comes from a projection the server
 * already serves (Run payload, Project snapshot, Session decision matrix) and is only formatted here: no statistic, ranking
 * or verdict is computed. A value the server does not publish is `null`, which the view shows as "Not published".
 */

const L = (en: string, zh: string): string => translate(getLanguage(), en, zh)

// ---------------------------------------------------------------------------------------------
// Which Runs a chat turn produced or linked

export type AssistantEventLike = { id: string; type: string; at: string; data: Record<string, unknown> }
export type MessageLike = { id: string; role: string; at: string }
export type RunRef = { project: string; run: string; experimentId?: string; at: string }

/** Every Run the events record, once each, in order. An Experiment id seen on any event for the Run is kept with it. */
export function runRefsOf(events: AssistantEventLike[], fallbackProject: string | null | undefined): RunRef[] {
  const refs: RunRef[] = []
  for (const event of events) {
    const data = event.data ?? {}
    const created = data.createdRefs && typeof data.createdRefs === 'object' ? (data.createdRefs as Record<string, unknown>) : data
    const project = typeof data.project === 'string' ? data.project : fallbackProject
    const run = created.runId
    if (!project || typeof run !== 'string') continue
    const experimentId = typeof created.experimentId === 'string' ? created.experimentId : undefined
    const known = refs.find((ref) => ref.project === project && ref.run === run)
    if (known) {
      if (experimentId && !known.experimentId) known.experimentId = experimentId
      continue
    }
    refs.push({ project, run, at: event.at, ...(experimentId ? { experimentId } : {}) })
  }
  return refs
}

export type TurnRefs = { anchor: string | null; refs: RunRef[] }

const time = (iso: string): number => Date.parse(iso)

/**
 * Refs grouped by chat turn. A turn starts at a user message and runs to the next one; its cards sit after the last message
 * of that turn (`anchor`). With no messages the refs share one group with no anchor. Refs with no readable time go to the last turn.
 */
export function refsByTurn(messages: MessageLike[], refs: RunRef[]): TurnRefs[] {
  if (!refs.length) return []
  const turns: { start: number; anchor: string }[] = []
  for (const message of messages) {
    if (message.role === 'user' || !turns.length) turns.push({ start: time(message.at), anchor: message.id })
    else turns[turns.length - 1].anchor = message.id
  }
  if (!turns.length) return [{ anchor: null, refs }]
  const groups: TurnRefs[] = turns.map((turn) => ({ anchor: turn.anchor, refs: [] }))
  for (const ref of refs) {
    const at = time(ref.at)
    let index = groups.length - 1
    if (Number.isFinite(at)) {
      index = 0
      turns.forEach((turn, i) => { if (Number.isFinite(turn.start) && turn.start <= at) index = i })
    }
    groups[index].refs.push(ref)
  }
  return groups.filter((group) => group.refs.length)
}

// ---------------------------------------------------------------------------------------------
// The five numbers of the card

export type CardLane = 'factor' | 'portfolio' | 'other'

export type CardMetric = {
  id: MetricId
  label: string
  /** Formatted value, or null when the server does not publish it for this Run. */
  value: string | null
  /** A short server-stated qualifier shown beside the value (for example whether the adjustment passes). */
  note?: string
}

const entryLabel = (id: MetricId): string => bi(metricEntry(id).label)
const show = (value: number | null | undefined, format: (v: number) => string): string | null => (finite(value) ? format(value) : null)

/** Which lane a Run belongs to, read from the Project snapshot: Factor unless the snapshot says otherwise. */
export function cardLane(project: ProjectSnapshot, runId: string): { lane: CardLane; name?: string } {
  const other = otherLaneOf(project, runId)
  if (!other) return { lane: 'factor' }
  return other.view === 'portfolio' ? { lane: 'portfolio', name: other.lane } : { lane: 'other', name: other.lane }
}

/**
 * The Session ledger's selection adjustment, only when this Run is that Session's current leader: the ledger describes the
 * selected leader, so for any other Run it is not a property of the Run on screen and the card shows it as not published.
 */
export function adjustmentForRun(project: ProjectSnapshot | null, runId: string) {
  if (!project) return undefined
  return project.sessions.find((session) => session.selectionIntegrity?.selectionMetric === 'validation_mean_ic' && session.session?.leader?.runId === runId)
    ?.selectionIntegrity?.selectionAdjustment
}

/**
 * Factor Run, validation split only: mean rank IC and HAC t (strength and significance of the ranking), the Session's
 * family-wise adjusted p (when this Run is the leader), the validation long-short total return (gross of costs, the figure
 * the chart draws) and the research family's counted trials.
 */
export function factorCardMetrics(fe: RunDiagnostics, project: ProjectSnapshot | null, runId: string): CardMetric[] {
  const validation = fe.summary?.validation
  const spread = fe.spreadSummary?.status === 'available' ? fe.spreadSummary.splits.find((split) => split.split === 'validation') : undefined
  const adjustment = adjustmentForRun(project, runId)
  const trials = project ? pickIntegrity(project)?.researchFamily?.totalExecutions : undefined
  const passes = adjustment?.passes
  return [
    { id: 'meanRankIc', label: entryLabel('meanRankIc'), value: show(validation?.meanRankIc, (v) => num(v, 4)) },
    { id: 'hacT', label: entryLabel('hacT'), value: show(validation?.hacTStatistic, (v) => num(v, 2)) },
    {
      id: 'adjustedP',
      label: entryLabel('adjustedP'),
      value: show(adjustment?.statistics?.familywiseAdjustedPValue, (v) => num(v, 3)),
      ...(passes === true ? { note: L('passes', '通过') } : passes === false ? { note: L('does not pass', '未通过') } : {}),
    },
    { id: 'spreadTotalReturn', label: L('Long-short return (gross)', '多空收益（毛）'), value: show(spread?.totalReturn, (v) => signedNumber(v * 100, 1, '%')) },
    { id: 'trialsCounted', label: entryLabel('trialsCounted'), value: show(trials, (v) => v.toLocaleString('en-US')) },
  ]
}

/** Portfolio Run: validation net numbers of the latest Portfolio Run (the only one the Project snapshot projects) and its run-matched DSR. */
export function portfolioCardMetrics(project: ProjectSnapshot | null, runId: string): CardMetric[] {
  const explorer = project?.portfolioExplorer
  const own = explorer?.run?.id === runId
  const validation = own ? explorer?.strategyViability?.validation : undefined
  const evidence = project?.library?.strategy?.evidence
  const dsr = evidence?.runId === runId ? evidence.selectionAdjustment?.statistics?.deflatedSharpeProbability : undefined
  return [
    { id: 'netSharpe', label: entryLabel('netSharpe'), value: show(validation?.net?.sharpe, (v) => fn(v, 2)) },
    { id: 'netAnnualReturn', label: entryLabel('netAnnualReturn'), value: show(validation?.net?.annualReturn, (v) => sp(v)) },
    { id: 'maxDrawdown', label: entryLabel('maxDrawdown'), value: show(validation?.net?.maximumDrawdown, (v) => sp(v)) },
    { id: 'deflatedSharpe', label: L('Deflated Sharpe', '折减 Sharpe'), value: show(dsr, (v) => up(v, 1)) },
    { id: 'turnover', label: entryLabel('turnover'), value: show(validation?.friction?.annualizedOneWayTurnover, (v) => `${fn(v, 1)}x`) },
  ]
}

/** The Portfolio Run's net-growth path, with every test-split point removed unless the protocol and payload make the test audit visible (the Portfolio page's rule). */
export function portfolioCurvePoints(pf: PortfolioDiagnostics | null | undefined): PathPoint[] {
  if (!pf) return []
  const testVisible = pf.selection?.testRole === 'visible-diagnostic' && !!pf.strategyViability?.test
  const testStart = pf.selection?.splits?.test?.start
  const outsideTest = (date: string | undefined) => testVisible || !testStart || !date || date < testStart
  return (pf.path?.points ?? [])
    .filter((point) => point.timestamp && finite(point.netGrowth))
    .filter((point) => testVisible || (point.split !== 'test' && outsideTest(point.timestamp)))
}

// ---------------------------------------------------------------------------------------------
// Before and after one counted trial

export type TableRow = { key: string; label: string; primary: boolean; before: string | null; after: string | null }

export type TrialTable =
  | { kind: 'loading' }
  | { kind: 'none'; message: string }
  | {
      kind: 'ready'
      mode: 'pending' | 'completed'
      /** Which result the "before" column is. */
      beforeTitle: string
      beforeRun: string
      afterRun: string | null
      verdict: string | null
      /** Server-stated change of the primary objective against the previous kept result, formatted. */
      improvement: string | null
      objective: string | null
      rows: TableRow[]
    }

type Matrix = NonNullable<SessionSnapshot['decisionMatrix']>

const sessionIdOf = (session: SessionSnapshot): string | undefined => session.session?.id ?? session.id

/** The server's own unit tag decides the format. */
function formatMatrixValue(unit: string, value: number | null | undefined): string | null {
  if (!finite(value)) return null
  if (unit === 'percent') return sp(value, 2)
  if (unit === 'ratio') return fn(value, 2)
  if (unit === 'count') return fn(value, 0)
  return fn(value, 4)
}

/**
 * Rows for the validation, selection-eligible, non-context matrix metrics: the exact set Core compares trials on. Test and
 * context metrics are never listed, so a hidden test number cannot appear here.
 */
function tableRows(matrix: Matrix, before: TrialRow, after: TrialRow | null): TableRow[] {
  return (matrix.metrics ?? [])
    .filter((metric) => metric.split === 'validation' && metric.selectionEligible && metric.preference !== 'context')
    .map((metric) => ({
      key: metric.key,
      label: uiValue(metric.label),
      primary: metric.primary,
      before: formatMatrixValue(metric.unit, before.metrics?.[metric.key]),
      after: after ? formatMatrixValue(metric.unit, after.metrics?.[metric.key]) : null,
    }))
}

const none = (message: string): TrialTable => ({ kind: 'none', message })
const noPrevious = (): TrialTable => none(L('No previous kept result exists for this candidate yet.', '这个候选还没有以前保留的结果。'))

function beforeTitle(trial: TrialRow): string {
  return trial.role === 'baseline' ? L('Baseline', '基线') : L(`Kept trial ${trial.sequence}`, `已保留的第 ${trial.sequence} 次试验`)
}

/** The primary objective's change against the previous kept result, exactly as the server states it for the trial. */
function improvementOf(matrix: Matrix, trial: TrialRow): { improvement: string | null; objective: string | null } {
  return { improvement: show(trial.objectiveImprovementVsPriorLeader, (v) => signedNumber(v, 4)), objective: matrix.objective?.metric ?? null }
}

/**
 * Confirmation of a counted trial: the result this trial will be compared against (the Session's kept leader) beside an
 * empty "this trial" column. Needs the Session id from the previewed action; without a Session (a Session start) or without
 * a published matrix there is no previous result, and the table says so.
 */
export function pendingTrialTable(project: ProjectSnapshot | null, preview: { params?: Record<string, unknown> | null } | null | undefined): TrialTable {
  const sessionId = preview?.params?.session
  if (typeof sessionId !== 'string') return noPrevious()
  if (!project) return { kind: 'loading' }
  const session = project.sessions.find((item) => sessionIdOf(item) === sessionId)
  const matrix = session?.decisionMatrix
  const leader = matrix?.trials?.find((trial) => trial.isCurrentLeader)
  if (!matrix || !leader) return noPrevious()
  return {
    kind: 'ready',
    mode: 'pending',
    beforeTitle: beforeTitle(leader),
    beforeRun: leader.runId,
    afterRun: null,
    verdict: null,
    improvement: null,
    objective: matrix.objective?.metric ?? null,
    rows: tableRows(matrix, leader, null),
  }
}

/** After a counted trial: the previously kept result against this trial's result, same metrics, from the Session's decision matrix. */
export function completedTrialTable(project: ProjectSnapshot | null, experimentId: string): TrialTable {
  if (!project) return { kind: 'loading' }
  const session = project.sessions.find((item) => item.decisionMatrix?.trials?.some((trial) => trial.experimentId === experimentId) || item.experiments?.some((row) => row.id === experimentId))
  const matrix = session?.decisionMatrix
  if (!matrix) return noPrevious()
  const trials = matrix.trials ?? []
  const trial = trials.find((item) => item.experimentId === experimentId)
  if (!trial) return none(L('This trial is outside the displayed trials of its Session.', '这次试验不在其会话已展示的试验中。'))
  if (trial.priorLeaderRunId === undefined) return none(L('This server does not publish which result was kept before this trial.', '这个服务端没有发布这次试验之前保留的是哪一个结果。'))
  if (trial.priorLeaderRunId === null) return noPrevious()
  const prior = trials.find((item) => item.runId === trial.priorLeaderRunId)
  if (!prior) {
    const shown = matrix.scope?.displayedCandidateTrials ?? trials.length
    return none(L(`The previous kept result is outside the ${shown} displayed trials.`, `之前保留的结果不在已展示的 ${shown} 次试验中。`))
  }
  return {
    kind: 'ready',
    mode: 'completed',
    beforeTitle: beforeTitle(prior),
    beforeRun: prior.runId,
    afterRun: trial.runId,
    verdict: trial.verdict,
    ...improvementOf(matrix, trial),
    rows: tableRows(matrix, prior, trial),
  }
}
