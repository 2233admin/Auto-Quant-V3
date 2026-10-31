import { useState } from 'react'
import { Swatch } from '../../pages/FactorCharts'
import { ActionRow, ChartCard, FactChips, MetricGrid, PaneCard, SegmentedToggle, StatusLine, TabList, VerdictBar, WorkbenchShell, useHashTab, type StatusState } from '.'

type Left = 'inputs' | 'status'
type Right = 'chart' | 'metrics'
type Metric = 'group' | 'ic'
type Mode = 'idle' | 'running' | 'indeterminate' | 'failed'

const LEFT = [{ id: 'inputs', label: 'Inputs' }, { id: 'status', label: 'States', badge: '4' }] as const
const RIGHT = [{ id: 'chart', label: 'Chart' }, { id: 'metrics', label: 'Metrics' }] as const

const SERIES = Array.from({ length: 60 }, (_, i) => Math.sin(i / 6) * 0.6 + Math.cos(i / 2.3) * 0.2 + i / 90)

function Plot({ width, height, alt }: { width: number; height: number; alt: boolean }) {
  const pad = 28
  const ys = alt ? SERIES.map((v, i) => (i % 7 === 0 ? v : v * 0.4)) : SERIES
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const x = (i: number) => pad + (i / (ys.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - ((v - lo) / (hi - lo)) * (height - pad * 2)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sample series">
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="var(--grid)" />
      <polyline fill="none" stroke="var(--text)" strokeWidth="1.8" points={ys.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      <text x={pad} y={height - 8} fill="var(--muted)" fontSize="11">{width} x {height} px, measured</text>
    </svg>
  )
}

/** `?view=kit`: every workbench component with sample content, laid out in a live WorkbenchShell. Not in the nav. */
export function WorkbenchGallery() {
  const [left, setLeft] = useHashTab<Left>(['inputs', 'status'], 'inputs')
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
      label="Inputs"
      tabs={<TabList label="Left pane" tabs={[...LEFT]} active={left} onSelect={setLeft} />}
      actions={
        <ActionRow
          primary={{ label: `Run analysis${ran ? ` (${ran})` : ''}`, onClick: () => setRan((n) => n + 1) }}
          secondary={[{ label: 'Reset', disabled: true, disabledReason: 'Nothing to reset: the candidate matches the saved version.' }]}
          chip="1 trial"
        />
      }
      status={status}
    >
      {left === 'inputs' ? (
        <>
          <VerdictBar
            tone="bad"
            word="Refuted"
            reasons={[
              { tone: 'bad', text: 'Validation HAC p is above 0.05.', field: 'summary.hacNormalPValue' },
              { tone: 'info', text: 'Test split is hidden by the protocol.', field: 'protocol.splits.testVisible' },
            ]}
          >
            Validation mean rank IC is 0.0042 with HAC t 0.91, so the factor does not beat the selection-adjusted noise frontier at this horizon.
          </VerdictBar>
          <FactChips
            label="Study parameters"
            locked
            info={<p>These values come from the Study and cannot be changed in a candidate.</p>}
            facts={[
              { label: 'Study', value: 'btc-4h-momentum', mono: true },
              { label: 'Horizon', value: '4-bar primary' },
              { label: 'Dataset', value: 'okx-btc-2024', mono: true },
              { label: 'Scored asset', value: 'BTC-USDT', mono: true },
              { label: 'Evaluation mode', value: 'cross_section', mono: true },
              { label: 'Validation window', value: '2024-03-01 to 2024-06-30' },
            ]}
          />
          <div className="wb-gallery-filler">
            <p className="small muted">The left pane scrolls on its own; scroll here and the right pane stays put.</p>
            {Array.from({ length: 24 }, (_, i) => (
              <p key={i} className="small">Filler row {i + 1}: candidate source line that makes this pane taller than the viewport.</p>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="small muted">Switch the status line state:</p>
          <SegmentedToggle
            label="Status state"
            value={mode}
            onChange={setMode}
            options={[{ id: 'idle', label: 'Idle' }, { id: 'running', label: 'Running' }, { id: 'indeterminate', label: 'Unmeasured' }, { id: 'failed', label: 'Failed' }]}
          />
          <ActionRow primary={{ label: 'Save', disabled: true, disabledReason: 'Fix the 2 validation errors in the candidate before saving; this sentence is long on purpose to show truncation with a tooltip.' }} />
          <VerdictBar tone="ok" word="Supported">Mean rank IC and the HAC t clear the noise frontier on the validation split.</VerdictBar>
          <VerdictBar tone="warn" word="Inconclusive">Too few observations to decide.</VerdictBar>
        </>
      )}
    </PaneCard>
  )

  const rightPane = (
    <PaneCard
      label="Results"
      flush={right === 'chart'}
      tabs={<TabList label="Right pane" tabs={[...RIGHT]} active={right} onSelect={setRight} />}
    >
      {right === 'chart' ? (
        <ChartCard
          title={metric === 'group' ? 'Group return' : 'Rank IC'}
          info={<p>Cumulative return of each factor-rank group. Higher groups should earn more than lower ones.</p>}
          toggle={<SegmentedToggle label="Chart" value={metric} onChange={setMetric} options={[{ id: 'group', label: 'Group return' }, { id: 'ic', label: 'Rank IC' }]} />}
          legend={
            <>
              <Swatch kind="line" label="Top group" />
              <Swatch kind="dash" label="Benchmark" />
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
              heading: 'Validation · selection split · 4-bar horizon',
              tiles: [
                { label: 'Mean rank IC', value: '0.0042' },
                { label: 'HAC t', value: '0.91' },
                { label: 'HAC p', value: '0.363', note: 'two-sided' },
                { label: 'Hit rate', value: '0.512' },
                { label: 'Rank IC IR', value: '0.041' },
                { label: 'Mean Pearson IC', value: '0.0038' },
                { label: 'Observations after warm-up', value: '812', note: 'min 1,000', tone: 'weak', toneReason: 'below min' },
                { label: 'Trials counted', value: '14', note: '9 unique' },
              ],
            },
            {
              heading: 'Quantile spread',
              tiles: [
                { label: 'Top minus bottom', value: '+3.1 bp' },
                { label: 'Monotonicity', value: '0.40' },
                { label: 'Turnover', value: '38%' },
                { label: 'Cost-adjusted spread', value: '-1.2 bp' },
              ],
            },
          ]}
        />
      )}
    </PaneCard>
  )

  return <WorkbenchShell left={leftPane} right={rightPane} ratio={40} />
}
