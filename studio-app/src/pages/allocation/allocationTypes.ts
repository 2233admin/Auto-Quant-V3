/** The strategic Allocation payload (`allocationExplorer`), as the server publishes it. Every field is optional on purpose: a missing one becomes "not available", never zero. */
type Num = number | null | undefined
export type Weights = Record<string, number>

/** Per-split performance block; snake_case is the server's own spelling. */
export type AllocPerf = {
  observations?: number
  total_return?: Num
  annual_return?: Num
  annual_volatility?: Num
  sharpe?: Num
  sortino?: Num
  calmar?: Num
  maximum_drawdown?: Num
  expected_shortfall_95?: Num
  positive_rate?: Num
  return_skewness?: Num
  return_kurtosis?: Num
  benchmark_beta?: Num
  tracking_error?: Num
  active_annual_return?: Num
  information_ratio?: Num
}

export type AllocComparison = {
  netSharpeAdvantage?: Num
  annualReturnAdvantage?: Num
  annualVolatilityDifference?: Num
  maximumDrawdownDifference?: Num
  informationRatio?: Num
}

export type AllocSplit = { candidate?: AllocPerf; reference?: AllocPerf; comparison?: AllocComparison }

export type Implementation = {
  candidateAnnualizedOneWayTurnover?: Num
  candidateMaximumForecastVolatility?: Num
  candidateRiskBreaches?: Num
  candidateRiskLimit?: Num
  candidateTotalCost?: Num
  referenceAnnualizedOneWayTurnover?: Num
  referenceTotalCost?: Num
}

export type LatestEligible = {
  asOf?: string
  status?: string
  solverConverged?: boolean
  withinTolerance?: boolean
  maximumContributionError?: Num
  capBindingAssets?: string[]
} | null

export type FidelitySplit = {
  scheduledDecisions?: number
  eligibleDecisions?: number
  withinToleranceDecisions?: number
  capInducedParityGapDecisions?: number
  withinToleranceRate?: Num
  maximumContributionError?: Num
  latestEligibleDecision?: LatestEligible
}

export type AllocPoint = {
  timestamp: string
  candidateNetReturn?: Num
  referenceNetReturn?: Num
  candidateGrossExposure?: Num
  candidateForecastVolatility?: Num
}

export type SplitRange = { start?: string; end?: string; observations?: number }

export type AllocationDiagnostics = {
  run?: { id?: string; status?: string; inputHash?: string; harness?: { version?: string; commit?: string } }
  contract?: {
    id?: string
    universe?: string[]
    tradableAssets?: string[]
    contextAssets?: string[]
    assetPositionRoles?: Record<string, string>
    method?: { kind?: string; covarianceWindow?: number; minimumObservations?: number; contributionTolerance?: number; scaleUp?: boolean }
    portfolioPolicy?: {
      annualizedVolatilityCeiling?: Num
      assetMaxAbsWeights?: Weights
      baseCostBps?: Num
      decisionSchedule?: { kind?: string }
      grossLimit?: Num
      maxAbsWeight?: Num
      noTradeOneWay?: Num
      referenceNav?: Num
    }
    benchmark?: { kind?: string; weights?: Weights }
    selectionPolicy?: { primaryMetric?: string; primarySplit?: string; testRole?: string }
    authority?: string
    tradingAuthority?: string
  }
  dataset?: { id?: string; version?: string; observations?: number; timeRange?: { start?: string; end?: string }; assetClasses?: Record<string, string> }
  splitProtocol?: { method?: string; selectionSplit?: string; testRole?: string; splits?: Record<string, SplitRange> }
  splits?: Record<string, AllocSplit>
  solver?: { scheduledDecisions?: number; eligibleDecisions?: number; withinToleranceDecisions?: number; capInducedParityGapDecisions?: number; maximumContributionError?: Num }
  implementation?: Record<string, Implementation>
  latestDecision?: {
    asOf?: string
    status?: string
    solverConverged?: boolean
    forecastAnnualizedVolatility?: Num
    maximumContributionError?: Num
    targetWeights?: Weights
    executedWeights?: Weights
    referenceWeights?: Weights
    targetRiskContributionShares?: Weights
  }
  currentState?: {
    asOf?: string
    ordinaryRebalanceDue?: boolean
    candidateExecutionReason?: string
    referenceExecutionReason?: string
    candidateForecastAnnualizedVolatility?: Num
    candidatePretradeWeights?: Weights
    candidateExecutedWeights?: Weights
    referencePretradeWeights?: Weights
    referenceExecutedWeights?: Weights
    scheduledTargetWeights?: Weights | null
  }
  conclusion?: { status?: string; statement?: string; scope?: string; selectionBasis?: string; validationNetSharpeAdvantage?: Num; testUsedForSelection?: boolean; tradingAuthority?: string }
  constructionFidelity?: { kind?: string; tolerance?: Num; selectionSplit?: string; testRole?: string; performanceConclusionIndependent?: boolean; bySplit?: Record<string, FidelitySplit> }
  path?: AllocPoint[]
  artifacts?: Record<string, { path?: string }>
  verification?: Record<string, boolean | string>
}
