import { uiTemplate, uiText } from '../i18n'
import type { FactorNoiseFrontier, FactorNoiseFrontierSeries, NoiseFrontierPoint, NoiseFrontierUnavailable, PortfolioNoiseFrontierSeries } from '../api'
import { num } from '../format'
import { Chart, Empty, ic4, Swatch, useChartWidth } from './FactorCharts'
import { niceTicks } from './factorMath'

/**
 * The server computes every plotted number (autoquant/studio_frontier.py); this file only maps them to pixels.
 * Nothing here recovers a standard error, evaluates a quantile or compares the selected value with a line.
 */

/** A snapshot from a server that predates the series has no frontier field; it reads as not published, never as a computed value. */
export function frontierAbsent(): NoiseFrontierUnavailable {
  return { schemaVersion: 1, kind: 'factor-mean-ic', status: 'unavailable', reasonCode: 'absent', detail: null }
}

/** Why the server published no series, in the reader's language. */
export function frontierUnavailableReason(frontier: NoiseFrontierUnavailable): string {
  switch (frontier.reasonCode) {
    case 'no-factor-ledger':
      return uiText("No Research Session in this Project selected on validation mean IC, so there is no trial ledger and the number of independent trials N is unknown.")
    case 'no-adjustment':
      return frontier.kind === 'portfolio-net-sharpe'
        ? uiText("Core published no selection adjustment for this Portfolio Run.")
        : uiText("The Session ledger publishes no selection adjustment.")
    case 'adjustment-unavailable':
      return uiTemplate("The selection adjustment is {0}{1}.", [frontier.detail?.status ?? 'unavailable', frontier.detail?.reason ? ` (${frontier.detail.reason})` : ''])
    case 'degenerate-p-value':
      return uiText("The published raw HAC p-value is degenerate, so the null spread of the mean IC cannot be recovered.")
    case 'no-trial-dispersion':
      return uiText("Core measured no spread across successful trials in this Project, so the noise scale is unknown and no frontier is drawn.")
    case 'incomplete-trial-statistics':
      return uiText("The selection adjustment does not publish the trial statistics the frontier needs.")
    default:
      return uiText("The server published no noise frontier.")
  }
}

const sharpe = (v: number | null | undefined) =>
  typeof v === 'number' && Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}` : '—'
const plural = (n: number) => (n === 1 ? '' : 's')

type Row = NoiseFrontierPoint

function FrontierPlot({ labelledBy, width: W, curve, trials: n, axisMaximum: maxN, selected, runValue, passLine, yLabel, decimals, format, shortfall }: {
  labelledBy: string
  width: number
  curve: Row[]
  trials: number
  axisMaximum: number
  selected: number
  /** The value of the Run this page shows, drawn only when it differs from the selected value. */
  runValue?: number | null
  /** Draw the dotted pass line the curve rows carry. */
  passLine: boolean
  yLabel: string
  decimals: number
  format: (v: number) => string
  /** Server verdict: false adds the shortfall note to the selected label; null or true adds nothing. */
  shortfall: { passes: boolean | null; label: string }
}) {
  const H = 340
  const m = { l: 64, r: 20, t: 24, b: 54 }
  const first = curve[0]
  const last = curve[curve.length - 1]
  const x = (t: number) => m.l + (Math.log(t) / Math.log(maxN)) * (W - m.l - m.r)
  const ys = [selected, runValue ?? 0, 0, last.expected, ...(passLine ? [last.passLine ?? 0, first.passLine ?? 0] : [])]
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const pad = (hi - lo) * 0.1
  const ticks = niceTicks(lo - pad, hi + pad)
  const yMin = Math.min(lo - pad, ticks[0])
  const yMax = Math.max(hi + pad, ticks[ticks.length - 1])
  const y = (v: number) => m.t + ((yMax - v) / (yMax - yMin)) * (H - m.t - m.b)
  const path = (pick: (p: Row) => number) => curve.map((p) => `${x(p.trials).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ')
  const xticks = [1, 2, 5, 10, 20, 50, 100, 200].filter((t) => t <= maxN)
  const marker = runValue != null && Math.abs(runValue - selected) > 1e-12
  return (
    <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelledBy}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={t === 0 ? 0 : 1} opacity=".7" />
          <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="ax">
            {t === 0 ? '0' : t.toFixed(decimals)}
          </text>
        </g>
      ))}
      <text transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="ax">{yLabel}</text>
      {xticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={H - m.b} y2={H - m.b + 5} stroke="var(--stroke)" />
          <text x={x(t)} y={H - m.b + 18} textAnchor="middle" className="ax">
            {t}
          </text>
        </g>
      ))}
      <text x={(m.l + W - m.r) / 2} y={H - 8} textAnchor="middle" className="ax">{uiText("independent trials N (log scale)")}</text>
      <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--text)" strokeWidth="1.2" />
      <line x1={x(n)} x2={x(n)} y1={m.t} y2={H - m.b} stroke="var(--line-strong)" strokeDasharray="3 3" />
      {passLine && <polyline points={path((p) => p.passLine ?? 0)} fill="none" stroke="var(--signal-graphic)" strokeWidth="1.8" strokeDasharray="2 4" strokeLinecap="round" />}
      <polyline points={path((p) => p.expected)} fill="none" stroke="var(--text)" strokeWidth="1.8" />
      <text x={x(n) + 6} y={m.t + 10} className="ax">
        N = {n}
      </text>
      <g transform={`translate(${x(n)} ${y(selected)})`}>
        <path d="M0 -7 L7 0 L0 7 L-7 0 Z" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />
      </g>
      <text x={x(n) + 12} y={y(selected) + 4} className="val" textAnchor="start">{uiText("selected ")}{format(selected)}
        {shortfall.passes === false ? shortfall.label : ''}
      </text>
      {marker && runValue != null && (
        <>
          <circle cx={x(n)} cy={y(runValue)} r="5.5" fill="var(--bg)" stroke="var(--text)" strokeWidth="1.8" />
          <text x={x(n) + 12} y={y(runValue) + 4} className="val" textAnchor="start">{uiText("this Run ")}{format(runValue)}
          </text>
        </>
      )}
    </svg>
  )
}

export function NoiseFrontierChart({ frontier, runIc }: { frontier: FactorNoiseFrontierSeries; runIc: number | null }) {
  const [plotRef, W] = useChartWidth()
  const { trials: n, standardError: se, rawPValue: rawP, expectedAtTrials } = frontier
  return (
    <Chart
      title={uiText("Noise frontier: how large the best IC looks by luck alone")}
      plotRef={plotRef}
      short={uiTemplate("Best IC expected from {0} trial{1} of pure noise, against the family-wise pass line.", [n, plural(n)])}
      desc={uiTemplate("With {0} independent trial{1} in the Project ledger, the best mean IC is expected to reach {2} under pure noise. The solid curve is that expectation as trials grow; the dotted curve is the mean IC the published family-wise HAC rule demands.", [n, plural(n), ic4(expectedAtTrials)])}
      legend={
        <span className="legend">
          <Swatch kind="line" label={uiText("Expected best IC under noise")} />
          <Swatch kind="ref" label={uiText("IC needed to pass family-wise HAC rule")} />
        </span>
      }
      note={
        <>{uiText("N is the Project ledger's ")}<span className="mono">{frontier.trialCountAssumption}</span>{uiText(" count of unique candidate sources (")}{frontier.totalExecutions}{uiText(" execution")}{frontier.totalExecutions === 1 ? '' : 's'}{uiText("), an upper bound on independent trials. The null spread is the HAC standard error ")}{num(se, 4)}{uiText(" implied by the selected value's published raw p-value ")}{num(rawP, 3)}{uiText(". The expectation uses the closed form of ")}<span className="mono">{uiText("autoquant/selection.py")}</span>{uiText("; the dotted curve inverts its published Bonferroni rule (adjusted p = raw p × N ≤ 0.05).")}</>
      }
      table={
        <table className="tbl">
          <caption className="small muted">{uiText("Noise frontier at selected trial counts")}</caption>
          <thead>
            <tr>
              <th scope="col" className="r">{uiText("Trials N")}</th>
              <th scope="col" className="r">{uiText("Expected best IC under noise")}</th>
              <th scope="col" className="r">{uiText("IC needed to pass family-wise HAC")}</th>
            </tr>
          </thead>
          <tbody>
            {frontier.table.map((row) => (
              <tr key={row.trials}>
                <td className="r mono">
                  {row.trials}
                  {row.trials === n && uiText(" · this ledger")}
                </td>
                <td className="r mono">{ic4(row.expected)}</td>
                <td className="r mono">{ic4(row.passLine)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {({ labelledBy }) => (
        <FrontierPlot
          labelledBy={labelledBy}
          width={W}
          curve={frontier.curve}
          trials={n}
          axisMaximum={frontier.axisMaximumTrials}
          selected={frontier.selectedValue}
          runValue={runIc}
          passLine
          yLabel={uiText("mean rank IC")}
          decimals={3}
          format={ic4}
          shortfall={{ passes: frontier.passes, label: uiText(" · below the pass line") }}
        />
      )}
    </Chart>
  )
}

/** Strategy / Portfolio counterpart: the expected best annualized net Sharpe of N noise-only trials, scaled by the trial spread Core measured. */
export function PortfolioNoiseFrontierChart({ frontier }: { frontier: PortfolioNoiseFrontierSeries }) {
  const [plotRef, W] = useChartWidth()
  const { trials: n, expectedAtTrials } = frontier
  return (
    <Chart
      title={uiText("Noise frontier: how large the best Sharpe looks by luck alone")}
      plotRef={plotRef}
      short={uiTemplate("Best annualized net Sharpe expected from {0} trial{1} of pure noise, against the selected Run.", [n, plural(n)])}
      desc={uiTemplate("With {0} independent trial{1} in the Project ledger, the best annualized net Sharpe is expected to reach {2} under pure noise. The curve is that expectation as trials grow, scaled by the {3} spread Core measured across {4} successful trials.", [n, plural(n), sharpe(expectedAtTrials), num(frontier.trialDispersion, 2), frontier.successfulTrials ?? '—'])}
      legend={
        <span className="legend">
          <Swatch kind="line" label={uiText("Expected best Sharpe under noise")} />
        </span>
      }
      note={
        <>{uiText("N is the Project ledger's ")}<span className="mono">{frontier.trialCountAssumption}</span>{uiText(" count of unique candidate sources (")}{frontier.totalExecutions}{uiText(" execution")}{frontier.totalExecutions === 1 ? '' : 's'}{uiText("), an upper bound on independent trials. The curve scales the expected maximum of N standard-normal trials, the closed form of ")}<span className="mono">{uiText("autoquant/selection.py")}</span>{uiText(", by the dispersion of the Project's successful trial Sharpe ratios; the deflated Sharpe ratio uses the same product.")}</>
      }
      table={
        <table className="tbl">
          <caption className="small muted">{uiText("Noise frontier at selected trial counts")}</caption>
          <thead>
            <tr>
              <th scope="col" className="r">{uiText("Trials N")}</th>
              <th scope="col" className="r">{uiText("Expected best Sharpe under noise")}</th>
            </tr>
          </thead>
          <tbody>
            {frontier.table.map((row) => (
              <tr key={row.trials}>
                <td className="r mono">
                  {row.trials}
                  {row.trials === n && uiText(" · this ledger")}
                </td>
                <td className="r mono">{sharpe(row.expected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {({ labelledBy }) => (
        <FrontierPlot
          labelledBy={labelledBy}
          width={W}
          curve={frontier.curve}
          trials={n}
          axisMaximum={frontier.axisMaximumTrials}
          selected={frontier.selectedValue}
          passLine={false}
          yLabel={uiText("annualized net Sharpe")}
          decimals={2}
          format={sharpe}
          shortfall={{ passes: frontier.passes, label: uiText(" · does not pass the Core check") }}
        />
      )}
    </Chart>
  )
}

/** The Factor page's "Selection and noise" body: the chart with the Run it belongs to, or the reason there is none. */
export function NoiseSection({ frontier, runIc, runId }: { frontier: FactorNoiseFrontier; runIc: number | null; runId: string }) {
  if (frontier.status !== 'available') return <Empty title={uiText("Noise frontier")} reason={frontierUnavailableReason(frontier)} />
  return (
    <>
      <NoiseFrontierChart frontier={frontier} runIc={runIc} />
      <p className="muted small">
        {frontier.leaderRunId ? (
          <>{uiText("Selected value: Run ")}<span className="mono" translate="no">{frontier.leaderRunId}</span>
            {frontier.leaderRunId === runId ? uiText(" (this Run).") : uiText("; this page shows a later Run that did not replace it.")}
          </>
        ) : (
          uiText("The selected value comes from the Session ledger; no single Run matches it exactly.")
        )}
      </p>
    </>
  )
}
