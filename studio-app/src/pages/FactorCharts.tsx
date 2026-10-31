import { useEffect, useId, useState, type ReactNode } from 'react'
import type { FactorDiagnostics, FactorQuantileRow, FactorSplit } from '../api'
import { num, ret } from '../format'
import { Info } from '../components/Info'
import { ChartCard } from '../components/workbench'
import { gatedSplits, studyTestVisible, TEST_HIDDEN_NOTE } from './testGate'
import {
  expectedMaxZ,
  familywiseThreshold,
  hacStandardError,
  niceTicks,
  samplePoints,
  SPLITS,
  SPLIT_LABEL,
  SPLIT_ROLE,
  trailingMean,
  type NoiseFrontier,
} from './factorMath'

const ic4 = (v: number | null | undefined) =>
  typeof v === 'number' && Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(4)}` : '—'
const int = (v: number) => v.toLocaleString('en-US')
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Figure shell: accessible title and description, the drawing, and the same numbers as a table. */
export function Chart({
  title,
  desc,
  short,
  controls,
  legend,
  children,
  table,
  note,
  plotRef,
  fill,
}: {
  title: string
  /** Full explanation: read by screen readers and shown in the info disclosure. */
  desc: string
  /** One visible line under the title; the full `desc` and `note` move behind the "?" disclosure. */
  short?: string
  controls?: ReactNode
  legend?: ReactNode
  children: (ids: { labelledBy: string }) => ReactNode
  table: ReactNode
  note?: ReactNode
  plotRef?: (el: HTMLDivElement | null) => void
  /** The drawing takes the height its card gives it instead of a fixed one. */
  fill?: boolean
}) {
  const id = useId()
  return (
    <figure className={fill ? 'chart chart--fill' : 'chart'}>
      <figcaption>
        <div className="chart-title">
          <h3 id={`${id}-t`}>{title}</h3>
          {short && (
            <Info label={`About ${title}`}>
              <p>{desc}</p>
              {note && <p>{note}</p>}
            </Info>
          )}
        </div>
        {short ? (
          <>
            <p className="muted small chart-cap">{short}</p>
            <p className="sr-only" id={`${id}-d`}>
              {desc}
            </p>
          </>
        ) : (
          <p className="muted small" id={`${id}-d`}>
            {desc}
          </p>
        )}
      </figcaption>
      {(controls || legend) && (
        <div className="chart-bar">
          {controls}
          {legend}
        </div>
      )}
      <div className="plot-wrap" ref={plotRef}>
        {children({ labelledBy: `${id}-t ${id}-d` })}
      </div>
      {note && !short && <p className="muted small chart-note">{note}</p>}
      <details className="datatable">
        <summary>Data table</summary>
        <div className="tablewrap">{table}</div>
      </details>
    </figure>
  )
}

export function Swatch({ kind, label }: { kind: 'train' | 'validation' | 'test' | 'line' | 'dash' | 'dot' | 'ref'; label: string }) {
  const id = useId()
  return (
    <span className="legend-item">
      <svg width="18" height="12" aria-hidden="true">
        {kind === 'train' && <rect x="1" y="1" width="16" height="10" fill="var(--stroke)" opacity=".55" />}
        {kind === 'validation' && <rect x="1" y="1" width="16" height="10" fill="var(--text)" />}
        {kind === 'test' && (
          <>
            <defs>
              <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="4" stroke="var(--text)" strokeWidth="1.4" />
              </pattern>
            </defs>
            <rect x="1" y="1" width="16" height="10" fill={`url(#${id})`} stroke="var(--text)" strokeWidth="1.2" />
          </>
        )}
        {kind === 'line' && <line x1="0" y1="6" x2="18" y2="6" stroke="var(--text)" strokeWidth="1.8" />}
        {kind === 'dash' && <line x1="0" y1="6" x2="18" y2="6" stroke="var(--text)" strokeWidth="1.4" strokeDasharray="4 3" />}
        {kind === 'ref' && <line x1="0" y1="6" x2="18" y2="6" stroke="var(--signal-graphic)" strokeWidth="1.8" strokeDasharray="2 3" />}
        {kind === 'dot' && <circle cx="9" cy="6" r="2.4" fill="var(--stroke)" />}
      </svg>
      <span>{label}</span>
    </span>
  )
}

/** Width of the plot column in CSS px. The SVG viewBox uses it 1:1, so 11px text stays 11px at every viewport. */
function useChartWidth(): [(el: HTMLDivElement | null) => void, number] {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [w, setW] = useState(760)
  useEffect(() => {
    if (!el) return
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width)
      if (next >= 280) setW((prev) => (Math.abs(prev - next) >= 2 ? next : prev))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, w]
}

/* ---------------------------------------------------------------- 1. IC by horizon x split */

/** Bars of the Rank IC chart: one per horizon and shown split. Shared by the figure, its legend and its data table. */
function icBars(study: FactorDiagnostics) {
  /** Same rule as the page's tiles: test is drawn only when its audit exists and the protocol marks it a visible diagnostic. */
  const testShown = studyTestVisible(study)
  const shownSplits = gatedSplits(study, SPLITS)
  const rows = [...study.horizonProfile].sort((a, b) => a.horizon - b.horizon)
  const primary = study.protocol.primaryHorizon
  type Bar = { horizon: number; split: FactorSplit; mean: number | null; se: number | null; n: number; t: number | null; sufficient: boolean }
  const bars: Bar[] = rows.flatMap((row) =>
    shownSplits.map((split) => {
      const s = row[split]
      return { horizon: row.horizon, split, mean: s.meanRankIc, se: hacStandardError(s), n: s.observations, t: s.hacTStatistic, sufficient: s.sufficient }
    }),
  )
  return { testShown, shownSplits, rows, primary, bars }
}

export function IcByHorizonLegend({ study }: { study: FactorDiagnostics }) {
  const { testShown } = icBars(study)
  return (
    <span className="legend">
      <Swatch kind="train" label="Train" />
      <Swatch kind="validation" label="Validation (selection)" />
      {testShown ? <Swatch kind="test" label="Test (visible audit)" /> : <span className="faint">{TEST_HIDDEN_NOTE}</span>}
    </span>
  )
}

export const IC_BY_HORIZON_DESC =
  'Mean rank IC of the factor against the forward return, with ±1.96 HAC standard-error whiskers. A whisker that crosses zero means the mean is not distinguishable from noise.'
export const IC_BY_HORIZON_SHORT = 'Mean rank IC with ±1.96 HAC whiskers; a whisker crossing zero means noise.'

export function IcByHorizonNote({ study }: { study: FactorDiagnostics }) {
  const { primary } = icBars(study)
  return (
    <>
      Whiskers are ±1.96 HAC standard errors, recovered as |mean IC / HAC t|. The HAC maximum lag equals each forward horizon, so overlapping
      forward returns are accounted for; a bar with no whisker has no usable t statistic. Only the {primary}-bar horizon drives selection.
    </>
  )
}

export function IcByHorizonTable({ study }: { study: FactorDiagnostics }) {
  const { bars } = icBars(study)
  return (
    <table className="tbl">
      <caption className="small muted">Mean rank IC, HAC statistics and observations</caption>
      <thead>
        <tr>
          <th scope="col" className="r">Horizon</th>
          <th scope="col">Split</th>
          <th scope="col" className="r">Mean IC</th>
          <th scope="col" className="r">HAC SE</th>
          <th scope="col" className="r">HAC t</th>
          <th scope="col" className="r">Observations</th>
        </tr>
      </thead>
      <tbody>
        {bars.map((b) => (
          <tr key={`${b.horizon}/${b.split}`}>
            <td className="r mono">{b.horizon}</td>
            <td>{SPLIT_LABEL[b.split]}</td>
            <td className="r mono">{ic4(b.mean)}</td>
            <td className="r mono">{num(b.se, 4)}</td>
            <td className="r mono">{num(b.t, 2)}</td>
            <td className="r mono">
              {int(b.n)}
              {!b.sufficient && ' · below minimum'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The drawing alone, at `width` x `height` CSS px (one SVG unit is one CSS px, so axis text stays 11px). */
export function IcByHorizonPlot({ study, width: W, height: H, labelledBy, label }: { study: FactorDiagnostics; width: number; height: number; labelledBy?: string; label?: string }) {
  const pattern = useId()
  const { shownSplits, rows, primary, bars } = icBars(study)
  const m = { l: 60, r: 16, t: 24, b: 78 }
  const values = bars.flatMap((b) => (b.mean === null ? [] : b.se === null ? [b.mean] : [b.mean - 1.96 * b.se, b.mean + 1.96 * b.se]))
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  const pad = (hi - lo) * 0.14 || 0.01
  const ticks = niceTicks(lo - pad, hi + pad)
  const yMin = Math.min(lo - pad, ticks[0])
  const yMax = Math.max(hi + pad, ticks[ticks.length - 1])
  const y = (v: number) => m.t + ((yMax - v) / (yMax - yMin)) * (H - m.t - m.b)
  const gw = (W - m.l - m.r) / Math.max(1, rows.length)
  const nSplit = shownSplits.length
  const slot = Math.min(110, gw / (nSplit + 0.2))
  const bw = Math.min(64, slot - 24)
  const baseline = y(0)

  return (
    <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label}>
      <defs>
        <pattern id={pattern} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--text)" strokeWidth="1.5" />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={t === 0 ? 0 : 1} opacity=".7" />
          <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="ax">
            {t === 0 ? '0' : t.toFixed(3)}
          </text>
        </g>
      ))}
      <text transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="ax">
        mean rank IC
      </text>
      {rows.map((row, gi) => {
        const gx = m.l + gi * gw
        return (
          <g key={row.horizon}>
            {gi > 0 && <line x1={gx} x2={gx} y1={m.t} y2={H - m.b + 6} stroke="var(--line)" />}
            {shownSplits.map((split, si) => {
              const b = bars.find((x) => x.horizon === row.horizon && x.split === split)!
              const cx = gx + gw / 2 + (si - (nSplit - 1) / 2) * slot
              const above = (b.mean ?? 0) >= 0
              const topY = b.mean === null ? baseline : y(Math.max(0, b.mean))
              const hgt = b.mean === null ? 0 : Math.max(1, Math.abs(y(b.mean) - baseline))
              const wHi = b.mean !== null && b.se !== null ? y(b.mean + 1.96 * b.se) : null
              const wLo = b.mean !== null && b.se !== null ? y(b.mean - 1.96 * b.se) : null
              const labelY = above ? Math.min(topY, wHi ?? topY) - 6 : Math.max(baseline + hgt, wLo ?? 0) + 14
              const fill = split === 'train' ? 'var(--stroke)' : split === 'validation' ? 'var(--text)' : `url(#${pattern})`
              return (
                <g key={split}>
                  {b.mean !== null && (
                    <rect
                      x={cx - bw / 2}
                      y={topY}
                      width={bw}
                      height={hgt}
                      fill={fill}
                      opacity={split === 'train' ? 0.55 : 1}
                      stroke={split === 'test' ? 'var(--text)' : 'none'}
                      strokeWidth="1.2"
                    />
                  )}
                  {wHi !== null && wLo !== null &&
                    (['var(--bg)', 'var(--text)'] as const).map((color, k) => (
                      <g key={color} stroke={color} strokeWidth={k === 0 ? 4 : 1.6}>
                        <line x1={cx} x2={cx} y1={wHi} y2={wLo} />
                        <line x1={cx - 5} x2={cx + 5} y1={wHi} y2={wHi} />
                        <line x1={cx - 5} x2={cx + 5} y1={wLo} y2={wLo} />
                      </g>
                    ))}
                  {b.mean !== null && (
                    <text x={cx} y={labelY} textAnchor="middle" className="val">
                      {ic4(b.mean)}
                    </text>
                  )}
                  <text x={cx} y={H - m.b + 18} textAnchor="middle" className="ax">
                    {split === 'validation' ? 'val' : split}
                  </text>
                  {slot >= 70 && (
                    <text x={cx} y={H - m.b + 32} textAnchor="middle" className="ax faint">
                      n={int(b.n)}
                    </text>
                  )}
                </g>
              )
            })}
            <text x={gx + gw / 2} y={H - 10} textAnchor="middle" className="grp">
              {row.horizon}-bar horizon{row.horizon === primary ? ' · primary' : ''}
            </text>
          </g>
        )
      })}
      <line x1={m.l} x2={W - m.r} y1={baseline} y2={baseline} stroke="var(--text)" strokeWidth="1.2" />
    </svg>
  )
}

/** The Rank IC chart as a workbench card (Factor hero and Run page). `table={false}` leaves the numbers to a section of the page. */
export function IcByHorizonCard({
  study,
  toggle,
  legendExtra,
  table = true,
}: {
  study: FactorDiagnostics
  toggle?: ReactNode
  legendExtra?: ReactNode
  table?: boolean
}) {
  return (
    <ChartCard
      title="Rank IC by horizon and split"
      info={
        <>
          <p>{IC_BY_HORIZON_DESC}</p>
          <p>
            <IcByHorizonNote study={study} />
          </p>
        </>
      }
      toggle={toggle}
      legend={
        <>
          <IcByHorizonLegend study={study} />
          {legendExtra}
        </>
      }
      table={table ? <IcByHorizonTable study={study} /> : undefined}
      minHeight={260}
    >
      {({ width, height }) => <IcByHorizonPlot study={study} width={width} height={height} label={IC_BY_HORIZON_SHORT} />}
    </ChartCard>
  )
}

export function IcByHorizon({ study, hero }: { study: FactorDiagnostics; hero?: boolean }) {
  const [plotRef, W] = useChartWidth()
  return (
    <Chart
      title="Rank IC by horizon and split"
      plotRef={plotRef}
      short={IC_BY_HORIZON_SHORT}
      desc={IC_BY_HORIZON_DESC}
      legend={<IcByHorizonLegend study={study} />}
      note={<IcByHorizonNote study={study} />}
      table={<IcByHorizonTable study={study} />}
    >
      {({ labelledBy }) => <IcByHorizonPlot study={study} width={W} height={hero ? 330 : 360} labelledBy={labelledBy} />}
    </Chart>
  )
}

/* ---------------------------------------------------------------- 2. IC over time */

const WINDOW = 12

export function IcOverTime({ study }: { study: FactorDiagnostics }) {
  const [plotRef, W] = useChartWidth()
  const primary = study.protocol.primaryHorizon
  const [horizon, setHorizon] = useState(primary)
  const testShown = studyTestVisible(study)
  const shownSplits = gatedSplits(study, SPLITS)
  const points = samplePoints(study, horizon).filter((p) => testShown || p.split !== 'test')
  const { icPath } = study
  if (points.length < WINDOW + 2) {
    return <Empty title="Rank IC over time" reason={`The Run publishes no per-timestamp IC path (${points.length} points), so the series cannot be drawn.`} />
  }
  const smooth = trailingMean(points, WINDOW)
  const H = 320
  const m = { l: 60, r: 16, t: 30, b: 46 }
  const t0 = points[0].t
  const t1 = points[points.length - 1].t
  const maxAbs = Math.max(0.1, ...points.map((p) => Math.abs(p.ic)))
  const ticks = niceTicks(-maxAbs * 1.08, maxAbs * 1.08)
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const x = (t: number) => m.l + ((t - t0) / (t1 - t0)) * (W - m.l - m.r)
  const y = (v: number) => m.t + ((yMax - v) / (yMax - yMin)) * (H - m.t - m.b)
  const windows = shownSplits.map((split) => ({
    split,
    start: Math.max(t0, Date.parse(study.protocol.splits.splits[split].start)),
    end: Math.min(t1, Date.parse(study.protocol.splits.splits[split].end)),
  }))
  const row = study.horizonProfile.find((r) => r.horizon === horizon)
  const line = smooth.flatMap((v, i) => (v === null ? [] : [`${x(points[i].t).toFixed(1)},${y(v).toFixed(1)}`])).join(' ')
  const years: number[] = []
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) years.push(Date.UTC(yr, 0, 1))

  return (
    <Chart
      title={`Rank IC over time, ${horizon}-bar horizon`}
      plotRef={plotRef}
      short={`Sampled rank IC, trailing mean of ${WINDOW}; dashed lines are each split's mean.`}
      desc={`Sampled per-timestamp rank IC (${testShown ? `${icPath.sampledRows} of ${int(icPath.totalRows)}` : points.length} timestamps) with a trailing mean of ${WINDOW} samples. Dashed lines are each split's published mean IC over all of its timestamps.`}
      controls={
        <div className="seg" role="group" aria-label="Forward horizon">
          {[...study.protocol.horizons]
            .sort((a, b) => a - b)
            .map((h) => (
              <button key={h} type="button" aria-pressed={h === horizon} onClick={() => setHorizon(h)}>
                {h}-bar{h === primary ? ' · primary' : ''}
              </button>
            ))}
        </div>
      }
      legend={
        <span className="legend">
          <Swatch kind="dot" label="Sampled timestamp" />
          <Swatch kind="line" label={`Trailing mean of ${WINDOW} samples`} />
          <Swatch kind="dash" label="Split mean, all timestamps" />
          {!testShown && <span className="faint">{TEST_HIDDEN_NOTE}</span>}
        </span>
      }
      note={
        <>
          The path is a bounded sample ({icPath.sampling.replace(/-/g, ' ')}), not the full series, so the trailing mean is a mean of samples and
          reads only as a drift check. Single timestamps are noisy by construction; the split means are the published full-split values.
        </>
      }
      table={
        <table className="tbl">
          <caption className="small muted">Sampled rank IC, {horizon}-bar horizon</caption>
          <thead>
            <tr>
              <th scope="col">Timestamp (UTC)</th>
              <th scope="col">Split</th>
              <th scope="col" className="r">Rank IC</th>
              <th scope="col" className="r">Trailing mean</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.t}>
                <td className="mono">{new Date(p.t).toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td>{SPLIT_LABEL[p.split]}</td>
                <td className="r mono">{ic4(p.ic)}</td>
                <td className="r mono">{ic4(smooth[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {({ labelledBy }) => (
          <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelledBy}>
          {windows.map((w) =>
            w.end > w.start ? (
              <g key={w.split}>
                <rect
                  x={x(w.start)}
                  y={m.t}
                  width={x(w.end) - x(w.start)}
                  height={H - m.t - m.b}
                  fill={w.split === 'validation' ? 'var(--hover)' : w.split === 'test' ? 'var(--selected)' : 'none'}
                  opacity={w.split === 'test' ? 0.55 : 1}
                />
                <text x={(x(w.start) + x(w.end)) / 2} y={m.t - 10} textAnchor="middle" className="grp">
                  {SPLIT_LABEL[w.split]} · {SPLIT_ROLE[w.split]}
                </text>
              </g>
            ) : null,
          )}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" opacity={t === 0 ? 1 : 0.5} />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="ax">
                {t === 0 ? '0' : t.toFixed(1)}
              </text>
            </g>
          ))}
          <text transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="ax">
            rank IC
          </text>
          {years
            .filter((yr) => yr > t0 + 90 * 864e5 && yr < t1 - 90 * 864e5)
            .map((yr) => (
              <text key={yr} x={x(yr)} y={H - 26} textAnchor="middle" className="ax">
                {new Date(yr).getUTCFullYear()}
              </text>
            ))}
          <text x={m.l} y={H - 8} textAnchor="start" className="ax faint">
            {day(t0)}
          </text>
          <text x={W - m.r} y={H - 8} textAnchor="end" className="ax faint">
            {day(t1)}
          </text>
          {points.map((p) => (
            <circle key={p.t} cx={x(p.t)} cy={y(p.ic)} r="1.9" fill="var(--stroke)" opacity=".6" />
          ))}
          {row &&
            windows.map((w) => {
              const mean = row[w.split].meanRankIc
              return mean !== null && w.end > w.start ? (
                <line key={w.split} x1={x(w.start)} x2={x(w.end)} y1={y(mean)} y2={y(mean)} stroke="var(--text)" strokeWidth="1.4" strokeDasharray="5 4" />
              ) : null
            })}
          <polyline points={line} fill="none" stroke="var(--bg)" strokeWidth="4" strokeLinejoin="round" />
          <polyline points={line} fill="none" stroke="var(--text)" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )}
    </Chart>
  )
}

/* ---------------------------------------------------------------- 3. Quantile returns */

export function Quantiles({ study }: { study: FactorDiagnostics }) {
  const [plotRef, W] = useChartWidth()
  const evidence = study.quantileEvidence
  const primary = study.protocol.primaryHorizon
  const testShown = studyTestVisible(study)
  const rows: FactorQuantileRow[] = study.quantileSummary.filter((r) => r.horizon === primary && (testShown || r.split !== 'test'))
  const drawable = evidence.status === 'available' && rows.some((r) => r.low !== null && r.middle !== null && r.high !== null)
  if (!drawable) {
    return (
      <Empty
        title="Mean forward return by factor quantile"
        reason={
          evidence.status === 'protocol-unavailable'
            ? `Not emitted for ${evidence.evaluationMode}. ${evidence.reason ?? ''}`
            : 'The Run published no quantile rows for the primary horizon.'
        }
        code={evidence.reasonCode ?? evidence.status}
      />
    )
  }
  const H = 300
  const m = { l: 64, r: 16, t: 24, b: 64 }
  const vals = rows.flatMap((r) => [r.low, r.middle, r.high]).filter((v): v is number => v !== null)
  const lo = Math.min(0, ...vals)
  const hi = Math.max(0, ...vals)
  const pad = (hi - lo) * 0.16 || 0.001
  const ticks = niceTicks(lo - pad, hi + pad)
  const yMin = Math.min(lo - pad, ticks[0])
  const yMax = Math.max(hi + pad, ticks[ticks.length - 1])
  const y = (v: number) => m.t + ((yMax - v) / (yMax - yMin)) * (H - m.t - m.b)
  const gw = (W - m.l - m.r) / rows.length
  const bw = Math.min(54, gw / 4.5)
  return (
    <Chart
      title={`Mean forward return by factor quantile, ${primary}-bar horizon`}
      plotRef={plotRef}
      short="Low, middle and high factor groups per split; a useful factor rises from low to high."
      desc="Mean forward return of the low, middle and high factor groups in each split. A useful factor shows the bars rising from low to high."
      legend={testShown ? undefined : <span className="legend"><span className="faint">{TEST_HIDDEN_NOTE}</span></span>}
      table={
        <table className="tbl">
          <caption className="small muted">Quantile mean forward return</caption>
          <thead>
            <tr>
              <th scope="col">Split</th>
              <th scope="col" className="r">Low</th>
              <th scope="col" className="r">Middle</th>
              <th scope="col" className="r">High</th>
              <th scope="col" className="r">High − low</th>
              <th scope="col" className="r">Monotonicity</th>
              <th scope="col" className="r">Observations</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.split}>
                <td>{SPLIT_LABEL[r.split]}</td>
                <td className="r mono">{ret(r.low)}</td>
                <td className="r mono">{ret(r.middle)}</td>
                <td className="r mono">{ret(r.high)}</td>
                <td className="r mono">{ret(r.highMinusLow)}</td>
                <td className="r mono">{num(r.monotonicity, 2)}</td>
                <td className="r mono">{int(r.observations)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {({ labelledBy }) => (
          <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelledBy}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={t === 0 ? 0 : 1} opacity=".7" />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="ax">
                {ret(t)}
              </text>
            </g>
          ))}
          {rows.map((r, gi) => {
            const gx = m.l + gi * gw
            return (
              <g key={r.split}>
                {(
                  [
                    ['low', r.low],
                    ['middle', r.middle],
                    ['high', r.high],
                  ] as const
                ).map(([name, v], bi) => {
                  const cx = gx + gw / 2 + (bi - 1) * (bw + 8)
                  if (v === null) return null
                  return (
                    <g key={name}>
                      <rect
                        x={cx - bw / 2}
                        y={y(Math.max(0, v))}
                        width={bw}
                        height={Math.max(1, Math.abs(y(v) - y(0)))}
                        fill={r.split === 'validation' ? 'var(--text)' : 'var(--stroke)'}
                        opacity={r.split === 'train' ? 0.55 : 1}
                      />
                      <text x={cx} y={v >= 0 ? y(v) - 6 : y(v) + 14} textAnchor="middle" className="val">
                        {ret(v)}
                      </text>
                      <text x={cx} y={H - m.b + 16} textAnchor="middle" className="ax">
                        {name}
                      </text>
                    </g>
                  )
                })}
                <text x={gx + gw / 2} y={H - 10} textAnchor="middle" className="grp">
                  {SPLIT_LABEL[r.split]} · n={int(r.observations)}
                </text>
              </g>
            )
          })}
          <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--text)" strokeWidth="1.2" />
        </svg>
      )}
    </Chart>
  )
}

/** A chart that cannot be drawn says why, instead of a blank frame or invented data. */
export function Empty({ title, reason, code }: { title: string; reason: string; code?: string }) {
  return (
    <figure className="chart">
      <figcaption>
        <h3>{title}</h3>
      </figcaption>
      <div className="empty" role="status">
        <span className="badge">Not available</span>
        <p>{reason}</p>
        {code && <p className="faint small mono">{code}</p>}
      </div>
    </figure>
  )
}

/* ---------------------------------------------------------------- 4. Noise frontier */

export function NoiseFrontierChart({ frontier, runIc }: { frontier: NoiseFrontier; runIc: number | null }) {
  const [plotRef, W] = useChartWidth()
  const H = 340
  const m = { l: 64, r: 20, t: 24, b: 54 }
  const { standardError: se, trials: n, leaderIc } = frontier
  const maxN = Math.max(50, n * 4)
  const x = (t: number) => m.l + (Math.log(t) / Math.log(maxN)) * (W - m.l - m.r)
  const expected = (t: number) => se * Math.max(0, expectedMaxZ(t))
  const bonf = (t: number) => familywiseThreshold(se, t)
  const ys = [leaderIc, runIc ?? 0, 0, expected(maxN), bonf(maxN), bonf(1)]
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const pad = (hi - lo) * 0.1
  const ticks = niceTicks(lo - pad, hi + pad)
  const yMin = Math.min(lo - pad, ticks[0])
  const yMax = Math.max(hi + pad, ticks[ticks.length - 1])
  const y = (v: number) => m.t + ((yMax - v) / (yMax - yMin)) * (H - m.t - m.b)
  const grid = Array.from({ length: 80 }, (_, i) => Math.exp((i / 79) * Math.log(maxN)))
  const path = (f: (t: number) => number) => grid.map((t) => `${x(t).toFixed(1)},${y(f(t)).toFixed(1)}`).join(' ')
  const xticks = [1, 2, 5, 10, 20, 50, 100, 200].filter((t) => t <= maxN)
  const cleared = leaderIc > bonf(n)
  const marker = runIc !== null && Math.abs(runIc - leaderIc) > 1e-12
  return (
    <Chart
      title="Noise frontier: how large the best IC looks by luck alone"
      plotRef={plotRef}
      short={`Best IC expected from ${n} trial${n === 1 ? '' : 's'} of pure noise, against the family-wise pass line.`}
      desc={`With ${n} independent trial${n === 1 ? '' : 's'} in the Project ledger, the best mean IC is expected to reach ${ic4(expected(n))} under pure noise. The solid curve is that expectation as trials grow; the dotted curve is the mean IC the published family-wise HAC rule demands.`}
      legend={
        <span className="legend">
          <Swatch kind="line" label="Expected best IC under noise" />
          <Swatch kind="ref" label="IC needed to pass family-wise HAC rule" />
        </span>
      }
      note={
        <>
          N is the Project ledger's <span className="mono">{frontier.family.trialCountAssumption}</span> count of unique candidate sources (
          {frontier.family.totalExecutions} execution{frontier.family.totalExecutions === 1 ? '' : 's'}), an upper bound on independent trials. The
          null spread is the HAC standard error {num(se, 4)} implied by the selected value's published raw p-value {num(frontier.rawP, 3)}. The
          expectation uses the closed form of <span className="mono">autoquant/selection.py</span>; the dotted curve inverts its published
          Bonferroni rule (adjusted p = raw p × N ≤ 0.05).
        </>
      }
      table={
        <table className="tbl">
          <caption className="small muted">Noise frontier at selected trial counts</caption>
          <thead>
            <tr>
              <th scope="col" className="r">Trials N</th>
              <th scope="col" className="r">Expected best IC under noise</th>
              <th scope="col" className="r">IC needed to pass family-wise HAC</th>
            </tr>
          </thead>
          <tbody>
            {[...new Set([1, 2, 5, 10, 20, 50, n])]
              .sort((a, b) => a - b)
              .map((t) => (
                <tr key={t}>
                  <td className="r mono">
                    {t}
                    {t === n && ' · this ledger'}
                  </td>
                  <td className="r mono">{ic4(expected(t))}</td>
                  <td className="r mono">{ic4(bonf(t))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      }
    >
      {({ labelledBy }) => (
          <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelledBy}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={t === 0 ? 0 : 1} opacity=".7" />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="ax">
                {t === 0 ? '0' : t.toFixed(3)}
              </text>
            </g>
          ))}
          <text transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="ax">
            mean rank IC
          </text>
          {xticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={H - m.b} y2={H - m.b + 5} stroke="var(--stroke)" />
              <text x={x(t)} y={H - m.b + 18} textAnchor="middle" className="ax">
                {t}
              </text>
            </g>
          ))}
          <text x={(m.l + W - m.r) / 2} y={H - 8} textAnchor="middle" className="ax">
            independent trials N (log scale)
          </text>
          <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--text)" strokeWidth="1.2" />
          <line x1={x(n)} x2={x(n)} y1={m.t} y2={H - m.b} stroke="var(--line-strong)" strokeDasharray="3 3" />
          <polyline points={path(bonf)} fill="none" stroke="var(--signal-graphic)" strokeWidth="1.8" strokeDasharray="2 4" strokeLinecap="round" />
          <polyline points={path(expected)} fill="none" stroke="var(--text)" strokeWidth="1.8" />
          <text x={x(n) + 6} y={m.t + 10} className="ax">
            N = {n}
          </text>
          <g transform={`translate(${x(n)} ${y(leaderIc)})`}>
            <path d="M0 -7 L7 0 L0 7 L-7 0 Z" fill="var(--text)" stroke="var(--bg)" strokeWidth="1.5" />
          </g>
          <text x={x(n) + 12} y={y(leaderIc) + 4} className="val" textAnchor="start">
            selected {ic4(leaderIc)}
            {cleared ? '' : ' · below the pass line'}
          </text>
          {marker && runIc !== null && (
            <>
              <circle cx={x(n)} cy={y(runIc)} r="5.5" fill="var(--bg)" stroke="var(--text)" strokeWidth="1.8" />
              <text x={x(n) + 12} y={y(runIc) + 4} className="val" textAnchor="start">
                this Run {ic4(runIc)}
              </text>
            </>
          )}
        </svg>
      )}
    </Chart>
  )
}
