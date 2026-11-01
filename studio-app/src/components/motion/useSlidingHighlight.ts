/*
 * Adapted from animate-ui (https://github.com/imskyleen/animate-ui, MIT + Commons Clause, Copyright (c) 2025 Elliot Sutton):
 * kept the behaviour of primitives/effects/highlight and primitives/tabs, one indicator that glides to the active item and one
 * that follows the hovered item; changed it to write the measured box into CSS custom properties on the container, so the
 * indicators are the container's ::before / ::after (no extra DOM, no Motion layout animation) and motion.css owns the easing,
 * colours and reduced-motion behaviour.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

export type SlidingHighlightOptions = {
  /** CSS selector for the items inside the container (e.g. `.wb-tab`). */
  items: string
  /** CSS selector for the one active item; omit when only the hover indicator is wanted. */
  active?: string
  /** Follow the pointer (and keyboard focus-visible). Default true. */
  hover?: boolean
  /** Do not show the hover indicator on the active item (the active one already has a fill). Default false. */
  skipActiveHover?: boolean
}

type Box = { x: number; y: number; w: number; h: number; r: string }

function measure(container: HTMLElement, item: HTMLElement): Box {
  const c = container.getBoundingClientRect()
  const i = item.getBoundingClientRect()
  return {
    x: i.left - c.left - container.clientLeft + container.scrollLeft,
    y: i.top - c.top - container.clientTop + container.scrollTop,
    w: i.width,
    h: i.height,
    r: getComputedStyle(item).borderRadius,
  }
}

function write(container: HTMLElement, key: 'a' | 'h', box: Box) {
  const s = container.style
  s.setProperty(`--mo-${key}-x`, `${box.x}px`)
  s.setProperty(`--mo-${key}-y`, `${box.y}px`)
  s.setProperty(`--mo-${key}-w`, `${box.w}px`)
  s.setProperty(`--mo-${key}-h`, `${box.h}px`)
  s.setProperty(`--mo-${key}-r`, box.r)
}

/**
 * Sliding active and hover indicators for a group of items. The container needs the `mo-hl` class (plus a variant class);
 * this hook only measures and sets `--mo-a-*` / `--mo-h-*` and the `data-mo-a` / `data-mo-h` states that motion.css reads.
 * It changes no markup, focus order or key handling.
 */
export function useSlidingHighlight<T extends HTMLElement>(ref: RefObject<T | null>, options: SlidingHighlightOptions): void {
  const opts = useRef(options)
  opts.current = options

  // Active indicator: measured after every render (cheap: one rect) and whenever the container or the active item resizes.
  useLayoutEffect(() => {
    const el = ref.current
    const { active } = opts.current
    if (!el || !active) return
    const place = () => {
      const target = el.querySelector<HTMLElement>(active)
      if (!target || el.clientWidth === 0) {
        el.removeAttribute('data-mo-a')
        return
      }
      write(el, 'a', measure(el, target))
      // First placement jumps (no transition); later ones glide.
      if (el.dataset.moA === undefined) {
        el.dataset.moA = 'enter'
        requestAnimationFrame(() => {
          if (el.dataset.moA === 'enter') el.dataset.moA = 'on'
        })
      }
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el)
    const target = el.querySelector<HTMLElement>(active)
    if (target) ro.observe(target)
    return () => ro.disconnect()
  })

  // Hover indicator: delegated listeners, attached once.
  useEffect(() => {
    const el = ref.current
    if (!el || opts.current.hover === false) return
    let frame = 0
    const hide = () => {
      cancelAnimationFrame(frame)
      if (el.dataset.moH) el.dataset.moH = 'off'
    }
    const show = (item: HTMLElement) => {
      const { active, skipActiveHover } = opts.current
      if (skipActiveHover && active && item.matches(active)) return hide()
      write(el, 'h', measure(el, item))
      const state = el.dataset.moH
      if (state === 'on' || state === 'enter') return
      // Entering from nothing: appear in place, then glide on later moves.
      el.dataset.moH = 'enter'
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (el.dataset.moH === 'enter') el.dataset.moH = 'on'
      })
    }
    const itemOf = (t: EventTarget | null): HTMLElement | null => {
      const hit = (t as Element | null)?.closest?.(opts.current.items) as HTMLElement | null
      return hit && el.contains(hit) ? hit : null
    }
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const item = itemOf(e.target)
      if (item) show(item)
      else hide()
    }
    const onFocusIn = (e: FocusEvent) => {
      const item = itemOf(e.target)
      if (item && item.matches(':focus-visible')) show(item)
    }
    el.addEventListener('pointerover', onOver)
    el.addEventListener('pointerleave', hide)
    el.addEventListener('focusin', onFocusIn)
    el.addEventListener('focusout', hide)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointerover', onOver)
      el.removeEventListener('pointerleave', hide)
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', hide)
    }
  }, [ref])
}
