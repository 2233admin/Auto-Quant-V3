import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react'
import { useFitWidth } from '../../design/useFitWidth'
import { Info } from '../Info'
import { AnimatedDetails } from '../motion/AnimatedDetails'
import './workbench.css'

export type ChartSize = { width: number; height: number }

/**
 * Chart card: header (title, "?" Info, `toggle`, `legend`) and a body that fills the remaining height. The render prop gets
 * the measured body size (ResizeObserver; width via design/useFitWidth), so the plot fills the pane and text stays 1:1.
 */
export function ChartCard({
  title,
  info,
  toggle,
  legend,
  table,
  minHeight = 220,
  fill = false,
  children,
}: {
  title: string
  info?: ReactNode
  toggle?: ReactNode
  legend?: ReactNode
  /** The plotted numbers as a table, behind a "Data table" disclosure under the plot (the text alternative of the drawing). */
  table?: ReactNode
  /** Smallest plot height; the body scrolls rather than squashing below it. */
  minHeight?: number
  /** Take the height of the parent (a flush pane body) instead of the default slot height. */
  fill?: boolean
  children: (size: ChartSize) => ReactNode
}) {
  const [fitRef, width] = useFitWidth<HTMLDivElement>(240)
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(0)
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      fitRef(node)
      setEl(node)
    },
    [fitRef],
  )
  useLayoutEffect(() => {
    if (!el) return
    const read = () => setHeight(Math.round(el.getBoundingClientRect().height))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return (
    <figure className={`wb-chart${fill ? ' is-fill' : ''}`}>
      <figcaption className="wb-chart-head">
        <span className="wb-chart-title">
          <strong>{title}</strong>
          {info && <Info label={`${title}: how to read it`}>{info}</Info>}
        </span>
        {toggle && <span className="wb-chart-toggle">{toggle}</span>}
        {legend && <span className="wb-chart-legend">{legend}</span>}
      </figcaption>
      <div className="wb-chart-body" ref={ref} style={{ minHeight }}>
        <div className="wb-chart-fill">{height > 0 && children({ width, height })}</div>
      </div>
      {table && (
        <AnimatedDetails className="wb-chart-table datatable">
          <summary>Data table</summary>
          <div className="tablewrap">{table}</div>
        </AnimatedDetails>
      )}
    </figure>
  )
}
