import { Info } from '../../components/Info'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceTicks } from '../factorMath'

const W = 980
const H = 300
const m = { l: 64, r: 80, t: 16, b: 40 }
const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

export type ChartPoint = { x: number; xl: string; y: number | null | undefined }
export type ChartSeries = { key: string; label: string; points: ChartPoint[]; dash?: string; tone?: 'text' | 'muted' }

const DASHES = [undefined, '7 3', '2 3', '10 3 2 3', '4 4']

/**
 * Plain multi-line SVG chart for published series. x is a number (date in ms or a bar offset) and `xl` its label.
 * The code only scales and formats; series are told apart by dash pattern and an end label, never by colour alone.
 * Hover the plot, or focus it and use the arrow keys, to read every series at one x. A data table sits behind a disclosure.
 */
export function LaneChart({
  title,
  desc,
  series,
  fy,
  yLabel,
  xLabel,
  fill = false,
  note,
}: {
  title: string
  desc: string
  series: ChartSeries[]
  fy: (v: number | null | undefined) => string
  yLabel: string
  xLabel?: string
  /** Fill the area between the first series and zero (drawdown style). */
  fill?: boolean
  note?: string
}) {
  const id = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b)
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).filter(finite)
  if (xs.length < 2 || ys.length < 2) {
    return (
      <div className="empty" role="status">
        <span className="badge">Not available</span>
        <p>not available: the Run publishes fewer than two points for “{title}”, too few to draw a line.</p>
      </div>
    )
  }
  const x0 = xs[0]
  const x1 = xs[xs.length - 1]
  const lo = fill ? Math.min(0, ...ys) : Math.min(...ys)
  const hi = fill ? Math.max(0, ...ys) : Math.max(...ys)
  const ticks = niceTicks(lo, hi, 5)
  const yMin = Math.min(ticks[0], lo)
  const yMax = Math.max(ticks[ticks.length - 1], hi)
  const px = (v: number) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r)
  const py = (v: number) => m.t + ((yMax - v) / (yMax - yMin || 1)) * (H - m.t - m.b)
  const path = (s: ChartSeries) => {
    let open = false
    return s.points
      .map((p) => {
        if (!finite(p.y)) {
          open = false
          return ''
        }
        const cmd = `${open ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`
        open = true
        return cmd
      })
      .join(' ')
  }
  const area = (() => {
    const s = series[0]
    const real = s.points.filter((p) => finite(p.y))
    if (!real.length) return ''
    const pts = real.map((p) => `${px(p.x).toFixed(1)},${py(p.y as number).toFixed(1)}`)
    return `${px(real[0].x).toFixed(1)},${py(0).toFixed(1)} ${pts.join(' ')} ${px(real[real.length - 1].x).toFixed(1)},${py(0).toFixed(1)}`
  })()
  const xTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => xs[Math.round(f * (xs.length - 1))]))]
  const labelOf = (xv: number) => series.flatMap((s) => s.points).find((p) => p.x === xv)?.xl ?? ''

  const nearest = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || !box.width) return null
    const target = x0 + ((((clientX - box.left) / box.width) * W - m.l) / (W - m.l - m.r)) * (x1 - x0)
    let best = 0
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - target) < Math.abs(xs[best] - target)) best = i
    return best
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const step = e.key === 'ArrowLeft' ? -1 : 1
      setHover((h) => Math.max(0, Math.min(xs.length - 1, (h ?? (step < 0 ? xs.length : -1)) + step)))
    } else if (e.key === 'Escape') setHover(null)
  }
  const at = (s: ChartSeries, xv: number) => s.points.find((p) => p.x === xv)?.y
  const hx = hover === null ? null : xs[hover]

  return (
    <figure className="chart lane-chart">
      <figcaption className="lane-cap">
        <h3 id={`${id}-t`}>{title}</h3>
        <Info label={`About: ${title}`}>
          <p>{desc} Hover the chart, or focus it and use the arrow keys, to read a point.</p>
        </Info>
        <p className="sr-only" id={`${id}-d`}>{desc} Hover the chart, or focus it and use the arrow keys, to read a point.</p>
      </figcaption>
      {series.length > 1 && (
        <span className="legend" role="list" aria-label="Series">
          {series.map((s, i) => (
            <span className="legend-item" role="listitem" key={s.key}>
              <svg width="26" height="12" aria-hidden="true">
                <line x1="0" y1="6" x2="26" y2="6" stroke={s.tone === 'muted' ? 'var(--muted)' : 'var(--text)'} strokeWidth="1.9" strokeDasharray={s.dash ?? DASHES[i % DASHES.length]} />
              </svg>
              {s.label}
            </span>
          ))}
        </span>
      )}
      <svg
        ref={svgRef}
        className="plot lane-plot"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${id}-t ${id}-d`}
        tabIndex={0}
        onPointerMove={(e: PointerEvent<SVGSVGElement>) => setHover(nearest(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={py(v)} y2={py(v)} stroke="var(--grid)" strokeWidth="1" opacity={v === 0 ? 1 : 0.5} />
            <text x={m.l - 8} y={py(v) + 4} textAnchor="end" className="ax">{fy(v)}</text>
          </g>
        ))}
        <text transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="ax">{yLabel}</text>
        {xTicks.map((xv, i) => (
          <g key={`${xv}-${i}`}>
            <line x1={px(xv)} x2={px(xv)} y1={H - m.b} y2={H - m.b + 4} stroke="var(--stroke)" />
            <text x={px(xv)} y={H - m.b + 17} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} className="ax">{labelOf(xv)}</text>
          </g>
        ))}
        {xLabel && <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle" className="ax faint">{xLabel}</text>}
        {fill && area && <polygon points={area} fill="var(--stroke)" opacity=".4" />}
        {series.map((s, i) => (
          <g key={s.key}>
            <path d={path(s)} fill="none" stroke="var(--bg)" strokeWidth="4" strokeLinejoin="round" />
            <path d={path(s)} fill="none" stroke={s.tone === 'muted' ? 'var(--muted)' : 'var(--text)'} strokeWidth="1.9" strokeLinejoin="round" strokeDasharray={s.dash ?? DASHES[i % DASHES.length]} />
          </g>
        ))}
        {series.length > 1 &&
          series.map((s) => {
            const real = s.points.filter((p) => finite(p.y))
            const last = real[real.length - 1]
            return last ? (
              <text key={s.key} x={px(last.x) + 5} y={py(last.y as number) + 4} className="ax">{s.label.split(' ')[0]}</text>
            ) : null
          })}
        {hx !== null && (
          <g pointerEvents="none">
            <line x1={px(hx)} x2={px(hx)} y1={m.t} y2={H - m.b} stroke="var(--text)" strokeWidth="1" strokeDasharray="2 2" />
            {series.map((s) => {
              const v = at(s, hx)
              return finite(v) ? <circle key={s.key} cx={px(hx)} cy={py(v)} r="3.4" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" /> : null
            })}
          </g>
        )}
      </svg>
      <p className="lane-readout mono small" aria-live="off">
        {hx !== null ? (
          <>
            <b>{labelOf(hx)}</b>
            {series.map((s) => ` · ${series.length > 1 ? `${s.label} ` : ''}${fy(at(s, hx))}`).join('')}
          </>
        ) : (
          <span className="faint">Hover the chart to read a point.</span>
        )}
      </p>
      {note && <p className="muted small chart-note">{note}</p>}
      <details className="datatable">
        <summary>Data table</summary>
        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <caption className="small muted">{title}</caption>
            <thead>
              <tr>
                <th scope="col">{xLabel ?? 'Date'}</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="r">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xs.map((xv) => (
                <tr key={xv}>
                  <td className="mono">{labelOf(xv)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="r">{fy(at(s, xv))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
