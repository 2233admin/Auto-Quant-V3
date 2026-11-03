import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { setLanguage } from '../src/i18n'
import { FactorTearSheet } from '../src/pages/FactorTearSheet'
import { tearStudy } from './tearSheetFixture'

test('tear sheet renders six figures, all five groups, captions, tables and definitions', () => {
  const html = renderToStaticMarkup(<FactorTearSheet study={tearStudy()} />)
  assert.equal((html.match(/class="wb-chart"/g) ?? []).length, 6)
  for (const label of ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'IC decay', 'Rank autocorrelation', 'No cost model']) assert.ok(html.includes(label), label)
  assert.equal((html.match(/class="figure-caption"/g) ?? []).length, 6)
  assert.equal((html.match(/<table/g) ?? []).length, 6)
  assert.ok(html.includes('tearTurnover'))
})

test('test gate excludes test control and every test number before audit', () => {
  const study = tearStudy()
  const html = renderToStaticMarkup(<FactorTearSheet study={study} />)
  assert.doesNotMatch(html, /value="test"|0\.9877|98\.765|98\.7654/)
  study.protocol.testRole = 'visible-diagnostic'
  const visible = renderToStaticMarkup(<FactorTearSheet study={study} />)
  assert.match(visible, /value="test"/)
  // Default stays validation even when a test audit is available.
  assert.doesNotMatch(visible, /98\.7654/)
})

test('legacy absence and temporal evidence show explicit states without values', () => {
  const study = tearStudy()
  delete study.tearSheet
  assert.match(renderToStaticMarkup(<FactorTearSheet study={study} />), /Not published by this Run/)
  study.tearSheet = { schemaVersion: 1, status: 'protocol-unavailable', reason: 'cross-sectional-population-required' }
  assert.match(renderToStaticMarkup(<FactorTearSheet study={study} />), /unavailable for temporal/)
})

test('Chinese copy and risk boundary retain published units without return curves', () => {
  const study = tearStudy()
  setLanguage('zh')
  try {
    const html = renderToStaticMarkup(<FactorTearSheet study={study} />)
    assert.match(html, /完整因子报告/)
    assert.match(html, /无成本模型/)
    assert.match(html, /短样本/)
  } finally { setLanguage('en') }
  study.tearSheet!.outcome = 'forward-realized-volatility'
  const risk = renderToStaticMarkup(<FactorTearSheet study={study} />)
  assert.match(risk, /forward realized volatility/)
  assert.doesNotMatch(risk, /Cumulative group returns|Long-short gross/)
})
