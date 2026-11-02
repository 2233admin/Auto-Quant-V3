import { uiText, uiTemplate } from '../i18n'
import { num, when } from '../format'
import { routeHref } from '../route'
import { MetricInfo } from '../components/MetricInfo'
import { primaryMetricId } from '../pages/compare/comparisonMetrics'
import { bi, metricEntry } from '../metrics/catalogue'
import type { Col } from './DataTable'
import { runKey, type HistoryRun } from './runHistoryApi'

export function runColumns(picked: string[], toggle: (key: string) => void): Col<HistoryRun>[] {
  return [
    { id: 'pick', label: uiText('Select'), render: r => <input type="checkbox" aria-label={uiTemplate('Select {0} for comparison', [r.id])} checked={picked.includes(runKey(r))} onChange={() => toggle(runKey(r))} /> },
    { id: 'run', label: uiText('Run'), rowHeader: true, sort: r => r.id, render: r => <><a href={routeHref({ view: 'run', id: r.project.id, run: r.id })} className="mono small" title={`${r.id}\n${r.sourceHash}`}>{r.id.split('-').at(-1)}</a><span className="faint small mono">{r.studyId}</span></> },
    { id: 'project', label: uiText('Project'), sort: r => r.project.name, render: r => r.project.name },
    { id: 'object', label: uiText('Object kind'), sort: r => r.objectKind, render: r => uiText(r.objectKind) },
    { id: 'lane', label: uiText('Lane'), sort: r => r.lane, render: r => uiText(r.lane) },
    { id: 'verdict', label: uiText('Verdict'), sort: r => r.verdict, render: r => uiText(r.verdict) },
    { id: 'metric', label: uiText('Validation metric'), sort: r => r.primaryMetric, render: r => <span className="small" title={r.primaryMetric}>{bi(metricEntry(primaryMetricId(r.primaryMetric)).label)} <MetricInfo id={primaryMetricId(r.primaryMetric)} /></span> },
    { id: 'value', label: uiText('Value'), align: 'r', sort: r => r.primaryValue, render: r => num(r.primaryValue, 4) },
    { id: 'started', label: uiText('Started (UTC)'), sort: r => r.startedAt, render: r => <span className="mono small">{when(r.startedAt)}</span> },
    { id: 'duration', label: uiText('Duration'), align: 'r', sort: r => r.durationMs, render: r => `${(r.durationMs / 1000).toFixed(1)} s` },
  ]
}
