import { useCallback, useRef, useState } from 'react'

/**
 * Width of the element a chart is drawn in, kept current as the layout changes. The SVG viewBox is set to this
 * width so one SVG unit is one CSS pixel: the plot fills its column and the 11px axis text stays 11px.
 * A callback ref is used so the observer attaches whenever the element mounts, even after an early return.
 * `min` is the narrowest width a plot is laid out at (the frame scrolls rather than squashing the plot below it).
 */
export function useFitWidth<T extends Element>(min = 360, fallback = 980) {
  const [width, setWidth] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el) return
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width))
    read()
    const next = new ResizeObserver(read)
    next.observe(el)
    observer.current = next
  }, [])
  return [ref, Math.max(min, width || fallback)] as const
}
