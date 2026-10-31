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
  sessions: { id?: string; status?: string; studyId?: string; selectionIntegrity?: SelectionIntegrity }[]
  timeline: TimelineRow[]
  externalHoldout: { status?: string; state?: string } | null
  agentWorkBrief: {
    focus?: { laneName?: string; studyName?: string; scientificStage?: string; operatingMode?: string }
    primaryAction?: { description?: string; display?: string }
    authority?: { selectionSplit?: string; testRole?: string; testEntersSelection?: boolean; tradingAuthority?: string }
  } | null
  factorExplorer: FactorDiagnostics | null
  /** Lane explorers other than Factor: present means the legacy Studio can draw them. */
  portfolioExplorer: object | null
  rlExplorer: object | null
  bookRiskExplorer: object | null
  eventStudyExplorer: EventStudyDiagnostics | null
  bookPathStressExplorer: object | null
  allocationExplorer: object | null
}

export type ProjectResponse = { harness: Harness; projects: ProjectSnapshot[] }

export class ApiError extends Error {}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const message = body?.error?.message ?? `${response.status} ${response.statusText}`
    throw new ApiError(message)
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

export type FactorDiagnostics = {
  run: { id: string; studyId: string; startedAt: string; completedAt: string }
  dataset: { id: string; version: string; universe: string[]; timeRange: { start?: string; end?: string } | null }
  predictionUniverse: { evaluationMode?: string; predictionAssets?: string[] }
  protocol: {
    selectionSplit: string
    testRole: string
    testEntersSelection: boolean
    horizons: number[]
    primaryHorizon: number
    semantics: { inference?: string; measure?: string }
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
  summary: { validation?: RankSummary; testAudit?: RankSummary }
  inputAvailability: { available: boolean; observationCoverage?: number; observedRows?: number; possibleRows?: number }
  factorQualification: {
    available: boolean
    diagnosis?: { stage: string; explanation: string; qualifiesForPortfolio: boolean }
  }
  horizonProfile: FactorHorizonRow[]
  quantileEvidence: { status: string; evaluationMode: string; reasonCode: string | null; reason: string | null; artifactRows: number }
  quantileSummary: FactorQuantileRow[]
  icPath: { totalRows: number; sampledRows: number; sampling: string; points: FactorIcPoint[] }
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
  researchFamily?: { id: string; uniqueSourceTrials: number; totalExecutions: number; trialCountAssumption: string; reproducible: boolean }
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
