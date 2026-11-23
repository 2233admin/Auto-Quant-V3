import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { setLanguage } from '../src/i18n'
import { DEFAULT_QUANTILES, intakeParams, QUANTILE_CHOICES } from '../src/pages/ideaEditor'
import { QuantileSelect } from '../src/pages/QuantileSelect'

test('the selector offers exactly the group counts Core accepts and defaults to three', () => {
  assert.deepEqual([...QUANTILE_CHOICES], [3, 5, 10])
  assert.equal(DEFAULT_QUANTILES, 3)
  setLanguage('en')
  const html = renderToStaticMarkup(<QuantileSelect value={3} onChange={() => {}} />)
  assert.deepEqual([...html.matchAll(/<option value="(\d+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]), [['3', '3 groups (default)'], ['5', '5 groups'], ['10', '10 groups']])
  assert.match(html, /<option value="3" selected="">/)
  assert.match(html, /Needs at least one prediction asset per group/)
  assert.match(renderToStaticMarkup(<QuantileSelect value={10} onChange={() => {}} />), /<option value="10" selected="">/)
})

test('the selector reads in Chinese', () => {
  setLanguage('zh')
  try {
    const html = renderToStaticMarkup(<QuantileSelect value={5} onChange={() => {}} />)
    assert.match(html, /分组数/)
    assert.match(html, />3 组（默认）</)
    assert.match(html, />10 组</)
    assert.match(html, /随 Study 一同冻结/)
  } finally {
    setLanguage('en')
  }
})

test('the intake preview carries the count only when it is not the default, so the default Study bytes do not change', () => {
  const assets = ['AAPL', 'MSFT', 'NVDA', 'QQQ', 'SPY']
  assert.deepEqual(intakeParams('staging/dataset.json', 1, assets, 3), { dataset: 'staging/dataset.json', horizon: 1, predictionAssets: assets })
  assert.equal('quantiles' in intakeParams('staging/dataset.json', 1, assets, 3), false)
  assert.deepEqual(intakeParams('staging/dataset.json', 5, assets, 5), { dataset: 'staging/dataset.json', horizon: 5, predictionAssets: assets, quantiles: 5 })
  assert.equal(intakeParams('staging/dataset.json', 1, assets, 10).quantiles, 10)
})

test('the idea workbench draws the selector in the data-binding form and sends the chosen count', () => {
  const source = readFileSync(resolve(process.cwd(), 'studio-app/src/pages/IdeaWorkbench.tsx'), 'utf8')
  assert.match(source, /<QuantileSelect value=\{quantiles\} onChange=/)
  assert.match(source, /previewAction\(b, 'project\.intake', project\.id, intakeParams\(dataset, horizon, assets, quantiles\)\)/)
})
