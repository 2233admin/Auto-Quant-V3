import { uiText, uiTemplate } from '../i18n'
import { when } from '../format'
import { routeHref } from '../route'
import { MetricInfo } from '../components/MetricInfo'
import { primaryMetricId } from '../pages/compare/comparisonMetrics'
import { bi, metricEntry } from '../metrics/catalogue'
import { signedNumber, signRole } from '../design/signConvention'
import type { Col } from './DataTable'
import { runKey, type HistoryRun } from './runHistoryApi'

/** Primary metrics that are a signed P&L-like outcome. Counts, concentration and volatility have no profit or loss to colour. */
const SIGNED_METRICS = new Set(['validation_mean_ic', 'validation_net_sharpe', 'validation_mean_net_sharpe', 'worst_terminal_book_return'])
export const isSignedMetric = (metric: string) => SIGNED_METRICS.has(metric)
/** A failed, crashed or reverted Run has no headline outcome worth colouring: it shows its state word in grey. */
export const runFailed = (r: HistoryRun) => r.status !== 'succeeded' || /^(revert|crash|fail)/i.test(r.verdict)
export const runStateWord = (r: HistoryRun) => (r.verdict && r.verdict !== 'succeeded' ? r.verdict : r.status)

/** Sign of a Run's headline metric for the metric column and the row edge; a failed or unsigned Run has none. */
export function runSign(r: HistoryRun): 'positive' | 'negative' | 'neutral' {
  return runFailed(r) || !isSignedMetric(r.primaryMetric) ? 'neutral' : signRole(r.primaryValue)
}

/** Row edge marker: the sign colour of the headline metric, grey for a failed or reverted Run, nothing for an unsigned metric. */
export function runEdge(r: HistoryRun): 'positive' | 'negative' | 'muted' | undefined {
  if (runFailed(r)) return 'muted'
  const sign = runSign(r)
  return sign === 'neutral' ? undefined : sign
}

const durationText = (ms: number) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s` : `${(ms / 1000).toFixed(1)} s`)

/**
 * Human columns first (Project, object, verdict, headline metric and value, start, duration); the Run id and Study id, the
 * log-like technical column, sit at the far right, quiet, on one truncated line.
 */
export function runColumns(picked: string[], toggle: (key: string) => void): Col<HistoryRun>[] {
  return [
    { id: 'pick', label: uiText('Select'), render: r => <input type="checkbox" aria-label={uiTemplate('Select {0} for comparison', [r.id])} checked={picked.includes(runKey(r))} onChange={() => toggle(runKey(r))} /> },
    { id: 'project', label: uiText('Project'), rowHeader: true, sort: r => r.project.name, render: r => <span className="run-project" translate="no" title={r.project.name}>{r.project.name}</span> },
    { id: 'object', label: uiText('Object kind'), sort: r => r.objectKind, render: r => <span title={r.lane}>{uiText(r.objectKind)}</span> },
    { id: 'verdict', label: uiText('Verdict'), sort: r => r.verdict, render: r => runFailed(r) ? <span className="run-state" data-state={runStateWord(r)}>{uiText(runStateWord(r))}</span> : <span className="run-verdict">{uiText(r.verdict)}</span> },
    { id: 'metric', label: uiText('Validation metric'), sort: r => r.primaryMetric, render: r => <span className="run-metric" title={r.primaryMetric}>{bi(metricEntry(primaryMetricId(r.primaryMetric)).label)} <MetricInfo id={primaryMetricId(r.primaryMetric)} /></span> },
    { id: 'value', label: uiText('Value'), align: 'r', sort: r => r.primaryValue, render: r => <span className="run-value" data-sign={runFailed(r) ? undefined : isSignedMetric(r.primaryMetric) ? runSign(r) : undefined}>{r.primaryValue == null ? '—' : isSignedMetric(r.primaryMetric) ? signedNumber(r.primaryValue, 4) : r.primaryValue.toFixed(4)}</span> },
    { id: 'started', label: uiText('Started (UTC)'), sort: r => r.startedAt, render: r => <span className="mono small">{when(r.startedAt)}</span> },
    { id: 'duration', label: uiText('Duration'), align: 'r', sort: r => r.durationMs, render: r => <span className="mono small">{durationText(r.durationMs)}</span> },
    { id: 'run', label: uiText('Run id'), className: 'run-id', sort: r => r.id, render: r => <a href={routeHref({ view: 'run', id: r.project.id, run: r.id })} className="mono" title={`${r.id}\n${r.studyId}\n${r.sourceHash}`}>{r.id}</a> },
  ]
}
