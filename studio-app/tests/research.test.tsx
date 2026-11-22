import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { setLanguage } from '../src/i18n'
import { parseRoute, routeHref, routeProjectId } from '../src/route'
import { Ledger, Verdict, Events } from '../src/research/ResearchParts'
import { ResearchLibrary } from '../src/research/ResearchLibrary'
import { ResearchResults, comparisonGaps, researchResults } from '../src/research/ResearchResults'
import { RdAgentCandidates, parseExtractionReceipt } from '../src/research/RdAgentCandidates'
import { bandOf, rowValue, statusOf } from '../src/research/words'
import type { Direction, ResearchHypothesis } from '../src/research/researchApi'
import type { WorkspaceSummary } from '../src/api'

const frontier = { trials: 12, programs: 10, failed: 2, probes: 2, best: 1.1, bar: 0.6, gap: 0.5, clears: true, byHypothesis: { h001: 1.1 } }
const direction = (hypotheses: ResearchHypothesis[]): Direction => ({
  direction: 'DEMO direction', created: '2026-10-08T09:00:00+00:00', budget_usd: 80, spend_usd: 12.5, unknown_cost_runs: 0, trials: 12,
  lockbox: { opened: false, n_total: 1600, n_dev: 1280 }, hypotheses, trial_points: [], probes: 2,
  events: [{ time: '2026-10-08T12:00:00+00:00', hypothesis: 'h002', experiment: 'e01', event: 'skeptic', note: null, withheld: true }],
  rounds: { state: 'idle', pending: [] }, frontier, experimentCurves: [],
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

const experiment = (id: string) => ({
  id, created: '', n_evaluated: 12, n_probed: 0, best_is_score: 1.25,
  spend_usd: 0, spend_known: false, first_trial: null, last_trial: null, evaluatorHash: 'evaluator', dataHash: 'data',
})

test('research results link exact experiments and only display verdicts for their recorded experiment', () => {
  setLanguage('en')
  const d = direction([{ ...judged, status: 'unconfirmed', confirmation: { experiment: 'e02' }, experiments: [experiment('e01'), experiment('e02')] }, pending])
  d.rounds.grants = [{ id: 'r01', attempts: 2, used: 1, runs: [{ attempt: 1, hypothesis: 'h001', experiment: 'e02', event: null, state: 'ended' }] }]
  assert.deepEqual(researchResults(d).map(row => [row.key, row.verdict?.label, row.verdict?.confirmation]), [
    ['h001/e01', 'supported', null], ['h001/e02', undefined, undefined],
  ])
  const html = renderToStaticMarkup(<ResearchResults id="p1" direction={d} />)
  assert.match(html, /h=h001&amp;e=e02#ev-inspector/)
  assert.match(html, /No verdict for this experiment/)
  assert.match(html, /Recorded round attempts/)
  assert.match(html, /r01/)
  assert.doesNotMatch(html, /validation-sharpe|lockbox_start/)
})

test('comparison rejects mismatched or missing identities and absent scores', () => {
  const [a, b] = researchResults(direction([{ ...judged, experiments: [experiment('e01'), experiment('e02')] }]))
  assert.deepEqual(comparisonGaps(a, b), [])
  assert.deepEqual(comparisonGaps(a, a), ['same'])
  assert.deepEqual(comparisonGaps(a, { ...b, experiment: { ...b.experiment, evaluatorHash: 'other', dataHash: undefined, best_is_score: null } }), ['data', 'evaluator', 'score'])
})

test('RD-Agent receipt exposes only candidate definitions and refuses invalid sources or malformed siblings', () => {
  const factor = { description: '<img src=x onerror=alert(1)>', formulation: 'ln(DailySTD)', variables: { DailySTD: 'As reported' } }
  const receipt = { rdagent: '1.0.0', source: 'https://example.test/report.pdf', excerpt_sha256: 'a'.repeat(64), model: 'not exposed', factors: { LogDailySTD: factor } }
  const view = parseExtractionReceipt(JSON.stringify(receipt))
  assert.equal(view.kind, 'factors')
  assert.deepEqual(view.factors, [{ name: 'LogDailySTD', description: factor.description, formula: factor.formulation, variables: [['DailySTD', 'As reported']] }])
  assert.equal(view.source, receipt.source)
  assert.doesNotMatch(JSON.stringify(view), /not exposed/)
  const empty = parseExtractionReceipt(JSON.stringify({ rdagent: '1', factors: {} }))
  assert.equal(empty.kind, 'factors')
  assert.deepEqual(empty.factors, [])
  for (const source of ['javascript:alert(1)', 'http://example.test', 'https://u:p@example.test', 'https:example.test']) {
    assert.throws(() => parseExtractionReceipt(JSON.stringify({ ...receipt, source })))
  }
  assert.throws(() => parseExtractionReceipt(JSON.stringify({ ...receipt, factors: { ...receipt.factors, broken: { ...factor, variables: [] } } })))
})

test('research feature receipts preserve the unit, quote, rule, inputs and explicit gap, without recasting them as factors', () => {
  const item = { id: 'm01', name: 'Coverage', kind: 'measure', grain: 'cohort', evidence: 'report n/N', rule: 'n / N', inputs: ['n', 'N'], gap: null }
  const encoded = { source: 'excerpt.txt', source_sha256: 'c'.repeat(64), items: [item] }
  const receipt = parseExtractionReceipt(JSON.stringify(encoded))
  assert.equal(receipt.kind, 'features')
  assert.deepEqual(receipt.features, [item])
  assert.throws(() => parseExtractionReceipt(JSON.stringify({ ...encoded, items: [item, item] })))
  assert.throws(() => parseExtractionReceipt(JSON.stringify({ ...encoded, factors: {} })))
})

test('candidate source lines are optional one-based integers, never inferred', () => {
  const item = { id: 'c04', name: 'LogDailySTD', kind: 'factor', grain: 'daily', evidence: 'log(日度标准差)', rule: 'log(DailySTD)', inputs: ['DailySTD'], gap: null }
  const parse = (feature: object) => parseExtractionReceipt(JSON.stringify({ source: 'excerpt.txt', source_sha256: 'a'.repeat(64), items: [feature] }))
  assert.deepEqual((parse({ ...item, sourceLine: 7 }) as { features: unknown[] }).features, [{ ...item, sourceLine: 7 }])
  assert.deepEqual((parse(item) as { features: unknown[] }).features, [item])
  for (const sourceLine of [0, -1, 1.5, '7', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parse({ ...item, sourceLine }), /source line/i)
  }
})

test('saved browser receipts are revalidated before displaying their evidence', () => {
  setLanguage('en')
  const key = 'aq-research-candidate-receipt-v1'
  const item = { id: 'c04', name: 'LogDailySTD', kind: 'factor', grain: 'daily', evidence: 'log(日度标准差)', rule: 'log(DailySTD)', inputs: ['DailySTD'], gap: null, sourceLine: 7 }
  let raw = JSON.stringify({ source: 'excerpt.txt', source_sha256: 'a'.repeat(64), items: [item] })
  let denyStorage = false
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem(name: string) {
        assert.equal(name, key)
        if (denyStorage) throw new Error('Storage disabled')
        return raw
      },
    },
  } })
  try {
    const saved = renderToStaticMarkup(<RdAgentCandidates />)
    assert.match(saved, /Showing the receipt saved in this browser/)
    assert.match(saved, /1 unverified feature candidates/)
    assert.match(saved, /Excerpt line \(reported\)<\/dt><dd translate="no">7/)

    raw = raw.replace(item.evidence, 'é'.repeat(300_000))
    assert.ok(raw.length < 512 * 1024)
    const invalid = renderToStaticMarkup(<RdAgentCandidates />)
    assert.match(invalid, /The saved receipt is invalid/)
    assert.doesNotMatch(invalid, /LogDailySTD/)
    assert.match(invalid, /Remove saved copy/)

    denyStorage = true
    const unavailable = renderToStaticMarkup(<RdAgentCandidates />)
    assert.match(unavailable, /Browser storage is unavailable/)
    assert.match(unavailable, /type="file"/)
  } finally {
    Reflect.deleteProperty(globalThis, 'window')
  }
})
