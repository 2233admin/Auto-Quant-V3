import type { ComponentProps, ReactNode } from 'react'
import { ChartCard } from './ChartCard'

type FigureProps = {
  title: string
  subtitle: string
  label: string
  caption: string
  development?: boolean
  /** A real download, never an inert export label. */
  exportAction?: { label: string; onClick: () => void }
}

/** The existing measured chart host plus the complete figure anatomy. */
export function FigureCard({ subtitle, label, caption, development, exportAction, ...chart }: FigureProps & Omit<ComponentProps<typeof ChartCard>, 'subtitle' | 'footer'>) {
  return <ChartCard {...chart} subtitle={<>{subtitle}{development && <span className="development-tag">development</span>}</>}
    footer={<FigureCaption label={label} caption={caption} exportAction={exportAction} />} />
}

function FigureCaption({ label, caption, exportAction }: Pick<FigureProps, 'label' | 'caption' | 'exportAction'>) {
  return <figcaption className="figure-caption"><span className="figure-label">{label}</span><span>{caption}</span>
    {exportAction && <button className="wb-link figure-export" onClick={exportAction.onClick}>{exportAction.label}</button>}
  </figcaption>
}

export type ComparisonRow = { label: string; baseline: number | null | undefined; subject: number | null | undefined }
/** Common absolute scale; glyphs disclose negative values, never a sign-coloured bar. */
export function ComparisonFigure({ title, subtitle, label, caption, rows, baselineLabel, subjectLabel, format }: FigureProps & {
  rows: ComparisonRow[]; baselineLabel: string; subjectLabel: string; format: (value: number | null | undefined) => string
}) {
  const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
  const max = Math.max(...rows.flatMap(r => [r.baseline, r.subject]).filter(finite).map(Math.abs), 0.000001)
  const bar = (value: number | null | undefined, subject: boolean): ReactNode => <div className="comparison-row">
    <span className="comparison-name">{subject ? subjectLabel : baselineLabel}</span>
    <span className="comparison-track">{finite(value) && <span className={subject ? 'comparison-bar is-subject' : 'comparison-bar'} style={{ width: `${Math.abs(value) / max * 100}%` }} />}</span>
    <span className={subject ? 'type-value comparison-value is-subject' : 'type-value comparison-value'}>{finite(value) ? format(value) : 'Hidden'}</span>
  </div>
  return <figure className="comparison-figure"><header><h3>{title}</h3><p>{subtitle}<span className="development-tag">development</span></p></header>
    <div className="comparison-body">{rows.map(r => <div className="comparison-group" key={r.label}><h4>{r.label}</h4>{bar(r.baseline, false)}{bar(r.subject, true)}</div>)}</div>
    <FigureCaption label={label} caption={caption} />
  </figure>
}
