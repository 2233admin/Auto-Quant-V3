import { uiTemplate, uiText, uiValue } from '../../i18n'
import { useCallback, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceTicks } from '../factorMath'
import { curveSign, SignedCurve, type CurvePoint } from '../../components/SignedCurve'
import type { PathPoint } from './portfolioTypes'

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

const FULL: Record<SeriesKey, string> = { net: 'Net growth (after costs)', gross: 'Gross growth (no cost)', bench: 'Benchmark growth', ticks: 'Transition dates', exposure: 'Exposure panel' }

function Swatch({ kind }: { kind: SeriesKey | 'dd' }) {
  return (
    <svg width="22" height="12" aria-hidden="true">
      {kind === 'net' && <line x1="0" y1="6" x2="22" y2="6" stroke="var(--text)" strokeWidth="2" />}
      {kind === 'gross' && <line x1="0" y1="6" x2="22" y2="6" stroke="var(--muted)" strokeWidth="1.8" strokeDasharray="1.5 3" strokeLinecap="round" />}
      {kind === 'bench' && <line x1="0" y1="6" x2="22" y2="6" stroke="var(--muted)" strokeWidth="1.8" strokeDasharray="6 3" />}
      {kind === 'ticks' && <path d="M4 1v10M11 1v10M18 1v10" stroke="var(--text)" strokeWidth="1.2" />}
      {kind === 'exposure' && <path d="M0 3h22" stroke="var(--text)" strokeWidth="1.4" />}
      {kind === 'exposure' && <path d="M0 9h22" stroke="var(--muted)" strokeWidth="1.4" strokeDasharray="5 3" />}
      {kind === 'dd' && <rect x="1" y="2" width="20" height="8" fill="var(--stroke)" opacity=".5" />}
    </svg>
  )
}

/** Explanation for the chart card's "?" (what the curve is, what the transition ticks mean). */
export function PortfolioChartInfo({ transitions, note }: { transitions: string[]; note?: string }) {
  const n = new Set(transitions).size
  return (
    <>
      <p>{uiText("Growth of 1.0 at the first date, after costs (not currency; initial capital is not published for the path). Hover the chart, or focus it and use the arrow keys, to read a date.")}</p>
      <p>{uiText("Transition ticks (bottom of the growth panel) mark only the dates of the server&apos;s recent signal transitions")}{n ? uiTemplate("({0} distinct dates)", [n]) : ''}{uiText("; earlier ones are not published, so a tick-free stretch does not mean no trading.")}{note ? ` ${note}` : ''}
      </p>
    </>
  )
}

/** The sampled daily path as a table (kept from the old chart's "Data table" disclosure). */
export function PathTable({ points }: { points: PathPoint[] }) {
  return (
    <div className="tablewrap tablewrap--tall">
      <table className="tbl">
        <caption className="small muted">{uiText("Sampled daily path")}</caption>
        <thead>
          <tr>
            <th scope="col">{uiText("Date")}</th>
            <th scope="col">{uiText("Split")}</th>
            <th scope="col" className="r">{uiText("Net")}</th>
            <th scope="col" className="r">{uiText("Gross")}</th>
            <th scope="col" className="r">{uiText("Benchmark")}</th>
            <th scope="col" className="r">{uiText("Drawdown")}</th>
            <th scope="col" className="r">{uiText("Gross exp.")}</th>
            <th scope="col" className="r">{uiText("Net exp.")}</th>
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
  )
}

/**
 * Net and benchmark growth with a drawdown panel (and optional exposure panel) under one shared time axis.
 * Fills the box its parent gives it (series toggles on top, readout below, the plot takes the rest).
 * Everything drawn is a published sampled value; the code only scales and formats it.
 */
export function PortfolioChart({
  points,
  windows,
  transitions,
  totalRows,
  sampledRows,
}: {
  points: PathPoint[]
  windows: SplitWindow[]
  transitions: string[]
  totalRows?: number
  sampledRows?: number
}) {
  const id = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const roRef = useRef<ResizeObserver | null>(null)
  const plotRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    roRef.current = null
    if (!el) return
    const read = () => {
      const r = el.getBoundingClientRect()
      setBox((p) => (Math.abs(p.w - r.width) < 1 && Math.abs(p.h - r.height) < 1 ? p : { w: Math.round(r.width), h: Math.round(r.height) }))
    }
    read()
    roRef.current = new ResizeObserver(read)
    roRef.current.observe(el)
  }, [])
  const W = Math.max(320, box.w || 640)
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

  const H = Math.max(240, box.h || 360)
  const panels = showExpo ? 3 : 2
  const plotH = Math.max(120, H - m.t - m.b - GAP * (panels - 1))
  const heights = showExpo ? { growth: plotH * 0.5, dd: plotH * 0.25, expo: plotH * 0.25 } : { growth: plotH * 0.66, dd: plotH * 0.34, expo: 0 }
  const gTop = m.t
  const gBot = gTop + heights.growth
  const dTop = gBot + GAP
  const dBot = dTop + heights.dd
  const eTop = dBot + GAP
  const eBot = eTop + heights.expo
  const axisY = showExpo ? eBot : dBot

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
  const netPts: CurvePoint[] = points.flatMap((p, i): CurvePoint[] => (finite(p.netGrowth) ? [[x(t[i]), yG(p.netGrowth)]] : []))
  const lastNet = [...points].reverse().find((p) => finite(p.netGrowth))
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
  const TAG_W = 132
  const tagX = (px: number) => (px + 12 + TAG_W > W - m.r ? px - 12 - TAG_W : px + 12)
  const hp = hover === null ? null : points[hover]
  const clip = `${id}-clip`

  const legend: { key: SeriesKey; label: string; avail: boolean; why: string }[] = [
    { key: 'net', label: uiText("Net"), avail: true, why: '' },
    { key: 'gross', label: uiText("Gross"), avail: hasGross, why: 'the Run publishes no gross growth' },
    { key: 'bench', label: uiText("Benchmark"), avail: hasBench, why: 'the Run publishes no benchmark growth' },
    { key: 'ticks', label: uiText("Transitions"), avail: tickDates.length > 0, why: 'no published transition date falls inside the visible window' },
    { key: 'exposure', label: uiText("Exposure"), avail: hasExpo, why: 'the Run publishes no exposure path' },
  ]

  return (
    <div className="pf-embed">
      <p className="sr-only" id={`${id}-d`}>{uiText("Growth of 1.0 at the first date, after costs (not currency; initial capital is not published for the path).")}{totalRows !== undefined && sampledRows !== undefined && <>{uiText(" Sampled path: ")}{sampledRows}{uiText(" of ")}{totalRows.toLocaleString('en-US')}{uiText(" daily rows.")}</>}{uiText(" Hover the chart, or focus it and use the arrow keys, to read a date.")}</p>
      <h3 id={`${id}-t`} className="sr-only">{uiText("Net growth, benchmark and drawdown")}</h3>
      <div className="pf-embed-bar">
        <span className="legend" role="group" aria-label={uiText("Series")}>
          {legend.map((l) => (
            <button
              key={l.key}
              type="button"
              className="pf-toggle"
              aria-pressed={l.avail && on[l.key]}
              disabled={!l.avail}
              title={l.avail ? uiText(FULL[l.key]) : uiTemplate("not available: {0}", [l.why])}
              onClick={() => toggle(l.key)}
            >
              <Swatch kind={l.key} />
              {uiValue(l.label)}
            </button>
          ))}
          <span className="legend-item">
            <Swatch kind="dd" />{uiText("Drawdown")}</span>
        </span>
        {totalRows !== undefined && sampledRows !== undefined && (
          <span className="faint small">{sampledRows}{uiText(" of ")}{totalRows.toLocaleString('en-US')}{uiText(" daily rows")}</span>
        )}
      </div>
      <div className="pf-embed-plot" ref={plotRef}>
      <svg
        ref={svgRef}
        className="plot pf-plot"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
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
                {uiValue(w.label)}
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
        <text transform={`translate(14 ${(gTop + gBot) / 2}) rotate(-90)`} textAnchor="middle" className="ax">{uiText("growth of 1.0")}</text>
        {ddTicks.map((v) => (
          <g key={`d${v}`}>
            <line x1={m.l} x2={W - m.r} y1={yD(v)} y2={yD(v)} stroke="var(--grid)" strokeWidth="1" opacity={v === 0 ? 1 : 0.5} />
            <text x={m.l - 8} y={yD(v) + 4} textAnchor="end" className="ax">
              {v === 0 ? '0%' : `${(v * 100).toFixed(0)}%`}
            </text>
          </g>
        ))}
        <text transform={`translate(14 ${(dTop + dBot) / 2}) rotate(-90)`} textAnchor="middle" className="ax">{uiText("drawdown")}</text>
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
          <text transform={`translate(14 ${(eTop + eBot) / 2}) rotate(-90)`} textAnchor="middle" className="ax">{uiText("exposure")}</text>
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
          {on.gross && hasGross && <path className="fx-reveal" d={line((p) => p.grossGrowth, yG)} fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="1.5 3" strokeLinecap="round" />}
          {on.bench && hasBench && <path className="fx-reveal fx-late" d={line((p) => p.benchmarkGrowth, yG)} fill="none" stroke="var(--muted)" strokeWidth="1.7" strokeDasharray="6 3" />}
          {on.net && (
            <SignedCurve pts={netPts} baseY={yG(1)} x0={m.l} x1={W - m.r} top={gTop} bottom={gBot} casing />
          )}
          {ddArea && (
            <>
              <polygon className="fx-fade" points={ddArea} fill="var(--stroke)" opacity=".4" />
              <path className="fx-draw fx-late" pathLength={1} d={line((p) => p.drawdown, yD)} fill="none" stroke="var(--text)" strokeWidth="1.3" strokeLinejoin="round" />
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
            {on.bench && hasBench && finite(hp.benchmarkGrowth) && <circle cx={x(t[hover])} cy={yG(hp.benchmarkGrowth)} r="3.4" fill="var(--muted)" stroke="var(--bg)" strokeWidth="1.5" />}
            {on.gross && hasGross && finite(hp.grossGrowth) && <circle cx={x(t[hover])} cy={yG(hp.grossGrowth)} r="3" fill="var(--muted)" stroke="var(--bg)" strokeWidth="1.5" />}
            {finite(hp.drawdown) && <circle cx={x(t[hover])} cy={yD(hp.drawdown)} r="3.2" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />}
            <g className="cross-tag" transform={`translate(${tagX(x(t[hover]))} ${gTop + 4})`}>
              <rect width={TAG_W} height="36" fill="var(--raised)" stroke="var(--line-strong)" />
              <text x="8" y="14" className="ax">{hp.timestamp.slice(0, 10)}{hp.split ? ` · ${hp.split}` : ''}</text>
              <text x="8" y="29" className="val" data-sign={curveSign([hp.netGrowth as number], 1)}>{uiText("net ")}{g3(hp.netGrowth)}</text>
            </g>
          </g>
        )}
        {on.net && lastNet && !hp && (
          <text x={W - m.r - 4} y={yG(lastNet.netGrowth as number) + ((lastNet.netGrowth as number) >= 1 ? 18 : -8)} textAnchor="end" className="val end-label" data-sign={curveSign([lastNet.netGrowth as number], 1)}>{g3(lastNet.netGrowth)}</text>
        )}
      </svg>
      </div>
      <p className="pf-readout small" aria-live="off">
        {hp ? (
          <>
            <b>{hp.timestamp.slice(0, 10)}</b>
            {hp.split ? ` · ${hp.split}` : ''}{uiText(" · net ")}{g3(hp.netGrowth)}
            {hasGross ? uiTemplate("· gross {0}", [g3(hp.grossGrowth)]) : ''}
            {hasBench ? uiTemplate("· benchmark {0}", [g3(hp.benchmarkGrowth)]) : ''}{uiText(" · drawdown ")}{p1(hp.drawdown)}
            {hasExpo ? uiTemplate("· gross exp {0} · net exp {1}", [g3(hp.grossExposure), g3(hp.netExposure)]) : ''}
          </>
        ) : (
          <span className="faint">{uiText("Hover the chart to read a date.")}</span>
        )}
      </p>
    </div>
  )
}
