import { uiValue } from '../i18n'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import './info.css'

/**
 * A "?" button that opens a small popover holding the long-form text. Button plus region with aria-expanded and
 * aria-controls; Escape and a click outside close it. Used so a heading keeps one visible line and the full text
 * (and any field-name provenance) stays one click away.
 */
export function Info({ label, children, align = 'start' }: { label: string; children: ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const panel = useId()
  const body = useRef<HTMLSpanElement>(null)
  const [flip, setFlip] = useState(false)

  // Open toward the side that has room: if the popover would leave the viewport on the right, anchor it to the button's right edge.
  useLayoutEffect(() => {
    if (!open) {
      setFlip(false)
      return
    }
    const r = body.current?.getBoundingClientRect()
    if (r && align === 'start' && r.right > window.innerWidth - 8) setFlip(true)
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        root.current?.querySelector('button')?.focus()
      }
    }
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <span className="info" ref={root}>
      <button type="button" className="info-btn" aria-expanded={open} aria-controls={panel} aria-label={uiValue(label)} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">?</span>
      </button>
      <span id={panel} role="region" aria-label={label} className={`info-body info-body--${flip ? 'end' : align}`} hidden={!open} ref={body}>
        {children}
      </span>
    </span>
  )
}
