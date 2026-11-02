import { useEffect, useState } from 'react'
import type { ProjectSnapshot } from '../../api'
import { Section } from '../../design/layout'
import { routeHref } from '../../route'
import { PathTable, PortfolioChart, PortfolioChartInfo, type SplitWindow } from './PortfolioChart'
import { BookBlock, EpisodesTable, NeighborhoodBlock, TransitionsTable, ViabilityBlock } from './PortfolioBlocks'
import type { PerfSummary, PortfolioDiagnostics } from './portfolioTypes'
import { Block, day, finite, fn, Kv, NA, SplitToggle, sp, up } from './pfmt'
import { Info } from '../../components/Info'
import { ActionRow, FigureCard, FactChips, FactsDialog, MetricGrid, PaneCard, StatChips, StatusLine, Tabs, useHashTab, VerdictBar, WorkbenchShell, type ActionButton, type Fact, type MetricGroup, type Stat, type TabDef, type VerdictReason } from '../../components/workbench'
import { downloadJson } from '../../download'
import { signedNumber } from '../../design/signConvention'
import { portfolioCaption } from '../figureEvidence'
import { TEST_HIDDEN_NOTE } from '../testGate'
import { when } from '../../format'
import { RunSelect } from '../run/RunSelect'
import { otherLaneOf } from '../run/runTypes'
import './portfolio.css'
import { Empty } from '../../components/States'

type Split = 'validation' | 'test'
type Verdict = 'fail' | 'inconclusive'

/**
 * The server's own stage enum, nothing derived. The three non-positive stages are a fail. The one positive stage,
 * post-cost-edge-positive, is still inconclusive: the server's next step for it is robustness, capacity and a fresh
 * external holdout, so this lane has no "pass" state to show.
 */
const FAIL_STAGES = new Set(['factor-edge-absent', 'factor-not-monetized', 'cost-fragile'])
const WORD: Record<Verdict, string> = { fail: 'Inconclusive', inconclusive: 'Inconclusive' }

function verdictOf(pf: PortfolioDiagnostics): Verdict {
  const stage = pf.strategyViability?.diagnosis?.stage
  return stage && FAIL_STAGES.has(stage) ? 'fail' : 'inconclusive'
}

type Metric = { key: keyof PerfSummary; label: string; kind: 'pct' | 'num'; vsBench: boolean; gross: boolean }
const METRICS: Metric[] = [
  { key: 'totalReturn', label: 'Net total return', kind: 'pct', vsBench: true, gross: true },
  { key: 'annualReturn', label: 'Net annualized return', kind: 'pct', vsBench: true, gross: true },
  { key: 'sharpe', label: 'Net Sharpe', kind: 'num', vsBench: true, gross: true },
  { key: 'sortino', label: 'Net Sortino', kind: 'num', vsBench: true, gross: true },
  { key: 'maximumDrawdown', label: 'Max drawdown', kind: 'pct', vsBench: true, gross: true },
  { key: 'calmar', label: 'Calmar ratio', kind: 'num', vsBench: true, gross: false },
  { key: 'annualVolatility', label: 'Annualized volatility', kind: 'pct', vsBench: true, gross: false },
  { key: 'expectedShortfall95', label: 'Expected shortfall 95%', kind: 'pct', vsBench: true, gross: false },
  { key: 'positiveRate', label: 'Positive-day rate', kind: 'pct', vsBench: true, gross: false },
  { key: 'activeAnnualReturn', label: 'Active return vs benchmark', kind: 'pct', vsBench: false, gross: false },
  { key: 'informationRatio', label: 'Information ratio', kind: 'num', vsBench: false, gross: false },
]

const SHORT: Record<string, string> = {
  totalReturn: 'Net total return',
  annualReturn: 'Net annual return',
  sharpe: 'Net Sharpe',
  sortino: 'Net Sortino',
  maximumDrawdown: 'Max drawdown',
  calmar: 'Calmar',
  annualVolatility: 'Volatility (ann.)',
  expectedShortfall95: 'Exp. shortfall 95%',
  positiveRate: 'Positive-day rate',
  activeAnnualReturn: 'Active return',
  informationRatio: 'Information ratio',
}

const fmtMetric = (m: Metric, x: number | null | undefined) => (m.kind === 'pct' ? (m.key === 'maximumDrawdown' || m.key.endsWith('Return') ? sp(x) : up(x, 1)) : fn(x))

/** The published headline metrics (Calmar and expected shortfall included) as compact tiles; the benchmark value is in each tile's "?". */
function metricGroups(pf: PortfolioDiagnostics, split: Split): MetricGroup[] | null {
  const v = pf.strategyViability?.[split]
  if (!v?.net) return null
  const f = v.friction
  const label = split === 'validation' ? 'Validation · selection split' : 'Test · visible audit'
  return [
    {
      heading: label,
      label: `Core numbers, ${split} split`,
      tiles: [
        ...METRICS.filter((m) => m.key !== 'calmar' || finite(v.net?.calmar)).map((m) => {
          const bench = v.benchmark?.[m.key]
          return {
            label: SHORT[m.key] ?? m.label,
            value: fmtMetric(m, v.net?.[m.key]),
            info: m.vsBench && finite(bench) ? <p>{m.label}. Benchmark value: {fmtMetric(m, bench)}.</p> : m.label,
          }
        }),
        { label: '1-way turnover / yr', value: finite(f?.annualizedOneWayTurnover) ? `${fn(f?.annualizedOneWayTurnover, 1)}x` : '—', info: 'Annualized one-way turnover: traded notional per year, one way.' },
        { label: 'Total cost drag', value: up(f?.totalCostDrag, 2), info: `Total cost drag at ${finite(f?.baseCostBps) ? `${fn(f?.baseCostBps, 1)} bps` : '—'} per one-way trade.` },
      ],
    },
  ]
}

/** Gross, net and benchmark side by side for every headline metric, behind a disclosure. */
function MetricDetail({ pf, split }: { pf: PortfolioDiagnostics; split: Split }) {
  const v = pf.strategyViability?.[split]
  if (!v?.net) return <p><NA why={`strategyViability.${split}.net is not in the payload`} /></p>
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="small muted">Net against benchmark and gross, {split} split</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col" className="r">Net</th>
            <th scope="col" className="r">Benchmark</th>
            <th scope="col" className="r">Net minus benchmark</th>
            <th scope="col" className="r">Gross (no cost)</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.filter((m) => m.key !== 'calmar' || finite(v.net?.calmar)).map((m) => {
            const net = v.net?.[m.key]
            const bench = v.benchmark?.[m.key]
            const gross = v.gross?.[m.key]
            const delta = m.vsBench && finite(net) && finite(bench) ? net - bench : null
            return (
              <tr key={m.key}>
                <th scope="row">{m.label}</th>
                <td className="r mono">{fmtMetric(m, net)}</td>
                <td className="r mono">{m.vsBench ? (finite(bench) ? fmtMetric(m, bench) : '—') : 'by definition'}</td>
                <td className="r mono">{delta === null ? '—' : m.kind === 'pct' ? `${delta >= 0 ? '+' : '−'}${fn(Math.abs(delta) * 100, 2)} pts` : `${delta >= 0 ? '+' : '−'}${fn(Math.abs(delta), 2)}`}</td>
                <td className="r mono">{m.gross && finite(gross) ? fmtMetric(m, gross) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type TabId = 'detail' | 'viability' | 'neighborhood' | 'book' | 'transitions' | 'episodes' | 'path'
const TAB_IDS = ['detail', 'viability', 'neighborhood', 'book', 'transitions', 'episodes', 'path'] as const
/** Old section anchors (the former section bar) now live inside a tab. */
const ANCHOR_TAB: Record<string, TabId> = {
  'pf-summary': 'detail',
  'pf-viability': 'viability',
  'pf-neighborhood': 'neighborhood',
  'pf-book': 'book',
  'pf-transitions': 'transitions',
  'pf-episodes': 'episodes',
}

export function PortfolioPage({ project, go }: { project: ProjectSnapshot; go?: (href: string) => void }) {
  const pf = project.portfolioExplorer
  const [split, setSplit] = useState<Split>('validation')
  const [paramsOpen, setParamsOpen] = useState(false)
  const [tab, selectTab, anchor] = useHashTab<TabId>(TAB_IDS, 'detail', ANCHOR_TAB)
  useEffect(() => {
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }))
  }, [anchor, tab])
  if (!pf) {
    return (
      <div className="pg pf">
        <header className="pg-head">
          <h1>Portfolio</h1>
          <p className="muted small">
            Project <a href={routeHref({ view: 'project', id: project.id })}>{project.name}</a>. Research diagnostics of a mechanical strategy; no trading authority.
          </p>
        </header>
        <Empty title="No evidence in this Project">
          <p>This Project has no Portfolio Run, so there is no net-growth curve, viability diagnosis or parameter neighborhood to draw. Nothing is estimated in its place.</p>
          <p className="small">
            <a href={routeHref({ view: 'project', id: project.id })}>Back to the Project</a>
          </p>
        </Empty>
      </div>
    )
  }

  // Visibility rule (same as the Factor and Run pages): a test number is drawn only when the protocol calls test a visible
  // diagnostic AND the server published the test block. Otherwise nothing dated inside the test split is drawn either.
  const testWindow = pf.selection?.splits?.test
  const testVisible = pf.selection?.testRole === 'visible-diagnostic' && !!pf.strategyViability?.test
  const effective: Split = testVisible ? split : 'validation'
  const testStart = testWindow?.start
  const outsideTest = (date: string | undefined) => testVisible || !testStart || !date || date < testStart
  const hiddenNote = testVisible ? '' : TEST_HIDDEN_NOTE

  const allPoints = (pf.path?.points ?? []).filter((p) => p.timestamp)
  const points = testVisible ? allPoints : allPoints.filter((p) => p.split !== 'test' && outsideTest(p.timestamp))
  const windows: SplitWindow[] = (['train', 'validation', 'test'] as const)
    .filter((k) => pf.selection?.splits?.[k] && (k !== 'test' || testVisible))
    .map((k) => ({
      split: k,
      label: k === 'test' ? 'Test · audit' : `${k[0].toUpperCase()}${k.slice(1)}`,
      start: Date.parse(pf.selection?.splits?.[k]?.start ?? ''),
      end: Date.parse(pf.selection?.splits?.[k]?.end ?? ''),
    }))
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end))

  const transitionsAll = pf.recentTransitions ?? []
  const transitions = transitionsAll.filter((r) => outsideTest(r.timestamp))
  const episodesAll = pf.positionLifecycle?.recentEpisodes ?? []
  const episodes = episodesAll.filter((e) => testVisible || (e.split !== 'test' && outsideTest(e.entryTimestamp)))
  const bookDate = pf.currentBook?.timestamp
  const bookHidden = !outsideTest(bookDate) ? `the book is dated ${day(bookDate)}, inside the test split, and no test audit is published for this Run` : null

  const sum = pf.path?.summary
  const run = pf.run
  const toggle = <SplitToggle value={effective} onChange={setSplit} testVisible={testVisible} />

  const vv = pf.strategyViability?.validation
  const vSharpe = vv?.net?.sharpe
  const vBench = vv?.benchmark?.sharpe
  const verdict = verdictOf(pf)
  const d = pf.strategyViability?.diagnosis
  const sig = pf.signalMonetization?.diagnosis
  const agg = pf.parameterNeighborhood?.validation?.aggregate
  const reasons: (VerdictReason & { field: string })[] = [
    d
      ? { tone: verdict === 'fail' ? 'bad' : 'info', text: d.explanation, field: `strategyViability.diagnosis.stage = ${d.stage}` }
      : { tone: 'info', text: <NA why="strategyViability.diagnosis is not in the payload, so there is no server verdict" />, field: 'strategyViability.diagnosis' },
  ]
  if (sig) reasons.push({ tone: 'info', text: sig.explanation, field: `signalMonetization.diagnosis.outcome = ${sig.outcome}` })
  if (agg) {
    reasons.push({
      tone: 'info',
      text: `${up(agg.positiveNetSharpeRate, 0)} of ${agg.configurationCount} nearby configurations have a positive validation net Sharpe; ${up(agg.signAgreementWithBaseRate, 0)} share the base sign.`,
      field: 'parameterNeighborhood.validation.aggregate',
    })
  }
  const clause =
    finite(vSharpe) && finite(vBench) ? `Validation net Sharpe ${fn(vSharpe)} vs benchmark ${fn(vBench)}` : 'No validation net Sharpe is published for this Run.'
  const sentence =
    finite(vSharpe) && finite(vBench)
      ? `Validation net Sharpe ${fn(vSharpe)}, ${vSharpe - vBench >= 0 ? 'above' : 'below'} benchmark by ${fn(Math.abs(vSharpe - vBench), 1)}.${d ? ` Stage ${d.stage}.` : ''}`
      : 'No validation net Sharpe is published for this Run.'

  const portfolioRuns = project.runs.filter((r) => otherLaneOf(project, r.id)?.view === 'portfolio')
  const groups = metricGroups(pf, effective)
  const win = (k: 'train' | 'validation' | 'test') => {
    const w = pf.selection?.splits?.[k]
    return w ? `${day(w.start)} to ${day(w.end)}` : '—'
  }
  const facts: Fact[] = [
    { label: 'Project', value: <a href={routeHref({ view: 'project', id: project.id })}>{project.name}</a> },
    { label: 'Run', value: run?.id?.replace(/^run-/, '') ?? '—', mono: true },
    { label: 'Study', value: run?.studyId ?? '—', mono: true },
    { label: 'Universe', value: `${pf.universe?.length ?? '—'} assets` },
    { label: 'Mandate', value: pf.mandate?.family ?? '—', mono: true },
    { label: 'Benchmark', value: pf.mandate?.benchmark?.kind ?? '—', mono: true },
    { label: 'Selection split', value: pf.selection?.selectionSplit ?? 'validation', mono: true },
    { label: 'Test role', value: pf.selection?.testRole ?? '—', mono: true },
    { label: 'Train', value: win('train') },
    { label: 'Validation', value: win('validation') },
    ...(testVisible ? [{ label: 'Test', value: win('test') }] : []),
    { label: 'Sampled path', value: finite(pf.path?.sampledRows) ? `${pf.path?.sampledRows} of ${(pf.path?.totalRows ?? 0).toLocaleString('en-US')} rows` : '—' },
  ]

  const tabs: TabDef<TabId>[] = [
    { id: 'detail', label: 'Detail' },
    { id: 'viability', label: 'Viability and cost' },
    { id: 'neighborhood', label: 'Neighborhood' },
    { id: 'book', label: 'Book and exposure' },
    { id: 'transitions', label: 'Transitions', badge: String(transitions.length) },
    { id: 'episodes', label: 'Episodes', badge: String(episodes.length) },
    { id: 'path', label: 'Path data' },
  ]

  const netSplit = pf.strategyViability?.[effective]?.net
  const stats: Stat[] = netSplit
    ? [
        { label: 'Net Sharpe', value: signedNumber(netSplit.sharpe), signed: true, hint: `${effective} split, after costs` },
        { label: 'Net return', value: signedNumber(netSplit.totalReturn == null ? null : netSplit.totalReturn * 100, 2, '%'), signed: true, focal: true, hint: `Total return, ${effective} split, after costs` },
        { label: 'Max drawdown', value: signedNumber(netSplit.maximumDrawdown == null ? null : netSplit.maximumDrawdown * 100, 2, '%'), signed: true, hint: `${effective} split` },
      ]
    : []
  const runRow = project.runs.find((r) => r.id === run?.id)
  const duration = typeof runRow?.durationMs === 'number' ? `${(runRow.durationMs / 1000).toFixed(1)} s` : undefined
  const exportButton: ActionButton = testVisible
    ? { label: 'Export JSON', onClick: () => downloadJson(`${run?.id ?? 'portfolio'}-portfolio-evidence.json`, pf), title: 'Download the Portfolio evidence snapshot of this Run as JSON' }
    : { label: 'Export JSON', disabled: true, disabledReason: 'No test audit is published for this Run: the raw snapshot is exported only when every number in it may be shown.' }
  const resultActions: ActionButton[] = [
    { label: 'Parameters', onClick: () => setParamsOpen(true), title: 'Show the parameters of the Study and the Run' },
    { label: 'Open Project', href: routeHref({ view: 'project', id: project.id }) },
    ...(run?.id ? [{ label: 'Run summary', href: routeHref({ view: 'run', id: project.id, run: run.id }) }] : []),
    exportButton,
  ]

  const selector =
    portfolioRuns.length > 0 ? (
      <RunSelect bar compact label="Portfolio Run" runs={portfolioRuns} value={run?.id} onChange={(id) => go?.(routeHref({ view: 'run', id: project.id, run: id }))} />
    ) : (
      <span className="mono small faint">{run?.id?.replace(/^run-/, '') ?? '—'}</span>
    )
  const splitControl = (
    <span className="wb-split">
      <span>Split:</span>
      {toggle}
    </span>
  )
  const chips: Fact[] = facts.filter((f) => ['Project', 'Run', 'Study', 'Universe'].includes(f.label))
  const more: Fact[] = facts.filter((f) => !['Project', 'Run', 'Study', 'Universe'].includes(f.label))

  const right = (
    <PaneCard
      label="Results"
      actions={
        <div className="wb-resultbar">
          {selector}
          <StatChips label={`Headline numbers, ${effective} split`} scope={effective === 'test' ? 'Test · development' : 'Validation · development'} stats={stats} />
        </div>
      }
      status={
        <div className="fr-status">
          <ActionRow align="start" secondary={resultActions} />
          <VerdictBar tone="warn" word={WORD[verdict]} reasons={reasons.map((r) => ({ tone: r.tone, text: r.text, field: r.field }))} detail={sentence}>
            {clause}
          </VerdictBar>
          {runRow && (
            <StatusLine
              state={runRow.status === 'succeeded' ? 'done' : 'failed'}
              text={runRow.status === 'succeeded' ? `Run succeeded · ${when(runRow.startedAt)} UTC` : `Run ${runRow.status} · ${when(runRow.startedAt)} UTC`}
              elapsed={duration}
            />
          )}
        </div>
      }
    >
      <h1 className="type-page-title">Portfolio</h1>
      <FactChips
        label="What was run"
        locked
        variant="row"
        facts={chips}
        more={more}
        info={
          <>
            <p>These values come from the Study and the Run. They are read-only here. Research diagnostics of a mechanical strategy; no trading authority.</p>
            <p>
              Selection uses the {pf.selection?.selectionSplit ?? 'validation'} split only. Test is <span className="mono">{pf.selection?.testRole ?? '—'}</span>
              {pf.selection?.testEntersSelection === false ? ' and never enters selection' : ''}.
              {!testVisible && ' No test audit is published for this Run, so no test number is drawn on this page.'}
            </p>
          </>
        }
      />
      {points.length >= 2 ? (
        <FigureCard label="FIG A" subtitle="Published net growth and drawdown." caption={portfolioCaption(netSplit?.totalReturn, effective, testVisible)} development title="Growth and drawdown" info={<PortfolioChartInfo transitions={transitions.map((r) => r.timestamp)} note={hiddenNote} />} toggle={splitControl} minHeight={260}>
          {() => <PortfolioChart points={points} windows={windows} transitions={transitions.map((r) => r.timestamp)} totalRows={pf.path?.totalRows} sampledRows={pf.path?.sampledRows} />}
        </FigureCard>
      ) : (
        <Empty title="Not available">
          <p>not available: the Run publishes {allPoints.length} path points{testVisible ? '' : ' outside the test split'}, too few to draw a curve.</p>
        </Empty>
      )}
      {points.length < 2 && splitControl}
      {groups ? <MetricGrid groups={groups} hiddenNote={testVisible ? undefined : hiddenNote} /> : <p><NA why={`strategyViability.${effective}.net is not in the payload`} /></p>}
      <Tabs
        label="Portfolio sections"
        tabs={tabs}
        active={tab}
        onSelect={selectTab}
        panels={{
          detail: (
            <Section title="Verdict and metrics" id="pf-summary" caption={`Universe ${pf.universe?.length ?? '—'} assets; ${pf.mandate?.family ?? '—'} mandate; benchmark ${pf.mandate?.benchmark?.kind ?? '—'}.`}>
              <div className="vstack">
                <ul className="pf-reasons">
                  {reasons.map((r, i) => (
                    <li key={i}>
                      {r.text} <span className="faint small mono">{r.field}</span>
                    </li>
                  ))}
                </ul>
                {d && (
                  <p className="small muted">
                    Stage <span className="mono">{d.stage}</span>; next focus <span className="mono">{d.iterationFocus}</span>. Read from the server stage only. This lane never shows Pass: even the best stage still needs robustness checks and a fresh external holdout.
                  </p>
                )}
                {testVisible && effective === 'test' && (
                  <p className="small muted">
                    Test is a visible audit.
                    <Info label="About the test split">
                      <p>Test is a visible audit. It did not enter selection, and looking at it more than once spends the held-out evidence.</p>
                    </Info>
                  </p>
                )}
                <Block title="Whole sampled path (all splits)">
                  {sum && testVisible ? (
                    <Kv
                      rows={[
                        ['Net / gross / benchmark total return', `${sp(sum.netTotalReturn)} / ${sp(sum.grossTotalReturn)} / ${sp(sum.benchmarkTotalReturn)}`],
                        ['Max drawdown', `${sp(sum.maximumDrawdown)} on ${day(sum.maximumDrawdownAt)}`],
                        ['Total one-way turnover', `${fn(sum.totalOneWayTurnover, 1)}x; largest single day ${up(sum.maximumOneWayTurnover)}`],
                        ['Total cost', up(sum.totalCost, 2)],
                        ['Rebalance days', finite(sum.rebalanceDays) ? `${sum.rebalanceDays} of ${pf.path?.totalRows ?? '—'}` : '—'],
                      ]}
                    />
                  ) : (
                    <NA why={sum ? 'the whole-path summary mixes in the test split, and no test audit is published for this Run' : 'path.summary is not in the payload'} />
                  )}
                </Block>
                <Block title={`Benchmark and gross detail, ${effective} split`}>
                  <MetricDetail pf={pf} split={effective} />
                </Block>
              </div>
            </Section>
          ),
          viability: (
            <Section title="Viability and cost stress" id="pf-viability" caption="Gross against net, break-even cost and extra delay.">
              <ViabilityBlock pf={pf} split={effective} />
            </Section>
          ),
          neighborhood: (
            <Section title="Parameter neighborhood" id="pf-neighborhood" caption="Predeclared nearby configurations; context only.">
              <NeighborhoodBlock pf={pf} split={effective} />
            </Section>
          ),
          book: (
            <Section title="Current book and exposure" id="pf-book" caption="Last published decision date, with per-asset attribution.">
              <BookBlock pf={pf} split={effective} hiddenWhy={bookHidden} />
            </Section>
          ),
          transitions: (
            <Section title="Recent transitions" id="pf-transitions" caption={`${transitions.length} signal transitions.`}>
              <TransitionsTable rows={transitions} total={transitionsAll.length} />
            </Section>
          ),
          episodes: (
            <Section title="Recent episodes" id="pf-episodes" caption={`${episodes.length} position episodes.`}>
              <EpisodesTable rows={episodes} total={episodesAll.length} />
            </Section>
          ),
          path: (
            <Section title="Sampled daily path" id="pf-path" caption="The points the growth chart draws.">
              {points.length >= 2 ? <PathTable points={points} /> : <NA why="too few path points" />}
            </Section>
          ),
        }}
      />
      <FactsDialog open={paramsOpen} onClose={() => setParamsOpen(false)} title="Study and Run parameters" note="Read-only: they come from the Study and the Run." facts={facts} />
    </PaneCard>
  )

  return <WorkbenchShell right={right} />
}
