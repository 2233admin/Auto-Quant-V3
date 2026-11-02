import { uiText, uiValue } from '../../i18n'
import { Info } from '../../components/Info'
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceTicks } from '../factorMath'
import type { SplitWindow } from '../portfolio/PortfolioChart'
import { finite, sp, up } from '../portfolio/pfmt'
import type { AllocPoint } from './allocationTypes'
import { useFitWidth } from '../../design/useFitWidth'

const m = { l: 64, r: 16, t: 28, b: 40 }
const GAP = 22
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * Sampled daily path on one shared time axis: net return of the candidate and the reference, the candidate's forecast
 * volatility against its ceiling, and its gross exposure. Everything is a published sampled value that is only scaled
 * and formatted. Cumulative growth is deliberately not drawn: the path is a sample, so compounding it here would be a
 * browser-side statistic.
 */
export function AllocationChart({
  points,
  windows,
  ceiling,
  totalRows,
  sampledRows,
  note,
  testVisible = false,
}: {
  points: AllocPoint[]
  windows: SplitWindow[]
  ceiling?: number | null
  totalRows?: number
  sampledRows?: number
  note?: string
  /** Same rule as the page's numbers: test is protocol 'visible-audit-only' AND a test candidate block exists. */
  testVisible?: boolean
}) {
  const id = useId()
  const [figRef, W] = useFitWidth<HTMLElement>(420)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const t = points.map((p) => Date.parse(p.timestamp))
  const t0 = t[0]
  const t1 = t[t.length - 1]

  const H1 = 280
  const H2 = 76
  const H3 = 66
  const top1 = m.t
  const bot1 = top1 + H1
  const top2 = bot1 + GAP
  const bot2 = top2 + H2
  const top3 = bot2 + GAP
  const bot3 = top3 + H3
  const H = bot3 + m.b
  const x = (ms: number) => m.l + ((ms - t0) / (t1 - t0 || 1)) * (W - m.l - m.r)

  const scale = (vals: number[], target: number, floor0: boolean) => {
    const ticks = niceTicks(floor0 ? Math.min(0, ...vals) : Math.min(...vals), Math.max(...vals), target)
    return { ticks, lo: Math.min(ticks[0], ...vals), hi: Math.max(ticks[ticks.length - 1], ...vals) }
  }
  const r1 = scale(points.flatMap((p) => [p.candidateNetReturn, p.referenceNetReturn]).filter(finite), 5, false)
  const v2vals = points.map((p) => p.candidateForecastVolatility).filter(finite)
  const r2 = scale(finite(ceiling) ? [...v2vals, ceiling] : v2vals, 3, true)
  const r3 = scale(points.map((p) => p.candidateGrossExposure).filter(finite), 3, true)
  const yOf = (r: { lo: number; hi: number }, top: number, bot: number) => (v: number) => top + ((r.hi - v) / (r.hi - r.lo || 1)) * (bot - top)
  const y1 = yOf(r1, top1, bot1)
  const y2 = yOf(r2, top2, bot2)
  const y3 = yOf(r3, top3, bot3)

  const line = (get: (p: AllocPoint) => number | null | undefined, y: (v: number) => number) => {
    const out: string[] = []
    let open = false
    points.forEach((p, i) => {
      const v = get(p)
      if (!finite(v)) {
        open = false
        return
      }
      out.push(`${open ? 'L' : 'M'}${x(t[i]).toFixed(1)} ${y(v).toFixed(1)}`)
      open = true
    })
    return out.join(' ')
  }

  const nearest = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || !box.width) return null
    const ms = t0 + ((((clientX - box.left) / box.width) * W - m.l) / (W - m.l - m.r)) * (t1 - t0)
    let best = 0
    for (let i = 1; i < t.length; i++) if (Math.abs(t[i] - ms) < Math.abs(t[best] - ms)) best = i
    return best
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const step = e.key === 'ArrowLeft' ? -1 : 1
      setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? (step < 0 ? points.length : -1)) + step)))
    } else if (e.key === 'Escape') setHover(null)
  }
  const hp = hover === null ? null : points[hover]
  const clip = `${id}-clip`
  const panel = (ticks: number[], y: (v: number) => number, fmt: (v: number) => string, label: string, top: number, bot: number) => (
    <>
      {ticks.map((v) => (
        <g key={`${label}${v}`}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" opacity={v === 0 ? 1 : 0.5} />
          <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="ax">{fmt(v)}</text>
        </g>
      ))}
      <text transform={`translate(14 ${(top + bot) / 2}) rotate(-90)`} textAnchor="middle" className="ax">{uiValue(label)}</text>
    </>
  )
  const years: number[] = []
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) years.push(Date.UTC(yr, 0, 1))

  return (
    <figure ref={figRef} className="chart pf-chart">
      <figcaption>
        <h3 id={`${id}-t`} className="sr-only">{uiText("Daily net return, forecast volatility and exposure")}</h3>
        <p className="sr-only" id={`${id}-d`}>{uiText("Daily returns after costs, not compounded. Hover the chart, or focus it and use the arrow keys, to read a date.")}</p>
        <p className="muted small">{uiText("Daily net return, forecast volatility and exposure")}{sampledRows !== undefined && totalRows !== undefined && <> · {sampledRows}{uiText(" of ")}{totalRows.toLocaleString('en-US')}{uiText(" daily rows")}</>}
          <Info label={uiText("About this chart")}>
            <p>{uiText("Daily returns after costs, not compounded. Hover the chart, or focus it and use the arrow keys, to read a date.")}</p>
            {note ? <p>{uiValue(note)}</p> : null}
          </Info>
        </p>
      </figcaption>
      <div className="chart-bar">
        <span className="legend" role="group" aria-label={uiText("Series")}>
          <span className="legend-item">
            <svg width="22" height="12" aria-hidden="true"><line x1="0" y1="6" x2="22" y2="6" stroke="var(--text)" strokeWidth="2" /></svg>{uiText("Candidate (equal risk contribution)")}</span>
          <span className="legend-item">
            <svg width="22" height="12" aria-hidden="true"><line x1="0" y1="6" x2="22" y2="6" stroke="var(--signal-graphic)" strokeWidth="1.8" strokeDasharray="6 3" /></svg>{uiText("Fixed-weight reference")}</span>
          {finite(ceiling) && (
            <span className="legend-item">
              <svg width="22" height="12" aria-hidden="true"><line x1="0" y1="6" x2="22" y2="6" stroke="var(--muted)" strokeWidth="1.8" strokeDasharray="1.5 3" strokeLinecap="round" /></svg>{uiText("Volatility ceiling")}</span>
          )}
        </span>
      </div>
      <svg
        ref={svgRef}
        className="plot pf-plot"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${id}-t ${id}-d`}
        tabIndex={0}
        onPointerMove={(e: PointerEvent<SVGSVGElement>) => setHover(nearest(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <clipPath id={clip}>
            <rect x={m.l} y={top1} width={W - m.l - m.r} height={bot3 - top1} />
          </clipPath>
        </defs>
        {windows.filter((w) => w.split !== 'test' || testVisible).map((w) => {
          const a = Math.max(t0, w.start)
          const b = Math.min(t1, w.end)
          if (b <= a) return null
          return (
            <g key={w.split}>
              <rect x={x(a)} y={top1} width={x(b) - x(a)} height={bot3 - top1} fill={w.split === 'validation' ? 'var(--hover)' : w.split === 'test' ? 'var(--selected)' : 'none'} opacity={w.split === 'test' ? 0.55 : 1} />
              <text x={(x(a) + x(b)) / 2} y={m.t - 10} textAnchor="middle" className="grp">{uiValue(w.label)}</text>
            </g>
          )
        })}
        {panel(r1.ticks, y1, (v) => sp(v, 1), 'daily net return', top1, bot1)}
        {panel(r2.ticks, y2, (v) => up(v, 0), 'fcst vol', top2, bot2)}
        {panel(r3.ticks, y3, (v) => up(v, 0), 'gross exp.', top3, bot3)}
        {years
          .filter((yr) => yr > t0 + 60 * 864e5 && yr < t1 - 60 * 864e5)
          .map((yr) => (
            <g key={yr}>
              <line x1={x(yr)} x2={x(yr)} y1={bot3} y2={bot3 + 4} stroke="var(--stroke)" />
              <text x={x(yr)} y={bot3 + 16} textAnchor="middle" className="ax">{new Date(yr).getUTCFullYear()}</text>
            </g>
          ))}
        <text x={m.l} y={bot3 + 32} textAnchor="start" className="ax faint">{day(t0)}</text>
        <text x={W - m.r} y={bot3 + 32} textAnchor="end" className="ax faint">{day(t1)}</text>
        <g clipPath={`url(#${clip})`}>
          <path d={line((p) => p.referenceNetReturn, y1)} fill="none" stroke="var(--signal-graphic)" strokeWidth="1.5" strokeDasharray="6 3" />
          <path d={line((p) => p.candidateNetReturn, y1)} fill="none" stroke="var(--bg)" strokeWidth="3.6" strokeLinejoin="round" />
          <path d={line((p) => p.candidateNetReturn, y1)} fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinejoin="round" />
          {finite(ceiling) && <line x1={m.l} x2={W - m.r} y1={y2(ceiling)} y2={y2(ceiling)} stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="1.5 3" strokeLinecap="round" />}
          <path d={line((p) => p.candidateForecastVolatility, y2)} fill="none" stroke="var(--text)" strokeWidth="1.6" />
          <path d={line((p) => p.candidateGrossExposure, y3)} fill="none" stroke="var(--text)" strokeWidth="1.6" />
        </g>
        {hp && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(t[hover])} x2={x(t[hover])} y1={top1} y2={bot3} stroke="var(--text)" strokeWidth="1" strokeDasharray="2 2" />
            {finite(hp.candidateNetReturn) && <circle cx={x(t[hover])} cy={y1(hp.candidateNetReturn)} r="3.5" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />}
            {finite(hp.referenceNetReturn) && <circle cx={x(t[hover])} cy={y1(hp.referenceNetReturn)} r="3.3" fill="var(--signal-graphic)" stroke="var(--bg)" strokeWidth="1.5" />}
            {finite(hp.candidateForecastVolatility) && <circle cx={x(t[hover])} cy={y2(hp.candidateForecastVolatility)} r="3.2" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />}
            {finite(hp.candidateGrossExposure) && <circle cx={x(t[hover])} cy={y3(hp.candidateGrossExposure)} r="3.2" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />}
          </g>
        )}
      </svg>
      <p className="pf-readout mono small" aria-live="off">
        {hp ? (
          <>
            <b>{hp.timestamp.slice(0, 10)}</b>{uiText(" · candidate ")}{sp(hp.candidateNetReturn, 2)}{uiText(" · reference ")}{sp(hp.referenceNetReturn, 2)}{uiText(" · forecast vol ")}{up(hp.candidateForecastVolatility, 1)}{uiText(" · gross exposure ")}{up(hp.candidateGrossExposure, 0)}
          </>
        ) : (
          <span className="faint">{uiText("Hover the chart to read a date.")}</span>
        )}
      </p>
      <details className="datatable">
        <summary>{uiText("Data table")}</summary>
        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <caption className="small muted">{uiText("Sampled daily path")}</caption>
            <thead>
              <tr>
                <th scope="col">{uiText("Date")}</th>
                <th scope="col" className="r">{uiText("Candidate net")}</th>
                <th scope="col" className="r">{uiText("Reference net")}</th>
                <th scope="col" className="r">{uiText("Gross exposure")}</th>
                <th scope="col" className="r">{uiText("Forecast vol")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.timestamp}>
                  <td className="mono">{p.timestamp.slice(0, 10)}</td>
                  <td className="r">{sp(p.candidateNetReturn, 3)}</td>
                  <td className="r">{sp(p.referenceNetReturn, 3)}</td>
                  <td className="r">{up(p.candidateGrossExposure, 1)}</td>
                  <td className="r">{up(p.candidateForecastVolatility, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
