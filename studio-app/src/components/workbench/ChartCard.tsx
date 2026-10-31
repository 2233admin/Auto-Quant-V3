import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react'
import { useFitWidth } from '../../design/useFitWidth'
import { Info } from '../Info'
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
  minHeight = 220,
  children,
}: {
  title: string
  info?: ReactNode
  toggle?: ReactNode
  legend?: ReactNode
  /** Smallest plot height; the body scrolls rather than squashing below it. */
  minHeight?: number
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
    <figure className="wb-chart">
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
    </figure>
  )
}
