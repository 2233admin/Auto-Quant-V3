import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { setLanguage } from '../src/i18n'
import { parseRoute, routeHref, routeProjectId } from '../src/route'
import { Ledger, Verdict, Events } from '../src/research/ResearchParts'
import { ResearchLibrary } from '../src/research/ResearchLibrary'
import { bandOf, rowValue, statusOf } from '../src/research/words'
import type { Direction, ResearchHypothesis } from '../src/research/researchApi'
import type { WorkspaceSummary } from '../src/api'

const frontier = { trials: 12, programs: 10, failed: 2, probes: 2, best: 1.1, bar: 0.6, gap: 0.5, clears: true, byHypothesis: { h001: 1.1 } }
const direction = (hypotheses: ResearchHypothesis[]): Direction => ({
  direction: 'DEMO direction', created: '2026-10-08T09:00:00+00:00', budget_usd: 80, spend_usd: 12.5, unknown_cost_runs: 0, trials: 12,
  lockbox: { opened: false, n_total: 1600, n_dev: 1280 }, hypotheses, trial_points: [], probes: 2,
  events: [{ time: '2026-10-08T12:00:00+00:00', hypothesis: 'h002', experiment: 'e01', event: 'skeptic', note: null, withheld: true }],
  rounds: { state: 'idle', pending: [] }, frontier,
})
const judged: ResearchHypothesis = {
  id: 'h001', title: 'vol-scaled momentum', status: 'supported', created: '2026-10-08T09:05:00+00:00', body: '## Claim\nIt holds.\n', experiments: [],
  verdict: { label: 'supported', reason: 'DSR 0.973 >= 0.95 over 543 trials', evidence: { experiment: 'e01' }, created: '2026-10-08T13:00:00+00:00' }, confirmation: null,
  ledger: [
    { id: 'dsr', role: 'gate', state: 'pass', value: 0.973, threshold: '>= 0.95' },
    { id: 'pbo', role: 'gate', state: 'not-computed', value: null, threshold: '<= 0.5' },
  ],
}
const pending: ResearchHypothesis = {
  ...judged, id: 'h002', status: 'challenged', verdict: null,
  ledger: [{ id: 'validation-sharpe', role: 'gate', state: 'withheld', value: null, threshold: '> 0' }],
}

test('research routes round-trip and stay out of the Project fetch', () => {
  for (const route of [{ view: 'research' as const }, { view: 'research' as const, id: 'momentum-regimes', h: 'h003' }, { view: 'knowledge' as const }]) {
    const href = routeHref(route)
    const url = new URL(href, 'http://x')
    assert.deepEqual(parseRoute(url.search, url.pathname), route)
    assert.equal(routeProjectId(route), null)
  }
})

test('the ledger lays out server states: a missing PBO reads not computed and a withheld row carries no value', () => {
  setLanguage('en')
  const html = renderToStaticMarkup(<Ledger rows={[...judged.ledger, ...pending.ledger]} />)
  assert.match(html, /Not computed/)
  assert.match(html, /Withheld until a verdict/)
  assert.match(html, /0\.973/)
  assert.equal(rowValue(pending.ledger[0]), '—')
})

test('the verdict band appears only with a verdict; before it the validation evidence stays withheld', () => {
  setLanguage('en')
  const d = direction([judged, pending])
  assert.match(renderToStaticMarkup(<Verdict h={judged} d={d} />), /verdict--pass/)
  const before = renderToStaticMarkup(<Verdict h={pending} d={d} />)
  assert.doesNotMatch(before, /verdict--/)
  assert.match(before, /No verdict yet/)
  assert.match(renderToStaticMarkup(<Events d={d} selected="h001" />), /Withheld until this hypothesis has a verdict/)
  assert.equal(bandOf('unconfirmed'), 'fail')
  assert.equal(bandOf('inconclusive'), 'inconclusive')
})

test('the research library lists only Projects with research and marks synthetic demo data, in Chinese by default wording', () => {
  setLanguage('zh')
  const workspace = { projects: [
    { id: 'momentum-regimes', name: 'momentum-regimes', research: { state: 'ready', direction: 'DEMO', hypotheses: 4, statusCounts: { supported: 1, rejected: 1 }, latestVerdict: { hypothesis: 'h002', label: 'rejected', at: '2026-10-09' }, lockbox: 'sealed', demo: 'DEMO' } },
    { id: 'plain', name: 'plain', research: null },
  ] } as unknown as WorkspaceSummary
  const html = renderToStaticMarkup(<ResearchLibrary workspace={workspace} go={() => {}} />)
  assert.match(html, /momentum-regimes/)
  assert.doesNotMatch(html, />plain</)
  assert.match(html, /合成演示/)
  assert.match(html, new RegExp(statusOf('rejected').word))
  setLanguage('en')
})
