import type { ReactNode } from 'react'
import { Icon } from '../../design/icons'
import { Info } from '../Info'
import './workbench.css'

export type Fact = { label: string; value: ReactNode; mono?: boolean }

/**
 * Compact read-only key/value grid: three columns when the card is wide enough, else two. Labels sit above the value, which
 * stays on one line (ellipsis, full text in the tooltip). `compact={false}` lets values wrap. `locked` shows a lock icon and the optional `info` "?" explains why the
 * values cannot be edited here (for example Study-locked parameters).
 */
export function FactChips({ facts, label, locked = false, info, compact = true }: { facts: Fact[]; label: string; locked?: boolean; info?: ReactNode; compact?: boolean }) {
  return (
    <div className={`wb-facts-wrap${compact ? ' is-compact' : ''}`}>
      <p className="wb-facts-head">
        {locked && (
          <span className="wb-lock" role="img" aria-label="Locked">
            <Icon name="lock" />
          </span>
        )}
        <span>{label}</span>
        {info && <Info label={`${label}: why locked`}>{info}</Info>}
      </p>
      <dl className="wb-facts" aria-label={label}>
        {facts.map((f) => (
          <div key={f.label} className="wb-fact" title={compact && (typeof f.value === 'string' || typeof f.value === 'number') ? `${f.label}: ${f.value}` : undefined}>
            <dt>{f.label}</dt>
            <dd className={f.mono ? 'mono' : undefined} translate={f.mono ? 'no' : undefined}>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
