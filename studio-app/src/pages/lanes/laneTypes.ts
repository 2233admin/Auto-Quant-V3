/** Payload shapes of the Book Risk and Reported-book path stress explorers, read from autoquant/book_risk_explorer.py and book_path_stress_explorer.py. */
type N = number | null | undefined

export type LaneRun = { id?: string; status?: string; primaryMetric?: string; primaryValue?: N; durationMs?: N; harness?: { version?: string; commit?: string } }

export type PositionSnapshot = {
  asOf?: string
  baseCurrency?: string
  cashWeight?: N
  id?: string
  snapshotKind?: string
  weights?: Record<string, number>
  authority?: { positionTruth?: string; tradingAuthority?: string }
}

export type ReductionRow = {
  rank?: N
  asset: string
  startingWeight?: N
  weightReduction?: N
  resultingWeight?: N
  resultingCashWeight?: N
  annualizedVolatility?: N
  volatilityReduction?: N
  volatilityReductionPerWeight?: N
  componentRiskHhi?: N
  effectiveRiskBets?: N
}

export type LookbackRow = {
  lookbackBars: number
  observations?: N
  annualizedVolatility?: N
  componentRiskHhi?: N
  effectiveRiskBets?: N
  firstPrincipalComponentVarianceShare?: N
  largestAbsoluteRiskContributor?: string
  largestAbsoluteRiskContributorShare?: N
  firstReductionAsset?: string
  firstReductionVolatilityPerWeight?: N
  maximumDrawdown?: N
}

export type ScenarioLookback = {
  lookbackBars: number
  annualizedVolatility?: N
  annualizedVolatilityDelta?: N
  componentRiskHhi?: N
  componentRiskHhiDelta?: N
  effectiveRiskBets?: N
  effectiveRiskBetsDelta?: N
  largestAbsoluteRiskContributor?: string
  largestAbsoluteRiskContributorShare?: N
  volatilityRank?: N
}

export type ScenarioContribution = {
  scenarioId?: string
  asset: string
  baselineWeight?: N
  scenarioWeight?: N
  weightDelta?: N
  baselineAbsoluteRiskShare?: N
  scenarioAbsoluteRiskShare?: N
  absoluteRiskShareDelta?: N
}

export type Scenario = {
  id: string
  name: string
  weights?: Record<string, number>
  cashWeight?: N
  lookbacks: ScenarioLookback[]
  primaryContributions: ScenarioContribution[]
}

export type SizingLookback = {
  lookbackBars: number
  annualizedVolatility?: N
  annualizedVolatilityDelta?: N
  componentRiskHhi?: N
  effectiveRiskBets?: N
  largestAbsoluteRiskContributor?: string
  largestAbsoluteRiskContributorShare?: N
  governing?: boolean
  ceilingSatisfied?: boolean
}

export type Sizing = {
  status: string
  resultMeaning?: string
  bindingConstraint?: string
  policy?: {
    asset?: string
    direction?: string
    annualizedVolatilityCeiling?: N
    lookbackBars?: N
    minimumWeight?: N
    maximumWeight?: N
    authority?: { decisionPath?: string; tradingAuthority?: string }
  }
  result?: {
    asset?: string
    startingWeight?: N
    resultingWeight?: N
    weightChange?: N
    startingCashWeight?: N
    resultingCashWeight?: N
    cashWeightChange?: N
    annualizedVolatility?: N
    annualizedVolatilityDelta?: N
    ceilingSatisfied?: boolean
    componentRiskHhi?: N
    effectiveRiskBets?: N
    largestAbsoluteRiskContributor?: string
    largestAbsoluteRiskContributorShare?: N
    weights?: Record<string, number>
  }
  lookbacks?: SizingLookback[]
  contributions?: { asset: string; baselineWeight?: N; resultingWeight?: N; weightDelta?: N; absoluteRiskShare?: N; signedRiskShare?: N }[]
  quadratic?: Record<string, number | null>
}

export type Drawdown = {
  initialNav?: N
  maximumDrawdown?: N
  method?: string
  peakTimestamp?: string | null
  troughTimestamp?: string | null
  recovered?: boolean
  recoveryTimestamp?: string | null
  returnConvention?: string
}

export type EquityPoint = { timestamp: string; portfolioReturn?: N; cumulativeReturn?: N; nav?: N; runningPeak?: N; drawdown?: N }
export type RollingPoint = { timestamp: string; observations?: N; annualizedVolatility?: N; componentRiskHhi?: N; effectiveRiskBets?: N; firstPrincipalComponentVarianceShare?: N }

export type ArtifactRef = { path?: string; description?: string; immutable?: boolean }

export type BookRiskDiagnostics = {
  run?: LaneRun
  positionSnapshot: PositionSnapshot
  authority?: Record<string, string>
  current: {
    annualizedVolatility?: N
    cashWeight?: N
    componentRiskHhi?: N
    effectiveRiskBets?: N
    firstPrincipalComponentVarianceShare?: N
    grossExposure?: N
    netExposure?: N
    largestAbsoluteRiskContributorShare?: N
    lookbackBars: number
    maximumDrawdown?: N
    observations?: N
  }
  lookbacks?: LookbackRow[]
  riskContributions?: { asset: string; weight?: N; marginalVariance?: N; componentVariance?: N; signedRiskShare?: N; absoluteRiskShare?: N }[]
  reductionPriority?: ReductionRow[]
  pairwiseCorrelations?: { leftAsset: string; rightAsset: string; correlation?: N }[]
  scenarioComparison?: {
    comparisonUniverse?: string[]
    baselineLookbacks?: { lookbackBars: number; annualizedVolatility?: N }[]
    scenarios?: Scenario[]
    ranking?: { direction?: string; metric?: string; selectionAuthority?: string }
  }
  positionSizing?: Sizing
  drawdown?: Drawdown
  equityPath?: { available?: boolean; totalRows?: N; sampledRows?: N; points?: EquityPoint[]; summary?: Drawdown }
  rollingPath?: {
    totalRows?: N
    sampledRows?: N
    points?: RollingPoint[]
    summary?: { start?: string; end?: string; observations?: N; minimumEffectiveRiskBets?: N; maximumComponentRiskHhi?: N }
  }
  artifacts?: Record<string, ArtifactRef>
}

export type PathStressDiagnostics = {
  run?: LaneRun
  dataset?: { id?: string; version?: string; alignedObservations?: N; priceAdjustment?: string; timeRange?: { start?: string; end?: string } }
  policy?: {
    attribution?: { method?: string; cashContribution?: N; reconciliationTolerance?: N }
    authority?: { decisionPath?: string; positionTruth?: string; tradingAuthority?: string }
    path?: { holdingBars?: N; method?: string; price?: string; rebalancing?: string; cashReturn?: N }
    ranking?: { direction?: string; episodeCount?: N; intervalBoundary?: string; metric?: string; overlapPolicy?: string; tieBreak?: string }
  }
  snapshot?: PositionSnapshot
  summary?: {
    eligibleWindowCount?: N
    selectedEpisodeCount?: N
    worstTerminalBookReturn?: N
    sameDominantLossContributorAcrossAllEpisodes?: boolean
    dominantLossContributorAcrossAllEpisodes?: string | null
  }
  episodes?: {
    rank: number
    startTimestamp?: string
    endTimestamp?: string
    terminalBookReturn?: N
    worstInterimBookReturn?: N
    worstInterimTimestamp?: string
    dominantLossContributor?: string
  }[]
  contributions?: { rank: number; asset: string; openingWeight?: N; terminalAssetReturn?: N; terminalContribution?: N }[]
  paths?: { rank: number; offsetBars: number; timestamp?: string; bookReturn?: N }[]
  artifacts?: Record<string, ArtifactRef>
  warning?: string
}
