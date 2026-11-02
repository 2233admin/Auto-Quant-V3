import { uiTemplate, uiText, uiValue } from '../../i18n'
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
import { MetricInfo } from '../../components/MetricInfo'
import type { MetricId } from '../../metrics/catalogue'
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

type Metric = { key: keyof PerfSummary; metric: MetricId; label: string; kind: 'pct' | 'num'; vsBench: boolean; gross: boolean }
const METRICS: Metric[] = [
  { key: 'totalReturn', metric: 'netTotalReturn', get label() { return uiText("Net total return") }, kind: 'pct', vsBench: true, gross: true },
  { key: 'annualReturn', metric: 'netAnnualReturn', get label() { return uiText("Net annualized return") }, kind: 'pct', vsBench: true, gross: true },
  { key: 'sharpe', metric: 'netSharpe', get label() { return uiText("Net Sharpe") }, kind: 'num', vsBench: true, gross: true },
  { key: 'sortino', metric: 'netSortino', get label() { return uiText("Net Sortino") }, kind: 'num', vsBench: true, gross: true },
  { key: 'maximumDrawdown', metric: 'maxDrawdown', get label() { return uiText("Max drawdown") }, kind: 'pct', vsBench: true, gross: true },
  { key: 'calmar', metric: 'calmar', get label() { return uiText("Calmar ratio") }, kind: 'num', vsBench: true, gross: false },
  { key: 'annualVolatility', metric: 'annualVolatility', get label() { return uiText("Annualized volatility") }, kind: 'pct', vsBench: true, gross: false },
  { key: 'expectedShortfall95', metric: 'expectedShortfall95', get label() { return uiText("Expected shortfall 95%") }, kind: 'pct', vsBench: true, gross: false },
  { key: 'positiveRate', metric: 'positiveRate', get label() { return uiText("Positive-day rate") }, kind: 'pct', vsBench: true, gross: false },
  { key: 'activeAnnualReturn', metric: 'activeReturn', get label() { return uiText("Active return vs benchmark") }, kind: 'pct', vsBench: false, gross: false },
  { key: 'informationRatio', metric: 'informationRatio', get label() { return uiText("Information ratio") }, kind: 'num', vsBench: false, gross: false },
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
export function portfolioMetricGroups(pf: PortfolioDiagnostics, split: Split): MetricGroup[] | null {
  const v = pf.strategyViability?.[split]
  if (!v?.net) return null
  const f = v.friction
  const label = split === 'validation' ? 'Validation · selection split' : 'Test · visible audit'
  return [
    {
      heading: label,
      label: uiTemplate("Core numbers, {0} split", [split]),
      tiles: [
        ...METRICS.filter((m) => m.key !== 'calmar' || finite(v.net?.calmar)).map((m) => {
          const bench = v.benchmark?.[m.key]
          return {
            label: SHORT[m.key] ?? m.label,
            value: fmtMetric(m, v.net?.[m.key]),
            info: m.vsBench && finite(bench) ? <p>{uiValue(m.label)}{uiText(". Benchmark value: ")}{fmtMetric(m, bench)}.</p> : m.label,
            metric: m.metric,
          }
        }),
        { label: uiText("1-way turnover / yr"), value: finite(f?.annualizedOneWayTurnover) ? `${fn(f?.annualizedOneWayTurnover, 1)}x` : '—', info: 'Annualized one-way turnover: traded notional per year, one way.', metric: 'turnover' },
        { label: uiText("Total cost drag"), value: up(f?.totalCostDrag, 2), info: `Total cost drag at ${finite(f?.baseCostBps) ? `${fn(f?.baseCostBps, 1)} bps` : '—'} per one-way trade.`, metric: 'costDrag' },
      ],
    },
  ]
}

/** The headline chips of the shown split, each tied to its catalogue definition. */
export function portfolioStats(netSplit: PerfSummary | null | undefined, effective: Split): Stat[] {
  return netSplit
    ? [
        { label: uiText("Net Sharpe"), value: signedNumber(netSplit.sharpe), signed: true, hint: uiTemplate("{0} split, after costs", [effective]), metric: 'netSharpe' },
        { label: uiText("Net return"), value: signedNumber(netSplit.totalReturn == null ? null : netSplit.totalReturn * 100, 2, '%'), signed: true, focal: true, hint: uiTemplate("Total return, {0} split, after costs", [effective]), metric: 'netTotalReturn' },
        { label: uiText("Max drawdown"), value: signedNumber(netSplit.maximumDrawdown == null ? null : netSplit.maximumDrawdown * 100, 2, '%'), signed: true, hint: uiTemplate("{0} split", [effective]), metric: 'maxDrawdown' },
      ]
    : []
}

/** Gross, net and benchmark side by side for every headline metric, behind a disclosure. */
export function MetricDetail({ pf, split }: { pf: PortfolioDiagnostics; split: Split }) {
  const v = pf.strategyViability?.[split]
  if (!v?.net) return <p><NA why={`strategyViability.${split}.net is not in the payload`} /></p>
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="small muted">{uiText("Net against benchmark and gross, ")}{split}{uiText(" split")}</caption>
        <thead>
          <tr>
            <th scope="col">{uiText("Metric")}</th>
            <th scope="col" className="r">{uiText("Net")}</th>
            <th scope="col" className="r">{uiText("Benchmark")}</th>
            <th scope="col" className="r">{uiText("Net minus benchmark")}</th>
            <th scope="col" className="r">{uiText("Gross (no cost)")}</th>
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
                <th scope="row">{uiValue(m.label)} <MetricInfo id={m.metric} label={uiValue(m.label)} /></th>
                <td className="r mono">{fmtMetric(m, net)}</td>
                <td className="r mono">{m.vsBench ? (finite(bench) ? fmtMetric(m, bench) : '—') : uiText("by definition")}</td>
                <td className="r mono">{delta === null ? '—' : m.kind === 'pct' ? uiTemplate("{0}{1} pts", [delta >= 0 ? '+' : '−', fn(Math.abs(delta) * 100, 2)]) : `${delta >= 0 ? '+' : '−'}${fn(Math.abs(delta), 2)}`}</td>
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

export function PortfolioPage({ project, go, embedded = false }: { project: ProjectSnapshot; go?: (href: string) => void; embedded?: boolean }) {
  const pf = project.portfolioExplorer
  const [split, setSplit] = useState<Split>('validation')
  const [paramsOpen, setParamsOpen] = useState(false)
  const detailTabs = embedded ? TAB_IDS.filter(id => id !== 'neighborhood') : TAB_IDS
  const [tab, selectTab, anchor] = useHashTab<TabId>(detailTabs, 'detail', ANCHOR_TAB)
  useEffect(() => {
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }))
  }, [anchor, tab])
  if (!pf) {
    return (
      <div className="pg pf">
        <header className="pg-head">
          <h1>{uiText("Portfolio")}</h1>
          <p className="muted small">{uiText("Project ")}<a href={routeHref({ view: 'project', id: project.id })}>{project.name}</a>{uiText(". Research diagnostics of a mechanical strategy; no trading authority.")}</p>
        </header>
        <Empty title={uiText("No evidence in this Project")}>
          <p>{uiText("This Project has no Portfolio Run, so there is no net-growth curve, viability diagnosis or parameter neighborhood to draw. Nothing is estimated in its place.")}</p>
          <p className="small">
            <a href={routeHref({ view: 'project', id: project.id })}>{uiText("Back to the Project")}</a>
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
  const hiddenNote = testVisible ? '' : uiText(TEST_HIDDEN_NOTE)

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
      text: uiTemplate("{0} of {1} nearby configurations have a positive validation net Sharpe; {2} share the base sign.", [up(agg.positiveNetSharpeRate, 0), agg.configurationCount, up(agg.signAgreementWithBaseRate, 0)]),
      field: 'parameterNeighborhood.validation.aggregate',
    })
  }
  const clause =
    finite(vSharpe) && finite(vBench) ? uiTemplate('Validation net Sharpe {0} vs benchmark {1}', [fn(vSharpe), fn(vBench)]) : uiText('No validation net Sharpe is published for this Run.')
  const sentence =
    finite(vSharpe) && finite(vBench)
      ? uiTemplate('Validation net Sharpe {0}, {1} benchmark by {2}.', [fn(vSharpe), uiText(vSharpe - vBench >= 0 ? 'above' : 'below'), fn(Math.abs(vSharpe - vBench), 1)]) + (d ? ` ${uiTemplate('Stage {0}.', [d.stage])}` : '')
      : uiText('No validation net Sharpe is published for this Run.')

  const portfolioRuns = project.runs.filter((r) => otherLaneOf(project, r.id)?.view === 'portfolio')
  const groups = portfolioMetricGroups(pf, effective)
  const win = (k: 'train' | 'validation' | 'test') => {
    const w = pf.selection?.splits?.[k]
    return w ? `${day(w.start)} to ${day(w.end)}` : '—'
  }
  const facts: Fact[] = [
    { label: uiText("Project"), value: <a href={routeHref({ view: 'project', id: project.id })}>{project.name}</a> },
    { label: uiText("Run"), value: run?.id?.replace(/^run-/, '') ?? '—', mono: true },
    { label: uiText("Study"), value: run?.studyId ?? '—', mono: true },
    { label: uiText("Universe"), value: uiTemplate('{0} assets', [pf.universe?.length ?? '—']) },
    { label: uiText("Mandate"), value: pf.mandate?.family ?? '—', mono: true },
    { label: uiText("Benchmark"), value: pf.mandate?.benchmark?.kind ?? '—', mono: true },
    { label: uiText("Selection split"), value: pf.selection?.selectionSplit ?? 'validation', mono: true },
    { label: uiText("Test role"), value: pf.selection?.testRole ?? '—', mono: true },
    { label: uiText("Train"), value: win('train') },
    { label: uiText("Validation"), value: win('validation') },
    ...(testVisible ? [{ label: uiText("Test"), value: win('test') }] : []),
    { label: uiText("Sampled path"), value: finite(pf.path?.sampledRows) ? `${pf.path?.sampledRows} of ${(pf.path?.totalRows ?? 0).toLocaleString('en-US')} rows` : '—' },
  ]

  const tabs: TabDef<TabId>[] = [
    { id: 'detail', label: uiText("Detail") },
    { id: 'viability', label: uiText("Viability and cost") },
    { id: 'neighborhood', label: uiText("Neighborhood") },
    { id: 'book', label: uiText("Book and exposure") },
    { id: 'transitions', label: uiText("Transitions"), badge: String(transitions.length) },
    { id: 'episodes', label: uiText("Episodes"), badge: String(episodes.length) },
    { id: 'path', label: uiText("Path data") },
  ]

  const netSplit = pf.strategyViability?.[effective]?.net
  const stats = portfolioStats(netSplit, effective)
  const runRow = project.runs.find((r) => r.id === run?.id)
  const duration = typeof runRow?.durationMs === 'number' ? `${(runRow.durationMs / 1000).toFixed(1)} s` : undefined
  const exportButton: ActionButton = testVisible
    ? { label: uiText("Export JSON"), onClick: () => downloadJson(`${run?.id ?? 'portfolio'}-portfolio-evidence.json`, pf), title: uiText("Download the Portfolio evidence snapshot of this Run as JSON") }
    : { label: uiText("Export JSON"), disabled: true, disabledReason: uiText("No test audit is published for this Run: the raw snapshot is exported only when every number in it may be shown.") }
  const resultActions: ActionButton[] = [
    { label: uiText("Parameters"), onClick: () => setParamsOpen(true), title: uiText("Show the parameters of the Study and the Run") },
    { label: uiText("Open Project"), href: routeHref({ view: 'project', id: project.id }) },
    ...(run?.id ? [{ label: uiText("Run summary"), href: routeHref({ view: 'run', id: project.id, run: run.id }) }] : []),
    exportButton,
  ]

  const selector =
    portfolioRuns.length > 0 ? (
      <RunSelect bar compact label={uiText("Portfolio Run")} runs={portfolioRuns} value={run?.id} onChange={(id) => go?.(routeHref({ view: 'run', id: project.id, run: id }))} />
    ) : (
      <span className="mono small faint">{run?.id?.replace(/^run-/, '') ?? '—'}</span>
    )
  const splitControl = (
    <span className="wb-split">
      <span>{uiText("Split:")}</span>
      {toggle}
    </span>
  )
  const chips: Fact[] = facts.filter((f) => ['Project', 'Run', 'Study', 'Universe'].map(uiText).includes(f.label))
  const more: Fact[] = facts.filter((f) => !['Project', 'Run', 'Study', 'Universe'].map(uiText).includes(f.label))

  const right = (
    <PaneCard
      label={uiText("Results")}
      actions={
        <div className="wb-resultbar">
          {selector}
          <StatChips label={uiTemplate("Headline numbers, {0} split", [effective])} scope={effective === 'test' ? 'Test · development' : 'Validation · development'} stats={stats} />
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
      {!embedded && <h1 className="type-page-title">{uiText("Portfolio")}</h1>}
      <FactChips
        label={uiText("What was run")}
        locked
        variant="row"
        facts={chips}
        more={more}
        info={
          <>
            <p>{uiText("These values come from the Study and the Run. They are read-only here. Research diagnostics of a mechanical strategy; no trading authority.")}</p>
            <p>{uiText("Selection uses the ")}{pf.selection?.selectionSplit ?? uiText("validation")}{uiText(" split only. Test is ")}<span className="mono">{pf.selection?.testRole ?? '—'}</span>
              {pf.selection?.testEntersSelection === false ? uiText(" and never enters selection") : ''}.
              {!testVisible && uiText(" No test audit is published for this Run, so no test number is drawn on this page.")}
            </p>
          </>
        }
      />
      {points.length >= 2 ? (
        <FigureCard label={uiText("FIG A")} subtitle={uiText("Published net growth and drawdown.")} caption={portfolioCaption(netSplit?.totalReturn, effective, testVisible)} development title={uiText("Growth and drawdown")} info={<PortfolioChartInfo transitions={transitions.map((r) => r.timestamp)} note={hiddenNote} />} toggle={splitControl} minHeight={260}>
          {() => <PortfolioChart points={points} windows={windows} transitions={transitions.map((r) => r.timestamp)} totalRows={pf.path?.totalRows} sampledRows={pf.path?.sampledRows} />}
        </FigureCard>
      ) : (
        <Empty title={uiText("Not available")}>
          <p>{uiText("not available: the Run publishes ")}{allPoints.length}{uiText(" path points")}{testVisible ? '' : uiText(" outside the test split")}{uiText(", too few to draw a curve.")}</p>
        </Empty>
      )}
      {points.length < 2 && splitControl}
      {groups ? <MetricGrid groups={groups} hiddenNote={testVisible ? undefined : hiddenNote} /> : <p><NA why={`strategyViability.${effective}.net is not in the payload`} /></p>}
      <Tabs
        label={uiText("Portfolio sections")}
        tabs={embedded ? tabs.filter(t => t.id !== 'neighborhood') : tabs}
        active={tab}
        onSelect={selectTab}
        panels={{
          detail: (
            <Section title={uiText("Verdict and metrics")} id="pf-summary" caption={uiTemplate("Universe {0} assets; {1} mandate; benchmark {2}.", [pf.universe?.length ?? '—', pf.mandate?.family ?? '—', pf.mandate?.benchmark?.kind ?? '—'])}>
              <div className="vstack">
                <ul className="pf-reasons">
                  {reasons.map((r, i) => (
                    <li key={i}>
                      {uiValue(r.text)} <span className="faint small mono">{r.field}</span>
                    </li>
                  ))}
                </ul>
                {d && (
                  <p className="small muted">{uiText("Stage ")}<span className="mono">{uiValue(d.stage)}</span>{uiText("; next focus ")}<span className="mono">{d.iterationFocus}</span>{uiText(". Read from the server stage only. This lane never shows Pass: even the best stage still needs robustness checks and a fresh external holdout.")}</p>
                )}
                {testVisible && effective === 'test' && (
                  <p className="small muted">{uiText("Test is a visible audit.")}<Info label={uiText("About the test split")}>
                      <p>{uiText("Test is a visible audit. It did not enter selection, and looking at it more than once spends the held-out evidence.")}</p>
                    </Info>
                  </p>
                )}
                <Block title={uiText("Whole sampled path (all splits)")}>
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
                <Block title={uiTemplate("Benchmark and gross detail, {0} split", [effective])}>
                  <MetricDetail pf={pf} split={effective} />
                </Block>
              </div>
            </Section>
          ),
          viability: (
            <Section title={uiText("Viability and cost stress")} id="pf-viability" caption={uiText("Gross against net, break-even cost and extra delay.")}>
              <ViabilityBlock pf={pf} split={effective} />
            </Section>
          ),
          neighborhood: (
            <Section title={uiText("Parameter neighborhood")} id="pf-neighborhood" caption={uiText("Predeclared nearby configurations; context only.")}>
              <NeighborhoodBlock pf={pf} split={effective} />
            </Section>
          ),
          book: (
            <Section title={uiText("Current book and exposure")} id="pf-book" caption={uiText("Last published decision date, with per-asset attribution.")}>
              <BookBlock pf={pf} split={effective} hiddenWhy={bookHidden} />
            </Section>
          ),
          transitions: (
            <Section title={uiText("Recent transitions")} id="pf-transitions" caption={uiTemplate("{0} signal transitions.", [transitions.length])}>
              <TransitionsTable rows={transitions} total={transitionsAll.length} />
            </Section>
          ),
          episodes: (
            <Section title={uiText("Recent episodes")} id="pf-episodes" caption={uiTemplate("{0} position episodes.", [episodes.length])}>
              <EpisodesTable rows={episodes} total={episodesAll.length} />
            </Section>
          ),
          path: (
            <Section title={uiText("Sampled daily path")} id="pf-path" caption={uiText("The points the growth chart draws.")}>
              {points.length >= 2 ? <PathTable points={points} /> : <NA why="too few path points" />}
            </Section>
          ),
        }}
      />
      <FactsDialog open={paramsOpen} onClose={() => setParamsOpen(false)} title={uiText("Study and Run parameters")} note={uiText("Read-only: they come from the Study and the Run.")} facts={facts} />
    </PaneCard>
  )

  return embedded ? right : <WorkbenchShell right={right} />
}
