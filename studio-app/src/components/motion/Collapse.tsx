/*
 * Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton):
 * kept the behaviour of primitives/radix-ui/collapsible and effects/auto-height, a panel whose height eases between closed and
 * its natural height; changed it to a CSS grid-rows transition (0fr to 1fr) with no Radix, no measuring and no Motion, and the
 * closed panel is `inert` so it leaves the tab order and the accessibility tree exactly as `hidden` did.
 */
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { prefersReducedMotion } from './reducedMotion'
import './motion.css'

/**
 * Disclosure body. `id` and `className` go on the content element so `aria-controls` and the caller's padding keep working.
 * The caller owns the button and `aria-expanded`.
 */
export function Collapse({ open, children, ...rest }: { open: boolean; children: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <div className="mo-collapse" data-open={open ? '' : undefined} inert={!open}>
      <div className="mo-collapse-clip">
        <div {...rest}>{children}</div>
      </div>
    </div>
  )
}

/**
 * Animates the height of a wrapper whenever its content changes size (a list that grows, a row that appears).
 * The first measurement never animates; reduced motion never animates.
 */
export function AutoHeight({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    let last = i.offsetHeight
    let running: Animation | null = null
    const ro = new ResizeObserver(() => {
      const next = i.offsetHeight
      if (next === last) return
      // The wrapper already sits at its new auto height here, so start from where it was: the old content height, or mid-flight.
      const from = running ? o.getBoundingClientRect().height : last
      last = next
      if (prefersReducedMotion() || typeof o.animate !== 'function') return
      running?.cancel()
      const mine = o.animate([{ height: `${from}px` }, { height: `${next}px` }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' })
      running = mine
      const clear = () => {
        if (running === mine) running = null
      }
      mine.onfinish = clear
      mine.oncancel = clear
    })
    ro.observe(i)
    return () => {
      ro.disconnect()
      running?.cancel()
    }
  }, [])
  return (
    <div ref={outer} className={`mo-autoheight${className ? ` ${className}` : ''}`}>
      <div ref={inner}>{children}</div>
    </div>
  )
}
