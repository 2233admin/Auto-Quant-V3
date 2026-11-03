import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { OverlapLine, RedundancyTable, possibleDuplicate } from '../src/pages/FactorRedundancy'
import type { FactorRedundancy } from '../src/api'
import { METRIC_CATALOGUE } from '../src/metrics/catalogue'

const evidence: FactorRedundancy = {
  schemaVersion: 1, status: 'available', reason: null, split: 'validation', authority: 'diagnostic-only', excluded: [],
  peers: [{ projectId: 'peer', label: 'Five-day reversal', studyId: 's', runId: 'run-peer', sourceHash: 'hash',
    correlation: -0.98, residualRankIc: 0.01, observations: 20, pairedAssetObservations: 100, residualObservations: 20, residualReason: null }],
}

test('duplicate is a strict display heuristic, with null and zero boundaries', () => {
  assert.equal(possibleDuplicate(-0.7, 0.01, 0.1), true)
  assert.equal(possibleDuplicate(0.7, 0.05, 0.1), false)
  assert.equal(possibleDuplicate(0.699, 0, 0.1), false)
  assert.equal(possibleDuplicate(1, 0, 0), false)
  assert.equal(possibleDuplicate(1, null, 0.1), false)
  assert.equal(possibleDuplicate(1, 0, null), false)
})

test('answer quotes peer and residual, with accessible catalogue help', () => {
  const html = renderToStaticMarkup(<OverlapLine redundancy={evidence} validationIc={0.1} />)
  assert.match(html, /Five-day reversal/)
  assert.match(html, /−0.98/)
  assert.match(html, /0.01/)
  assert.match(html, /Possible duplicate/)
  assert.match(html, /Factor overlap: definition/)
})

test('table preserves peer identity and discloses temporal residual boundary', () => {
  const temporal = structuredClone(evidence)
  temporal.peers[0].residualRankIc = null
  temporal.peers[0].residualReason = 'cross-sectional-residualization-not-applicable'
  const html = renderToStaticMarkup(<RedundancyTable redundancy={temporal} />)
  assert.match(html, /run-peer/)
  assert.match(html, /does not apply to temporal Runs/)
  assert.doesNotMatch(html, / · Possible duplicate/)
})

test('unavailable states invent no numbers and catalogue defines both languages', () => {
  const html = renderToStaticMarkup(<OverlapLine />)
  assert.match(html, /unavailable/)
  assert.doesNotMatch(html, /−0.98| · Possible duplicate/)
  for (const id of ['overlapCorrelation', 'residualRankIc'] as const) {
    for (const key of ['definition', 'read', 'core', 'caveat'] as const) {
      assert.ok(METRIC_CATALOGUE[id][key].en)
      assert.ok(METRIC_CATALOGUE[id][key].zh)
    }
  }
})
