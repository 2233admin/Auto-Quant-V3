import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FactorDiagnostics, ProjectSnapshot, RunRow } from '../src/api'
import type { Idea } from '../src/actions/ideaApi'
import { setLanguage } from '../src/i18n'
import { METRIC_CATALOGUE, METRIC_IDS, READING_TEXTS, readingOrder, type Bi } from '../src/metrics/catalogue'
import { MetricGrid, StatChips } from '../src/components/workbench'
import { HeadlineMetrics } from '../src/components/HeadlineMetrics'
import { coreGroups } from '../src/pages/FactorWorkbench'
import { spreadGroups } from '../src/pages/GroupReturn'
import { factorStats } from '../src/pages/Factor'
import { FoldTable, HorizonTable, QualificationBlock, StabilityTables, VerdictReasons } from '../src/pages/FactorEvidence'
import { IdeaVerdict } from '../src/pages/IdeaVerdict'
import { runMetricGroups } from '../src/pages/run/RunPage'
import { MetricDetail, portfolioMetricGroups, portfolioStats } from '../src/pages/portfolio/Portfolio'
import type { PortfolioDiagnostics } from '../src/pages/portfolio/portfolioTypes'
import { LibraryCard } from '../src/library/LibraryCards'
import { StrategyTuning } from '../src/pages/strategy/StrategyTuning'
import { ComparisonResults } from '../src/pages/compare/ComparisonResults'
import type { Comparison, HistoryRun } from '../src/library/runHistoryApi'

const CJK = /[㐀-鿿]/
const HIDDEN = /876\.5432|9876|99999/

// ---------------------------------------------------------------------------------------------
// Fixtures: validation numbers are ordinary, every test-split number is a sentinel that must never render when hidden.

const rank = { meanRankIc: 0.12, meanPearsonIc: 0.11, pearsonIcir: 0.4, hacTStatistic: 2.5, hacNormalPValue: 0.01, rankHitRate: 0.6, rankIcir: 0.5, rankIcStandardDeviation: 0.2, observations: 30, minimumObservations: 20, sufficient: true }
const hiddenRank = { ...rank, meanRankIc: 876.5432, observations: 99999 }
const fold = (id: string, split: string, r = rank) => ({ ...r, id, split, role: split })
const variants = (r: typeof rank) => ({ role: 'validation', candidate: r, dominantStyle: r, styleNeutralCandidate: r, equalRankBlend: r, incremental: { styleNeutralIcRetention: 0.8, styleNeutralIcDelta: -0.02, blendUpliftVsStyle: 0.03, blendUpliftVsCandidate: 0.01 }, candidateChronologicalFolds: [], weakestCandidateFold: null })

function study(testRole = 'sealed'): FactorDiagnostics {
  return {
    run: { id: 'run-one', studyId: 'ohlcv-factor-quality' },
    dataset: { id: 'd', version: '1', universe: ['A', 'B', 'C', 'D'], timeRange: null },
    protocol: { primaryHorizon: 1, horizons: [1, 5], testRole, selectionSplit: 'validation', testEntersSelection: false, semantics: { inference: 'HAC inference.', measure: 'Rank IC.' }, splits: { method: 'chronological', candidateDependent: false, targetCrossesBoundary: false, splits: { train: { start: '2024-01-01', end: '2024-01-31', rows: 30, role: 'train' }, validation: { start: '2024-02-01', end: '2024-02-28', rows: 30, role: 'selection' }, test: { start: '2099-12-01', end: '2099-12-31', rows: 30, role: 'test' } }, horizons: {} } },
    summary: { validation: rank, testAudit: hiddenRank, weakestValidationFold: { id: 'validation_1', meanRankIc: 0.1 } },
    predictionUniverse: { evaluationMode: 'cross-sectional', predictionAssets: ['A', 'B', 'C', 'D'] },
    factorQualification: { available: true, diagnosis: { stage: 'decision-signal-positive', explanation: 'Development diagnosis.', qualifiesForPortfolio: true }, claim: { claim: 'decision-signal', outcome: 'forward-return' }, semantics: { diagnosticThresholds: { minimumPositiveHacTStatistic: 1.96 } }, validation: variants(rank), testAudit: variants(hiddenRank) },
    quantileEvidence: { status: 'available' },
    quantilePath: { cumulative: { horizon: 1, totalRows: 2, points: [
      { timestamp: '2024-02-01', split: 'validation', high: 1.1, middle: 1, low: 0.9, spread: 1.2 },
      { timestamp: '2024-02-02', split: 'validation', high: 1.2, middle: 1, low: 0.8, spread: 1.4 },
    ] } },
    spreadSummary: { status: 'available', basis: 'Gross per-bar spread.', splits: [
      { split: 'validation', totalReturn: 0.2, maximumDrawdown: -0.1, sharpePerBar: 0.5, hitRate: 0.6, meanPerBar: 0.01, observations: 30 },
      { split: 'test', totalReturn: 9876.543, maximumDrawdown: -0.1, sharpePerBar: 0.5, hitRate: 0.6, meanPerBar: 0.01, observations: 99999 },
    ] },
    horizonProfile: [{ horizon: 1, train: { ...rank, role: 'train' }, validation: { ...rank, role: 'selection' }, test: { ...hiddenRank, role: 'test' } }],
    stability: {
      chronologicalFolds: [fold('validation_1', 'validation'), fold('validation_2', 'validation'), fold('test_1', 'test', hiddenRank)],
      causalRegimes: [{ ...rank, split: 'validation', role: 'selection', regime: 'up-calm' }],
      assets: [{ split: 'validation', role: 'selection', asset: 'A', rankCorrelation: 0.2, observations: 30 }],
      styles: [{ split: 'validation', role: 'selection', style: 'momentum_20', meanRankCorrelation: 0.1, meanAbsoluteRankCorrelation: 0.3, observations: 30 }],
    },
  } as unknown as FactorDiagnostics
}

const project = {
  id: 'idea', sessions: [{ selectionIntegrity: { selectionMetric: 'validation_mean_ic', researchFamily: { totalExecutions: 3, uniqueSourceTrials: 2 }, selectionAdjustment: { passes: true, method: 'bonferroni-hac-v1', confidenceLevel: 0.95, statistics: { familywiseAdjustedPValue: 0.02, uniqueTrials: 2 } } } }], runs: [],
} as unknown as ProjectSnapshot
const adjustment = project.sessions[0].selectionIntegrity!.selectionAdjustment

const perf = { totalReturn: 0.12, annualReturn: 0.3, annualVolatility: 0.2, sharpe: 1.1, sortino: 1.5, maximumDrawdown: -0.08, expectedShortfall95: 0.02, calmar: 3.7, positiveRate: 0.54, activeAnnualReturn: 0.05, informationRatio: 0.6 }
const portfolio = { strategyViability: { validation: { net: perf, gross: perf, benchmark: perf, friction: { baseCostBps: 10, totalCostDrag: 0.004, annualizedOneWayTurnover: 3.2 } } } } as PortfolioDiagnostics

// ---------------------------------------------------------------------------------------------
// The audit: every rendered metric carries a catalogue id with complete English and Chinese text.

const blocks = (html: string, re: RegExp) => [...html.matchAll(re)].map((m) => m[1])
const label = (block: string) => block.replace(/<span class="info"[\s\S]*$/, '').replace(/<[^>]+>/g, '').trim()

/** Labels of rendered metric slots (tiles, stat chips, numeric table columns, metric table rows) lacking a catalogue id. */
function missingDefinitions(page: string): string[] {
  // A figure's data table lists the drawn series (group growth multiples), not published metrics.
  const html = page.replace(/<table class="tbl"><caption class="small muted">(Compounded group growth multiples|各分组复合增长倍数)[\s\S]*?<\/table>/g, '')
  const slots = [
    ...blocks(html, /<dt class="ct-label">([\s\S]*?)<\/dt>/g),
    ...blocks(html, /<div class="wb-stat"[^>]*><dt>([\s\S]*?)<\/dt>/g),
    ...blocks(html.replace(/<table class="tbl"><caption class="small muted">(?:Net against benchmark|净值与基准)[\s\S]*?<\/table>/g, ''), /<th scope="col" class="r">([\s\S]*?)<\/th>/g),
    ...blocks(html, /<div class="kv-row"><dt>([\s\S]*?)<\/dt>/g),
  ]
  // The Portfolio detail table has one metric per row and one layer (net, benchmark, gross) per column.
  for (const table of blocks(html, /(<table class="tbl"><caption class="small muted">(?:Net against benchmark|净值与基准)[\s\S]*?<\/table>)/g)) {
    slots.push(...blocks(table, /<th scope="row">([\s\S]*?)<\/th>/g))
  }
  return slots.filter((slot) => {
    const id = /data-metric="([A-Za-z0-9]+)"/.exec(slot)?.[1]
    return !id || !(id in METRIC_CATALOGUE)
  }).map(label)
}
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;')
const metricIds = (html: string) => new Set(blocks(html, /data-metric="([A-Za-z0-9]+)"/g))

const pages = () => {
  const s = study('visible-diagnostic')
  const sealed = study('sealed')
  const runRow = { id: 'run-one', studyId: 'ohlcv-factor-quality', status: 'succeeded' } as RunRow
  const idea = { hypothesis: 'Does this ranking help?', hypothesisSha256: 'q', verdictPolicy: 'factor-idea-development-v1', bindings: [], evidence: { runId: 'run-one', selectionAdjustment: { passes: true } } } as unknown as Idea
  return {
    'Custom Run comparison': renderToStaticMarkup(<ComparisonResults comparison={{ status: 'comparable', differences: [], a: { primaryMetric: 'validation_custom', primaryValue: 0.1 } as HistoryRun, b: { primaryMetric: 'validation_custom', primaryValue: 0.2 } as HistoryRun } as Comparison} />),
    'Factor answer card': renderToStaticMarkup(<IdeaVerdict project={project} idea={idea} study={sealed} run={runRow} job={null} busy="" />),
    'Factor workbench': renderToStaticMarkup(<>
      <StatChips label="Headline" stats={factorStats(s.summary.validation, 1, adjustment)} />
      <MetricGrid groups={[...coreGroups({ study: s, project, validation: s.summary.validation, testAudit: s.summary.testAudit, testVisible: true, defs: s.protocol.semantics }), ...spreadGroups(s, true)]} />
    </>),
    'Factor evidence tabs': renderToStaticMarkup(<>
      <HeadlineMetrics splits={[{ name: 'Validation', role: 'selection split', summary: rank }]} horizon={1} defs={s.protocol.semantics} />
      <VerdictReasons study={s} adjustment={adjustment} />
      <QualificationBlock study={s} />
      <FoldTable study={s} />
      <HorizonTable study={s} />
      <StabilityTables study={s} />
    </>),
    'Run page': renderToStaticMarkup(<MetricGrid groups={runMetricGroups(s as never, project, true)} />),
    Portfolio: renderToStaticMarkup(<>
      <StatChips label="Headline" stats={portfolioStats(perf, 'validation')} />
      <MetricGrid groups={portfolioMetricGroups(portfolio, 'validation') ?? []} />
      <MetricDetail pf={portfolio} split="validation" />
    </>),
    'Strategy tuning': renderToStaticMarkup(<StrategyTuning project={{ ...project, library: { strategy: { evidence: { runId: 'run-base', selectionAdjustment: { status: 'available', interpretation: 'Core adjustment.', statistics: { deflatedSharpeProbability: .9, minimumTrackRecordObservations: 123 } } } } } } as unknown as ProjectSnapshot} />),
    'Library cards': renderToStaticMarkup(<>
      <LibraryCard name="F" badge="Supported" metric="m" metrics={['meanRankIc', 'hacT', 'trialsCounted']} points={[]} updated={null} href="/" go={() => {}} />
      <LibraryCard strategy name="S" badge="Inconclusive" metric="m" metrics={['netTotalReturn', 'netSharpe', 'maxDrawdown']} points={[]} updated={null} href="/" go={() => {}} />
    </>),
  }
}

const complete = (text: Bi | undefined, where: string) => {
  assert.ok(text, where)
  assert.ok(text.en.trim().length > 0, `${where}: empty English`)
  assert.ok(text.zh.trim().length > 0 && CJK.test(text.zh), `${where}: Chinese missing`)
  assert.ok(!CJK.test(text.en), `${where}: English side contains Chinese`)
}

test('every catalogue entry has a complete English and Chinese definition', () => {
  assert.ok(METRIC_IDS.length >= 30)
  for (const id of METRIC_IDS) {
    const e = METRIC_CATALOGUE[id]
    for (const field of ['label', 'definition', 'read', 'core'] as const) complete(e[field], `${id}.${field}`)
    if ('caveat' in e) complete(e.caveat, `${id}.caveat`)
    for (const s of ('sources' in e ? e.sources : []) ?? []) assert.match(`${s.license} ${s.url}`, /^(MIT|Apache-2\.0) https:\/\/github\.com\//, id)
  }
  READING_TEXTS.forEach((text, i) => complete(text, `reading ${i}`))
})

test('every metric rendered on the main pages has a catalogue entry, in English and Chinese', () => {
  const seen = new Set<string>()
  for (const language of ['en', 'zh'] as const) {
    setLanguage(language)
    try {
      for (const [page, html] of Object.entries(pages())) {
        assert.deepEqual(missingDefinitions(html), [], `${page} (${language})`)
        const ids = metricIds(html)
        assert.ok(ids.size > 0, `${page} renders no metric definition`)
        for (const id of ids) {
          seen.add(id)
          const definition = METRIC_CATALOGUE[id as keyof typeof METRIC_CATALOGUE].definition[language]
          assert.ok(html.includes(escapeHtml(definition)), `${page} (${language}) omits the ${id} definition`)
        }
      }
    } finally { setLanguage('en') }
  }
  // Every catalogue entry is reachable from at least one main page: no orphan definitions.
  assert.deepEqual(METRIC_IDS.filter((id) => !seen.has(id)), [])
})

test('verdict reasons carry the definition of the number they quote', () => {
  const html = renderToStaticMarkup(<VerdictReasons study={study()} adjustment={adjustment} />)
  const reasons = blocks(html, /<li>([\s\S]*?)<\/li>/g)
  assert.ok(reasons.length >= 4)
  for (const r of reasons) assert.match(r, /data-metric="/)
})

test('explanations never reveal hidden test numbers', () => {
  for (const [page, html] of Object.entries(pages())) {
    if (page === 'Factor answer card') assert.doesNotMatch(html, HIDDEN, page)
  }
  const sealed = study('sealed')
  const evidence = renderToStaticMarkup(<><VerdictReasons study={sealed} adjustment={adjustment} /><QualificationBlock study={sealed} /><FoldTable study={sealed} /><HorizonTable study={sealed} /></>)
  assert.doesNotMatch(evidence, HIDDEN)
  for (const id of METRIC_IDS) assert.doesNotMatch(JSON.stringify(METRIC_CATALOGUE[id]), HIDDEN)
})

test('answer card reading order is fixed, quiet, bilingual and test-blind', () => {
  const steps = readingOrder({ range: '2024-02-01 – 2024-02-28', horizon: 1, executions: 3, sources: 2, adjustment: 'passes' })
  assert.equal(steps.length, 5)
  assert.match(steps[0], /^The verdict word/)
  assert.match(steps[1], /^What was tested.*2024-02-01 – 2024-02-28.*1-bar/)
  assert.match(steps[2], /^The focal numbers/)
  assert.match(steps[3], /^Trials and adjustment\. 3 executions from 2 distinct.*adjustment passes/)
  assert.match(steps[4], /^What is hidden and why/)
  assert.notEqual(readingOrder({ range: null, horizon: 1, executions: 1, sources: 1, adjustment: 'fails' })[3], readingOrder({ range: null, horizon: 1, executions: 1, sources: 1, adjustment: 'none' })[3])
  assert.match(readingOrder({ range: null, horizon: 1, executions: 1, sources: 1, adjustment: 'none' })[1], /no validated range/)
  const html = pages()['Factor answer card']
  assert.match(html, /<details class="idea-reading" data-measure="reading"><summary>How to read this answer<\/summary><ol class="reading-order">(<li>[^<]+<\/li>){5}<\/ol><\/details>/)
  assert.ok(html.indexOf('idea-reading') > html.indexOf('wb-verdict') && html.indexOf('idea-reading') < html.indexOf('wb-chart'))
  assert.doesNotMatch(html, HIDDEN)
  setLanguage('zh')
  try {
    const zh = readingOrder({ range: '2024-02-01 – 2024-02-28', horizon: 1, executions: 3, sources: 2, adjustment: 'passes' })
    assert.ok(zh.every((step) => CJK.test(step)))
    assert.match(pages()['Factor answer card'], /<summary>如何阅读这个结论<\/summary>/)
  } finally { setLanguage('en') }
})
