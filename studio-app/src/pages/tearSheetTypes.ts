export type TearStatistic = { value: number | null; observations: number; shortSample: boolean }
export type TearPoint = {
  timestamp: string; groupReturns: number[]; groupSizes: number[]; turnover: (number | null)[]
  gross: number; net: number | null; tradedNotional: number
  groupCumulative: (number | null)[]; grossCumulative: number | null; netCumulative: number | null
}
export type TearSplit = {
  observations: number; shortSample: boolean; refusedBars: number; totalRows: number
  quantileMeans: TearStatistic[]; meanTurnover: TearStatistic[]
  longShortGross: TearStatistic; longShortNet: TearStatistic; path: TearPoint[]
  icDecay: (TearStatistic & { horizon: number })[]; autocorrelation: (TearStatistic & { lag: number })[]
}
export type FactorTearSheet = {
  schemaVersion: number; status: 'not-published' | 'protocol-unavailable' | 'available'; reason: string | null
  quantiles?: number; primaryHorizon?: number; maximumLag?: number; minimumSampleBars?: number
  minimumGroupMembers?: number; outcome?: string
  costModel?: { model: string; baseCostBps: number; source: string } | null
  splits?: Partial<Record<'train' | 'validation' | 'test', TearSplit>>
}
