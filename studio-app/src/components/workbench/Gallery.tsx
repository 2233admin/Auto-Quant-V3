import { uiTemplate, uiText } from '../../i18n'
import { useState } from 'react'
import { StateCatalogue } from './StateCatalogue'
import { Swatch } from '../../pages/FactorCharts'
import { MotionDemos } from '../motion/MotionDemos'
import { ActionRow, ChartCard, FactChips, MetricGrid, PaneCard, SegmentedToggle, StatusLine, TabList, VerdictBar, WorkbenchShell, useHashTab, type StatusState } from '.'

type Left = 'inputs' | 'status' | 'motion'
type Right = 'chart' | 'metrics'
type Metric = 'group' | 'ic'
type Mode = 'idle' | 'running' | 'indeterminate' | 'failed'

const LEFT = [{ id: 'inputs', get label() { return uiText("Inputs") } }, { id: 'status', get label() { return uiText("States") }, badge: '4' }, { id: 'motion', get label() { return uiText("Motion") } }] as const
const RIGHT = [{ id: 'chart', get label() { return uiText("Chart") } }, { id: 'metrics', get label() { return uiText("Metrics") } }] as const

const SERIES = Array.from({ length: 60 }, (_, i) => Math.sin(i / 6) * 0.6 + Math.cos(i / 2.3) * 0.2 + i / 90)

function Plot({ width, height, alt }: { width: number; height: number; alt: boolean }) {
  const pad = 28
  const ys = alt ? SERIES.map((v, i) => (i % 7 === 0 ? v : v * 0.4)) : SERIES
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const x = (i: number) => pad + (i / (ys.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - ((v - lo) / (hi - lo)) * (height - pad * 2)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={uiText("Sample series")}>
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="var(--grid)" />
      <polyline fill="none" stroke="var(--text)" strokeWidth="1.8" points={ys.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      <text x={pad} y={height - 8} fill="var(--muted)" fontSize="11">{width} x {height}{uiText(" px, measured")}</text>
    </svg>
  )
}

/** `?view=kit`: every workbench component with sample content, laid out in a live WorkbenchShell. Not in the nav. */
export function WorkbenchGallery() {
  const [left, setLeft] = useHashTab<Left>(['inputs', 'status', 'motion'], 'inputs')
  const [right, setRight] = useState<Right>('chart')
  const [metric, setMetric] = useState<Metric>('group')
  const [mode, setMode] = useState<Mode>('running')
  const [ran, setRan] = useState(0)
  const state: StatusState = mode === 'idle' ? 'idle' : mode === 'failed' ? 'failed' : 'running'

  const status = (
    <StatusLine
      state={state}
      text={mode === 'idle' ? 'Ready. Last run 4m ago.' : mode === 'failed' ? 'Failed: the Run exited with code 2' : mode === 'indeterminate' ? 'Running' : 'Running stage 3 of 5'}
      percent={mode === 'running' ? 60 : mode === 'indeterminate' ? null : undefined}
      elapsed="1m 12s"
      onCancel={() => setMode('idle')}
      details={<pre className="mono small">aq factor run --study demo --split validation</pre>}
    />
  )

  const leftPane = (
    <PaneCard
      label={uiText("Inputs")}
      tabs={<TabList label={uiText("Left pane")} tabs={[...LEFT]} active={left} onSelect={setLeft} />}
      actions={
        <ActionRow
          primary={{ label: uiTemplate("Run analysis{0}", [ran ? ` (${ran})` : '']), onClick: () => setRan((n) => n + 1) }}
          secondary={[{ label: uiText("Reset"), disabled: true, disabledReason: uiText("Nothing to reset: the candidate matches the saved version.") }]}
          chip="1 trial"
        />
      }
      status={status}
    >
      {left === 'motion' ? (
        <MotionDemos />
      ) : left === 'inputs' ? (
        <>
          <VerdictBar
            tone="bad"
            word={uiText("Inconclusive")}
            reasons={[
              { tone: 'bad', text: uiText("Validation HAC p is above 0.05."), field: 'summary.hacNormalPValue' },
              { tone: 'info', text: uiText("Test split is hidden by the protocol."), field: 'protocol.splits.testVisible' },
            ]}
          >{uiText("Validation mean rank IC is 0.0042 with HAC t 0.91, so the factor does not beat the selection-adjusted noise frontier at this horizon.")}</VerdictBar>
          <FactChips
            label={uiText("Study parameters")}
            locked
            info={<p>{uiText("These values come from the Study and cannot be changed in a candidate.")}</p>}
            facts={[
              { label: uiText("Study"), value: 'btc-4h-momentum', mono: true },
              { label: uiText("Horizon"), value: '4-bar primary' },
              { label: uiText("Dataset"), value: 'okx-btc-2024', mono: true },
              { label: uiText("Scored asset"), value: 'BTC-USDT', mono: true },
              { label: uiText("Evaluation mode"), value: 'cross_section', mono: true },
              { label: uiText("Validation window"), value: '2024-03-01 to 2024-06-30' },
            ]}
          />
          <div className="wb-gallery-filler">
            <p className="small muted">{uiText("The left pane scrolls on its own; scroll here and the right pane stays put.")}</p>
            {Array.from({ length: 24 }, (_, i) => (
              <p key={i} className="small">{uiText("Filler row ")}{i + 1}{uiText(": candidate source line that makes this pane taller than the viewport.")}</p>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="small muted">{uiText("Switch the status line state:")}</p>
          <SegmentedToggle
            label={uiText("Status state")}
            value={mode}
            onChange={setMode}
            options={[{ id: 'idle', label: uiText("Idle") }, { id: 'running', label: uiText("Running") }, { id: 'indeterminate', label: uiText("Unmeasured") }, { id: 'failed', label: uiText("Failed") }]}
          />
          <ActionRow primary={{ label: uiText("Save"), disabled: true, disabledReason: uiText("Fix the 2 validation errors in the candidate before saving; this sentence is long on purpose to show truncation with a tooltip.") }} />
          <VerdictBar tone="ok" word={uiText("Supported")}>{uiText("Mean rank IC and the HAC t clear the noise frontier on the validation split.")}</VerdictBar>
          <VerdictBar tone="warn" word={uiText("Inconclusive")}>{uiText("Too few observations to decide.")}</VerdictBar>
        </>
      )}
    </PaneCard>
  )

  const rightPane = (
    <PaneCard
      label={uiText("Results")}
      flush={right === 'chart'}
      tabs={<TabList label={uiText("Right pane")} tabs={[...RIGHT]} active={right} onSelect={setRight} />}
    >
      {right === 'chart' ? (
        <ChartCard
          fill
          title={metric === 'group' ? uiText("Group return") : uiText("Rank IC")}
          info={<p>{uiText("Cumulative return of each factor-rank group. Higher groups should earn more than lower ones.")}</p>}
          toggle={<SegmentedToggle label={uiText("Chart")} value={metric} onChange={setMetric} options={[{ id: 'group', label: uiText("Group return") }, { id: 'ic', label: uiText("Rank IC") }]} />}
          legend={
            <>
              <Swatch kind="line" label={uiText("Top group")} />
              <Swatch kind="dash" label={uiText("Benchmark")} />
            </>
          }
        >
          {({ width, height }) => <Plot width={width} height={height} alt={metric === 'ic'} />}
        </ChartCard>
      ) : (
        <MetricGrid
          hiddenNote="Test split is hidden by the protocol, so its metrics are not shown."
          groups={[
            {
              heading: uiText("Validation · selection split · 4-bar horizon"),
              tiles: [
                { label: uiText("Mean rank IC"), value: '0.0042' },
                { label: uiText("HAC t"), value: '0.91' },
                { label: uiText("HAC p"), value: '0.363', note: uiText("two-sided") },
                { label: uiText("Hit rate"), value: '0.512' },
                { label: uiText("Rank IC IR"), value: '0.041' },
                { label: uiText("Mean Pearson IC"), value: '0.0038' },
                { label: uiText("Observations after warm-up"), value: '812', note: uiText("min 1,000"), tone: 'weak', toneReason: uiText("below min") },
                { label: uiText("Trials counted"), value: '14', note: uiText("9 unique") },
              ],
            },
            {
              heading: uiText("Quantile spread"),
              tiles: [
                { label: uiText("Top minus bottom"), value: '+3.1 bp' },
                { label: uiText("Monotonicity"), value: '0.40' },
                { label: uiText("Turnover"), value: '38%' },
                { label: uiText("Cost-adjusted spread"), value: '-1.2 bp' },
              ],
            },
          ]}
        />
      )}
    </PaneCard>
  )

  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('catalogue') === 'states') return <StateCatalogue />
  return <WorkbenchShell left={leftPane} right={rightPane} ratio={40} />
}
