/**
 * Shape of `portfolioExplorer` as `aq studio serve` sends it (autoquant/portfolio_explorer.py). Every field is optional
 * on purpose: older or partial payloads must degrade to an explicit "not available", never to a crash or a zero.
 */
export type PerfSummary = {
  observations?: number
  totalReturn?: number | null
  annualReturn?: number | null
  annualVolatility?: number | null
  sharpe?: number | null
  sortino?: number | null
  maximumDrawdown?: number | null
  expectedShortfall95?: number | null
  calmar?: number | null
  positiveRate?: number | null
  activeAnnualReturn?: number | null
  informationRatio?: number | null
}

export type BreakEven = { status?: string; bps?: number | null; searchMaximumBps?: number | null }

export type Friction = {
  baseCostBps?: number
  totalCostDrag?: number
  annualizedOneWayTurnover?: number
  grossToNetTotalReturnWedge?: number
  grossToNetAnnualReturnWedge?: number
  grossToNetSharpeDelta?: number
  grossReturnPerOneWayTurnoverBps?: number | null
  netReturnPerOneWayTurnoverBps?: number | null
  breakEvenCost?: BreakEven
}

export type MonthMark = { month?: string; return?: number }

export type ViabilitySplit = {
  role?: string
  factorRankIc?: number | null
  gross?: PerfSummary
  net?: PerfSummary
  benchmark?: PerfSummary
  friction?: Friction
  costStress?: { costBps: number; totalReturn: number; annualReturn: number; netSharpe: number }[]
  extraDelay?: { totalReturn?: number; annualReturn?: number; netSharpe?: number; netSharpeDelta?: number }
  temporal?: {
    months?: number
    positiveNetMonthRate?: number
    bestNetMonth?: MonthMark
    worstNetMonth?: MonthMark
    maximumUnderwaterBars?: number
    maximumUnderwaterStart?: string
    maximumUnderwaterEnd?: string
    currentUnderwaterBars?: number
    bestDayCount?: number
    bestDaysAbsoluteReturnShare?: number
    netTotalReturnWithoutBestDays?: number
  }
}

export type PathPoint = {
  timestamp: string
  split?: string
  netGrowth?: number | null
  grossGrowth?: number | null
  benchmarkGrowth?: number | null
  drawdown?: number | null
  grossExposure?: number | null
  netExposure?: number | null
  cashWeight?: number | null
  oneWayTurnover?: number | null
  cost?: number | null
  rebalanced?: boolean
}

export type BookPosition = {
  asset: string
  signalState?: number
  signalEvent?: string
  targetWeight?: number
  pretradeWeight?: number
  executedWeight?: number
  tradeWeight?: number
  executionAction?: string
  regime?: string
  netReturnContribution?: number
  varianceContributionShare?: number
}

export type Transition = {
  timestamp: string
  asset: string
  signalEvent?: string
  priorSignalState?: number
  signalState?: number
  executedWeight?: number
  tradeWeight?: number
  executionAction?: string
  executionReason?: string
  regime?: string
}

export type Episode = {
  id: string
  split?: string
  asset?: string
  side?: string
  entryTimestamp?: string
  exitTimestamp?: string | null
  entryAction?: string
  exitAction?: string
  complete?: boolean
  leftCensored?: boolean
  rightCensored?: boolean
  decisionBars?: number
  netContribution?: number
  totalCost?: number
  maximumFavorableExcursion?: number
  maximumAdverseExcursion?: number
}

export type NeighborConfig = {
  id: string
  signalProfile?: string
  noTradeOneWay?: number
  isBase?: boolean
  netSharpe?: number | null
  totalReturn?: number | null
  annualizedOneWayTurnover?: number | null
  totalCostDrag?: number | null
  rebalanceRate?: number | null
  signalTransitions?: number | null
  netSharpeDeltaVsBase?: number | null
}

export type NeighborSplit = {
  aggregate?: {
    configurationCount?: number
    baseNetSharpe?: number
    positiveNetSharpeRate?: number
    signAgreementWithBaseRate?: number
    minimumNetSharpe?: number
    medianNetSharpe?: number
    maximumNetSharpe?: number
    netSharpeStd?: number
    worstNetSharpeDelta?: number
    bestNetSharpeDelta?: number
  }
  configurations?: NeighborConfig[]
}

export type AttributionRow = {
  asset: string
  annualizedNetContribution?: number
  averageAbsoluteWeight?: number
  meanVarianceContributionShare?: number
  totalCostContribution?: number
  totalOneWayTurnoverContribution?: number
}

export type PortfolioDiagnostics = {
  kind?: string
  run?: { id?: string; studyId?: string; status?: string; startedAt?: string; primaryMetric?: string; primaryValue?: number | null }
  universe?: string[]
  mandate?: {
    direction?: string
    family?: string
    grossLimit?: number
    maxAbsWeight?: number
    benchmark?: { kind?: string }
    implementationPolicy?: { baseCostBps?: number; noTradeOneWay?: number }
  }
  selection?: {
    selectionSplit?: string
    testRole?: string
    testEntersSelection?: boolean
    splits?: Record<string, { start?: string; end?: string; role?: string }>
  }
  path?: {
    totalRows?: number
    sampledRows?: number
    sampling?: string
    summary?: {
      netTotalReturn?: number
      grossTotalReturn?: number
      benchmarkTotalReturn?: number
      maximumDrawdown?: number
      maximumDrawdownAt?: string
      maximumOneWayTurnover?: number
      totalOneWayTurnover?: number
      totalCost?: number
      rebalanceDays?: number
    }
    points?: PathPoint[]
  }
  currentBook?: {
    timestamp?: string
    historicalResearchWeights?: boolean
    grossExposure?: number
    netExposure?: number
    cashWeight?: number
    oneWayTurnover?: number
    cost?: number
    executionRiskStatus?: string
    executedRiskForecastAnnualized?: number
    executionRiskCeilingAnnualized?: number
    riskGovernorStatus?: string
    riskGovernorScale?: number
    positions?: BookPosition[]
  }
  strategyViability?: {
    authority?: string
    diagnosis?: { selectionSplit?: string; testEntersDiagnosis?: boolean; stage?: string; iterationFocus?: string; explanation?: string }
    validation?: ViabilitySplit
    test?: ViabilitySplit
  }
  signalMonetization?: {
    diagnosis?: { outcome?: string; iterationFocus?: string; largestAdverseStage?: string; largestAdverseAnnualizedDelta?: number; explanation?: string }
  }
  recentTransitions?: Transition[]
  positionLifecycle?: { available?: boolean; recentEpisodes?: Episode[] }
  parameterNeighborhood?: {
    available?: boolean
    policy?: {
      baseConfigurationId?: string
      role?: string
      configurationCount?: number
      signalProfiles?: { id: string; label?: string }[]
      noTradeBands?: number[]
    }
    validation?: NeighborSplit
    test?: NeighborSplit
  }
  attribution?: { validation?: AttributionRow[]; test?: AttributionRow[] }
}
