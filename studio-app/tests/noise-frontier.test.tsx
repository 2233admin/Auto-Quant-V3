import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import fixture from './noise-frontier.fixture.json'
import type { FactorNoiseFrontierSeries, NoiseFrontierUnavailable, PortfolioNoiseFrontierSeries, ProjectSnapshot } from '../src/api'
import { setLanguage } from '../src/i18n'
import { frontierAbsent, frontierUnavailableReason, NoiseFrontierChart, NoiseSection, PortfolioNoiseFrontierChart } from '../src/pages/NoiseFrontier'
import * as factorMath from '../src/pages/factorMath'
import { StrategyTuning } from '../src/pages/strategy/StrategyTuning'

// Payloads written by autoquant/studio_frontier.py; tests/test_studio_frontier.py pins this file to the server output.
const factor = fixture.factor as FactorNoiseFrontierSeries
const portfolio = fixture.portfolio as PortfolioNoiseFrontierSeries
const portfolioUnavailable = fixture.portfolioUnavailable as NoiseFrontierUnavailable
const factorUnavailable = fixture.factorUnavailable as NoiseFrontierUnavailable
const polylinePoints = (html: string) => [...html.matchAll(/<polyline points="([^"]+)"/g)].map((m) => m[1].split(' ').length)

test('the Factor frontier draws the published series: two curves of every server point, the table, N and the selected value', () => {
  const html = renderToStaticMarkup(<NoiseFrontierChart frontier={factor} runIc={factor.selectedValue} />)
  assert.deepEqual(polylinePoints(html), [factor.curve.length, factor.curve.length])
  assert.equal(factor.curve.length, 80)
  assert.match(html, /N = 12/)
  assert.match(html, /selected \+0\.0450/)
  assert.equal([...html.matchAll(/ · this ledger/g)].length, 1)
  assert.equal([...html.matchAll(/<tr>/g)].length - 1, factor.table.length)
  for (const row of factor.table) assert.ok(html.includes(`+${row.passLine.toFixed(4)}`), `pass line at N=${row.trials}`)
  // The server verdict (passes === false on this ledger) is what adds the shortfall note.
  assert.match(html, /below the pass line/)
  const passing = renderToStaticMarkup(<NoiseFrontierChart frontier={{ ...factor, passes: true }} runIc={null} />)
  assert.doesNotMatch(passing, /below the pass line/)
  const silent = renderToStaticMarkup(<NoiseFrontierChart frontier={{ ...factor, passes: null }} runIc={null} />)
  assert.doesNotMatch(silent, /below the pass line/)
})

test('the Factor frontier shows server numbers verbatim; the browser recomputes nothing', () => {
  const tampered: FactorNoiseFrontierSeries = {
    ...factor,
    expectedAtTrials: 0.0123,
    table: factor.table.map((row) => ({ ...row, expected: 0.0123, passLine: 0.0456 })),
    curve: factor.curve.map((row) => ({ ...row, expected: 0.0123, passLine: 0.0456 })),
  }
  const html = renderToStaticMarkup(<NoiseFrontierChart frontier={tampered} runIc={null} />)
  const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'))
  assert.equal([...body.matchAll(/\+0\.0123/g)].length, tampered.table.length)
  assert.equal([...body.matchAll(/\+0\.0456/g)].length, tampered.table.length)
  assert.match(html, /expected to reach \+0\.0123 under pure noise/)
  // A flat server curve is drawn flat: every y coordinate of the expectation polyline is identical.
  const curve = [...html.matchAll(/<polyline points="([^"]+)"/g)][1][1].split(' ').map((p) => p.split(',')[1])
  assert.equal(new Set(curve).size, 1)
})

test('the Factor section names the Run that produced the selected value, or refuses without a series', () => {
  const same = renderToStaticMarkup(<NoiseSection frontier={factor} runIc={factor.selectedValue} runId="run-leader" />)
  assert.match(same, /Selected value: Run <span class="mono" translate="no">run-leader<\/span> \(this Run\)\./)
  const later = renderToStaticMarkup(<NoiseSection frontier={factor} runIc={0.01} runId="run-later" />)
  assert.match(later, /a later Run that did not replace it/)
  assert.match(later, /this Run \+0\.0100/)
  const ambiguous = renderToStaticMarkup(<NoiseSection frontier={{ ...factor, leaderRunId: null }} runIc={null} runId="run-later" />)
  assert.match(ambiguous, /no single Run matches it exactly/)
  const none = renderToStaticMarkup(<NoiseSection frontier={factorUnavailable} runIc={0.01} runId="run-a" />)
  assert.match(none, /role="status"/)
  assert.match(none, /no trial ledger and the number of independent trials N is unknown/)
  assert.doesNotMatch(none, /<polyline|<svg class="plot"/)
})

test('every unavailable reason has English and Chinese copy and no fallback line is drawn', () => {
  const codes = ['no-factor-ledger', 'no-adjustment', 'adjustment-unavailable', 'degenerate-p-value', 'no-trial-dispersion', 'incomplete-trial-statistics', 'absent']
  const detail = { status: 'unsupported', reason: 'missing-factor-hac-evidence' }
  for (const language of ['en', 'zh'] as const) {
    setLanguage(language)
    for (const code of codes) {
      const text = frontierUnavailableReason({ ...factorUnavailable, reasonCode: code, detail })
      assert.ok(text.length > 10, code)
      if (language === 'zh') assert.match(text, /[一-鿿]/, code)
    }
    assert.match(frontierUnavailableReason({ ...factorUnavailable, reasonCode: 'adjustment-unavailable', detail }), /unsupported \(missing-factor-hac-evidence\)/)
    assert.match(frontierUnavailableReason(portfolioUnavailable), language === 'zh' ? /没有测得离散程度/ : /no spread across successful trials/)
  }
  setLanguage('en')
  assert.equal(frontierAbsent().status, 'unavailable')
  assert.equal(frontierUnavailableReason(frontierAbsent()), 'The server published no noise frontier.')
})

test('the client frontier math is gone: no quantile, expected-maximum or pass-line code in the app', () => {
  assert.deepEqual(Object.keys(factorMath).filter((key) => /normalQuantile|expectedMaxZ|familywiseThreshold|noiseFrontier/i.test(key)), [])
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(ts|tsx)$/.test(name) && /EULER_MASCHERONI|normalQuantile|expectedMaxZ|familywiseThreshold|Acklam/.test(readFileSync(path, 'utf8'))) hits.push(path)
    }
  }
  walk(resolve(process.cwd(), 'studio-app/src'))
  assert.deepEqual(hits, [])
})

const strategy = (noiseFrontier?: unknown) => ({
  id: 'desk', name: 'Desk', description: '', studies: [], sessions: [], runs: [], portfolioExplorer: null,
  library: { strategy: { evidence: { runId: 'run-base', researchFamily: { uniqueSourceTrials: 4 }, selectionAdjustment: { status: 'available', method: 'deflated-sharpe-ratio-v1', interpretation: 'Core adjustment.', statistics: { deflatedSharpeProbability: .31, minimumTrackRecordObservations: null } }, ...(noiseFrontier === undefined ? {} : { noiseFrontier }) } } },
}) as unknown as ProjectSnapshot

test('the Strategy page draws the server Sharpe frontier and nothing else', () => {
  const html = renderToStaticMarkup(<StrategyTuning project={strategy(portfolio)} />)
  assert.match(html, /Noise frontier: how large the best Sharpe looks by luck alone/)
  assert.deepEqual(polylinePoints(html), [portfolio.curve.length])
  assert.match(html, /N = 4/)
  assert.match(html, /selected \+1\.59/)
  assert.match(html, /does not pass the Core check/)
  for (const row of portfolio.table) assert.ok(html.includes(`+${row.expected.toFixed(2)}`) || row.expected === 0, `expected at N=${row.trials}`)
  const flat = (passes: boolean) => ({ ...portfolio, passes, curve: portfolio.curve.map((row) => ({ ...row, expected: 0.5 })), table: portfolio.table.map((row) => ({ ...row, expected: 0.5 })) })
  const standalone = renderToStaticMarkup(<PortfolioNoiseFrontierChart frontier={flat(true)} />)
  assert.doesNotMatch(standalone, /does not pass the Core check/)
  assert.equal([...standalone.matchAll(/\+0\.50/g)].length, portfolio.table.length)
})

test('without trial data the Strategy page shows the not-computed state and draws no line', () => {
  const refused = { ...portfolioUnavailable, reasonCode: 'adjustment-unavailable', detail: { status: 'unsupported', reason: 'non-reproducible-research-family' } }
  for (const [frontier, message] of [
    [portfolioUnavailable, /no spread across successful trials/],
    [undefined, /The server published no noise frontier/],
    [refused, /unsupported \(non-reproducible-research-family\)/],
  ] as const) {
    const html = renderToStaticMarkup(<StrategyTuning project={strategy(frontier)} />)
    assert.match(html, message)
    assert.match(html, /Noise frontier/)
    assert.doesNotMatch(html, /<polyline|<svg class="plot"/)
  }
  setLanguage('zh')
  const zh = renderToStaticMarkup(<StrategyTuning project={strategy(portfolioUnavailable)} />)
  assert.match(zh, /噪声边界/)
  assert.match(zh, /没有测得离散程度/)
  setLanguage('en')
})
