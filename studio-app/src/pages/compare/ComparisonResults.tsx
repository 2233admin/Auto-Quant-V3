import { uiText } from '../../i18n'
import { num } from '../../format'
import { bi, metricEntry } from '../../metrics/catalogue'
import { MetricInfo } from '../../components/MetricInfo'
import { signRole } from '../../design/signConvention'
import type { Comparison } from '../../library/runHistoryApi'
import { comparisonMetrics, type MetricRow } from './comparisonMetrics'
import { deltaText } from './comparisonCopy'
import { ComparisonCharts } from './ComparisonCharts'
import { highlighted, hiddenTestNote, protocolFactRows, type FactValue } from './protocolFacts'
import { CopyButton } from '../../actions/CopyButton'
import { Collapse } from '../../components/motion/Collapse'
import { useState } from 'react'

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

/** One readable row per protocol fact; differing rows are highlighted and expand to both complete values. */
export function ProtocolFacts({ comparison: c, initiallyOpen = [] }: { comparison: Comparison; initiallyOpen?: string[] }) {
  const rows = protocolFactRows(c)
  const [open, setOpen] = useState(() => new Set(initiallyOpen))
  const toggle = (key: string) => setOpen(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  return <section><h2>{uiText('Protocol facts')}</h2><div className="tablewrap"><table className="tbl cmp cmp-facts" aria-label={uiText('Protocol facts')}>
    <thead><tr><th>{uiText('Field')}</th><th>{uiText('Baseline (A)')}</th><th>{uiText('Subject (B)')}</th><th>{uiText('State')}</th></tr></thead>
    <tbody>{rows.flatMap(row => {
      const hot = highlighted(row)
      const expanded = hot && open.has(row.key)
      const id = `fact-${row.key.replace(/\W/g, '-')}`
      const head = hot
        ? <button type="button" className="cmp-fact-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => toggle(row.key)}><span aria-hidden="true">{expanded ? '▾' : '▸'}</span> {row.label}</button>
        : row.label
      const out = [<tr key={row.key} className={hot ? 'cmp-different' : undefined} data-fact={row.key}>
        <th scope="row">{head}</th>
        <FactCell value={row.a} note={row.key === 'splitWindows' ? hiddenTestNote(c, 0) : undefined} />
        <FactCell value={row.b} note={row.key === 'splitWindows' ? hiddenTestNote(c, 1) : undefined} />
        <td>{uiText(row.state)}</td>
      </tr>]
      if (hot) out.push(<tr key={`${row.key}/full`} className="cmp-different cmp-fact-full"><td colSpan={4}>
        <Collapse open={expanded} id={id}><dl className="cmp-fact-values">
          <dt>{uiText('Baseline (A)')}</dt><dd><pre translate="no">{row.a.full}</pre></dd>
          <dt>{uiText('Subject (B)')}</dt><dd><pre translate="no">{row.b.full}</pre></dd>
        </dl></Collapse>
      </td></tr>)
      return out
    })}</tbody>
  </table></div></section>
}

function FactCell({ value, note }: { value: FactValue; note?: string }) {
  const title = note ? `${value.full}\n${note}` : value.full
  return <td className="cmp-fact"><span className="cmp-fact-line">
    <span className={value.hash ? 'cmp-fact-text mono' : 'cmp-fact-text'} title={title} translate="no">{value.text}</span>
    {value.hash && <CopyButton text={value.full} label={uiText('Copy hash')} />}
  </span></td>
}
