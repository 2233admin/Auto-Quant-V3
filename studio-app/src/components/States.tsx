import type { ReactNode } from 'react'
import './states.css'
import { STATE_COPY } from './stateCopy'

/**
 * The three shared page states. One size and one tone everywhere: a centred muted sentence, never an icon or a
 * button of its own. `title` names what is missing or what is loading; children say what to do next.
 */
export function Empty({ title = 'No evidence in this Project', children, minHeight }: { title?: string; children?: ReactNode; minHeight?: number }) {
  return (
    <div className="st st--empty" role="status" style={minHeight ? { minHeight } : undefined}>
      <p className="st-title">{STATE_COPY.empty}</p>
      {title !== STATE_COPY.empty && <p className="st-body">{title}</p>}
      {children && <div className="st-body">{children}</div>}
    </div>
  )
}

/** A spinner and one word inside a box that already has the size of the content it will hold, so nothing shifts. */
export function Loading({ label = 'Loading…', minHeight = 120 }: { label?: string; minHeight?: number }) {
  return (
    <div className="st st--loading" role="status" aria-live="polite" style={{ minHeight }}>
      <span className="st-spin" aria-hidden="true" />
      <p className="st-title" title={label}>{STATE_COPY.loading}</p>
    </div>
  )
}

/** The caption under a list that has no more rows. */
export function EndOfList({ label = 'End of list' }: { label?: string }) {
  return <p className="st-end">{label}</p>
}
