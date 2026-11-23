import { uiText } from '../i18n'
import type { FactorDiagnostics, FactorSplit, RankSummary } from '../api'

export const SPLITS: FactorSplit[] = ['train', 'validation', 'test']
export const SPLIT_LABEL: Record<FactorSplit, string> = { get train() { return uiText('Train') }, get validation() { return uiText('Validation') }, get test() { return uiText('Test') } }
/** What each split is for, in the words the Run's protocol uses. */
export const SPLIT_ROLE: Record<FactorSplit, string> = {
  get train() { return uiText('training') },
  get validation() { return uiText('selection') },
  get test() { return uiText('visible audit') },
}

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

/** The HAC standard error of a mean IC: the published mean divided by the published HAC t statistic. */
export function hacStandardError(summary: RankSummary): number | null {
  const { meanRankIc: mean, hacTStatistic: t } = summary
  if (!finite(mean) || !finite(t) || t === 0) return null
  return Math.abs(mean / t)
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
