import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceTicks } from '../factorMath'
import { Info } from '../../components/Info'
import type { PathPoint } from './portfolioTypes'

const W = 980
const m = { l: 60, r: 16, t: 28, b: 40 }
const GAP = 22
const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
const g3 = (v: number | null | undefined) => {
  if (!finite(v)) return '—'
  const s = Math.abs(v).toFixed(3)
  return v < 0 && Number(s) !== 0 ? `−${s}` : s
}
const p1 = (v: number | null | undefined) => (finite(v) ? `${v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}%` : '—')
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export type SplitWindow = { split: string; label: string; start: number; end: number }
type SeriesKey = 'net' | 'gross' | 'bench' | 'ticks' | 'exposure'

function Swatch({ kind }: { kind: SeriesKey | 'dd' }) {
  return (
    <svg width="22" height="12" aria-hidden="true">
      {kind === 'net' && <line x1="0" y1="6" x2="22" y2="6" stroke="var(--text)" strokeWidth="2" />}
      {kind === 'gross' && <line x1="0" y1="6" x2="22" y2="6" stroke="var(--muted)" strokeWidth="1.8" strokeDasharray="1.5 3" strokeLinecap="round" />}
      {kind === 'bench' && <line x1="0" y1="6" x2="22" y2="6" stroke="var(--signal-graphic)" strokeWidth="1.8" strokeDasharray="6 3" />}
      {kind === 'ticks' && <path d="M4 1v10M11 1v10M18 1v10" stroke="var(--text)" strokeWidth="1.2" />}
      {kind === 'exposure' && <path d="M0 3h22" stroke="var(--text)" strokeWidth="1.4" />}
      {kind === 'exposure' && <path d="M0 9h22" stroke="var(--muted)" strokeWidth="1.4" strokeDasharray="5 3" />}
      {kind === 'dd' && <rect x="1" y="2" width="20" height="8" fill="var(--stroke)" opacity=".5" />}
    </svg>
  )
}

/**
 * Net and benchmark growth with a drawdown panel (and optional exposure panel) under one shared time axis.
 * Everything drawn is a published sampled value; the code only scales and formats it.
 */
export function PortfolioChart({
  points,
  windows,
  transitions,
  totalRows,
  sampledRows,
  note,
}: {
  points: PathPoint[]
  windows: SplitWindow[]
  transitions: string[]
  totalRows?: number
  sampledRows?: number
  note?: string
}) {
  const id = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [on, setOn] = useState<Record<SeriesKey, boolean>>({ net: true, gross: false, bench: true, ticks: true, exposure: false })
  const [hover, setHover] = useState<number | null>(null)
  const toggle = (k: SeriesKey) => setOn((s) => ({ ...s, [k]: !s[k] }))

  const t = points.map((p) => Date.parse(p.timestamp))
  const t0 = t[0]
  const t1 = t[t.length - 1]
  const hasGross = points.some((p) => finite(p.grossGrowth))
  const hasBench = points.some((p) => finite(p.benchmarkGrowth))
  const hasExpo = points.some((p) => finite(p.grossExposure) || finite(p.netExposure))
  const showExpo = on.exposure && hasExpo

  const heights = { growth: 210, dd: 90, expo: 90 }
  const gTop = m.t
  const gBot = gTop + heights.growth
  const dTop = gBot + GAP
  const dBot = dTop + heights.dd
  const eTop = dBot + GAP
  const eBot = eTop + heights.expo
  const axisY = showExpo ? eBot : dBot
  const H = axisY + m.b

  const x = (ms: number) => m.l + ((ms - t0) / (t1 - t0)) * (W - m.l - m.r)

  const gVals = points
    .flatMap((p) => [on.net ? p.netGrowth : null, on.gross && hasGross ? p.grossGrowth : null, on.bench && hasBench ? p.benchmarkGrowth : null])
    .filter(finite)
  const gAll = gVals.length ? gVals : points.map((p) => p.netGrowth).filter(finite)
  const gTicks = niceTicks(Math.min(...gAll), Math.max(...gAll))
  const gMin = Math.min(gTicks[0], ...gAll)
  const gMax = Math.max(gTicks[gTicks.length - 1], ...gAll)
  const yG = (v: number) => gTop + ((gMax - v) / (gMax - gMin || 1)) * (gBot - gTop)

  const ddVals = points.map((p) => p.drawdown).filter(finite)
  const ddTicks = niceTicks(Math.min(0, ...ddVals), 0, 3)
  const ddMin = Math.min(ddTicks[0], ...ddVals)
  const ddMax = Math.max(0, ddTicks[ddTicks.length - 1])
  const yD = (v: number) => dTop + ((ddMax - v) / (ddMax - ddMin || 1)) * (dBot - dTop)

  const eVals = points.flatMap((p) => [p.grossExposure, p.netExposure]).filter(finite)
  const eTicks = niceTicks(Math.min(0, ...eVals), Math.max(0, ...eVals), 3)
  const eMin = Math.min(eTicks[0], ...eVals)
  const eMax = Math.max(eTicks[eTicks.length - 1], ...eVals)
  const yE = (v: number) => eTop + ((eMax - v) / (eMax - eMin || 1)) * (eBot - eTop)

  const line = (get: (p: PathPoint) => number | null | undefined, y: (v: number) => number) => {
    const parts: string[] = []
    let open = false
    points.forEach((p, i) => {
      const v = get(p)
      if (!finite(v)) {
        open = false
        return
      }
      parts.push(`${open ? 'L' : 'M'}${x(t[i]).toFixed(1)} ${y(v).toFixed(1)}`)
      open = true
    })
    return parts.join(' ')
  }
  const ddArea = (() => {
    const pts = points.map((p, i) => (finite(p.drawdown) ? `${x(t[i]).toFixed(1)},${yD(p.drawdown).toFixed(1)}` : null)).filter((s): s is string => !!s)
    if (!pts.length) return ''
    return `${x(t0).toFixed(1)},${yD(0).toFixed(1)} ${pts.join(' ')} ${x(t1).toFixed(1)},${yD(0).toFixed(1)}`
  })()

  const years: number[] = []
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) years.push(Date.UTC(yr, 0, 1))
  const tickDates = [...new Set(transitions)].map((d) => Date.parse(d)).filter((ms) => ms >= t0 && ms <= t1)

  const nearest = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || !box.width) return null
    const ms = t0 + ((((clientX - box.left) / box.width) * W - m.l) / (W - m.l - m.r)) * (t1 - t0)
    let best = 0
    for (let i = 1; i < t.length; i++) if (Math.abs(t[i] - ms) < Math.abs(t[best] - ms)) best = i
    return best
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => setHover(nearest(e.clientX))
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const step = e.key === 'ArrowLeft' ? -1 : 1
      setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? (step < 0 ? points.length : -1)) + step)))
    } else if (e.key === 'Escape') setHover(null)
  }
  const hp = hover === null ? null : points[hover]
  const clip = `${id}-clip`

  const legend: { key: SeriesKey; label: string; avail: boolean; why: string }[] = [
    { key: 'net', label: 'Net growth', avail: true, why: '' },
    { key: 'gross', label: 'Gross growth', avail: hasGross, why: 'the Run publishes no gross growth' },
    { key: 'bench', label: 'Benchmark growth', avail: hasBench, why: 'the Run publishes no benchmark growth' },
    { key: 'ticks', label: 'Transition dates', avail: tickDates.length > 0, why: 'no published transition date falls inside the visible window' },
    { key: 'exposure', label: 'Exposure panel', avail: hasExpo, why: 'the Run publishes no exposure path' },
  ]

  return (
    <figure className="chart pf-chart">
      <figcaption>
        <h3 id={`${id}-t`} className="sr-only">Net growth, benchmark and drawdown</h3>
        <p className="sr-only" id={`${id}-d`}>
          Growth of 1.0 at the first date, after costs (not currency; initial capital is not published for the path).
          {totalRows !== undefined && sampledRows !== undefined && <> Sampled path: {sampledRows} of {totalRows.toLocaleString('en-US')} daily rows.</>} Hover the chart, or focus it and use the arrow keys, to read a date.
        </p>
        <p className="muted small">
          Growth of 1.0 after costs
          {totalRows !== undefined && sampledRows !== undefined && <> · {sampledRows} of {totalRows.toLocaleString('en-US')} daily rows</>}
          <Info label="About this chart">
            <p>Growth of 1.0 at the first date, after costs (not currency; initial capital is not published for the path). Hover the chart, or focus it and use the arrow keys, to read a date.</p>
            <p>
              Transition ticks (bottom of the growth panel) mark only the dates of the server&apos;s recent signal transitions
              {tickDates.length ? ` (${tickDates.length} distinct dates)` : ''}; earlier ones are not published, so a tick-free stretch does not mean no trading.
              {note ? ` ${note}` : ''}
            </p>
          </Info>
        </p>
      </figcaption>
      <div className="chart-bar">
        <span className="legend" role="group" aria-label="Series">
          {legend.map((l) => (
            <button
              key={l.key}
              type="button"
              className="pf-toggle"
              aria-pressed={l.avail && on[l.key]}
              disabled={!l.avail}
              title={l.avail ? undefined : `not available: ${l.why}`}
              onClick={() => toggle(l.key)}
            >
              <Swatch kind={l.key} />
              {l.label}
            </button>
          ))}
          <span className="legend-item">
            <Swatch kind="dd" />
            Drawdown (always shown)
          </span>
        </span>
      </div>
      <svg
        ref={svgRef}
        className="plot pf-plot"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${id}-t ${id}-d`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <clipPath id={clip}>
            <rect x={m.l} y={gTop} width={W - m.l - m.r} height={axisY - gTop} />
          </clipPath>
        </defs>
        {windows.map((w) => {
          const a = Math.max(t0, w.start)
          const b = Math.min(t1, w.end)
          if (b <= a) return null
          return (
            <g key={w.split}>
              <rect
                x={x(a)}
                y={gTop}
                width={x(b) - x(a)}
                height={axisY - gTop}
                fill={w.split === 'validation' ? 'var(--hover)' : w.split === 'test' ? 'var(--selected)' : 'none'}
                opacity={w.split === 'test' ? 0.55 : 1}
              />
              <text x={(x(a) + x(b)) / 2} y={m.t - 10} textAnchor="middle" className="grp">
                {w.label}
              </text>
            </g>
          )
        })}
        {gTicks.map((v) => (
          <g key={`g${v}`}>
            <line x1={m.l} x2={W - m.r} y1={yG(v)} y2={yG(v)} stroke="var(--grid)" strokeWidth="1" opacity={v === 1 ? 1 : 0.5} />
            <text x={m.l - 8} y={yG(v) + 4} textAnchor="end" className="ax">
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        <text transform={`translate(14 ${(gTop + gBot) / 2}) rotate(-90)`} textAnchor="middle" className="ax">
          growth of 1.0
        </text>
        {ddTicks.map((v) => (
          <g key={`d${v}`}>
            <line x1={m.l} x2={W - m.r} y1={yD(v)} y2={yD(v)} stroke="var(--grid)" strokeWidth="1" opacity={v === 0 ? 1 : 0.5} />
            <text x={m.l - 8} y={yD(v) + 4} textAnchor="end" className="ax">
              {v === 0 ? '0%' : `${(v * 100).toFixed(0)}%`}
            </text>
          </g>
        ))}
        <text transform={`translate(14 ${(dTop + dBot) / 2}) rotate(-90)`} textAnchor="middle" className="ax">
          drawdown
        </text>
        {showExpo &&
          eTicks.map((v) => (
            <g key={`e${v}`}>
              <line x1={m.l} x2={W - m.r} y1={yE(v)} y2={yE(v)} stroke="var(--grid)" strokeWidth="1" opacity={v === 0 ? 1 : 0.5} />
              <text x={m.l - 8} y={yE(v) + 4} textAnchor="end" className="ax">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
        {showExpo && (
          <text transform={`translate(14 ${(eTop + eBot) / 2}) rotate(-90)`} textAnchor="middle" className="ax">
            exposure
          </text>
        )}
        {years
          .filter((yr) => yr > t0 + 60 * 864e5 && yr < t1 - 60 * 864e5)
          .map((yr) => (
            <g key={yr}>
              <line x1={x(yr)} x2={x(yr)} y1={axisY} y2={axisY + 4} stroke="var(--stroke)" />
              <text x={x(yr)} y={axisY + 16} textAnchor="middle" className="ax">
                {new Date(yr).getUTCFullYear()}
              </text>
            </g>
          ))}
        <text x={m.l} y={axisY + 32} textAnchor="start" className="ax faint">
          {day(t0)}
        </text>
        <text x={W - m.r} y={axisY + 32} textAnchor="end" className="ax faint">
          {day(t1)}
        </text>

        <g clipPath={`url(#${clip})`}>
          {on.gross && hasGross && <path d={line((p) => p.grossGrowth, yG)} fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="1.5 3" strokeLinecap="round" />}
          {on.bench && hasBench && <path d={line((p) => p.benchmarkGrowth, yG)} fill="none" stroke="var(--signal-graphic)" strokeWidth="1.7" strokeDasharray="6 3" />}
          {on.net && (
            <>
              <path d={line((p) => p.netGrowth, yG)} fill="none" stroke="var(--bg)" strokeWidth="4" strokeLinejoin="round" />
              <path d={line((p) => p.netGrowth, yG)} fill="none" stroke="var(--text)" strokeWidth="1.9" strokeLinejoin="round" />
            </>
          )}
          {ddArea && (
            <>
              <polygon points={ddArea} fill="var(--stroke)" opacity=".4" />
              <path d={line((p) => p.drawdown, yD)} fill="none" stroke="var(--text)" strokeWidth="1.3" strokeLinejoin="round" />
            </>
          )}
          {showExpo && (
            <>
              <path d={line((p) => p.grossExposure, yE)} fill="none" stroke="var(--text)" strokeWidth="1.4" />
              <path d={line((p) => p.netExposure, yE)} fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeDasharray="5 3" />
            </>
          )}
          {on.ticks && tickDates.map((ms) => <line key={ms} x1={x(ms)} x2={x(ms)} y1={gBot - 9} y2={gBot} stroke="var(--text)" strokeWidth="1.2" />)}
        </g>
        {hp && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(t[hover])} x2={x(t[hover])} y1={gTop} y2={axisY} stroke="var(--text)" strokeWidth="1" strokeDasharray="2 2" />
            {on.net && finite(hp.netGrowth) && <circle cx={x(t[hover])} cy={yG(hp.netGrowth)} r="3.6" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />}
            {on.bench && hasBench && finite(hp.benchmarkGrowth) && <circle cx={x(t[hover])} cy={yG(hp.benchmarkGrowth)} r="3.4" fill="var(--signal-graphic)" stroke="var(--bg)" strokeWidth="1.5" />}
            {on.gross && hasGross && finite(hp.grossGrowth) && <circle cx={x(t[hover])} cy={yG(hp.grossGrowth)} r="3" fill="var(--muted)" stroke="var(--bg)" strokeWidth="1.5" />}
            {finite(hp.drawdown) && <circle cx={x(t[hover])} cy={yD(hp.drawdown)} r="3.2" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />}
          </g>
        )}
      </svg>
      <p className="pf-readout mono small" aria-live="off">
        {hp ? (
          <>
            <b>{hp.timestamp.slice(0, 10)}</b>
            {hp.split ? ` · ${hp.split}` : ''} · net {g3(hp.netGrowth)}
            {hasGross ? ` · gross ${g3(hp.grossGrowth)}` : ''}
            {hasBench ? ` · benchmark ${g3(hp.benchmarkGrowth)}` : ''} · drawdown {p1(hp.drawdown)}
            {hasExpo ? ` · gross exp ${g3(hp.grossExposure)} · net exp ${g3(hp.netExposure)}` : ''}
          </>
        ) : (
          <span className="faint">Hover the chart to read a date.</span>
        )}
      </p>
      <details className="datatable">
        <summary>Data table</summary>
        <div className="tablewrap tablewrap--tall">
          <table className="tbl">
            <caption className="small muted">Sampled daily path</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Split</th>
                <th scope="col" className="r">Net</th>
                <th scope="col" className="r">Gross</th>
                <th scope="col" className="r">Benchmark</th>
                <th scope="col" className="r">Drawdown</th>
                <th scope="col" className="r">Gross exp.</th>
                <th scope="col" className="r">Net exp.</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.timestamp}>
                  <td className="mono">{p.timestamp.slice(0, 10)}</td>
                  <td>{p.split ?? '—'}</td>
                  <td className="r">{g3(p.netGrowth)}</td>
                  <td className="r">{g3(p.grossGrowth)}</td>
                  <td className="r">{g3(p.benchmarkGrowth)}</td>
                  <td className="r">{p1(p.drawdown)}</td>
                  <td className="r">{g3(p.grossExposure)}</td>
                  <td className="r">{g3(p.netExposure)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
