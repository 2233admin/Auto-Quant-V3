import type { ActionsBootstrap } from './actions/types'
import type { PortfolioDiagnostics } from './pages/portfolio/portfolioTypes'
/** Wire types for the Studio routes this app reads. Only fields the pages use are typed. */

export type HoldoutState = { present: boolean; status: string | null }

export type ProjectSummary = {
  id: string
  name: string
  description: string | null
  valid: boolean
  diagnostics: number
  counts: Record<string, number | Record<string, number>>
  studies: { id: string; name: string; subjectKind: string }[]
  runCount: number
  latestRunAt: string | null
  brief: { headline: string | null; lane: string | null; stage: string | null; mode: string | null }
  externalHoldout: HoldoutState
}

export type Harness = { id: string; version: string; commit: string | null; dirty: boolean }

export type WorkspaceSummary = {
  kind: 'autoquant-studio-workspace-summary'
  generatedAt: string
  harness: Harness
  source: { scope: string; rootDir: string; workspace: { name: string } | null }
  valid: boolean
  diagnostics: { path?: string; code?: string; message?: string }[]
  projects: ProjectSummary[]
  /** Present only when Studio was started with --allow-actions; absent means read-only. */
  actions?: ActionsBootstrap
}

export type StudyRow = {
  id: string
  name: string
  description: string
  subjectKind: string
  primaryMetric: string
  direction: string
}

export type RunRow = {
  id: string
  status: string
  studyId: string
  subject: { kind: string; name: string }
  primaryMetric: string
  primaryValue: number | null
  startedAt: string
  summary: string
  /** Present on current servers; the shape of an error entry is not fixed, so it is rendered defensively. */
  errors?: unknown[]
  failureDisposition?: string | null
  durationMs?: number | null
}

export type TimelineRow = {
  kind: string
  id: string
  at: string
  status: string
  title: string
  value: number | null
}

export type ProjectSnapshot = {
  id: string
  name: string
  description: string
  valid: boolean
  diagnostics: { message?: string }[]
  counts: Record<string, number | Record<string, number>>
  studies: StudyRow[]
  runs: RunRow[]
  sessions: SessionSnapshot[]
  timeline: TimelineRow[]
  externalHoldout: { status?: string; state?: string } | null
  runReports?: ReportRow[]
  reviews?: ReportRow[]
  dossiers?: ReportRow[]
  agentWorkBrief: {
    focus?: { laneName?: string | null; studyName?: string; scientificStage?: string; operatingMode?: string }
    question?: { title?: string; text?: string; origin?: string } | null
    researchAgenda?: ResearchAgenda | null
    review?: { status?: string; label?: string; detail?: string; next?: string; boundary?: string } | null
    reasons?: { code?: string; message?: string }[]
    primaryAction?: { description?: string; display?: string }
    authority?: { selectionSplit?: string; testRole?: string; testEntersSelection?: boolean; tradingAuthority?: string }
  } | null
  factorExplorer: FactorDiagnostics | null
  /** Lane explorers other than Factor: present means the lane has evidence; each has a native page here (Portfolio, RL, Book Risk, event study, path stress, Allocation). */
  portfolioExplorer: PortfolioDiagnostics | null
  rlExplorer: object | null
  bookRiskExplorer: object | null
  eventStudyExplorer: EventStudyDiagnostics | null
  bookPathStressExplorer: object | null
  allocationExplorer: object | null
}

export type ProjectResponse = { harness: Harness; projects: ProjectSnapshot[] }

export class ApiError extends Error {
  status?: number
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const message = body?.error?.message ?? `${response.status} ${response.statusText}`
    const error = new ApiError(message)
    error.status = response.status
    throw error
  }
  return body as T
}

/** One rate: N and successes always present; estimate and ci95 are null when the guard withholds them. */
export type EnvelopeRate = {
  n: number
  successes: number
  guard: 'ok' | 'small-sample' | 'withheld'
  estimate: number | null
  ci95: [number, number] | null
}

export type EnvelopeStability = { firstHalf: EnvelopeRate; secondHalf: EnvelopeRate; agree: boolean | null }

export type EnvelopeOutcome = EnvelopeRate & { stability: EnvelopeStability; perYear: (EnvelopeRate & { year: number })[] }

export type EnvelopeDistribution = {
  n: number
  mean: number | null
  minimum: number | null
  maximum: number | null
  quantiles: Record<'p10' | 'p25' | 'p50' | 'p75' | 'p90', number | null>
}

export type EventStudyEvent = {
  eventIndex: number
  eventTimestamp: string
  entryTimestamp: string | null
  exitTimestamp: string | null
  gapReturn: number
  outcomeStatus: 'complete' | 'right-censored'
  primaryEligible: boolean
  overlapReason: string
  assetReturn: number | null
  referenceReturn: number | null
  excessReturn: number | null
}

export type EventStudyDiagnostics = {
  run: { id: string; status: string }
  dataset: { asset: string; referenceAsset: string; alignedObservations: number; timeRange: { start?: string; end?: string } | null }
  policy: {
    event: { asset: string; comparator: string; thresholdReturn: number }
    timing: { waitBars: number; holdingBars: number }
    references: { matchedAsset: string }
    population: { minimumEvents: number }
  }
  populations: {
    qualifyingEvents: number
    completeEvents: number
    rightCensoredEvents: number
    primaryEvents: number
    overlapExcludedEvents: number
    unconditionalObservations: number
  }
  conclusion: { status: string; minimumEvents: number; observedPrimaryEvents: number; tradingAuthority: string }
  envelope: {
    method: string
    confidenceLevel: number
    population: string
    guards: { warnBelow: number; withholdBelow: number }
    outcomes: { primaryPositiveReturn: EnvelopeOutcome; primaryPositiveExcess: EnvelopeOutcome }
    unconditionalPositiveReturn: { n: number; successes: number; estimate: number | null; ci95: null; intervalWithheldReason: string }
    returnDistribution: EnvelopeDistribution
    excessDistribution: EnvelopeDistribution
    disclaimer: string
  }
  events: EventStudyEvent[]
  warning: string
}

export type FactorSplit = 'train' | 'validation' | 'test'

/** One split's rank-IC summary. HAC t and p are null when the variance estimate is degenerate. */
export type RankSummary = {
  meanRankIc: number | null
  rankIcStandardDeviation: number | null
  rankIcir: number | null
  rankHitRate: number | null
  observations: number
  minimumObservations: number
  sufficient: boolean
  hacTStatistic: number | null
  hacNormalPValue: number | null
  /** Pearson IC mean for the same split; present on current servers. */
  meanPearsonIc?: number | null
  pearsonIcir?: number | null
}

/** One row of `stability.chronologicalFolds` (and the qualification fold lists): a rank-IC summary with its fold id. */
export type FactorFold = RankSummary & { id: string; split: FactorSplit; role: string }
export type FactorRegimeRow = RankSummary & { split: FactorSplit; role: string; regime: string }
export type FactorAssetRow = { split: FactorSplit; role: string; asset: string; rankCorrelation: number | null; observations: number }
export type FactorStyleRow = {
  split: FactorSplit
  role: string
  style: string
  meanRankCorrelation: number | null
  meanAbsoluteRankCorrelation: number | null
  observations: number
}
/** The four factor variants the qualification funnel compares, per split. */
export type FactorQualificationSplit = {
  role: string
  candidate: RankSummary
  dominantStyle: RankSummary
  styleNeutralCandidate: RankSummary
  equalRankBlend: RankSummary
  incremental: Record<string, number | null>
  candidateChronologicalFolds: FactorFold[]
  weakestCandidateFold: FactorFold | null
}

export type FactorHorizonRow = { horizon: number } & Record<FactorSplit, RankSummary & { role: string }>

export type FactorSplitWindow = { start: string; end: string; rows: number; role: string }

export type FactorIcPoint = {
  timestamp: string
  split: FactorSplit
  role: string
  regime: string
} & Record<string, string | number | null>

export type FactorQuantileRow = {
  horizon: number
  split: FactorSplit
  role: string
  low: number | null
  middle: number | null
  high: number | null
  highMinusLow: number | null
  monotonicity: number | null
  observations: number
}

/** One point of the compounded group curves: growth multiples starting near 1.0 (1.23 = +23%), gross of costs. */
export type FactorCumulativePoint = {
  timestamp: string
  split: FactorSplit
  role: string
  low: number
  middle: number
  high: number
  /** Compounded high-minus-low long-short curve. */
  spread: number
}

/** Long-short (high minus low) statistics of one split, per bar, gross of costs. Every field optional: older Cores send none. */
export type FactorSpreadStats = {
  observations?: number
  meanPerBar?: number | null
  volatilityPerBar?: number | null
  sharpePerBar?: number | null
  totalReturn?: number | null
  /** At most 0. */
  maximumDrawdown?: number | null
  hitRate?: number | null
  basis?: string
}

export type FactorSpreadSplit = FactorSpreadStats & { split: FactorSplit; role?: string }

export type FactorDiagnostics = {
  run: { id: string; studyId: string; startedAt: string; completedAt: string; inputHash?: string; studyHash?: string; sourceHash?: string }
  dataset: { id: string; version: string; hash?: string; universe: string[]; timeRange: { start?: string; end?: string } | null }
  harness?: { id?: string; version?: string; commit?: string; dirty?: boolean; buildProvenance?: string; python?: string; sourceHash?: string }
  researchHorizon?: {
    primaryForwardBars: number
    diagnosticForwardBars: number[]
    targetSemantics: string
    selectionAuthority: { primary: string; diagnostics: string }
    source: { horizonPolicy: string; horizon: string; kind: string }
  }
  stability?: { chronologicalFolds: FactorFold[]; causalRegimes: FactorRegimeRow[]; assets: FactorAssetRow[]; styles: FactorStyleRow[] }
  predictionUniverse: { evaluationMode?: string; predictionAssets?: string[] }
  protocol: {
    selectionSplit: string
    testRole: string
    testEntersSelection: boolean
    horizons: number[]
    primaryHorizon: number
    semantics: { inference?: string; measure?: string; regimes?: string }
    splits: {
      method: string
      candidateDependent: boolean
      targetCrossesBoundary: boolean
      splits: Record<FactorSplit, FactorSplitWindow>
      horizons: Record<string, Record<FactorSplit, { purgedBoundaryRows: number; eligibleSignalRows: number }>>
    }
    /** Added with the Factor evidence page; older servers do not send it. */
    causality?: { available: boolean; reason: string | null; audit?: string; cuts?: string[]; crossAssetContext?: string | null }
  }
  summary: {
    validation?: RankSummary
    testAudit?: RankSummary
    weakestValidationFold?: { id: string; meanRankIc: number | null }
    maximumValidationStyleOverlap?: { style: string; meanRankCorrelation: number | null }
  }
  inputAvailability: { available: boolean; observationCoverage?: number; observedRows?: number; possibleRows?: number }
  factorQualification: {
    available: boolean
    diagnosis?: { stage: string; iterationFocus?: string; explanation: string; qualifiesForPortfolio: boolean }
    claim?: { claim: string; outcome: string; testRole: string; knownStyle?: string | null; selectionAuthority?: string; tradingAuthority?: string }
    semantics?: { diagnosticThresholds?: { minimumPositiveHacTStatistic?: number; selectionAdjustedSignificanceRequiredSeparately?: boolean } }
    selection?: { dominantStyle?: string }
    validation?: FactorQualificationSplit
    testAudit?: FactorQualificationSplit
  }
  horizonProfile: FactorHorizonRow[]
  quantileEvidence: { status: string; evaluationMode: string; reasonCode: string | null; reason: string | null; artifactRows: number }
  quantileSummary: FactorQuantileRow[]
  icPath: { totalRows: number; sampledRows: number; sampling: string; points: FactorIcPoint[] }
  /** Added with the group-return chart; older snapshots do not send it. */
  quantilePath?: {
    totalRows?: number
    sampledRows?: number
    cumulative?: { horizon: number; basis?: string; totalRows: number; sampledRows: number; points: FactorCumulativePoint[] }
  }
  /** Long-short (high minus low) statistics per split; `splits` is empty when the evaluation mode has no groups. */
  spreadSummary?: { status: string; evaluationMode?: string; horizon: number; basis: string; reasonCode: string | null; authority?: string; splits: FactorSpreadSplit[] }
  warning: string
}

export type SelectionIntegrity = {
  selectionMetric?: string
  selectionSplit?: string
  testRole?: string
  testEntersSelection?: boolean | null
  testExposureState?: string
  candidateTrials?: number
  evaluatedRuns?: number
  externalHoldoutRequired?: boolean | null
  externalHoldoutReason?: string
  warning?: string
  researchFamily?: { id: string; uniqueSourceTrials: number; failedSourceTrials?: number; successfulSourceTrials?: number; totalExecutions: number; trialCountAssumption: string; reproducible: boolean }
  selectionAdjustment?: {
    status: string
    method: string | null
    reason: string | null
    passes: boolean | null
    interpretation: string
    confidenceLevel: number
    statistics: {
      observedMeanIc: number
      rawHacPValue: number
      familywiseAdjustedPValue: number
      uniqueTrials: number
    } | null
  }
}

/** Report, Review and Dossier rows: no sample was available when this was typed, so every key is optional and read defensively. */
export type ReportRow = { id?: string; title?: string; status?: string; createdAt?: string; runId?: string } & Record<string, unknown>

export type ExperimentRow = {
  id: string
  sequence: number
  verdict: string
  hypothesis: string
  leaderValue: number | null
  candidateValue: number | null
  improvement: number | null
  runId: string
  completedAt: string
}

export type TrialRow = {
  role: string
  sequence: number
  experimentId: string | null
  runId: string
  status: string
  verdict: string
  hypothesis: string
  primaryValue: number | null
  objectiveImprovementVsBaseline: number | null
  isCurrentLeader: boolean
  errors: unknown[]
}

export type ResearchAgenda = {
  status?: string
  reason?: string | null
  moveRole?: string
  diagnosis?: { stage?: string; iterationFocus?: string; explanation?: string }
  moves?: { priority: number; id: string; title: string; hypothesis?: string; rationale?: string }[]
}

export type SessionSnapshot = {
  session?: { id?: string; status?: string; studyId?: string; createdAt?: string; updatedAt?: string }
  /** Older snapshots: kept so a flat shape still renders. */
  id?: string
  status?: string
  studyId?: string
  selectionIntegrity?: SelectionIntegrity
  delegation?: { request?: { title?: string; question?: string; decisionContext?: string; horizon?: string; hypotheses?: string[]; constraints?: string[]; deliverables?: string[] } } | null
  experiments?: ExperimentRow[]
  decisionMatrix?: {
    objective?: { direction?: string; metric?: string; minimumImprovement?: number }
    scope?: { trialLimit: number; totalCandidateTrials: number; displayedCandidateTrials: number; omittedCandidateTrials: number }
    trials?: TrialRow[]
  } | null
  reports?: ReportRow[]
}
