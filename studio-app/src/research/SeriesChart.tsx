import { uiText } from '../i18n'
import { useFitWidth } from '../design/useFitWidth'
import { Chart, Swatch } from '../pages/FactorCharts'
import { niceTicks } from '../pages/factorMath'

export type Point = [number, number | null]
export type Series = { label: string; kind: 'line' | 'dash' | 'step' | 'bars' | 'dots'; points: Point[]; dashes?: string }

const H = 220
const M = { l: 56, r: 16, t: 14, b: 36 }

function extent(series: Series[], zero: boolean) {
  const xs = series.flatMap((s) => s.points.map((p) => p[0]))
  const ys = series.flatMap((s) => s.points.flatMap((p) => (p[1] === null ? [] : [p[1]])))
  const lo = Math.min(...(zero ? [0] : []), ...ys)
  const hi = Math.max(...ys, lo + 1e-9)
  const pad = (hi - lo || 1) * 0.08
  const ticks = niceTicks(zero && lo >= 0 ? 0 : lo - pad, hi + pad, 4)
  return { x0: Math.min(...xs), x1: Math.max(...xs, Math.min(...xs) + 1), y0: Math.min(ticks[0], zero && lo >= 0 ? 0 : lo - pad), y1: Math.max(ticks[ticks.length - 1], hi + pad), ticks }
}

function path(points: Point[], x: (v: number) => number, y: (v: number) => number, step: boolean): string {
  let d = ''
  let last: number | null = null
  for (const [px, py] of points) {
    if (py === null) continue
    d += d === '' ? `M${x(px)},${y(py)}` : step && last !== null ? `H${x(px)}V${y(py)}` : `L${x(px)},${y(py)}`
    last = py
  }
  return d
}

function Marks({ s, x, y, bottom, barWidth }: { s: Series; x: (v: number) => number; y: (v: number) => number; bottom: number; barWidth: number }) {
  if (s.kind === 'bars') return <>{s.points.map(([px, py]) => py === null ? null : <rect key={px} x={x(px) - barWidth / 2} y={y(py)} width={barWidth} height={Math.max(0, bottom - y(py))} fill="var(--stroke)" opacity=".55" />)}</>
  if (s.kind === 'dots') return <>{s.points.map(([px, py], i) => py === null ? null : <rect key={i} x={x(px) - 1.5} y={y(py) - 1.5} width="3" height="3" fill="none" stroke="var(--stroke)" />)}</>
  return <path d={path(s.points, x, y, s.kind === 'step')} fill="none" stroke="var(--text)" strokeWidth={s.kind === 'dash' ? 1.3 : 1.8} strokeDasharray={s.kind === 'dash' ? '5 4' : s.dashes} />
}

/**
 * Small multiple of server-computed series over generations (or any shared x): lines, a step line for the running
 * best, bars and dots. Shapes and dash patterns, never colour alone, tell the series apart. Nothing is computed here
 * beyond scaling to pixels.
 */
export function SeriesChart({ title, short, desc, xLabel, series, format = (v) => v.toFixed(2), zero = false }: { title: string; short: string; desc: string; xLabel: string; series: Series[]; format?: (v: number) => string; zero?: boolean }) {
  const [ref, W] = useFitWidth<HTMLDivElement>(320, 640)
  const shown = series.filter((s) => s.points.some((p) => p[1] !== null))
  if (shown.length === 0) return <p className="muted small">{uiText("No data for this chart.")}</p>
  const e = extent(shown, zero)
  const x = (v: number) => M.l + ((v - e.x0) / (e.x1 - e.x0)) * (W - M.l - M.r)
  const y = (v: number) => M.t + ((e.y1 - v) / (e.y1 - e.y0)) * (H - M.t - M.b)
  const xs = [...new Set(shown.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b)
  const barWidth = Math.max(1.5, Math.min(10, ((W - M.l - M.r) / Math.max(1, xs.length)) * 0.7))
  const xticks = niceTicks(e.x0, e.x1, 6).filter((t) => t >= e.x0 && t <= e.x1)
  return (
    <Chart
      title={title}
      plotRef={ref}
      short={short}
      desc={desc}
      legend={<span className="legend">{shown.map((s) => s.dashes ? <span key={s.label} className="legend-item"><svg width="18" height="12" aria-hidden="true"><line x1="0" y1="6" x2="18" y2="6" stroke="var(--text)" strokeWidth="1.8" strokeDasharray={s.dashes} /></svg><span translate="no">{s.label}</span></span> : <Swatch key={s.label} kind={s.kind === 'bars' ? 'train' : s.kind === 'dots' ? 'dot' : s.kind === 'dash' ? 'dash' : 'line'} label={s.label} />)}</span>}
      table={
        <table className="tbl">
          <thead><tr><th scope="col" className="r">{xLabel}</th>{shown.map((s) => <th key={s.label} scope="col" className="r">{s.label}</th>)}</tr></thead>
          <tbody>{xs.map((v) => <tr key={v}><td className="r mono">{v}</td>{shown.map((s) => { const p = s.points.find((q) => q[0] === v); return <td key={s.label} className="r mono">{p && p[1] !== null ? format(p[1]) : '—'}</td> })}</tr>)}</tbody>
        </table>
      }
    >
      {({ labelledBy }) => (
        <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelledBy}>
          {e.ticks.map((t) => <g key={t}><line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" /><text x={M.l - 8} y={y(t) + 4} textAnchor="end" className="ax">{format(t)}</text></g>)}
          {xticks.map((t) => <text key={t} x={x(t)} y={H - M.b + 16} textAnchor="middle" className="ax">{t}</text>)}
          <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" className="ax">{xLabel}</text>
          {shown.map((s) => <Marks key={s.label} s={s} x={x} y={y} bottom={y(Math.max(e.y0, 0))} barWidth={barWidth} />)}
        </svg>
      )}
    </Chart>
  )
}
