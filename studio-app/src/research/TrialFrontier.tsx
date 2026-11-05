import { uiTemplate, uiText } from '../i18n'
import { useFitWidth } from '../design/useFitWidth'
import { Chart, Swatch } from '../pages/FactorCharts'
import { niceTicks } from '../pages/factorMath'
import type { Frontier, TrialPoint } from './researchApi'

const H = 300
const M = { l: 56, r: 20, t: 18, b: 46 }

/** Path through the running best (record frontier); each record holds until the next. */
function recordPath(points: TrialPoint[], x: (n: number) => number, y: (v: number) => number): string {
  let d = ''
  let best: number | null = null
  for (const p of points) {
    if (p.score === null || (best !== null && p.score <= best)) continue
    d += best === null ? `M${x(p.n)},${y(p.score)}` : `H${x(p.n)}V${y(p.score)}`
    best = p.score
  }
  return points.length && best !== null ? `${d}H${x(points[points.length - 1].n)}` : d
}

function scale(points: TrialPoint[], width: number) {
  const values = points.flatMap((p) => (p.score === null ? [p.bar] : [p.score, p.bar]))
  const lo = Math.min(0, ...values)
  const hi = Math.max(...values)
  const pad = (hi - lo || 1) * 0.08
  const ticks = niceTicks(lo - pad, hi + pad, 4)
  const yMin = Math.min(lo - pad, ticks[0])
  const yMax = Math.max(hi + pad, ticks[ticks.length - 1])
  const last = Math.max(2, points[points.length - 1]?.n ?? 2)
  const failY = H - M.b + 2
  return {
    ticks,
    failY,
    x: (n: number) => M.l + ((n - 1) / (last - 1)) * (width - M.l - M.r),
    y: (v: number) => M.t + ((yMax - v) / (yMax - yMin)) * (failY - 14 - M.t),
  }
}

/**
 * Every evaluated program of the direction in evaluation order: the selected hypothesis's trials filled, the others
 * hollow, failed programs as crosses below the axis, the record frontier as a step line, and the dashed expected best
 * of N pure-noise trials (computed by the server at every prefix, with the skeptic's variance). The more is tried, the
 * higher the dashed line: the multiple-testing cost made visible. The browser draws; it computes no statistic.
 */
export function TrialFrontier({ points, frontier, selected }: { points: TrialPoint[]; frontier: Frontier; selected: string }) {
  const [ref, W] = useFitWidth<HTMLDivElement>(360, 860)
  const { ticks, failY, x, y } = scale(points, W)
  const bar = points.map((p) => `${x(p.n)},${y(p.bar)}`).join(' ')
  const records = points.filter((p) => p.record)
  const short = frontier.clears === null
    ? uiText("No successful program yet: only the noise line can be drawn.")
    : frontier.clears
      ? uiTemplate("The best in-sample score clears what {0} noise trials would produce by {1}.", [frontier.trials, (frontier.gap ?? 0).toFixed(3)])
      : uiTemplate("The best in-sample score does not clear what {0} noise trials would produce.", [frontier.trials])
  return (
    <Chart
      title={uiText("Trials against the noise frontier")}
      plotRef={ref}
      short={short}
      desc={uiTemplate("{0} evaluated programs, {1} failed, plus {2} probes. The dashed line is the expected best in-sample Sharpe of that many pure-noise trials; it rises as trials accumulate.", [frontier.programs, frontier.failed, frontier.probes])}
      legend={
        <span className="legend">
          <Swatch kind="line" label={uiText("Record frontier")} />
          <Swatch kind="dash" label={uiText("Expected best of N noise trials")} />
          <Swatch kind="dot" label={uiText("Other hypotheses")} />
        </span>
      }
      table={
        <table className="tbl">
          <thead><tr><th scope="col" className="r">{uiText("Trial")}</th><th scope="col">{uiText("Hypothesis")}</th><th scope="col" className="r">{uiText("In-sample score")}</th><th scope="col" className="r">{uiText("Noise line")}</th></tr></thead>
          <tbody>{records.map((p) => <tr key={p.n}><td className="r mono">{p.n}</td><td className="mono" translate="no">{p.hypothesis}/{p.experiment}</td><td className="r mono">{p.score?.toFixed(3)}</td><td className="r mono">{p.bar.toFixed(3)}</td></tr>)}</tbody>
        </table>
      }
    >
      {({ labelledBy }) => (
        <svg className="plot rs-frontier" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelledBy}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" className="ax">{t.toFixed(2)}</text>
            </g>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 8} textAnchor="middle" className="ax">{uiText("trial order")}</text>
          <polyline points={bar} fill="none" stroke="var(--text)" strokeWidth="1.4" strokeDasharray="5 4" />
          {points.map((p) => p.score === null
            ? <path key={p.n} d={`M${x(p.n) - 2.5},${failY - 2.5}l5,5m0,-5l-5,5`} stroke="var(--signal-graphic)" strokeWidth="1" />
            : <rect key={p.n} className={p.hypothesis === selected ? 'rs-pt is-mine' : 'rs-pt'} x={x(p.n) - 1.8} y={y(p.score) - 1.8} width="3.6" height="3.6" />)}
          <path d={recordPath(points, x, y)} fill="none" stroke="var(--text)" strokeWidth="2" />
        </svg>
      )}
    </Chart>
  )
}
