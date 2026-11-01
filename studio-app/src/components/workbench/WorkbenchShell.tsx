import type { CSSProperties, ReactNode } from 'react'
import './workbench.css'

/**
 * Two-column workbench: `left` and `right` slots at viewport height under the app header, page scroll off, each column
 * scrolls on its own (put a PaneCard in each). `ratio` is the left share in percent (default 40). Content is capped at
 * 1800px and centred. Without `left` the right pane takes the full width. Below 1000px the slots stack in normal flow.
 */
export function WorkbenchShell({ left, right, ratio = 40 }: { left?: ReactNode; right: ReactNode; ratio?: number }) {
  const l = Math.min(70, Math.max(30, ratio))
  const style = { ['--wb-l' as string]: `${l}fr`, ['--wb-r' as string]: `${100 - l}fr` } as CSSProperties
  return (
    <div className={`wb-shell${left ? '' : ' is-single'}`} style={style}>
      {left && <div className="wb-col">{left}</div>}
      <div className="wb-col">{right}</div>
    </div>
  )
}
