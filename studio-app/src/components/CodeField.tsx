import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './codefield.css'

/**
 * A plain textarea with a line-number gutter. Tab inserts four spaces; press Esc, then Tab, to leave the field.
 * No editor library: the gutter is a second element scrolled in step with the textarea.
 */
export function CodeField({
  label,
  value,
  onChange,
  readOnly = false,
  rows = 16,
  describedBy,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  readOnly?: boolean
  rows?: number
  describedBy?: string
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const escaped = useRef(false)
  const hint = useId()
  const [focused, setFocused] = useState(false)
  const count = Math.max(1, value.split('\n').length)

  useEffect(() => {
    if (gutter.current && area.current) gutter.current.scrollTop = area.current.scrollTop
  }, [value])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return
    if (event.key === 'Escape') {
      escaped.current = true
      return
    }
    if (event.key !== 'Tab' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      escaped.current = false
      return
    }
    if (escaped.current) {
      escaped.current = false
      return // let focus move on
    }
    event.preventDefault()
    const el = event.currentTarget
    const { selectionStart: from, selectionEnd: to } = el
    const next = `${value.slice(0, from)}    ${value.slice(to)}`
    onChange(next)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = from + 4
    })
  }

  return (
    <div className={`cf${readOnly ? ' is-readonly' : ''}${focused ? ' is-focused' : ''}`}>
      <div className="cf-box">
        <div className="cf-gutter mono" ref={gutter} aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          ref={area}
          className="cf-area mono"
          aria-label={label}
          aria-describedby={[hint, describedBy].filter(Boolean).join(' ')}
          value={value}
          rows={rows}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          readOnly={readOnly}
          translate="no"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onScroll={(event) => {
            if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            escaped.current = false
          }}
        />
      </div>
      <p id={hint} className="cf-hint small faint">
        {readOnly ? 'Read-only.' : 'Tab inserts 4 spaces. Press Esc, then Tab, to leave the field.'}
      </p>
    </div>
  )
}
