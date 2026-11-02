import { uiValue } from '../../i18n'
import { useId, useRef, type KeyboardEvent } from 'react'
import { useSlidingHighlight } from '../motion/useSlidingHighlight'
import '../motion/motion.css'
import './workbench.css'

export type SegmentOption<T extends string> = { id: T; label: string }

/** Two to four mutually exclusive options as one radio group (arrows, Home, End move and select). */
export function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  disabledReason,
}: {
  label: string
  options: readonly [SegmentOption<T>, SegmentOption<T>] | readonly [SegmentOption<T>, SegmentOption<T>, SegmentOption<T>] | readonly [SegmentOption<T>, SegmentOption<T>, SegmentOption<T>, SegmentOption<T>]
  value: T
  onChange: (id: T) => void
  disabledReason?: string
}) {
  const reasonId = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const group = useRef<HTMLDivElement>(null)
  useSlidingHighlight(group, { items: '.wb-seg-opt', active: '.wb-seg-opt[aria-checked="true"]', skipActiveHover: true })
  const move = (event: KeyboardEvent, index: number) => {
    if (disabledReason) return
    const last = options.length - 1
    const key = event.key
    const next = key === 'ArrowRight' || key === 'ArrowDown' ? (index === last ? 0 : index + 1) : key === 'ArrowLeft' || key === 'ArrowUp' ? (index === 0 ? last : index - 1) : key === 'Home' ? 0 : key === 'End' ? last : -1
    if (next < 0) return
    event.preventDefault()
    onChange(options[next].id)
    refs.current[options[next].id]?.focus()
  }
  return (
    <div className="wb-seg-setting"><div ref={group} className="wb-seg mo-hl mo-hl--seg" role="radiogroup" aria-label={label} aria-describedby={disabledReason ? reasonId : undefined}>
      {options.map((o, i) => (
        <button
          key={o.id}
          ref={(el) => {
            refs.current[o.id] = el
          }}
          type="button"
          role="radio"
          disabled={!!disabledReason}
          aria-checked={o.id === value}
          tabIndex={o.id === value ? 0 : -1}
          className="wb-seg-opt"
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => move(e, i)}
        >
          {uiValue(o.label)}
        </button>
      ))}
    </div>{disabledReason && <p id={reasonId} className="small muted">{disabledReason}</p>}</div>
  )
}
