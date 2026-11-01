import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { FactorCumulativePoint, FactorDiagnostics, FactorSpreadSplit } from '../api'
import { ChartCard, SegmentedToggle, type MetricGroup } from '../components/workbench'
import { num, pct } from '../format'
import { IcByHorizonCard } from './FactorCharts'
import { niceTicks, SPLIT_LABEL } from './factorMath'
import { studyTestVisible, TEST_HIDDEN_NOTE } from './testGate'

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const int = (v: number) => v.toLocaleString('en-US')
const growth = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(3)}×` : '—')
/** Signed percentage of a per-bar fraction; `digits` is the decimals of the percent. */
const spct = (v: number | null | undefined, digits = 2) =>
  typeof v === 'number' && Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(digits)}%` : '—'

type LineKey = 'high' | 'middle' | 'low' | 'spread'
/** Monochrome by design: the four lines differ in weight and dash, and the spread alone takes the signal colour. */
const LINES: { key: LineKey; label: string; stroke: string; width: number; dash?: string; round?: boolean }[] = [
  { key: 'high', label: 'High group', stroke: 'var(--text)', width: 1.8 },
  { key: 'middle', label: 'Middle group', stroke: 'var(--muted)', width: 1.4, dash: '6 3' },
  { key: 'low', label: 'Low group', stroke: 'var(--stroke)', width: 1.6, dash: '1.5 3', round: true },
  { key: 'spread', label: 'Long-short (high minus low)', stroke: 'var(--signal-graphic)', width: 2.2 },
]

const m = { l: 56, r: 16, t: 22, b: 40 }

/** Compounded group curves at `width` x `height` CSS px. Test-split points are removed before any scale, marker or readout is built when test is hidden. */
function GroupPlot({ points, width: W, height: H, label }: { points: FactorCumulativePoint[]; width: number; height: number; label: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const t = points.map((p) => Date.parse(p.timestamp))
  const t0 = t[0]
  const t1 = t[t.length - 1]
  const all = points.flatMap((p) => [p.low, p.middle, p.high, p.spread]).filter(Number.isFinite)
  const ticks = niceTicks(Math.min(1, ...all), Math.max(1, ...all), 5)
  const lo = Math.min(ticks[0], ...all)
  const hi = Math.max(ticks[ticks.length - 1], ...all)
  const x = (ms: number) => m.l + ((ms - t0) / (t1 - t0 || 1)) * (W - m.l - m.r)
  const y = (v: number) => m.t + ((hi - v) / (hi - lo || 1)) * (H - m.t - m.b)
  const path = (key: LineKey) => points.map((p, i) => `${i ? 'L' : 'M'}${x(t[i]).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ')
  const years: number[] = []
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) years.push(Date.UTC(yr, 0, 1))
  // Split boundaries come from the drawn points: the first point of each later split.
  const bounds = points.flatMap((p, i) => (i > 0 && p.split !== points[i - 1].split ? [{ i, split: p.split }] : []))

  const nearest = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box) return null
    const px = ((clientX - box.left) / box.width) * W
    let best = 0
    for (let i = 1; i < t.length; i++) if (Math.abs(x(t[i]) - px) < Math.abs(x(t[best]) - px)) best = i
    return best
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Escape') return
    e.preventDefault()
    if (e.key === 'Escape') return setHover(null)
    setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? (e.key === 'ArrowRight' ? -1 : points.length)) + (e.key === 'ArrowRight' ? 1 : -1))))
  }
  const hp = hover !== null ? points[hover] : null
  const boxW = 176
  const boxH = 18 * 5 + 10
  const bx = hover !== null ? (x(t[hover]) + 12 + boxW > W - m.r ? x(t[hover]) - 12 - boxW : x(t[hover]) + 12) : 0

  return (
  <svg
    ref={svgRef}
    className="plot plot--fill"
    viewBox={`0 0 ${W} ${H}`}
    role="img"
    aria-label={label}
    tabIndex={0}
    onPointerMove={(e: PointerEvent<SVGSVGElement>) => setHover(nearest(e.clientX))}
    onPointerLeave={() => setHover(null)}
    onKeyDown={onKey}
    onBlur={() => setHover(null)}
  >
    {ticks.map((v) => (
      <g key={v}>
        <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" opacity={v === 1 ? 1 : 0.5} strokeDasharray={v === 1 ? undefined : '2 3'} />
        <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="ax">{v.toFixed(2)}</text>
      </g>
    ))}
    <text transform={`translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="ax">growth multiple</text>
    {bounds.map((b) => (
      <g key={b.i}>
        <line x1={x(t[b.i])} x2={x(t[b.i])} y1={m.t} y2={H - m.b} stroke="var(--stroke)" strokeWidth="1" opacity=".7" />
        <text x={x(t[b.i]) + 5} y={m.t - 8} className="ax">{SPLIT_LABEL[b.split]}</text>
      </g>
    ))}
    <text x={m.l + 5} y={m.t - 8} className="ax">{SPLIT_LABEL[points[0].split]}</text>
    {years
      .filter((yr) => yr > t0 + 90 * 864e5 && yr < t1 - 90 * 864e5)
      .map((yr) => (
        <g key={yr}>
          <line x1={x(yr)} x2={x(yr)} y1={H - m.b} y2={H - m.b + 4} stroke="var(--stroke)" />
          <text x={x(yr)} y={H - m.b + 16} textAnchor="middle" className="ax">{new Date(yr).getUTCFullYear()}</text>
        </g>
      ))}
    <text x={m.l} y={H - 8} textAnchor="start" className="ax faint">{day(t0)}</text>
    <text x={W - m.r} y={H - 8} textAnchor="end" className="ax faint">{day(t1)}</text>
    {LINES.map((l) => (
      <g key={l.key}>
        {l.key === 'spread' && <path d={path(l.key)} fill="none" stroke="var(--bg)" strokeWidth="4.4" strokeLinejoin="round" />}
        <path d={path(l.key)} fill="none" stroke={l.stroke} strokeWidth={l.width} strokeDasharray={l.dash} strokeLinejoin="round" strokeLinecap={l.round ? 'round' : undefined} />
      </g>
    ))}
    {hp && hover !== null && (
      <g pointerEvents="none">
        <line x1={x(t[hover])} x2={x(t[hover])} y1={m.t} y2={H - m.b} stroke="var(--text)" strokeWidth="1" strokeDasharray="2 2" />
        {LINES.map((l) => (
          <circle key={l.key} cx={x(t[hover])} cy={y(hp[l.key])} r="3.2" fill={l.stroke} stroke="var(--bg)" strokeWidth="1.5" />
        ))}
        <rect x={bx} y={m.t + 4} width={boxW} height={boxH} fill="var(--raised)" stroke="var(--line-strong)" />
        <text x={bx + 8} y={m.t + 20} className="ax">{hp.timestamp.slice(0, 10)} · {SPLIT_LABEL[hp.split]}</text>
        {[...LINES].reverse().map((l, i) => (
          <text key={l.key} x={bx + 8} y={m.t + 38 + i * 18} className="val">
            {l.key === 'spread' ? 'Long-short' : l.label.replace(' group', '')}: {growth(hp[l.key])}
          </text>
        ))}
      </g>
    )}
  </svg>
  )
}

function GroupLegend({ testShown }: { testShown: boolean }) {
  return (
  <span className="legend">
    {LINES.map((l) => (
      <span key={l.key} className="legend-item">
        <svg width="22" height="12" aria-hidden="true">
          <line x1="0" y1="6" x2="22" y2="6" stroke={l.stroke} strokeWidth={l.width} strokeDasharray={l.dash} strokeLinecap={l.round ? 'round' : undefined} />
        </svg>
        <span>{l.label}</span>
      </span>
    ))}
    {!testShown && <span className="faint">{TEST_HIDDEN_NOTE}</span>}
  </span>
  )
}

function GroupTable({ points }: { points: FactorCumulativePoint[] }) {
  return (
  <table className="tbl">
    <caption className="small muted">Compounded group growth multiples</caption>
    <thead>
      <tr>
        <th scope="col">Date</th>
        <th scope="col">Split</th>
        <th scope="col" className="r">Low</th>
        <th scope="col" className="r">Middle</th>
        <th scope="col" className="r">High</th>
        <th scope="col" className="r">Long-short</th>
      </tr>
    </thead>
    <tbody>
      {points.map((p) => (
        <tr key={p.timestamp}>
          <td className="mono">{p.timestamp.slice(0, 10)}</td>
          <td>{SPLIT_LABEL[p.split]}</td>
          <td className="r mono">{growth(p.low)}</td>
          <td className="r mono">{growth(p.middle)}</td>
          <td className="r mono">{growth(p.high)}</td>
          <td className="r mono">{growth(p.spread)}</td>
        </tr>
      ))}
    </tbody>
  </table>
  )
}

const SPREAD_INFO = (basis: string | undefined) => (
  <>
    <p>High minus low group, gross of costs, per-bar not annualised.</p>
    {basis && <p className="faint">{basis}</p>}
  </>
)

const spreadTiles = (s: FactorSpreadSplit): MetricGroup['tiles'] => [
  { label: 'Total return', value: spct(s.totalReturn, 1) },
  { label: 'Max drawdown', value: spct(s.maximumDrawdown, 1) },
  { label: 'Sharpe per bar', value: num(s.sharpePerBar, 3) },
  { label: 'Hit rate', value: pct(s.hitRate, 1) },
  { label: 'Mean per bar', value: spct(s.meanPerBar, 3) },
  { label: 'Observations', value: typeof s.observations === 'number' ? int(s.observations) : '—' },
]

/** Validation long-short groups, plus the test group only when the test split is visible (the same rule as the core metrics). Values arrive from the Core summary; nothing is re-derived. */
export function spreadGroups(study: FactorDiagnostics, testShown: boolean): MetricGroup[] {
  const sum = study.spreadSummary
  if (!sum || sum.status !== 'available') return []
  const by = (split: string) => sum.splits.find((s) => s.split === split)
  const validation = by('validation')
  const test = testShown ? by('test') : undefined
  if (!validation) return []
  const info = SPREAD_INFO(sum.basis)
  return [
    { heading: 'Long-short · validation', info, infoLabel: 'Long-short definition', tiles: spreadTiles(validation) },
    ...(test ? [{ heading: 'Long-short · test audit', info, infoLabel: 'Long-short definition', tiles: spreadTiles(test) }] : []),
  ]
}

type View = 'group' | 'ic'

/**
 * The Factor page's chart card. With group curves published it is the Group cumulative return chart, with Rank IC one click
 * away in the card header; without them (single-asset Runs, older snapshots) it is the Rank IC chart. The long-short tiles
 * live under it with the other metrics (`spreadGroups`).
 */
export function FactorHero({ study, minHeight = 260 }: { study: FactorDiagnostics; minHeight?: number }) {
  const testShown = studyTestVisible(study)
  const [choice, setChoice] = useState<View | null>(null)
  const quantiles = study.quantileEvidence.status === 'available' && study.predictionUniverse.evaluationMode !== 'single-asset-temporal'
  const points = [...(study.quantilePath?.cumulative?.points ?? [])]
    .filter((p) => testShown || p.split !== 'test')
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  const groups = quantiles && points.length >= 2
  const view: View = choice ?? (groups ? 'group' : 'ic')
  const assets = study.predictionUniverse.predictionAssets?.length ?? 0
  const toggle = groups ? (
    <SegmentedToggle
      label="Hero chart"
      value={view}
      onChange={setChoice}
      options={[
        { id: 'group', label: 'Group return' },
        { id: 'ic', label: 'Rank IC' },
      ]}
    />
  ) : undefined
  if (view === 'group' && groups) {
    const cum = study.quantilePath?.cumulative
    const desc = `Compounded growth multiple of the low, middle and high factor groups and of the long-short spread (high minus low), starting near 1.0. ${cum?.basis ?? ''} ${testShown ? `${points.length} of ${int(cum?.totalRows ?? points.length)}` : points.length} bars are drawn. ${testShown ? '' : TEST_HIDDEN_NOTE + '.'}`.trim()
    return (
      <ChartCard
        title="Group cumulative return"
        info={
          <>
            <p>{desc}</p>
            {cum?.basis && <p>{cum.basis}</p>}
          </>
        }
        toggle={toggle}
        legend={<GroupLegend testShown={testShown} />}
        table={<GroupTable points={points} />}
        minHeight={minHeight}
      >
        {({ width, height }) => (
          <GroupPlot
            points={points}
            width={width}
            height={height}
            label={`Low, middle and high factor groups compounded at ${cum?.horizon ?? 1}-bar horizon, gross of costs, plus the high-minus-low long-short curve.`}
          />
        )}
      </ChartCard>
    )
  }
  return (
    <IcByHorizonCard
      study={study}
      minHeight={minHeight}
      toggle={toggle}
      legendExtra={
        !quantiles ? (
          <span className="small">
            Group return curves do not exist for this Run: it is scored through time on {assets === 1 ? 'a single asset' : `${assets || 'its'} assets`}, so there is no cross-section to split into groups.
          </span>
        ) : undefined
      }
    />
  )
}
