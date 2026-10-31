import type { FactorDiagnostics, FactorSplit, RankSummary, SelectionIntegrity } from '../api'

export const SPLITS: FactorSplit[] = ['train', 'validation', 'test']
export const SPLIT_LABEL: Record<FactorSplit, string> = { train: 'Train', validation: 'Validation', test: 'Test' }
/** What each split is for, in the words the Run's protocol uses. */
export const SPLIT_ROLE: Record<FactorSplit, string> = {
  train: 'training',
  validation: 'selection',
  test: 'visible audit',
}

const EULER_MASCHERONI = 0.5772156649015329
const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

/** Standard normal quantile (Acklam's rational approximation, relative error about 1e-9). */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const low = 0.02425
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - low) return -normalQuantile(1 - p)
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/**
 * Expected maximum of N independent standard-normal trials, the same closed form autoquant/selection.py
 * uses for its expected-maximum statistic. One trial has no selection effect, so it is 0.
 */
export function expectedMaxZ(trials: number): number {
  if (trials <= 1) return 0
  return (1 - EULER_MASCHERONI) * normalQuantile(1 - 1 / trials) + EULER_MASCHERONI * normalQuantile(1 - 1 / (trials * Math.E))
}

/** The HAC standard error of a mean IC: the published mean divided by the published HAC t statistic. */
export function hacStandardError(summary: RankSummary): number | null {
  const { meanRankIc: mean, hacTStatistic: t } = summary
  if (!finite(mean) || !finite(t) || t === 0) return null
  return Math.abs(mean / t)
}

export type NoiseFrontier = {
  trials: number
  /** HAC standard error implied by the leader's published mean IC and raw HAC p-value. */
  standardError: number
  leaderIc: number
  rawP: number
  adjustedP: number
  passes: boolean | null
  family: NonNullable<SelectionIntegrity['researchFamily']>
  /** The Run that produced the leader value, when exactly one Run matches it. */
  leaderRunId: string | null
}

export type FrontierResult = { ok: true; value: NoiseFrontier } | { ok: false; reason: string }

/** Picks the Factor selection ledger from the Project's Sessions and checks it carries what the chart needs. */
export function noiseFrontier(
  sessions: { selectionIntegrity?: SelectionIntegrity }[],
  runs: { id: string; primaryValue: number | null }[],
): FrontierResult {
  const candidates = sessions
    .map((s) => s.selectionIntegrity)
    .filter((si): si is SelectionIntegrity => !!si && si.selectionMetric === 'validation_mean_ic')
  if (candidates.length === 0) {
    return { ok: false, reason: 'No Research Session in this Project selected on validation mean IC, so there is no trial ledger and the number of independent trials N is unknown.' }
  }
  const integrity = candidates.find((c) => c.selectionAdjustment?.statistics) ?? candidates[0]
  const adjustment = integrity.selectionAdjustment
  const family = integrity.researchFamily
  if (!adjustment || !family) return { ok: false, reason: 'The Session ledger publishes no selection adjustment.' }
  const stats = adjustment.statistics
  if (adjustment.status !== 'available' || !stats) {
    return { ok: false, reason: `The selection adjustment is ${adjustment.status}${adjustment.reason ? ` (${adjustment.reason})` : ''}.` }
  }
  const { observedMeanIc: ic, rawHacPValue: rawP, familywiseAdjustedPValue: adjustedP, uniqueTrials } = stats
  if (!finite(ic) || ic === 0 || !finite(rawP) || rawP <= 0 || rawP >= 1) {
    return { ok: false, reason: 'The published raw HAC p-value is degenerate, so the null spread of the mean IC cannot be recovered.' }
  }
  const se = Math.abs(ic) / normalQuantile(1 - rawP / 2)
  const matches = runs.filter((r) => r.primaryValue !== null && Math.abs(r.primaryValue - ic) < 1e-12)
  return {
    ok: true,
    value: {
      trials: uniqueTrials,
      standardError: se,
      leaderIc: ic,
      rawP,
      adjustedP,
      passes: adjustment.passes,
      family,
      leaderRunId: matches.length === 1 ? matches[0].id : null,
    },
  }
}

/** Mean IC a lone best trial must beat to clear the published family-wise 95% HAC rule at N trials. */
export function familywiseThreshold(standardError: number, trials: number, confidence = 0.95): number {
  return standardError * normalQuantile(1 - (1 - confidence) / 2 / Math.max(1, trials))
}

export type RollingPoint = { t: number; ic: number; split: FactorSplit }

export function samplePoints(diagnostics: FactorDiagnostics, horizon: number): RollingPoint[] {
  const key = `rankIcH${horizon}`
  const points: RollingPoint[] = []
  for (const p of diagnostics.icPath.points) {
    const value = p[key]
    const t = Date.parse(p.timestamp)
    if (typeof value === 'number' && Number.isFinite(value) && Number.isFinite(t)) points.push({ t, ic: value, split: p.split })
  }
  return points.sort((a, b) => a.t - b.t)
}

/** Trailing mean over the previous `window` sampled points; the first window-1 points have no value. */
export function trailingMean(points: RollingPoint[], window: number): (number | null)[] {
  return points.map((_, i) => {
    if (i < window - 1) return null
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += points[j].ic
    return sum / window
  })
}

export function niceTicks(min: number, max: number, target = 5): number[] {
  const span = max - min || 1
  const raw = span / target
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  return ticks
}
