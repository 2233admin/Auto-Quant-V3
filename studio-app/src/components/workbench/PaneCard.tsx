import type { ReactNode } from 'react'
import './workbench.css'

/**
 * Card with a sticky header (tabs left, actions right, status line under) and a body that fills the remaining height
 * and scrolls on its own. `flush` removes body padding and scrolling for bodies that manage both (code editor, chart).
 */
export function PaneCard({
  label,
  tabs,
  actions,
  status,
  flush = false,
  children,
}: {
  /** Accessible name of the pane. */
  label: string
  tabs?: ReactNode
  actions?: ReactNode
  status?: ReactNode
  flush?: boolean
  children: ReactNode
}) {
  const hasHead = tabs || actions || status
  return (
    <section className="wb-pane" aria-label={label}>
      {hasHead && (
        <header className="wb-pane-head">
          {(tabs || actions) && (
            <div className="wb-pane-row">
              {tabs && <div className="wb-pane-tabs">{tabs}</div>}
              {actions && <div className="wb-pane-actions">{actions}</div>}
            </div>
          )}
          {status && <div className="wb-pane-status">{status}</div>}
        </header>
      )}
      <div className={`wb-pane-body${flush ? ' is-flush' : ''}`} tabIndex={flush ? undefined : 0} role={flush ? undefined : 'region'} aria-label={flush ? undefined : `${label} content`}>
        {children}
      </div>
    </section>
  )
}
