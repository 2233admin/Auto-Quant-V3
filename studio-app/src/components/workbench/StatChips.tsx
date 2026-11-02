import type { ReactNode } from 'react'
import { formattedSignRole } from '../../design/signConvention'
import { AnimatedValue } from '../motion/AnimatedValue'
import './workbench.css'

/** `hint` is the tooltip: where the number comes from. */
export type Stat = { label: string; value: string; hint?: string; signed?: boolean; focal?: boolean }

/**
 * The headline numbers of the Run on show, as a compact inline row (label, mono value) that sits beside the Run selector.
 * Values arrive formatted from Core; `scope` names the split they belong to so the row never reads as split-free.
 */
export function StatChips({ stats, label, scope }: { stats: Stat[]; label: string; scope?: ReactNode }) {
  if (stats.length === 0) return null
  return (
    <dl data-sign-area="verdict-headline" className="wb-stats" aria-label={label}>
      {scope && <span className="wb-stats-scope faint">{scope}</span>}
      {stats.map((s) => (
        <div key={s.label} className="wb-stat" title={s.hint ? `${s.label}: ${s.hint}` : undefined}>
          <dt>{s.label}</dt>
          <dd className={s.focal ? "type-value-focal" : "type-value"} data-sign={s.signed ? formattedSignRole(s.value) : undefined}><AnimatedValue value={s.value} /></dd>
        </div>
      ))}
    </dl>
  )
}
