import { useState, type ReactNode } from 'react'
import type { ProjectSnapshot } from '../../api'
import { Info } from '../../components/Info'
import { MetricTile } from '../../components/MetricTile'
import { HeroLine, HeroTiles, type HeroTile } from '../hero'
import { VerdictBand, type Reason, type Verdict } from '../../components/VerdictBand'
import { Section, SectionNav } from '../../design/layout'
import { routeHref } from '../../route'
import type { SplitWindow } from '../portfolio/PortfolioChart'
import { Block, day, finite, fn, Kv, NA, SplitToggle, sn, sp, up } from '../portfolio/pfmt'
import { AllocationChart } from './AllocationChart'
import type { AllocationDiagnostics, AllocPerf, FidelitySplit, Weights } from './allocationTypes'
import '../portfolio/portfolio.css'
import './allocation.css'
import { Empty } from '../../components/States'

type Split = 'validation' | 'test'

/** The server's own conclusion enum: `supported` when the validation net Sharpe advantage is above zero, otherwise `rejected`. */
function verdictOf(a: AllocationDiagnostics): { verdict: Verdict; word: string } {
  const s = a.conclusion?.status
  if (s === 'supported') return { verdict: 'pass', word: 'Supported' }
  if (s === 'rejected') return { verdict: 'fail', word: 'Rejected' }
  return { verdict: 'inconclusive', word: 'Unavailable' }
}

const words = (s: string | undefined) => (s ? s.replaceAll('-', ' ').replaceAll('_', ' ') : '—')

type Metric = { key: keyof AllocPerf; label: string; kind: 'pct' | 'num'; cmp?: 'netSharpeAdvantage' | 'annualReturnAdvantage' | 'annualVolatilityDifference' | 'maximumDrawdownDifference' }
const METRICS: Metric[] = [
  { key: 'sharpe', label: 'Net Sharpe', kind: 'num', cmp: 'netSharpeAdvantage' },
  { key: 'sortino', label: 'Net Sortino', kind: 'num' },
  { key: 'total_return', label: 'Net total return', kind: 'pct' },
  { key: 'annual_return', label: 'Net annualized return', kind: 'pct', cmp: 'annualReturnAdvantage' },
  { key: 'annual_volatility', label: 'Annualized volatility', kind: 'pct', cmp: 'annualVolatilityDifference' },
  { key: 'maximum_drawdown', label: 'Max drawdown', kind: 'pct', cmp: 'maximumDrawdownDifference' },
  { key: 'calmar', label: 'Calmar', kind: 'num' },
  { key: 'expected_shortfall_95', label: 'Expected shortfall 95%', kind: 'pct' },
  { key: 'positive_rate', label: 'Positive-day rate', kind: 'pct' },
  { key: 'benchmark_beta', label: 'Beta to the benchmark', kind: 'num' },
  { key: 'tracking_error', label: 'Tracking error', kind: 'pct' },
  { key: 'active_annual_return', label: 'Active return vs benchmark', kind: 'pct' },
  { key: 'information_ratio', label: 'Information ratio', kind: 'num' },
]

function PerfTiles({ a, split }: { a: AllocationDiagnostics; split: Split }) {
  const s = a.splits?.[split]
  if (!s?.candidate) return <p><NA why={`splits.${split}.candidate is not in the payload`} /></p>
  const fmt = (m: Metric, v: number | null | undefined) => (m.kind === 'pct' ? (m.key === 'positive_rate' || m.key === 'annual_volatility' || m.key === 'expected_shortfall_95' || m.key === 'tracking_error' ? up(v, 2) : sp(v)) : fn(v))
  return (
    <dl className="hm-grid">
      {METRICS.map((m) => {
        const c = s.candidate?.[m.key]
        const r = s.reference?.[m.key]
        const cmp = m.cmp ? s.comparison?.[m.cmp] : undefined
        const delta = finite(cmp) ? `${m.kind === 'pct' ? `${sn(cmp * 100, 2)} pts` : sn(cmp, 2)} vs reference` : undefined
        return (
          <MetricTile
            key={m.key}
            label={m.label}
            value={fmt(m, c)}
            delta={delta}
            note={finite(r) ? `reference ${fmt(m, r)}` : <NA why="the reference value is not published" />}
          />
        )
      })}
    </dl>
  )
}

function ImplementationTiles({ a, split }: { a: AllocationDiagnostics; split: Split }) {
  const i = a.implementation?.[split]
  if (!i) return <p><NA why={`implementation.${split} is not in the payload`} /></p>
  return (
    <dl className="hm-grid">
      <MetricTile label="Annualized one-way turnover" value={finite(i.candidateAnnualizedOneWayTurnover) ? `${fn(i.candidateAnnualizedOneWayTurnover, 2)}x` : '—'} note={finite(i.referenceAnnualizedOneWayTurnover) ? `reference ${fn(i.referenceAnnualizedOneWayTurnover, 2)}x` : undefined} />
      <MetricTile label="Total cost" value={up(i.candidateTotalCost, 3)} note={finite(i.referenceTotalCost) ? `reference ${up(i.referenceTotalCost, 3)}` : undefined} />
      <MetricTile label="Max forecast volatility" value={up(i.candidateMaximumForecastVolatility, 2)} note={finite(i.candidateRiskLimit) ? `ceiling ${up(i.candidateRiskLimit, 1)}` : undefined} />
      <MetricTile
        label="Risk-ceiling breaches"
        value={finite(i.candidateRiskBreaches) ? String(i.candidateRiskBreaches) : '—'}
        tone={finite(i.candidateRiskBreaches) && i.candidateRiskBreaches > 0 ? 'weak' : 'neutral'}
        toneReason={finite(i.candidateRiskBreaches) && i.candidateRiskBreaches > 0 ? 'above zero' : undefined}
      />
    </dl>
  )
}

function Bar({ w }: { w: number | null | undefined }) {
  return (
    <span className="al-bar" aria-hidden="true">
      <i style={{ width: `${finite(w) ? Math.max(0, Math.min(1, w)) * 100 : 0}%` }} />
    </span>
  )
}

function WeightsTable({ a, hiddenWhy }: { a: AllocationDiagnostics; hiddenWhy: string | null }) {
  if (hiddenWhy) return <NA why={hiddenWhy} />
  const ld = a.latestDecision
  const cs = a.currentState
  const universe = a.contract?.universe ?? Object.keys(ld?.targetWeights ?? {})
  if (!universe.length || (!ld && !cs)) return <NA why="latestDecision and currentState are not in the payload" />
  const tradable = new Set(a.contract?.tradableAssets ?? universe)
  const get = (w: Weights | null | undefined, k: string) => w?.[k]
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="small muted">
          Weights as fractions of the book. Decision {day(ld?.asOf)}; current state {day(cs?.asOf)}. Context-only assets carry no weight by construction.
        </caption>
        <thead>
          <tr>
            <th scope="col">Asset</th>
            <th scope="col">Role</th>
            <th scope="col" className="r">Latest ERC target</th>
            <th scope="col" className="r">Latest executed</th>
            <th scope="col" className="r">Risk contribution share</th>
            <th scope="col" className="r">Current drifted</th>
            <th scope="col" className="r">Reference latest</th>
            <th scope="col" className="r">Reference current</th>
          </tr>
        </thead>
        <tbody>
          {universe.map((k) => (
            <tr key={k}>
              <th scope="row">{k}{!tradable.has(k) && <span className="faint small"> context only</span>}</th>
              <td className="muted">{a.contract?.assetPositionRoles?.[k] ?? '—'}</td>
              <td className="r"><span className="al-cell"><Bar w={get(ld?.targetWeights, k)} />{up(get(ld?.targetWeights, k), 2)}</span></td>
              <td className="r"><span className="al-cell"><Bar w={get(ld?.executedWeights, k)} />{up(get(ld?.executedWeights, k), 2)}</span></td>
              <td className="r">{up(get(ld?.targetRiskContributionShares, k), 2)}</td>
              <td className="r"><span className="al-cell"><Bar w={get(cs?.candidatePretradeWeights, k)} />{up(get(cs?.candidatePretradeWeights, k), 2)}</span></td>
              <td className="r">{up(get(ld?.referenceWeights, k), 2)}</td>
              <td className="r">{up(get(cs?.referencePretradeWeights, k), 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FidelityTable({ a, testVisible }: { a: AllocationDiagnostics; testVisible: boolean }) {
  const f = a.constructionFidelity
  if (!f?.bySplit) return <NA why="constructionFidelity.bySplit is not in the payload" />
  const names = (['train', 'validation', 'test'] as const).filter((k) => f.bySplit?.[k] && (k !== 'test' || testVisible))
  const rows: [string, (s: FidelitySplit) => ReactNode][] = [
    ['Scheduled decisions', (s) => s.scheduledDecisions ?? '—'],
    ['Eligible decisions', (s) => s.eligibleDecisions ?? '—'],
    ['Within tolerance', (s) => s.withinToleranceDecisions ?? '—'],
    ['Cap-induced parity gap', (s) => s.capInducedParityGapDecisions ?? '—'],
    ['Within-tolerance rate', (s) => (finite(s.withinToleranceRate) ? up(s.withinToleranceRate, 1) : <NA why="no eligible decision" />)],
    ['Max contribution error', (s) => (finite(s.maximumContributionError) ? s.maximumContributionError.toExponential(2) : '—')],
    ['Latest eligible decision', (s) => (s.latestEligibleDecision ? `${day(s.latestEligibleDecision.asOf)} · ${words(s.latestEligibleDecision.status)}` : <NA why="no eligible decision" />)],
    ['Cap-binding assets (latest)', (s) => (s.latestEligibleDecision ? s.latestEligibleDecision.capBindingAssets?.join(', ') || 'none' : '—')],
  ]
  return (
    <div className="tablewrap">
      <table className="tbl">
        <caption className="small muted">
          Does the solver reach equal risk contribution within the {finite(f.tolerance) ? up(f.tolerance, 1) : '—'} tolerance on each scheduled decision? A cap-induced gap is shown as a gap, never as exact parity. This is separate from the performance conclusion.
        </caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            {names.map((n) => <th scope="col" className="r" key={n}>{n[0].toUpperCase() + n.slice(1)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, get]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {names.map((n) => <td className="r" key={n}>{get(f.bySplit?.[n] ?? {})}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AllocationPage({ project }: { project: ProjectSnapshot }) {
  const a = project.allocationExplorer as AllocationDiagnostics | null
  const [split, setSplit] = useState<Split>('validation')
  const back = routeHref({ view: 'project', id: project.id })
  if (!a) {
    return (
      <div className="pg al">
        <header className="pg-head">
          <h1>Strategic allocation</h1>
          <p className="muted small">Project <a href={back}>{project.name}</a>. Research diagnostics of a mechanical allocation; no trading authority.</p>
        </header>
        <Empty title="No evidence in this Project">
          <p>This Project has no Allocation Run, so there is no equal-risk-contribution comparison, construction-fidelity audit or current book to draw. Nothing is estimated in its place.</p>
          <p className="small"><a href={back}>Back to the Project</a></p>
        </Empty>
      </div>
    )
  }

  // Visibility rule: a test number is drawn only when the protocol calls test a visible audit AND the server published the test block.
  const testRange = a.splitProtocol?.splits?.test
  const testVisible = a.splitProtocol?.testRole === 'visible-audit-only' && !!a.splits?.test?.candidate
  const effective: Split = testVisible ? split : 'validation'
  const outsideTest = (d: string | undefined) => testVisible || !testRange?.start || !d || d < testRange.start
  const hiddenNote = testVisible ? '' : 'Dates inside the test split are not drawn because no test audit is published for this Run.'
  const toggle = <SplitToggle value={effective} onChange={setSplit} testVisible={testVisible} />

  const allPoints = (a.path ?? []).filter((p) => p.timestamp)
  const points = allPoints.filter((p) => outsideTest(p.timestamp))
  const windows: SplitWindow[] = (['train', 'validation', 'test'] as const)
    .filter((k) => a.splitProtocol?.splits?.[k] && (k !== 'test' || testVisible))
    .map((k) => ({
      split: k,
      label: `${k[0].toUpperCase()}${k.slice(1)} · ${k === 'train' ? 'training' : k === 'validation' ? 'selection' : 'visible audit'}`,
      start: Date.parse(a.splitProtocol?.splits?.[k]?.start ?? ''),
      end: Date.parse(a.splitProtocol?.splits?.[k]?.end ?? ''),
    }))
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end))

  const { verdict, word } = verdictOf(a)
  const c = a.conclusion
  const vf = a.constructionFidelity?.bySplit?.validation
  const reasons: Reason[] = [
    c?.statement
      ? { tone: verdict === 'fail' ? 'bad' : 'info', text: c.statement, field: `conclusion.status = ${c.status}` }
      : { tone: 'info', text: <NA why="conclusion is not in the payload, so there is no server verdict" />, field: 'conclusion' },
  ]
  if (finite(c?.validationNetSharpeAdvantage)) {
    reasons.push({
      tone: c.validationNetSharpeAdvantage < 0 ? 'bad' : 'info',
      text: `Validation net Sharpe advantage of the candidate over the fixed reference: ${sn(c.validationNetSharpeAdvantage, 2)}. Selection uses validation only; test never enters it.`,
      field: 'conclusion.validationNetSharpeAdvantage',
    })
  }
  if (vf) {
    reasons.push({
      tone: 'info',
      text: `Construction fidelity on validation: ${vf.withinToleranceDecisions ?? '—'} of ${vf.eligibleDecisions ?? '—'} eligible decisions reach equal risk contribution within tolerance${(vf.capInducedParityGapDecisions ?? 0) > 0 ? `; ${vf.capInducedParityGapDecisions} show a cap-induced gap` : ''}. A separate question from performance.`,
      field: 'constructionFidelity.bySplit.validation',
    })
  }
  const cs = a.currentState
  const bookDate = a.latestDecision?.asOf
  const bookHidden = !outsideTest(bookDate) || !outsideTest(cs?.asOf) ? `the book is dated ${day(cs?.asOf ?? bookDate)}, inside the test split, and no test audit is published for this Run` : null

  const perf = a.splits?.[effective]
  const pfmt = (m: Metric, v: number | null | undefined) =>
    m.kind === 'pct' ? (m.key === 'positive_rate' || m.key === 'annual_volatility' || m.key === 'expected_shortfall_95' || m.key === 'tracking_error' ? up(v, 2) : sp(v)) : fn(v)
  const coreKeys: Metric['key'][] = ['sharpe', 'total_return', 'maximum_drawdown', 'annual_volatility', 'calmar', 'active_annual_return']
  const tiles: HeroTile[] = coreKeys.map((key) => {
    const m = METRICS.find((x) => x.key === key)!
    const r = perf?.reference?.[key]
    return { label: m.label, value: pfmt(m, perf?.candidate?.[key]), note: finite(r) ? `reference ${pfmt(m, r)}` : undefined }
  })
  const adv = c?.validationNetSharpeAdvantage
  const headText = c?.statement
    ? `${c.statement.replace(/\.$/, '')}${finite(adv) ? ` (net Sharpe advantage ${sn(adv, 2)})` : ''}`
    : 'no server conclusion is published for this Run'

  return (
    <div className="pg al">
      <header className="pg-head">
        <h1>Strategic allocation</h1>
        <p className="muted small">
          Project <a href={back}>{project.name}</a> · Run <span className="mono">{a.run?.id?.replace(/^run-/, '') ?? '—'}</span>
          <Info label="About this page">
            <p>
              Equal-risk-contribution construction against a fixed-weight reference. Research diagnostics; no trading authority. Selection uses the {a.splitProtocol?.selectionSplit ?? 'validation'} split only.
              Test is <span className="mono">{a.splitProtocol?.testRole ?? '—'}</span>
              {c?.testUsedForSelection === false ? ' and is never used for selection' : ''}.
              {!testVisible && ' No test audit is published for this Run, so no test number is drawn on this page.'}
            </p>
          </Info>
        </p>
      </header>

      <SectionNav
        items={[
          { id: 'al-summary', label: 'Verdict and metrics' },
          { id: 'al-impl', label: 'Implementation' },
          { id: 'al-book', label: 'Book and weights' },
          { id: 'al-fidelity', label: 'Construction fidelity' },
          { id: 'al-contract', label: 'Contract' },
          { id: 'al-prov', label: 'Provenance' },
        ]}
      />

      <div className="hero-stack">
        <HeroLine
          tone={verdict === 'fail' ? 'bad' : verdict === 'pass' ? 'ok' : 'warn'}
          word={word}
          why={
            <Info label="Why this verdict">
              <p>Read from the server conclusion enum only. {c?.selectionBasis ? <>Basis <span className="mono">{c.selectionBasis}</span>. </> : null}It says how the candidate compared with the reference, nothing about trading.</p>
              <p className="faint mono">conclusion.status = {c?.status ?? '—'}</p>
            </Info>
          }
        >
          {headText}
        </HeroLine>

        <section aria-labelledby="al-path" className="pf-hero-chart">
          <div className="pf-hero-head">
            <h2 id="al-path">Daily path</h2>
            {toggle}
          </div>
          {points.length >= 2 ? (
            <AllocationChart points={points} windows={windows} ceiling={a.contract?.portfolioPolicy?.annualizedVolatilityCeiling} totalRows={a.dataset?.observations} sampledRows={allPoints.length} note={hiddenNote} />
          ) : (
            <Empty title="Not available">
              <p>not available: the Run publishes {allPoints.length} path points{testVisible ? '' : ' outside the test split'}, too few to draw a path.</p>
            </Empty>
          )}
        </section>

        <HeroTiles items={tiles} label={`Core numbers, ${effective} split`} />
      </div>

      <div className="band">
        <Section
          title="Verdict and metrics"
          id="al-summary"
          caption={`${a.contract?.tradableAssets?.length ?? '—'} tradable assets; ${words(a.contract?.method?.kind)}; benchmark ${words(a.contract?.benchmark?.kind)}; ${a.dataset?.observations ?? '—'} daily rows.`}
        >
          <div className="vstack">
            <VerdictBand
              id="al-verdict-word"
              kicker="Verdict · validation split · relative performance only"
              verdict={verdict}
              word={word}
              detail={<>{c?.selectionBasis ? <>Basis <span className="mono">{c.selectionBasis}</span>.</> : null}</>}
              reasons={reasons}
            />
            <details className="pf-allmetrics">
              <summary>All {effective} metrics</summary>
              <PerfTiles a={a} split={effective} />
            </details>
            {testVisible && effective === 'test' && (
              <p className="small muted">
                Test is a visible audit.
                <Info label="About the test split">
                  <p>Test is a visible audit. It did not enter selection, and looking at it more than once spends the held-out evidence.</p>
                </Info>
              </p>
            )}
          </div>
        </Section>
      </div>

      <Section title="Implementation and cost" id="al-impl" caption="Turnover, cost and the volatility ceiling.">
        <div className="vstack">
          <div className="al-bar-row">{toggle}</div>
          <ImplementationTiles a={a} split={effective} />
        </div>
      </Section>

      <Section title="Book and weights" id="al-book" caption="Last decision, drifted current book and reference.">
        <div className="vstack">
          <Block title="Current state">
            {cs && !bookHidden ? (
              <Kv
                rows={[
                  ['As of', day(cs.asOf)],
                  ['Ordinary rebalance', cs.ordinaryRebalanceDue === undefined ? '—' : cs.ordinaryRebalanceDue ? 'due' : 'hold'],
                  ['Candidate execution reason', words(cs.candidateExecutionReason)],
                  ['Reference execution reason', words(cs.referenceExecutionReason)],
                  ['Candidate forecast volatility', up(cs.candidateForecastAnnualizedVolatility, 2)],
                  ['Latest decision', `${day(a.latestDecision?.asOf)} · ${words(a.latestDecision?.status)}${a.latestDecision?.solverConverged === false ? ' · solver did not converge' : ''}`],
                  ['Latest forecast volatility', up(a.latestDecision?.forecastAnnualizedVolatility, 2)],
                  ['Latest max contribution error', finite(a.latestDecision?.maximumContributionError) ? a.latestDecision.maximumContributionError.toExponential(2) : '—'],
                  ['Scheduled target', cs.scheduledTargetWeights ? 'published below in the target column' : 'none (a hold date publishes no scheduled target)'],
                ]}
              />
            ) : (
              <NA why={bookHidden ?? 'currentState is not in the payload'} />
            )}
          </Block>
          <WeightsTable a={a} hiddenWhy={bookHidden} />
        </div>
      </Section>

      <Section title="Construction fidelity" id="al-fidelity" caption="Equal risk contribution reached, by split.">
        <div className="vstack">
          <FidelityTable a={a} testVisible={testVisible} />
          {a.solver && (
            <Block title="Solver totals (all splits)">
              <Kv
                rows={[
                  ['Scheduled decisions', String(a.solver.scheduledDecisions ?? '—')],
                  ['Eligible decisions', String(a.solver.eligibleDecisions ?? '—')],
                  ['Within tolerance', String(a.solver.withinToleranceDecisions ?? '—')],
                  ['Cap-induced parity gap', String(a.solver.capInducedParityGapDecisions ?? '—')],
                ]}
              />
            </Block>
          )}
        </div>
      </Section>

      <Section title="Contract" id="al-contract" fold caption="Method, policy, benchmark and splits.">
        <div className="cols">
          <Block title="Construction and policy">
            <Kv
              rows={[
                ['Method', words(a.contract?.method?.kind)],
                ['Covariance window', a.contract?.method?.covarianceWindow ? `${a.contract.method.covarianceWindow} bars (minimum ${a.contract.method.minimumObservations ?? '—'})` : '—'],
                ['Contribution tolerance', up(a.contract?.method?.contributionTolerance, 1)],
                ['Scale up', a.contract?.method?.scaleUp === undefined ? '—' : a.contract.method.scaleUp ? 'allowed' : 'never'],
                ['Volatility ceiling', up(a.contract?.portfolioPolicy?.annualizedVolatilityCeiling, 1)],
                ['Gross limit / default cap', `${fn(a.contract?.portfolioPolicy?.grossLimit, 2)} / ${up(a.contract?.portfolioPolicy?.maxAbsWeight, 1)}`],
                ['Base cost / no-trade band', `${fn(a.contract?.portfolioPolicy?.baseCostBps, 1)} bps / ${up(a.contract?.portfolioPolicy?.noTradeOneWay, 1)}`],
                ['Decision schedule', words(a.contract?.portfolioPolicy?.decisionSchedule?.kind)],
                ['Reference NAV', finite(a.contract?.portfolioPolicy?.referenceNav) ? a.contract.portfolioPolicy.referenceNav.toLocaleString('en-US') : '—'],
                ['Authority', `${words(a.contract?.authority)}; trading ${a.contract?.tradingAuthority ?? '—'}`],
              ]}
            />
          </Block>
          <Block title="Benchmark and splits">
            <Kv
              rows={[
                ['Benchmark', words(a.contract?.benchmark?.kind)],
                ...Object.entries(a.contract?.benchmark?.weights ?? {}).map(([k, v]): [string, ReactNode] => [`  ${k}`, up(v, 1)]),
                ['Split method', words(a.splitProtocol?.method)],
                ...(['train', 'validation', 'test'] as const)
                  .filter((k) => a.splitProtocol?.splits?.[k] && (k !== 'test' || testVisible))
                  .map((k): [string, ReactNode] => [k, `${day(a.splitProtocol?.splits?.[k]?.start)} to ${day(a.splitProtocol?.splits?.[k]?.end)} · ${a.splitProtocol?.splits?.[k]?.observations ?? '—'} rows`]),
              ]}
            />
          </Block>
        </div>
      </Section>

      <Section title="Provenance and verification" id="al-prov" fold caption="Run identity and server re-derivation.">
        <div className="cols">
          <Block title="Run and dataset">
            <Kv
              rows={[
                ['Run', a.run?.id ?? '—'],
                ['Input hash', <span className="mono small" key="h">{a.run?.inputHash?.slice(0, 16) ?? '—'}</span>],
                ['Harness', a.run?.harness?.version ? `${a.run.harness.version} (${a.run.harness.commit?.slice(0, 7) ?? '—'})` : '—'],
                ['Dataset', `${a.dataset?.id ?? '—'} ${a.dataset?.version ?? ''}`],
                ['Time range', `${day(a.dataset?.timeRange?.start)} to ${day(a.dataset?.timeRange?.end)}`],
                ...Object.entries(a.artifacts ?? {}).map(([k, v]): [string, ReactNode] => [k, <span className="mono small" key={k}>{v.path}</span>]),
              ]}
            />
          </Block>
          <Block title="Server re-derivation">
            {a.verification ? (
              <Kv rows={Object.entries(a.verification).map(([k, v]): [string, ReactNode] => [k.replace(/([A-Z])/g, ' $1').toLowerCase(), v === true ? 'yes' : v === false ? 'no' : String(v)])} />
            ) : (
              <NA why="verification is not in the payload" />
            )}
          </Block>
        </div>
      </Section>
    </div>
  )
}
