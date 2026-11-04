import { uiTemplate, uiText, uiValue } from '../i18n'
import type { ReactNode } from 'react'
import { bi, metricEntry, type MetricId } from '../metrics/catalogue'
import { Info } from './Info'
export type { MetricId } from '../metrics/catalogue'

/**
 * The catalogue definition of one metric: definition, how to read it, what this page's value means (`extra`, supplied by
 * the page from values it already shows), how Core computes it, caveats and reference libraries. Static catalogue text
 * plus page-owned context; it never reads a Run value itself.
 */
export function MetricExplanation({ id, extra }: { id: MetricId; extra?: ReactNode }) {
  const e = metricEntry(id)
  return (
    <span className="metric-def" data-metric={id}>
      <p>{bi(e.definition)}</p>
      <p><span className="metric-def-k">{uiText("How to read")}</span> {bi(e.read)}</p>
      {extra ? <span className="metric-def-page"><span className="metric-def-k">{uiText("On this page")}</span> {typeof extra === 'string' ? uiValue(extra) : extra}</span> : null}
      <p><span className="metric-def-k">{uiText("How AutoQuant computes it")}</span> {bi(e.core)}</p>
      {e.caveat && <p><span className="metric-def-k">{uiText("Caveat")}</span> {bi(e.caveat)}</p>}
      {e.sources && e.sources.length > 0 && (
        <p className="faint">
          {uiText("Compare:")}{' '}
          {e.sources.map((s, i) => (
            <span key={s.url}>{i > 0 ? ', ' : ''}<a href={s.url} target="_blank" rel="noreferrer" translate="no">{s.name}</a> ({s.license})</span>
          ))}
          . {uiText("Wording is AutoQuant’s own.")}
        </p>
      )}
    </span>
  )
}

/** The "?" for one metric, through the shared Info popover. `label` is the visible label (already localized). */
export function MetricInfo({ id, label, extra, align }: { id: MetricId; label?: string; extra?: ReactNode; align?: 'start' | 'end' }) {
  return (
    <Info label={uiTemplate("{0}: definition", [uiText(label ?? bi(metricEntry(id).label))])} align={align}>
      <MetricExplanation id={id} extra={extra} />
    </Info>
  )
}

/** One "?" that defines several metrics shown on one line (library cards). */
export function MetricListInfo({ ids, label }: { ids: MetricId[]; label: string }) {
  return (
    <Info label={label}>
      {ids.map((id) => (
        <span key={id} className="metric-def" data-metric={id}>
          <p><span className="metric-def-k">{bi(metricEntry(id).label)}</span> {bi(metricEntry(id).definition)}</p>
        </span>
      ))}
    </Info>
  )
}
