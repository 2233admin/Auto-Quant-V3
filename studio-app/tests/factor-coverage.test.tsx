import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FactorDiagnostics } from '../src/api'
import { setLanguage } from '../src/i18n'
import { CoverageTable } from '../src/pages/FactorCoverage'

const SRC = resolve(process.cwd(), 'studio-app/src')

// Shapes written by autoquant/factor_explorer.py (`inputAvailability.byAsset`, `coverage`); tests/test_factor_explorer.py pins the keys.
const available = {
  available: true,
  timestamps: 1000,
  completeTimestamps: 940,
  observationCoverage: 0.985,
  observedRows: 5910,
  possibleRows: 6000,
  byAsset: [
    { asset: 'BTCUSDT', observations: 1000, start: '2024-01-01T00:00:00Z', end: '2024-02-11T15:00:00Z', inputCoverage: 1, factorCoverage: 0.9875 },
    { asset: 'SOLUSDT', observations: 910, start: '2024-01-05T00:00:00Z', end: '2024-02-11T15:00:00Z', inputCoverage: 0.91, factorCoverage: 0.5 },
  ],
}

const study = (patch: Partial<FactorDiagnostics>) => ({ inputAvailability: { available: false }, ...patch }) as unknown as FactorDiagnostics

test('the table shows each published asset row verbatim, with both coverages as the Run wrote them', () => {
  setLanguage('en')
  const html = renderToStaticMarkup(<CoverageTable study={study({ inputAvailability: available })} />)
  assert.deepEqual([...html.matchAll(/<th scope="row" class="mono">([^<]+)<\/th>/g)].map((m) => m[1]), ['BTCUSDT', 'SOLUSDT'])
  assert.match(html, />Input coverage/)
  assert.match(html, />Factor coverage/)
  for (const cell of ['1,000', '910', '2024-01-05', '2024-02-11', '100.0%', '91.0%', '98.8%', '50.0%']) assert.ok(html.includes(`>${cell}<`), cell)
  assert.match(html, /5,910 of 6,000 possible asset-bar rows are observed \(98\.5%\); 940 of 1,000 bars have every asset\./)
  assert.doesNotMatch(html, /Coverage not published|published factor coverage only/)
})

test('a Run that published only the factor coverage says so and shows that single column', () => {
  setLanguage('en')
  const html = renderToStaticMarkup(<CoverageTable study={study({ coverage: [{ asset: 'ETHUSDT', coverage: 0.75 }] })} />)
  assert.match(html, /published factor coverage only; it did not publish input coverage per asset/)
  assert.match(html, />ETHUSDT</)
  assert.match(html, />75\.0%</)
  assert.doesNotMatch(html, />Input coverage/)
  assert.doesNotMatch(html, /possible asset-bar rows/)
})

test('a Run that published neither shows the empty state and no number', () => {
  setLanguage('en')
  for (const diagnostics of [study({}), study({ inputAvailability: { available: false, reason: 'no panel' }, coverage: [] }), study({ inputAvailability: { available: true, byAsset: [] } })]) {
    const html = renderToStaticMarkup(<CoverageTable study={diagnostics} />)
    assert.match(html, /Coverage not published/)
    assert.doesNotMatch(html, /<table/)
    assert.doesNotMatch(html, /%/)
  }
})

test('an unavailable panel never shows its per-asset rows, even if the payload carries them', () => {
  setLanguage('en')
  const html = renderToStaticMarkup(<CoverageTable study={study({ inputAvailability: { ...available, available: false } })} />)
  assert.doesNotMatch(html, /BTCUSDT/)
  assert.match(html, /Coverage not published/)
})

test('every string of the section has a Chinese rendering', () => {
  setLanguage('zh')
  try {
    const html = renderToStaticMarkup(<CoverageTable study={study({ inputAvailability: available })} />)
    for (const text of ['资产', '周期数', '首条', '末条', '行情覆盖率', '因子覆盖率']) assert.ok(html.includes(text), text)
    assert.doesNotMatch(html, />(Asset|Bars|First bar|Last bar|Input coverage|Factor coverage)</)
    assert.match(html, /5,910/)
    const legacy = renderToStaticMarkup(<CoverageTable study={study({ coverage: [{ asset: 'ETHUSDT', coverage: 0.75 }] })} />)
    assert.doesNotMatch(legacy, /published factor coverage only/)
    const empty = renderToStaticMarkup(<CoverageTable study={study({})} />)
    assert.doesNotMatch(empty, /Coverage not published|did not publish per-asset/)
  } finally { setLanguage('en') }
})

test('the Factor page mounts the coverage section on the Stability tab, and the component computes nothing', () => {
  const page = readFileSync(resolve(SRC, 'pages/Factor.tsx'), 'utf8')
  assert.match(page, /'sec-coverage': 'stability'/)
  assert.match(page, /<CoverageTable study=\{study\} \/>/)
  const component = readFileSync(resolve(SRC, 'pages/FactorCoverage.tsx'), 'utf8')
  assert.doesNotMatch(component, /\.reduce\(|Math\.|\.filter\(/)
})
