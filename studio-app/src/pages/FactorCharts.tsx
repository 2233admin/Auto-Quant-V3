import { useId, useState, type ReactNode } from 'react'
import type { FactorDiagnostics, FactorQuantileRow, FactorSplit } from '../api'
import { num, ret } from '../format'
import { Info } from '../components/Info'
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
function Chart({
  title,
  desc,
  short,
  controls,
  legend,
  children,
  table,
  note,
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
}) {
  const id = useId()
  return (
    <figure className="chart">
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
      {children({ labelledBy: `${id}-t ${id}-d` })}
      {note && !short && <p className="muted small chart-note">{note}</p>}
      <details className="datatable">
        <summary>Data table</summary>
        <div className="tablewrap">{table}</div>
      </details>
    </figure>
  )
}

function Swatch({ kind, label }: { kind: 'train' | 'validation' | 'test' | 'line' | 'dash' | 'dot' | 'ref'; label: string }) {
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

const W = 760

/* ---------------------------------------------------------------- 1. IC by horizon x split */

export function IcByHorizon({ study, hero }: { study: FactorDiagnostics; hero?: boolean }) {
  const pattern = useId()
  const rows = [...study.horizonProfile].sort((a, b) => a.horizon - b.horizon)
  const primary = study.protocol.primaryHorizon
  type Bar = { horizon: number; split: FactorSplit; mean: number | null; se: number | null; n: number; t: number | null; sufficient: boolean }
  const bars: Bar[] = rows.flatMap((row) =>
    SPLITS.map((split) => {
      const s = row[split]
      return { horizon: row.horizon, split, mean: s.meanRankIc, se: hacStandardError(s), n: s.observations, t: s.hacTStatistic, sufficient: s.sufficient }
    }),
  )
  const H = hero ? 292 : 360
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
  const slot = Math.min(72, gw / 3.2)
  const bw = Math.min(46, slot - 24)
  const baseline = y(0)

  return (
    <Chart
      title="Rank IC by horizon and split"
      short="Mean rank IC with ±1.96 HAC whiskers; a whisker crossing zero means noise."
      desc="Mean rank IC of the factor against the forward return, with ±1.96 HAC standard-error whiskers. A whisker that crosses zero means the mean is not distinguishable from noise."
      legend={
        <span className="legend">
          <Swatch kind="train" label="Train" />
          <Swatch kind="validation" label="Validation (selection)" />
          <Swatch kind="test" label="Test (visible audit)" />
        </span>
      }
      note={
        <>
          Whiskers are ±1.96 HAC standard errors, recovered as |mean IC / HAC t|. The HAC maximum lag equals each forward horizon, so overlapping
          forward returns are accounted for; a bar with no whisker has no usable t statistic. Only the {primary}-bar horizon drives selection.
        </>
      }
      table={
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
      }
    >
      {({ labelledBy }) => (
        <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelledBy}>
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
                {SPLITS.map((split, si) => {
                  const b = bars.find((x) => x.horizon === row.horizon && x.split === split)!
                  const cx = gx + gw / 2 + (si - 1) * slot
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
                      <text x={cx} y={H - m.b + 32} textAnchor="middle" className="ax faint">
                        n={int(b.n)}
                      </text>
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
      )}
    </Chart>
  )
}

/* ---------------------------------------------------------------- 2. IC over time */

const WINDOW = 12

export function IcOverTime({ study }: { study: FactorDiagnostics }) {
  const primary = study.protocol.primaryHorizon
  const [horizon, setHorizon] = useState(primary)
  const points = samplePoints(study, horizon)
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
  const windows = SPLITS.map((split) => ({
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
      short={`Sampled rank IC, trailing mean of ${WINDOW}; dashed lines are each split's mean.`}
      desc={`Sampled per-timestamp rank IC (${icPath.sampledRows} of ${int(icPath.totalRows)} timestamps) with a trailing mean of ${WINDOW} samples. Dashed lines are each split's published mean IC over all of its timestamps.`}
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
  const evidence = study.quantileEvidence
  const primary = study.protocol.primaryHorizon
  const rows: FactorQuantileRow[] = study.quantileSummary.filter((r) => r.horizon === primary)
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
      short="Low, middle and high factor groups per split; a useful factor rises from low to high."
      desc="Mean forward return of the low, middle and high factor groups in each split. A useful factor shows the bars rising from low to high."
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
