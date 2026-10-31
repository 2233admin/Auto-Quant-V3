import type { ReactNode } from 'react'
import { Glyph, type GlyphKind } from '../../design/icons'
import '../../actions/actions.css'
import './workbench.css'

export type StatusState = 'idle' | 'running' | 'done' | 'failed'
const GLYPH: Record<StatusState, GlyphKind> = { idle: 'empty', running: 'running', done: 'supported', failed: 'error' }

/**
 * One slim status line: state glyph, text, percent bar (or an indeterminate one when `percent` is null while running),
 * elapsed, optional Cancel, and a `details` slot behind a disclosure (stages, command).
 */
export function StatusLine({
  state,
  text,
  percent,
  elapsed,
  onCancel,
  details,
}: {
  state: StatusState
  text: string
  /** 0-100, or null for "running but not measurable". Omit to hide the bar. */
  percent?: number | null
  elapsed?: string
  onCancel?: () => void
  details?: ReactNode
}) {
  const bar = state === 'running' && percent !== undefined
  const pct = percent ?? null
  return (
    <div className="wb-status" data-state={state}>
      <div className="wb-status-line" role="status" aria-live="polite">
        <Glyph kind={GLYPH[state]} signal={state === 'failed'} />
        <span className="wb-status-text" title={text}>{text}</span>
        {bar && (
          <div
            className={`wb-bar${pct === null ? ' is-indeterminate' : ''}`}
            role="progressbar"
            aria-label={text}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? undefined}
            aria-valuetext={pct === null ? 'In progress, not measured' : `${pct} percent`}
          >
            <span style={pct === null ? undefined : { width: `${pct}%` }} />
          </div>
        )}
        {bar && <span className="wb-status-pct mono">{pct === null ? '—' : `${pct}%`}</span>}
        {elapsed && <span className="wb-status-time mono faint">{elapsed}</span>}
        {onCancel && state === 'running' && (
          <button type="button" className="abtn abtn--quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {details && (
        <details className="wb-status-more">
          <summary>Stages and command</summary>
          {details}
        </details>
      )}
    </div>
  )
}
