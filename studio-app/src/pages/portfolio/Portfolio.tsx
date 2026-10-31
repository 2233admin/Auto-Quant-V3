import { useState, type ReactNode } from 'react'
import type { ProjectSnapshot } from '../../api'
import { Glyph } from '../../design/icons'
import { Section, SectionNav } from '../../design/layout'
import { routeHref } from '../../route'
import { PortfolioChart, type SplitWindow } from './PortfolioChart'
import { BookBlock, EpisodesTable, NeighborhoodBlock, TransitionsTable, ViabilityBlock } from './PortfolioBlocks'
import type { PerfSummary, PortfolioDiagnostics } from './portfolioTypes'
import { Block, day, finite, fn, Kv, NA, SplitToggle, sp, up } from './pfmt'
import './portfolio.css'

type Split = 'validation' | 'test'
type Verdict = 'pass' | 'fail' | 'inconclusive'

/**
 * The server's own stage enum, nothing derived. The three non-positive stages are a fail. The one positive stage,
 * post-cost-edge-positive, is still inconclusive: the server's next step for it is robustness, capacity and a fresh
 * external holdout, so this lane has no "pass" state to show.
 */
const FAIL_STAGES = new Set(['factor-edge-absent', 'factor-not-monetized', 'cost-fragile'])
const WORD: Record<Verdict, string> = { pass: 'Pass', fail: 'Fail', inconclusive: 'Inconclusive' }
const GLYPH = { pass: 'supported', fail: 'refuted', inconclusive: 'inconclusive' } as const

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
  { key: 'annualVolatility', label: 'Annualized volatility', kind: 'pct', vsBench: true, gross: false },
  { key: 'expectedShortfall95', label: 'Expected shortfall 95%', kind: 'pct', vsBench: true, gross: false },
  { key: 'positiveRate', label: 'Positive-day rate', kind: 'pct', vsBench: true, gross: false },
  { key: 'activeAnnualReturn', label: 'Active return vs benchmark', kind: 'pct', vsBench: false, gross: false },
  { key: 'informationRatio', label: 'Information ratio', kind: 'num', vsBench: false, gross: false },
]

function Tile({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="pf-tile">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {children}
    </div>
  )
}

function MetricTiles({ pf, split }: { pf: PortfolioDiagnostics; split: Split }) {
  const v = pf.strategyViability?.[split]
  if (!v?.net) return <p><NA why={`strategyViability.${split}.net is not in the payload`} /></p>
  const fmt = (m: Metric, x: number | null | undefined) => (m.kind === 'pct' ? (m.key === 'maximumDrawdown' || m.key.endsWith('Return') ? sp(x) : up(x, 1)) : fn(x))
  const f = v.friction
  return (
    <dl className="pf-tiles">
      {METRICS.map((m) => {
        const net = v.net?.[m.key]
        const bench = v.benchmark?.[m.key]
        const gross = v.gross?.[m.key]
        const delta = finite(net) && finite(bench) ? net - bench : null
        return (
          <Tile key={m.key} label={m.label} value={fmt(m, net)}>
            {m.vsBench ? (
              finite(bench) ? (
                <>
                  <span className="pf-sub">benchmark {fmt(m, bench)}</span>
                  {delta !== null && (
                    <span className="pf-sub pf-delta">
                      {delta >= 0 ? 'above' : 'below'} benchmark by {m.kind === 'pct' ? `${fn(Math.abs(delta) * 100, 2)} pts` : fn(Math.abs(delta), 2)}
                    </span>
                  )}
                </>
              ) : (
                <span className="pf-sub"><NA why="no benchmark value is published" /></span>
              )
            ) : (
              <span className="pf-sub">relative to the benchmark by definition</span>
            )}
            {m.gross && finite(gross) && <span className="pf-sub">gross (no cost) {fmt(m, gross)}</span>}
          </Tile>
        )
      })}
      <Tile label="Annualized one-way turnover" value={finite(f?.annualizedOneWayTurnover) ? `${fn(f?.annualizedOneWayTurnover, 1)}x` : '—'}>
        <span className="pf-sub">traded notional per year, one way</span>
      </Tile>
      <Tile label="Total cost drag" value={up(f?.totalCostDrag, 2)}>
        <span className="pf-sub">at {finite(f?.baseCostBps) ? `${fn(f?.baseCostBps, 1)} bps` : '—'} per one-way trade</span>
      </Tile>
    </dl>
  )
}

function VerdictBand({ pf }: { pf: PortfolioDiagnostics }) {
  const verdict = verdictOf(pf)
  const d = pf.strategyViability?.diagnosis
  const sig = pf.signalMonetization?.diagnosis
  const agg = pf.parameterNeighborhood?.validation?.aggregate
  const reasons: { tone: 'bad' | 'info'; text: ReactNode; field: string }[] = []
  reasons.push(
    d
      ? { tone: verdict === 'fail' ? 'bad' : 'info', text: d.explanation, field: `strategyViability.diagnosis.stage = ${d.stage}` }
      : { tone: 'info', text: <NA why="strategyViability.diagnosis is not in the payload, so there is no server verdict" />, field: 'strategyViability.diagnosis' },
  )
  if (sig) reasons.push({ tone: 'info', text: sig.explanation, field: `signalMonetization.diagnosis.outcome = ${sig.outcome}` })
  if (agg) {
    reasons.push({
      tone: 'info',
      text: `${up(agg.positiveNetSharpeRate, 0)} of ${agg.configurationCount} nearby configurations have a positive validation net Sharpe; ${up(agg.signAgreementWithBaseRate, 0)} share the base sign.`,
      field: 'parameterNeighborhood.validation.aggregate',
    })
  }
  return (
    <section className={`verdict verdict--${verdict}`} aria-labelledby="pf-verdict-word">
      <div className="verdict-main">
        <p className="verdict-kicker">Verdict · validation split</p>
        <h2 id="pf-verdict-word" className="verdict-word">
          <Glyph kind={GLYPH[verdict]} signal={verdict === 'fail'} />
          <span>{WORD[verdict]}</span>
        </h2>
        <p className="muted small">
          {d ? (
            <>
              Stage <span className="mono">{d.stage}</span>; next focus <span className="mono">{d.iterationFocus}</span>.{' '}
            </>
          ) : null}
          Read from the server stage only. This lane never shows Pass: even the best stage still needs robustness checks and a fresh external holdout.
        </p>
      </div>
      <ul className="verdict-reasons">
        {reasons.map((r, i) => (
          <li key={i}>
            <Glyph kind={r.tone === 'bad' ? 'error' : 'empty'} signal={r.tone === 'bad'} />
            <span>
              {r.text}
              <span className="faint small mono verdict-field">{r.field}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PortfolioPage({ project }: { project: ProjectSnapshot }) {
  const pf = project.portfolioExplorer
  const [split, setSplit] = useState<Split>('validation')
  const head = (
    <header className="pg-head">
      <h1>Portfolio</h1>
      <p className="muted small">
        Project <a href={routeHref({ view: 'project', id: project.id })}>{project.name}</a>. Research diagnostics of a mechanical strategy; no trading authority.
      </p>
    </header>
  )
  if (!pf) {
    return (
      <div className="pg pf">
        {head}
        <div className="empty" role="status">
          <span className="badge">No evidence in this Project</span>
          <p>This Project has no Portfolio Run, so there is no net-growth curve, viability diagnosis or parameter neighborhood to draw. Nothing is estimated in its place.</p>
          <p className="small">
            <a href={routeHref({ view: 'project', id: project.id })}>Back to the Project</a>
          </p>
        </div>
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
  const hiddenNote = testVisible ? '' : 'Dates inside the test split are not drawn because no test audit is published for this Run.'

  const allPoints = (pf.path?.points ?? []).filter((p) => p.timestamp)
  const points = testVisible ? allPoints : allPoints.filter((p) => p.split !== 'test' && outsideTest(p.timestamp))
  const windows: SplitWindow[] = (['train', 'validation', 'test'] as const)
    .filter((k) => pf.selection?.splits?.[k] && (k !== 'test' || testVisible))
    .map((k) => ({
      split: k,
      label: `${k[0].toUpperCase()}${k.slice(1)} · ${k === 'train' ? 'training' : k === 'validation' ? 'selection' : 'visible audit'}`,
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

  return (
    <div className="pg pf">
      <header className="pg-head">
        <h1>Portfolio</h1>
        <p className="muted small">
          Project <a href={routeHref({ view: 'project', id: project.id })}>{project.name}</a>. Run <span className="mono">{run?.id?.replace(/^run-/, '') ?? '—'}</span> of study{' '}
          <span className="mono">{run?.studyId ?? '—'}</span>. Research diagnostics of a mechanical strategy; no trading authority.
        </p>
        <p className="muted small">
          Selection uses the {pf.selection?.selectionSplit ?? 'validation'} split only. Test is <span className="mono">{pf.selection?.testRole ?? '—'}</span>
          {pf.selection?.testEntersSelection === false ? ' and never enters selection' : ''}.
          {!testVisible && ' No test audit is published for this Run, so no test number is drawn on this page.'}
        </p>
      </header>

      <div className="band">
        <Section title="Summary" id="pf-summary" caption={`Universe ${pf.universe?.length ?? '—'} assets; ${pf.mandate?.family ?? '—'} mandate; benchmark ${pf.mandate?.benchmark?.kind ?? '—'}.`}>
          <div className="vstack">
            <VerdictBand pf={pf} />
            <div className="pf-bar">{toggle}</div>
            <MetricTiles pf={pf} split={effective} />
            {testVisible && effective === 'test' && (
              <p className="small muted">Test is a visible audit. It did not enter selection, and looking at it more than once spends the held-out evidence.</p>
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
          </div>
        </Section>
      </div>

      <SectionNav
        items={[
          { id: 'pf-curve', label: 'Curve' },
          { id: 'pf-viability', label: 'Viability and cost' },
          { id: 'pf-neighborhood', label: 'Neighborhood' },
          { id: 'pf-book', label: 'Book and exposure' },
          { id: 'pf-transitions', label: 'Transitions' },
          { id: 'pf-episodes', label: 'Episodes' },
        ]}
      />

      <Section title="Growth and drawdown" id="pf-curve">
        {points.length >= 2 ? (
          <PortfolioChart
            points={points}
            windows={windows}
            transitions={transitions.map((r) => r.timestamp)}
            totalRows={pf.path?.totalRows}
            sampledRows={pf.path?.sampledRows}
            note={hiddenNote}
          />
        ) : (
          <div className="empty" role="status">
            <span className="badge">Not available</span>
            <p>not available: the Run publishes {allPoints.length} path points{testVisible ? '' : ' outside the test split'}, too few to draw a curve.</p>
          </div>
        )}
      </Section>

      <Section title="Viability and cost stress" id="pf-viability" caption="Gross against net, break-even cost, extra delay and the server's diagnosis, as published.">
        <div className="vstack">
          <div className="pf-bar">{toggle}</div>
          <ViabilityBlock pf={pf} split={effective} />
        </div>
      </Section>

      <Section title="Parameter neighborhood" id="pf-neighborhood" caption="Predeclared nearby configurations. Context only, never a way to pick a better one.">
        <div className="vstack">
          <div className="pf-bar">{toggle}</div>
          <NeighborhoodBlock pf={pf} split={effective} />
        </div>
      </Section>

      <Section title="Current book and exposure" id="pf-book" caption="Last published decision date, with per-asset attribution.">
        <BookBlock pf={pf} split={effective} hiddenWhy={bookHidden} />
      </Section>

      <Section title="Recent transitions" id="pf-transitions" fold caption={`${transitions.length} signal transitions.`}>
        <TransitionsTable rows={transitions} total={transitionsAll.length} />
      </Section>

      <Section title="Recent episodes" id="pf-episodes" fold caption={`${episodes.length} position episodes.`}>
        <EpisodesTable rows={episodes} total={episodesAll.length} />
      </Section>
    </div>
  )
}
