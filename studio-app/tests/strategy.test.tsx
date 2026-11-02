import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProjectSnapshot, StrategyRoute } from '../src/api'
import { setLanguage } from '../src/i18n'
import { parseRoute, routeHref } from '../src/route'
import { StrategyTuning } from '../src/pages/strategy/StrategyTuning'
import { StrategyPage } from '../src/pages/strategy/Strategy'
import { PortfolioPage } from '../src/pages/portfolio/Portfolio'
import { projectAnalysisRuns } from '../src/pages/strategy/StrategyAnalyses'
import { scopedRuns } from '../src/library/RunHistory'
import type { HistoryRun } from '../src/library/runHistoryApi'
import { BuildStrategyAction } from '../src/actions/BuildStrategyAction'

const base = { id: 'source', name: 'Caller strategy', description: 'Caller-owned question', studies: [], sessions: [], runs: [], portfolioExplorer: null } as unknown as ProjectSnapshot
const blocked = { mode: 'blocked', reasonCode: 'no-coordinated-program', reason: 'This Project has no coordinated Factor-to-Portfolio program. Core cannot convert a standalone Factor Lab or bind its evidence into a new Portfolio Project.', display: 'aq project intake workspace sibling --template ohlcv-research-desk --request request.json --dataset package.json --json' } as StrategyRoute

test('Strategy canonical URL and Portfolio alias retain explicit Project identity', () => {
  for (const view of ['strategy', 'portfolio'] as const) {
    assert.deepEqual(parseRoute(`?view=${view}&id=desk`), { view, id: 'desk' })
    assert.equal(routeHref({ view, id: 'desk' }), `/?view=${view}&id=desk`)
  }
})

test('Versions and Analyses are strictly confined to this Project and their native lanes', () => {
  const row = (id: string, lane: string) => ({ project: { id }, lane }) as HistoryRun
  const rows = [row('source', 'Portfolio'), row('other', 'Portfolio'), row('source', 'Factor'), row('source', 'Book Risk'), row('other', 'RL policy')]
  assert.deepEqual(scopedRuns(rows, 'source', 'Portfolio'), [rows[0]])
  assert.deepEqual(projectAnalysisRuns(rows, 'source'), [rows[3]])
})

test('Tuning shows only adjusted base-family results and no raw neighborhood best', () => {
  const project = { ...base, library: { strategy: { evidence: { runId: 'run-base', researchFamily: { uniqueSourceTrials: 7 }, selectionAdjustment: { status: 'available', method: 'deflated-sharpe', interpretation: 'Core adjustment.', statistics: { deflatedSharpeProbability: .81, minimumTrackRecordObservations: 213 } } } } },
    portfolioExplorer: { parameterNeighborhood: { available: true, policy: { configurationCount: 15, baseConfigurationId: 'base' }, validation: { aggregate: { maximumNetSharpe: 98765 }, configurations: [{ netSharpe: 98765 }] }, test: { configurations: [{ netSharpe: 87654 }] } } } } as unknown as ProjectSnapshot
  const html = renderToStaticMarkup(<StrategyTuning project={project} />)
  assert.match(html, /81.0%/)
  assert.match(html, /213/)
  assert.match(html, /data-metric="deflatedSharpe"/)
  assert.doesNotMatch(html, /98765|87654/)
  assert.match(html, /does not adjust the neighborhood cells/)
  const missing = renderToStaticMarkup(<StrategyTuning project={base} />)
  assert.match(missing, /No verified selection adjustment/)
})

test('standalone build refusal and Agent CLI path are visible in both languages', () => {
  for (const language of ['en', 'zh'] as const) {
    setLanguage(language)
    const html = renderToStaticMarkup(<BuildStrategyAction projectId="source" route={blocked} />)
    assert.match(html, /disabled=""/)
    assert.match(html, /ohlcv-research-desk/)
    assert.doesNotMatch(html, /ohlcv-portfolio-lab/)
    assert.match(html, language === 'zh' ? /新建策略|独立因子实验室/ : /Build strategy|standalone Factor Lab/)
  }
  setLanguage('en')
})

test('admitted build is read-only without the action bootstrap, already-built routes open the Strategy', () => {
  const html = renderToStaticMarkup(<BuildStrategyAction projectId="source" route={{ ...blocked, mode: 'start' }} />)
  assert.match(html, /Read-only session/)
  assert.match(html, /disabled=""/)
  const open = renderToStaticMarkup(<BuildStrategyAction projectId="source" route={{ ...blocked, mode: 'open' }} />)
  assert.match(open, /view=strategy&amp;id=source/)
  assert.match(open, /Open strategy/)
})

test('an older selected Factor Run cannot build from a different current source', () => {
  const html = renderToStaticMarkup(<BuildStrategyAction projectId="source" route={{ ...blocked, mode: 'start', factorRunId: 'run-current' }} shownRunId="run-older" />)
  assert.match(html, /disabled=""/)
  assert.match(html, /selected Factor Run differs/)
})

test('Strategy Backtest cannot expose raw neighborhood ranks through a legacy tab hash', () => {
  const original = globalThis.window
  globalThis.window = { location: { hash: '#tab-neighborhood' } } as Window & typeof globalThis
  try {
    const project = { ...base, portfolioExplorer: { parameterNeighborhood: { available: true, validation: { configurations: [{ id: 'raw-best', netSharpe: 98765 }] } } } } as unknown as ProjectSnapshot
    const html = renderToStaticMarkup(<PortfolioPage project={project} embedded />)
    assert.doesNotMatch(html, /raw-best|98765|id="tab-neighborhood"/)
  } finally { globalThis.window = original }
})

test('Strategy tabs and lifecycle use the published lifecycle enum, independently of metric signs', () => {
  const original = globalThis.window
  globalThis.window = { location: { hash: '#tab-tuning' } } as Window & typeof globalThis
  try {
    for (const state of ['Defined', 'Backtested', 'Tuned'] as const) {
      const project = { ...base, library: { factor: null, strategy: { state, net: { sharpe: -100 }, points: [], updatedAt: null } } }
      const html = renderToStaticMarkup(<StrategyPage project={project} go={() => {}} />)
      for (const word of ['Backtest', 'Versions', 'Tuning', 'Analyses', state]) assert.ok(html.includes(word))
      assert.match(html, /aria-selected="true"[^>]*class="wb-tab"[^>]*>Tuning/)
    }
  } finally { globalThis.window = original }
})
