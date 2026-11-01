/*
 * Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton):
 * kept the behaviour of primitives/radix-ui/progress, a bar that eases to each new value; changed it to plain markup with the
 * ARIA progressbar attributes written by hand (no Radix), a transform-based fill driven by a CSS transition, and a restrained
 * shimmer for the indeterminate state that becomes a static muted bar under reduced motion.
 */
import './motion.css'

/** Slim progress bar. `value` is 0-100, or null for "running but not measurable". Keeps the `wb-bar` look of the StatusLine. */
export function Progress({ value, label }: { value: number | null; label: string }) {
  const pct = value === null ? null : Math.min(100, Math.max(0, value))
  return (
    <div
      className={`wb-bar mo-progress${pct === null ? ' is-indeterminate' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct ?? undefined}
      aria-valuetext={pct === null ? 'In progress, not measured' : `${pct} percent`}
    >
      <span style={pct === null ? undefined : { transform: `scaleX(${pct / 100})` }} />
    </div>
  )
}
