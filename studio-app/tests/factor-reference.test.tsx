import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FactorReference, WorkspaceSummary } from '../src/api'
import { ActionsProvider } from '../src/actions/ActionsContext'
import { setLanguage } from '../src/i18n'
import { LibraryPage } from '../src/library/Library'
import { factorReferenceHref, matchingReferences, researchReferences, ResearchReferences } from '../src/library/FactorResearch'
import { parseRoute, routeHref, type Route } from '../src/route'
import { syntheticFactors, syntheticWorkspace } from './libraryFixture'

// Synthetic published payloads exercise UI contracts only; they are not research evidence.
const replay: FactorReference = {
  id: 'kit-confirm', name: 'Confirmation gate', formula: 'momentum * gate', direction: 'higher',
  evidence: 'Nine paired development decisions; no independent holdout.', source: 'https://example.test/reference',
  market: 'US', tags: ['confirmation'], meaning: 'A gate applied to ranked momentum.', usage: 'Confirm the second slot.',
  strategyUrl: 'https://example.test/strategy', strategyUses: [{ id: 'momentum', name: 'Momentum confirmation', rule: 'Retain cash unless confirmed.' }],
  replay: {
    runId: 'observed-run-9', dates: 9, triggered: 5, versusMomentumBp: -1.25, versusSameExposureBp: 2.5,
    daily: Array.from({ length: 9 }, (_, i) => {
      const cash = i % 2 === 0
      return { day: `2026-09-${String(i + 1).padStart(2, '0')}`, first: '600392.SH', second: cash ? '688361.SH' : '002371.SZ', cash, momentum: i / 100, kit: cash ? i / 400 : i / 100, control: cash ? 3 * i / 400 : i / 100 }
    }),
  },
}
const ranking: FactorReference = { id: 'ranking', name: 'Ranking score', formula: 'rank(score)', direction: 'diagnostic', source: replay.source, evidence: 'No execution simulation or verified return history.', strategyUses: [{ id: 'long_short', name: 'Q5 minus Q1', rule: 'Compare the top and bottom ranked cohorts.' }] }
const missing: FactorReference = { id: 'missing', name: 'Unvalidated signal', formula: 'raw(score)', direction: 'lower', source: replay.source, evidence: 'No historical observations have been published.' }
const project = { ...syntheticFactors(1)[0], id: 'reference-project', name: 'Reference desk', library: { factor: null, strategy: null, factorReferences: { factors: [replay, ranking, missing], invalid: false } } }
const workspace = syntheticWorkspace([project])

function withBrowser<T>(layout: 'list' | 'cards', hash: string, render: () => T): T {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { hash, search: '', pathname: '/' }, addEventListener() {}, removeEventListener() {} } })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === 'aq-studio-factor-layout' ? layout : null } })
  setLanguage('en')
  try { return render() } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
}
function page(route: Extract<Route, { view: 'factors' }>, data: WorkspaceSummary = workspace, layout: 'list' | 'cards' = 'list', hash = '') {
  return withBrowser(layout, hash, () => renderToStaticMarkup(<ActionsProvider workspace={data} routeKey="factors" go={() => {}} refresh={() => {}}><LibraryPage route={route} workspace={data} go={() => {}} /></ActionsProvider>))
}
const detail = (reference: FactorReference, data = workspace, hash = '') => page({ view: 'factors', section: 'reference', project: project.id, item: reference.id }, data, 'list', hash)
const markup = (node: ReactNode) => withBrowser('list', '', () => renderToStaticMarkup(node))

test('reference deep links round-trip on reload without changing routes for other views', () => {
  const href = factorReferenceHref('desk & one', 'factor/one')
  assert.equal(href, '/?view=factors&section=reference&project=desk+%26+one&item=factor%2Fone')
  assert.deepEqual(parseRoute(href.slice(1)), { view: 'factors', section: 'reference', project: 'desk & one', item: 'factor/one' })
  assert.equal(routeHref({ view: 'factors' }), '/?view=factors')
  for (const route of [
    { view: 'run', id: 'desk', run: 'run-one' },
    { view: 'factor', id: 'desk', study: 'quality', run: 'run-one' },
    { view: 'compare', id: 'desk', a: 'one', b: 'two', projectB: 'other' },
    { view: 'research', id: 'desk', h: 'hypothesis', e: 'experiment' },
    { view: 'tuning', id: 'desk' },
  ] satisfies Route[]) assert.deepEqual(parseRoute(routeHref(route).slice(1)), route)
  assert.deepEqual(parseRoute('?view=factors&section=unknown&project=desk&item=one'), { view: 'factors' })
})

test('zero formal factors still expose references and one identical history link per entry in both layouts', () => {
  const list = page({ view: 'factors' })
  const cards = page({ view: 'factors' }, workspace, 'cards')
  for (const html of [list, cards]) {
    assert.match(html, /Research references/)
    assert.match(html, /FACTOR LIBRARY \/ 03/)
    assert.doesNotMatch(html, /No factors in this workspace\.|No formal factor studies\. Research references are listed below\.|Sort factors by/)
    assert.match(html, /Development replay/)
    assert.match(html, /Ranking diagnostic only/)
    assert.match(html, /No verified history/)
    assert.match(html, /excluded from validation IC filters and counts/)
    assert.equal((html.match(/aria-label="Historical performance · /g) ?? []).length, 3)
    for (const reference of [replay, ranking, missing]) {
      const href = factorReferenceHref(project.id, reference.id).replaceAll('&', '&amp;')
      assert.equal(html.split(`href="${href}"`).length - 1, 1)
    }
  }
  assert.match(cards, /data-layout="cards"/)
  assert.equal((cards.match(/class="factor-card"/g) ?? []).length, 3)
  assert.doesNotMatch(list, /class="factor-card"/)
})

test('formal factors retain their analysis link and the header counts both collections', () => {
  const data = syntheticWorkspace([project, ...syntheticFactors(1)])
  const html = page({ view: 'factors' }, data)
  assert.match(html, /FACTOR LIBRARY \/ 04/)
  assert.equal((html.match(/aria-label="Factor analysis · /g) ?? []).length, 1)
  assert.equal((html.match(/aria-label="Historical performance · /g) ?? []).length, 3)
})

test('shared search includes reference metadata and excludes nonmatches in either layout', () => {
  const entries = researchReferences(workspace)
  for (const query of [' CONFIRMATION ', 'momentum * gate', 'second slot', 'Retain cash', 'Reference desk', 'US', 'independent holdout']) {
    assert.ok(matchingReferences(entries, query).some(entry => entry.reference.id === replay.id), query)
  }
  for (const layout of ['list', 'cards'] as const) {
    const html = markup(<ResearchReferences entries={entries} invalid={false} query="No historical observations" layout={layout} />)
    assert.match(html, /Unvalidated signal/)
    assert.doesNotMatch(html, /Confirmation gate|Ranking score/)
    const empty = markup(<ResearchReferences entries={entries} invalid={false} query="no-match" layout={layout} />)
    assert.match(empty, /No research references match this search/)
  }
})

test('replay detail renders nine paired observations, all three arms, cash slots and exact original Run', () => {
  const href = factorReferenceHref(project.id, replay.id)
  const route = parseRoute(href.slice(1))
  assert.equal(route.view, 'factors')
  const html = page(route as Extract<Route, { view: 'factors' }>)
  assert.match(html, /Historical performance/)
  assert.match(html, /Formula and usage/)
  assert.match(html, /Development-sample paired-decision replay/)
  assert.match(html, /not a daily return or cumulative NAV/)
  assert.match(html, /No independent holdout validation/)
  assert.match(html, /Returns by decision date/)
  assert.match(html, /class="plot lane-plot"/)
  assert.match(html, /Decision evidence and cash slots/)
  assert.match(html, /Momentum/)
  assert.match(html, /KiT gate/)
  assert.match(html, /Equal exposure/)
  for (const row of replay.replay!.daily) assert.ok(html.includes(row.day), row.day)
  const decisions = html.match(/Decision evidence and cash slots[\s\S]*?<\/table>/)?.[0] ?? ''
  const suppressed = decisions.match(/<tr[^>]*>(?:(?!<\/tr>).)*>2026-09-03<(?:(?!<\/tr>).)*<\/tr>/)?.[0] ?? ''
  assert.match(suppressed, /600392\.SH.*688361\.SH.*Hold cash.*−150\.00.*−100\.00/)
  const retained = decisions.match(/<tr[^>]*>(?:(?!<\/tr>).)*>2026-09-02<(?:(?!<\/tr>).)*<\/tr>/)?.[0] ?? ''
  assert.match(retained, /600392\.SH.*002371\.SZ.*Keep second stock.*0\.00.*0\.00/)
  const originalRun = routeHref({ view: 'run', id: project.id, run: replay.replay!.runId }).replaceAll('&', '&amp;')
  assert.ok(html.includes(`href="${originalRun}"`))
  assert.match(html, /Open original Run record/)
  assert.match(html, /href="\/\?view=factors" aria-label="Back to factor list"/)
})

test('missing evidence has explicit reason and no invented chart or replay link; Q5 diagnostic requires explicit long_short use', () => {
  const html = detail(missing)
  assert.match(html, /No verifiable historical performance available/)
  assert.match(html, /No historical observations have been published/)
  assert.doesNotMatch(html, /lane-plot|Open original Run record|Ranking diagnostic only|Q5−Q1/)
  const q5 = detail(ranking)
  assert.match(q5, /Ranking diagnostic only/)
  assert.match(q5, /Q5−Q1 is a ranking diagnostic, not verified strategy performance/)
  assert.doesNotMatch(q5, /lane-plot|Open original Run record|section=kit|factor-strategy-research/)
})

test('formula tab uses original rule and validated external links but never a strategy research endpoint', () => {
  const html = detail(replay, workspace, '#tab-reference-rule')
  assert.match(html, /Signal formula/)
  assert.match(html, /momentum \* gate/)
  assert.match(html, /Retain cash unless confirmed/)
  assert.match(html, /href="https:\/\/example.test\/reference"/)
  assert.match(html, /href="https:\/\/example.test\/strategy"/)
  assert.doesNotMatch(html, /section=kit|factor-strategy-research/)
  const unsafe = { ...replay, source: 'javascript:alert(1)', strategyUrl: 'data:text/html,unsafe' }
  const data = syntheticWorkspace([{ ...project, library: { ...project.library, factorReferences: { factors: [unsafe], invalid: false } } }])
  assert.doesNotMatch(detail(unsafe, data, '#tab-reference-rule'), /href="(?:javascript:|data:)/)
})

test('invalid or unmatched reference selection explains its meaning with a working return', () => {
  for (const route of [
    { view: 'factors', section: 'reference', project: 'other', item: replay.id },
    { view: 'factors', section: 'reference', project: project.id, item: 'removed' },
    { view: 'factors', section: 'reference' },
  ] satisfies Extract<Route, { view: 'factors' }>[]) {
    const html = page(route)
    assert.match(html, /Research reference unavailable/)
    assert.match(html, /not evidence of verified historical performance/)
    assert.match(html, /href="\/\?view=factors"/)
    assert.match(html, /Back to factor list/)
    assert.doesNotMatch(html, /lane-plot/)
  }
  const invalid = syntheticWorkspace([{ ...project, library: { factor: null, strategy: null, factorReferences: { factors: [], invalid: true } } }])
  assert.match(page({ view: 'factors' }, invalid), /Some research references could not be loaded/)
})
