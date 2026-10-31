/** The Governed RL policy payload (`rlExplorer`), as the server publishes it. Every field is optional: a missing one becomes "not available", never zero. */
type Num = number | null | undefined
export type Freq = Record<string, number>

export type StatBlock = { observations?: number; mean?: Num; standardDeviation?: Num; minimum?: Num; maximum?: Num }

export type ExecRisk = {
  available?: boolean
  activeDates?: number
  forecastCoverage?: Num
  pretradeBreachDates?: number
  riskRebalanceOverrideDates?: number
  executedBreachDates?: number
  maximumExecutedForecastAnnualized?: Num
  maximumCeilingError?: Num
}

export type SplitEvidence = {
  netSharpe?: Num
  netTotalReturn?: Num
  maximumDrawdown?: Num
  observations?: number
  cumulativeReward?: Num
  meanReward?: Num
  meanOneWayTurnover?: Num
  totalCostDrag?: Num
  actionFrequency?: Freq
  executionRisk?: ExecRisk
}

export type Trial = {
  fold: string
  seed: number
  status?: string
  selectedBaseline?: string
  validation?: SplitEvidence
  test?: SplitEvidence
  validationAdvantage?: Num
  testAdvantage?: Num
  validationAdvantageVsCandidateFactor?: Num
  testAdvantageVsCandidateFactor?: Num
}

export type Baseline = { fold: string; name: string; selectedOnValidation?: boolean; validation?: SplitEvidence; test?: SplitEvidence }

export type ContextualBaseline = {
  fold: string
  available?: boolean
  method?: string
  labelScope?: string
  anchorAction?: string
  iterations?: number
  history?: { iteration: number; trainingRows?: number; sharedPretradeActionEvaluations?: number; improvedTrainingNetSharpe?: Num; behaviorOracleHitRate?: Num }[]
}

export type TrainingRow = { fold: string; seed: number; episode: number; epsilon?: Num; totalReward?: Num; meanReward?: Num; actionCounts?: Record<string, number> }

export type ActionSummary = {
  fold: string
  seed: number
  split: string
  role?: string
  observations?: number
  actionFrequency?: Freq
  cumulativeReward?: Num
  meanReward?: Num
  meanOneWayTurnover?: Num
  totalCostDrag?: Num
  actionTransitions?: number
  executionRisk?: ExecRisk
}

export type Mandate = {
  available?: boolean
  id?: string
  direction?: string
  family?: string
  tradableAssets?: string[]
  contextAssets?: string[]
  grossLimit?: Num
  maxAbsWeight?: Num
  longGrossLimit?: Num
  shortGrossLimit?: Num
  assetPositionRoles?: Record<string, string>
  assetMaxAbsWeights?: Record<string, number>
  benchmark?: { kind?: string; asset?: string | null; source?: string }
  riskPolicy?: { annualizedVolatilityCeiling?: Num; scaleUp?: boolean }
  implementationPolicy?: { baseCostBps?: Num; noTradeOneWay?: Num; referenceNav?: Num; decisionPolicy?: { bars?: number; kind?: string } }
  policySource?: string
}

export type Candidate = {
  assessment?: string
  fixedSleeveNetSharpe?: Num
  balancedFixedSleeveNetSharpe?: Num
  fixedSleeveSharpeDeltaVsBalanced?: Num
  selectedFrequency?: Num
  localBestFrequency?: Num
  oracleCaptureRate?: Num
  missedOpportunityRate?: Num
  meanLocalRewardDeltaVsBalanced?: Num
  meanLocalRewardDeltaVsSelected?: Num
}
export type Transmission = {
  meanTrialGrossActiveReturn?: Num
  meanTrialIncrementalCost?: Num
  meanTrialNetActiveReturn?: Num
  meanSharpeAdvantageVsSelectedBaseline?: Num
  informationRatio?: Num
  activeDecisionRate?: Num
  conditionalActiveWinRate?: Num
  actionsDifferRate?: Num
  policySwitchRate?: Num
  baselineSwitchRate?: Num
}
export type FusionSplit = {
  role?: string
  candidateFactor?: Candidate
  policySelection?: { selectedBaselineMeanNetSharpe?: Num; oracleHitRate?: Num; meanSelectedRank?: Num; meanOneStepRealizedRegret?: Num }
  adaptiveTransmission?: Transmission
  stability?: { trialPaths?: number; positiveGrossTrialRate?: Num; positiveNetTrialRate?: Num; positiveSharpeAdvantageTrialRate?: Num; netActiveReturnStandardDeviation?: Num; worstTrial?: { fold?: string; seed?: number; grossActiveReturn?: Num; netActiveReturn?: Num; sharpeAdvantage?: Num } }
  lossLocator?: {
    worstRegime?: { key?: string; decisions?: number; totalNetActiveReturn?: Num }
    worstActionPair?: { key?: string; decisions?: number; totalNetActiveReturn?: Num }
    worstSwitchState?: { key?: string; decisions?: number; totalNetActiveReturn?: Num }
    worstAssetGrossContribution?: { asset?: string; totalGrossActiveContribution?: Num }
  }
}

export type IncSplit = {
  status?: string
  decisions?: number
  activeDecisions?: number
  activeDecisionRate?: Num
  trialPaths?: number
  meanTrialTotalGrossActiveReturn?: Num
  meanTrialTotalIncrementalCost?: Num
  meanTrialTotalNetActiveReturn?: Num
  informationRatio?: Num
  annualizedActiveReturn?: Num
  annualizedTrackingError?: Num
  relativeTotalReturn?: Num
  relativeMaximumDrawdown?: Num
  activeWinRate?: Num
  conditionalActiveWinRate?: Num
  p05NetActiveReturn?: Num
  medianNetActiveReturn?: Num
  p95NetActiveReturn?: Num
  worstNetActiveReturn?: Num
  bestNetActiveReturn?: Num
  actionsDifferRate?: Num
  policySwitchRate?: Num
  baselineSwitchRate?: Num
  byAsset?: { asset: string; meanTrialTotalGrossActiveContribution?: Num; meanGrossActiveContribution?: Num; totalGrossActiveContribution?: Num }[]
  byRegime?: { key: string; dimension: string; bucket: string; decisions?: number; activeDecisionRate?: Num; meanNetActiveReturn?: Num; conditionalActiveWinRate?: Num }[]
  byActionPair?: { key: string; policyAction: string; baselineAction: string; decisions?: number; meanNetActiveReturn?: Num; conditionalActiveWinRate?: Num }[]
  bySwitchState?: { key: string; decisions?: number; totalIncrementalCost?: Num; meanNetActiveReturn?: Num; conditionalActiveWinRate?: Num }[]
  reconciliation?: { passed?: boolean }
}

export type BehaviorSplit = {
  status?: string
  decisions?: number
  trialPaths?: number
  transitionRate?: Num
  retentionRate?: Num
  meanActionRunLength?: Num
  maximumActionRunLength?: Num
  singleBarRunRate?: Num
  medianActionMargin?: Num
  tieRate?: Num
  meanOneWayTurnover?: Num
  totalCost?: Num
  byAction?: { action: string; frequency?: Num; meanActionRunLength?: Num; meanActionMargin?: Num; meanReward?: Num; meanOneWayTurnover?: Num }[]
  byFeature?: { feature: string; dominantRate?: Num; meanAbsoluteMarginContribution?: Num; meanSignedMarginContribution?: Num }[]
  reconciliation?: { passed?: boolean }
}
export type BehaviorDecision = {
  fold: string
  seed: number
  split: string
  timestamp: string
  selectedAction: string
  runnerUpAction: string
  actionMargin?: Num
  dominantMarginFeature?: string
  dominantMarginContribution?: Num
  reward?: Num
}

export type OppSplit = {
  status?: string
  decisions?: number
  oracleHitRate?: Num
  meanSelectedRank?: Num
  meanRealizedRegret?: Num
  p90RealizedRegret?: Num
  maximumRealizedRegret?: Num
  positiveRegretRate?: Num
  byAction?: { action: string; selectedFrequency?: Num; oracleFrequency?: Num; meanLocalReward?: Num; meanOneWayTurnover?: Num; riskRepairRate?: Num }[]
  candidate?: { selectedFrequency?: Num; oracleFrequency?: Num; oracleCaptureRate?: Num; missedOpportunityRate?: Num; meanVsSelectedReward?: Num; meanVsBalancedReward?: Num; winRateVsBalanced?: Num }
  reconciliation?: { passed?: boolean }
}
export type OppDecision = {
  fold: string
  seed: number
  split: string
  timestamp: string
  selectedAction: string
  oracleAction: string
  selectedRank?: number
  selectedReward?: Num
  oracleReward?: Num
  realizedRegret?: Num
  candidateMinusSelectedReward?: Num
  candidateMinusBalancedReward?: Num
}

export type SplitRange = { start?: string; end?: string; observations?: number; role?: string }

export type RlDiagnostics = {
  run?: { id?: string; status?: string; studyId?: string; summary?: string; inputHash?: string; objective?: { direction?: string; metric?: string; minimumImprovement?: Num } }
  dataset?: { id?: string; version?: string; timeRange?: { start?: string; end?: string }; universe?: string[] }
  harness?: { version?: string; commit?: string }
  artifacts?: Record<string, { path?: string; sha256?: string }>
  portfolioMandate?: Mandate
  decisionCadence?: { bars?: number; kind?: string; observations?: number; eligibleBars?: number; eligibleRate?: Num; scheduledHoldBars?: number; riskOnlyOverrideBars?: number; constraintOnlyOverrideBars?: number; jointConstraintRiskOverrideBars?: number }
  policyBehavior?: { available?: boolean; validation?: BehaviorSplit; test?: BehaviorSplit; representativeDecisions?: BehaviorDecision[] }
  factorOpportunity?: { available?: boolean; validation?: OppSplit; test?: OppSplit; representativeDecisions?: OppDecision[] }
  incrementalAttribution?: { available?: boolean; validation?: IncSplit; test?: IncSplit }
  factorFusionDiagnosis?: {
    available?: boolean
    reason?: string | null
    diagnosis?: { stage?: string; iterationFocus?: string; explanation?: string }
    validation?: FusionSplit
    testAudit?: FusionSplit
  }
  executedBookRisk?: { available?: boolean; policy?: { riskPolicy?: { annualizedVolatilityCeiling?: Num } }; validation?: ExecRiskBook; test?: ExecRiskBook }
  protocol?: {
    selectionSplit?: string
    testRole?: string
    testEntersSelection?: boolean
    actions?: string[]
    folds?: string[]
    seeds?: number[]
    episodes?: number
    featureNames?: string[]
    configuration?: { costBps?: Num; learningRate?: Num; discount?: Num; epsilonStart?: Num; epsilonEnd?: Num; riskAversion?: Num; learningContract?: { method?: string; candidate_configurations?: number; development_selection_scope?: string; validation_role?: string; test_role?: string } }
    ranges?: Record<string, Record<string, SplitRange>>
    semantics?: Record<string, string>
  }
  summary?: {
    validation?: StatBlock
    testAudit?: StatBlock
    meanValidationAdvantageVsBestBaseline?: Num
    meanTestAdvantageVsValidationSelectedBaseline?: Num
    failureRate?: Num
    trialCount?: number
    meanValidationOneWayTurnover?: Num
    meanValidationCostDrag?: Num
    rlAddedValidationValue?: boolean
    withinFoldSeedStability?: { meanStandardDeviation?: Num; maximumStandardDeviation?: Num; exactConsensusFolds?: number; folds?: number; meanPairwiseActionMismatch?: Num; maximumPairwiseActionMismatch?: Num }
  }
  factorFusion?: {
    available?: boolean
    mode?: string
    candidateValidation?: StatBlock
    candidateTestAudit?: StatBlock
    meanValidationAdvantageVsCandidateFactor?: Num
    meanTestAdvantageVsCandidateFactor?: Num
    meanValidationCandidateActionFrequency?: Num
    rlBeatCandidateOnValidation?: boolean
  }
  trials?: Trial[]
  baselines?: Baseline[]
  contextualBaselines?: ContextualBaseline[]
  training?: TrainingRow[]
  actionSummaries?: ActionSummary[]
  actionPath?: { totalRows?: number; sampledRows?: number; transitions?: { from: string; to: string; count: number }[] }
  warning?: string
}

export type ExecRiskBook = {
  status?: string
  activeDates?: number
  forecastCoverage?: Num
  pretradeBreachDates?: number
  riskRebalanceOverrideDates?: number
  executedBreachDates?: number
  maximumExecutedForecastAnnualized?: Num
  maximumCeilingError?: Num
  constraintRebalanceOverrideDates?: number
  executedConstraintBreachDates?: number
  maximumExecutedConstraintError?: Num
}
