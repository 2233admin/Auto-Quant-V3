/*
 * Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton):
 * kept the behaviour of primitives/texts/counting-number, a figure that counts to its new value; changed it to take the value
 * as the string Core already formatted (Studio never recomputes a statistic), count only its first number while the prefix and
 * suffix stay fixed, run on requestAnimationFrame instead of a Motion spring, skip the first paint and reduced motion, and keep
 * the final text for assistive technology while it counts.
 */
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from './reducedMotion'
import './motion.css'

const DURATION = 520

type Parsed = { pre: string; n: number; dec: number; group: boolean; suf: string }

/** Splits "+3.1 bp" / "1,234" / "38%" into prefix, first number and suffix; null when there is no number to count. */
export function parseValue(text: string): Parsed | null {
  const m = /^([^\d]*?)(\d[\d,]*(?:\.(\d+))?)(.*)$/s.exec(text)
  if (!m) return null
  const n = Number(m[2].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  return { pre: m[1], n, dec: m[3]?.length ?? 0, group: m[2].includes(','), suf: m[4] }
}

function render(p: Parsed, n: number): string {
  const fixed = n.toFixed(p.dec)
  const [int, frac] = fixed.split('.')
  const body = p.group ? int.replace(/\B(?=(\d{3})+$)/g, ',') : int
  return `${p.pre}${frac === undefined ? body : `${body}.${frac}`}${p.suf}`
}

/**
 * Renders `value` exactly as given. When it later changes to another value of the same shape (same prefix and suffix), the
 * number counts from the old to the new value for about half a second. Never on first paint, never under reduced motion.
 * While it counts, the moving text is hidden from assistive technology and the final text is offered instead; at rest the
 * element holds only the final text. Not a live region.
 */
export function AnimatedValue({ value, className }: { value: string; className?: string }) {
  const shown = useRef(value)
  const [frame, setFrame] = useState<string | null>(null)

  useEffect(() => {
    const from = parseValue(shown.current)
    const to = parseValue(value)
    shown.current = value
    if (!from || !to || from.pre !== to.pre || from.suf !== to.suf || from.n === to.n || prefersReducedMotion()) {
      setFrame(null)
      return
    }
    const dec = Math.max(from.dec, to.dec)
    const shape = { ...to, dec }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      if (t >= 1) {
        setFrame(null)
        return
      }
      const eased = 1 - (1 - t) ** 3
      setFrame(render(shape, from.n + (to.n - from.n) * eased))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  if (frame === null) return <span className={className}>{value}</span>
  return (
    <span className={className}>
      <span aria-hidden="true">{frame}</span>
      <span className="mo-sr">{value}</span>
    </span>
  )
}
