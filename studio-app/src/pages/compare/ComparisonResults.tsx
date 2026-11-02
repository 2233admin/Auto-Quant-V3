import { uiText } from '../../i18n'
import { num } from '../../format'
import { bi, metricEntry } from '../../metrics/catalogue'
import { MetricInfo } from '../../components/MetricInfo'
import { signRole } from '../../design/signConvention'
import type { Comparison } from '../../library/runHistoryApi'
import { comparisonMetrics, type MetricRow } from './comparisonMetrics'
import { deltaText, fieldLabel } from './comparisonCopy'
import { ComparisonCharts } from './ComparisonCharts'

export function ComparisonResults({ comparison: c }: { comparison: Comparison }) {
  if (c.status !== 'comparable') return null
  const rows = comparisonMetrics(c)
  const audit = rows.filter(r => r.scope === 'Test audit')
  return <>
    <MetricTable rows={rows.filter(r => r.scope !== 'Test audit')} />
    <ComparisonCharts comparison={c} />
    <p className="small muted">{uiText('Test audit requires both published audits and visible-diagnostic roles; it never enters selection.')}</p>
    {audit.length > 0 && <details><summary>{uiText('Test audit')}</summary><MetricTable rows={audit} /></details>}
  </>
}

function MetricTable({ rows }: { rows: MetricRow[] }) {
  return <div className="tablewrap"><table className="tbl cmp" aria-label={uiText('Headline metrics')}>
      <thead><tr><th>{uiText('Measure')}</th><th className="r">{uiText('Baseline (A)')}</th><th className="r">{uiText('Subject (B)')}</th><th className="r">{uiText('Delta (B - A)')}</th></tr></thead>
      <tbody>{rows.map(r => {
        const delta = r.a !== null && r.b !== null ? r.b - r.a : null
        return <tr key={`${r.scope}/${r.id}`}>
          <th scope="row">{uiText(r.scope)} · {bi(metricEntry(r.id).label)} <MetricInfo id={r.id} /></th>
          <td className="r num">{num(r.a, 4)}</td><td className="r num">{num(r.b, 4)}</td>
          <td className="r num"><span className={r.focal ? 'signed-value type-value-focal' : undefined} data-sign={r.focal ? signRole(delta) : undefined}>{deltaText(delta)}</span></td>
        </tr>
      })}</tbody>
    </table></div>
}

const display = (value: unknown) => value == null ? '—' : typeof value === 'string' ? value : JSON.stringify(value, null, 2)
export function ProtocolFacts({ comparison: c }: { comparison: Comparison }) {
  const keys = Object.keys(c.a.protocol)
  const differs = new Set(c.differences.map(d => d.field))
  return <section><h2>{uiText('Protocol facts')}</h2><div className="tablewrap"><table className="tbl cmp cmp-facts">
    <thead><tr><th>{uiText('Field')}</th><th>{uiText('Baseline (A)')}</th><th>{uiText('Subject (B)')}</th><th>{uiText('State')}</th></tr></thead>
    <tbody>{keys.map(key => <tr key={key} className={differs.has(key) ? 'cmp-different' : undefined}>
      <th scope="row">{fieldLabel(key)}</th><td><pre>{display(c.a.protocol[key])}</pre></td><td><pre>{display(c.b.protocol[key])}</pre></td>
      <td>{uiText(differs.has(key) ? 'Different' : 'Same')}</td>
    </tr>)}<tr><th scope="row">{fieldLabel('sourceHash')}</th><td className="mono small">{c.a.sourceHash}</td><td className="mono small">{c.b.sourceHash}</td><td>{uiText(c.a.sourceHash === c.b.sourceHash ? 'Same' : 'Different')}</td></tr></tbody>
  </table></div></section>
}
