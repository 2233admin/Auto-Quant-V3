import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { uiText } from '../../i18n'
import { clampSplit, readSplit, SPLIT, splitBounds, splitColumns, splitFromPointer, splitKey, writeSplit } from './splitter'
import './workbench.css'

/**
 * Two-column workbench: `left` and `right` slots at viewport height under the app header, page scroll off, each column
 * scrolls on its own (put a PaneCard in each). `ratio` is the default left share in percent (default 40). Content is
 * capped at 1800px and centred. Without `left` the right pane takes the full width. Below 1000px the slots stack in
 * normal flow.
 *
 * With two panes a draggable vertical splitter sits between them (`role="separator"`): pointer drag, arrow keys move it
 * by 2 points (Shift 10), Home / End snap to the minimum widths (left 320px, right 480px), double-click or Enter resets
 * to 40/60. The width persists per user in localStorage under `aq-studio-split:<id>`.
 */
export function WorkbenchShell({ left, right, ratio = 40, id = 'workbench' }: { left?: ReactNode; right: ReactNode; ratio?: number; id?: string }) {
  const l = Math.min(70, Math.max(30, ratio))
  const shell = useRef<HTMLDivElement>(null)
  const leftCol = useId()
  const [width, setWidth] = useState(1200)
  const [percent, setPercent] = useState(() => readSplit(id, l))
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = shell.current
    if (!el || !left) return
    const measure = () => {
      const cs = getComputedStyle(el)
      setWidth(Math.round(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [left])

  const shown = clampSplit(percent, width)
  const commit = (next: number) => { setPercent(next); writeSplit(id, next) }
  const { min, max } = splitBounds(width)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = splitKey(shown, event.key, width, event.shiftKey)
    if (next === null) return
    event.preventDefault()
    commit(next)
  }
  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const el = shell.current
    if (!el) return
    const cs = getComputedStyle(el)
    const offset = event.clientX - el.getBoundingClientRect().left - parseFloat(cs.paddingLeft) - parseFloat(cs.borderLeftWidth)
    return splitFromPointer(offset, width)
  }

  if (!left) {
    return <div className="wb-shell is-single" ref={shell}><div className="wb-col">{right}</div></div>
  }
  const style = { ['--wb-l' as string]: `${l}fr`, ['--wb-r' as string]: `${100 - l}fr`, gridTemplateColumns: splitColumns(shown) } as CSSProperties
  return (
    <div className={`wb-shell has-split${dragging ? ' is-dragging' : ''}`} style={style} ref={shell}>
      <div className="wb-col" id={leftCol}>{left}</div>
      <div
        className="wb-split"
        role="separator"
        aria-orientation="vertical"
        aria-label={uiText('Resize panes')}
        aria-controls={leftCol}
        aria-valuenow={Math.min(Math.floor(max), Math.max(Math.ceil(min), Math.round(shown)))}
        aria-valuemin={Math.ceil(min)}
        aria-valuemax={Math.floor(max)}
        aria-valuetext={`${Math.round(shown)} / ${100 - Math.round(shown)}`}
        title={uiText('Drag to resize. Arrow keys move, Home and End snap, double-click resets to 40/60.')}
        tabIndex={0}
        data-min-left={SPLIT.minLeft}
        data-min-right={SPLIT.minRight}
        onKeyDown={onKeyDown}
        onDoubleClick={() => commit(clampSplit(SPLIT.reset, width))}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true) }}
        onPointerMove={(event) => { if (!dragging) return; const next = fromPointer(event); if (next !== undefined) setPercent(next) }}
        onPointerUp={(event) => { setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId); const next = fromPointer(event); if (next !== undefined) commit(next) }}
        onPointerCancel={() => setDragging(false)}
      />
      <div className="wb-col">{right}</div>
    </div>
  )
}
