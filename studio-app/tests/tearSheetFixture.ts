import type { FactorDiagnostics } from '../src/api'
import type { TearSplit } from '../src/pages/tearSheetTypes'

export const tearSplit = (marker = .0123): TearSplit => ({
  observations: 1, shortSample: true, refusedBars: 0, totalRows: 1,
  quantileMeans: Array.from({ length: 5 }, (_, i) => ({ value: marker * i, observations: 1, shortSample: true })),
  meanTurnover: Array.from({ length: 5 }, () => ({ value: null, observations: 0, shortSample: true })),
  longShortGross: { value: marker, observations: 1, shortSample: true },
  longShortNet: { value: null, observations: 0, shortSample: true },
  path: [{ timestamp: '2024-01-01', groupReturns: [0, 0, 0, 0, marker], groupSizes: [1, 1, 1, 1, 1], turnover: [null, null, null, null, null],
    gross: marker, net: null, tradedNotional: 2, groupCumulative: [1, 1, 1, 1, 1 + marker], grossCumulative: 1 + marker, netCumulative: null }],
  icDecay: [{ horizon: 1, value: marker, observations: 1, shortSample: true }],
  autocorrelation: [{ lag: 1, value: marker, observations: 1, shortSample: true }],
})

export function tearStudy(): FactorDiagnostics {
  return {
    protocol: { testRole: 'sealed' }, summary: { testAudit: { meanRankIc: .987654 } },
    tearSheet: { schemaVersion: 1, status: 'available', reason: null, quantiles: 5, primaryHorizon: 1,
      maximumLag: 1, minimumSampleBars: 20, outcome: 'forward-return', costModel: null,
      splits: { train: tearSplit(.0234), validation: tearSplit(), test: tearSplit(.987654) } },
  } as unknown as FactorDiagnostics
}
