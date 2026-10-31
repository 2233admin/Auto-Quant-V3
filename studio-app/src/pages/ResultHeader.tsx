import type { ReactNode } from 'react'

/**
 * Sticky result header of a workbench page: the Run selector on the first row (full width), then one row holding the
 * primary action and the text links. Stays under the top bar while the result scrolls.
 */
export function ResultHeader({ select, action, links }: { select: ReactNode; action: ReactNode; links: ReactNode }) {
  return (
    <div className="wb-rh">
      <div className="wb-rh-sel">{select}</div>
      <div className="wb-rh-act">
        {action}
        <nav className="wb-rh-links" aria-label="Related pages">
          {links}
        </nav>
      </div>
    </div>
  )
}
