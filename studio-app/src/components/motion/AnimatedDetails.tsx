/*
 * Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton):
 * kept the behaviour of primitives/radix-ui/accordion and effects/auto-height, content that eases open and closed instead of
 * jumping; changed it to keep the native <details>/<summary> (keyboard, screen reader and find-in-page unchanged) and animate
 * its height with the Web Animations API, skipping the animation entirely under reduced motion.
 */
import { useRef, type ComponentProps, type MouseEvent } from 'react'
import { prefersReducedMotion } from './reducedMotion'
import './motion.css'

const DURATION = 220
const EASE = 'cubic-bezier(.22,1,.36,1)'

/** A native `<details>` whose open and close ease the height. Same props and semantics as `<details>`. */
export function AnimatedDetails({ onClick, children, ref: _ref, ...rest }: ComponentProps<'details'>) {
  const ref = useRef<HTMLDetailsElement>(null)
  const running = useRef<Animation | null>(null)
  const baseOverflow = useRef('')

  const handle = (event: MouseEvent<HTMLDetailsElement>) => {
    onClick?.(event)
    const el = ref.current
    const summary = (event.target as Element).closest('summary')
    if (event.defaultPrevented || !el || !summary || summary.parentElement !== el) return
    if (prefersReducedMotion() || typeof el.animate !== 'function') return // native toggle
    event.preventDefault()
    if (!running.current) baseOverflow.current = el.style.overflow
    const startHeight = el.getBoundingClientRect().height // mid-flight if a click lands during an animation
    running.current?.cancel()

    const cs = getComputedStyle(el)
    const chrome = cs.boxSizing === 'border-box' ? 0 : parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    const was = el.open
    const from = startHeight - chrome
    el.open = !was
    const to = el.getBoundingClientRect().height - chrome
    if (was) el.open = true // stay open while closing; closed for real when the animation ends
    el.style.overflow = 'hidden'
    const anim = el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: DURATION, easing: EASE })
    running.current = anim
    const settle = () => {
      if (running.current !== anim) return // a newer click took over
      el.style.overflow = baseOverflow.current
      running.current = null
    }
    anim.onfinish = () => {
      if (was && running.current === anim) el.open = false
      settle()
    }
    anim.oncancel = settle
  }

  return (
    <details {...rest} ref={ref} onClick={handle}>
      {children}
    </details>
  )
}
