import { useId, useState, type ReactNode } from 'react'
import { Icon } from '../../design/icons'
import { Info } from '../Info'
import './workbench.css'

export type Fact = { label: string; value: ReactNode; mono?: boolean }

function Facts({ facts, label, compact }: { facts: Fact[]; label: string; compact: boolean }) {
  return (
    <dl className="wb-facts" aria-label={label}>
      {facts.map((f) => (
        <div key={f.label} className="wb-fact" title={compact && (typeof f.value === 'string' || typeof f.value === 'number') ? `${f.label}: ${f.value}` : undefined}>
          <dt>{f.label}</dt>
          <dd className={f.mono ? 'mono' : undefined} translate={f.mono ? 'no' : undefined}>{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Compact read-only key/value facts. Default `grid`: three columns when the card is wide enough, else two; labels sit above
 * the value, which stays on one line (ellipsis, full text in the tooltip); `compact={false}` lets values wrap.
 * `row` shows `facts` as one wrapping row of "label value" chips (long values wrap, never an ellipsis) and puts `more`
 * behind a "Details" toggle in the heading line. `locked` shows a lock icon and the optional `info` "?" explains why the values cannot
 * be edited here (for example Study-locked parameters).
 */
export function FactChips({
  facts,
  label,
  locked = false,
  info,
  compact = true,
  variant = 'grid',
  more = [],
  moreExtra,
  aside,
}: {
  facts: Fact[]
  label: string
  locked?: boolean
  info?: ReactNode
  compact?: boolean
  variant?: 'grid' | 'row'
  more?: Fact[]
  /** Extra content inside the Details disclosure, under the facts (for example a copy button for an id). */
  moreExtra?: ReactNode
  /** Sits at the end of the heading line, before the Details toggle (for example a status chip). */
  aside?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const moreId = useId()
  const hasMore = variant === 'row' && (more.length > 0 || !!moreExtra)
  const head = (
    <p className="wb-facts-head">
      {locked && (
        <span className="wb-lock" role="img" aria-label="Locked">
          <Icon name="lock" />
        </span>
      )}
      <span>{label}</span>
      {info && <Info label={`${label}: why locked`}>{info}</Info>}
      {(aside || hasMore) && (
        <span className="wb-facts-tools">
          {aside}
          {hasMore && (
            <button type="button" className="wb-link" aria-expanded={open} aria-controls={moreId} onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide details' : 'Details'}
            </button>
          )}
        </span>
      )}
    </p>
  )
  if (variant === 'row') {
    return (
      <div className="wb-facts-wrap is-row">
        {head}
        <dl className="wb-chiprow" aria-label={label}>
          {facts.map((f) => (
            <div key={f.label} className="wb-chip">
              <dt>{f.label}</dt>
              <dd className={f.mono ? 'mono' : undefined} translate={f.mono ? 'no' : undefined}>{f.value}</dd>
            </div>
          ))}
        </dl>
        {hasMore && (
          <div id={moreId} className="wb-facts-more" hidden={!open}>
            {more.length > 0 && <Facts facts={more} label={`${label}: details`} compact={false} />}
            {moreExtra}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className={`wb-facts-wrap${compact ? ' is-compact' : ''}`}>
      {head}
      <Facts facts={facts} label={label} compact={compact} />
    </div>
  )
}
