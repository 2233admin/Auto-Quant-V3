import type { RankSummary } from '../../api'
import type { Comparison } from '../../library/runHistoryApi'
import type { MetricId } from '../../metrics/catalogue'
import { testVisible } from '../testGate'

export const primaryMetricId = (metric: string): MetricId => ({ validation_mean_ic: 'meanRankIc', validation_net_sharpe: 'netSharpe' }[metric] as MetricId | undefined) ?? 'primaryObjective'
export type MetricRow = { id: MetricId; scope: string; a: number | null; b: number | null; focal: boolean }
const FACTOR_METRICS: [keyof RankSummary, MetricId][] = [['meanRankIc', 'meanRankIc'], ['rankIcir', 'rankIcir'], ['hacTStatistic', 'hacT'], ['hacNormalPValue', 'hacP'], ['rankHitRate', 'rankHitRate'], ['observations', 'observations']]

export function comparisonMetrics(c: Comparison): MetricRow[] {
  if (c.status !== 'comparable') return []
  if (!c.factors) return [
    { id: primaryMetricId(c.a.primaryMetric), scope: 'Validation', a: c.a.primaryValue, b: c.b.primaryValue, focal: true },
    ...(['netTotalReturn', 'netAnnualReturn', 'maxDrawdown', 'annualVolatility'] as const)
      .filter(id => c.a.validationHeadlines?.[id] != null || c.b.validationHeadlines?.[id] != null)
      .map(id => ({ id, scope: 'Validation', a: c.a.validationHeadlines?.[id] ?? null, b: c.b.validationHeadlines?.[id] ?? null, focal: false })),
  ]
  const [a, b] = c.factors
  const scopes = testVisible(a.protocol, a.summary) && testVisible(b.protocol, b.summary) ? ['Validation', 'Test audit'] : ['Validation']
  return scopes.flatMap(scope => FACTOR_METRICS.map(([key, id]) => {
    const x = scope === 'Validation' ? a.summary.validation : a.summary.testAudit
    const y = scope === 'Validation' ? b.summary.validation : b.summary.testAudit
    return { id, scope, a: typeof x?.[key] === 'number' ? x[key] as number : null, b: typeof y?.[key] === 'number' ? y[key] as number : null, focal: scope === 'Validation' && key === 'meanRankIc' }
  }))
}
