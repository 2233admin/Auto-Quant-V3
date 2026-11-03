import type { FactorSummary, LibraryPoint, ProjectSummary, StrategySummary, WorkspaceSummary } from '../src/api'

/**
 * Deterministic synthetic libraries for UI tests and layout screenshots only. Nothing here is research evidence and no
 * Project is ever created from it: it is a plain WorkspaceSummary object handed to the library components.
 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const curve = (next: () => number, drift: number, n = 32): LibraryPoint[] => {
  let v = 1
  return Array.from({ length: n }, (_, i) => ({ split: i < n * 0.7 ? 'train' : 'validation', value: (v *= 1 + drift + (next() - 0.5) * 0.04) }))
}

const base = (id: string, name: string, description: string, library: ProjectSummary['library']): ProjectSummary => ({
  id, name, description, valid: true, diagnostics: 0, counts: {}, studies: [], runCount: 3, latestRunAt: '2026-11-03T10:00:00Z',
  brief: { headline: null, lane: null, stage: null, mode: null }, externalHoldout: { present: false, status: null }, library,
})

const VERDICTS: FactorSummary['verdict'][] = ['Supported', 'Inconclusive', 'Inconclusive', 'Not tested', 'Could not be tested']

export function syntheticFactors(count: number, seed = 7): ProjectSummary[] {
  const next = rng(seed)
  return Array.from({ length: count }, (_, i) => {
    const verdict = VERDICTS[Math.floor(next() * VERDICTS.length)]
    const tested = verdict === 'Supported' || verdict === 'Inconclusive'
    const ic = tested ? (next() - 0.42) * 0.12 : null
    const day = 1 + Math.floor(next() * 28)
    const factor: FactorSummary = {
      studyId: 'ohlcv-factor-quality', verdict, question: `Synthetic factor ${i + 1}`, expression: `rank(close / delay(close, ${2 + (i % 18)}))`, bound: true, request: null, evidence: null,
      validation: tested ? { meanRankIc: ic, hacTStatistic: (ic as number) * 40 + (next() - 0.5) } : null,
      trials: 1 + Math.floor(next() * 14), updatedAt: `2026-10-${String(day).padStart(2, '0')}T0${i % 10}:00:00Z`,
      points: tested ? curve(next, (ic as number) * 0.05) : [], protocol: { testRole: 'audit' }, testAudit: false,
    }
    return base(`synthetic-factor-${String(i + 1).padStart(3, '0')}`, `momentum-${String(i + 1).padStart(3, '0')}`, factor.question, { factor, strategy: null })
  })
}

export function syntheticStrategies(count: number, seed = 11): ProjectSummary[] {
  const next = rng(seed)
  const states: StrategySummary['state'][] = ['Tuned', 'Backtested', 'Backtested', 'Defined']
  return Array.from({ length: count }, (_, i) => {
    const state = states[Math.floor(next() * states.length)]
    const ret = state === 'Defined' ? null : (next() - 0.45) * 0.8
    const strategy: StrategySummary = {
      state, updatedAt: `2026-10-${String(1 + Math.floor(next() * 28)).padStart(2, '0')}T09:00:00Z`,
      net: ret === null ? null : { totalReturn: ret, sharpe: ret * 3 + (next() - 0.5), maximumDrawdown: -(next() * 0.3) },
      points: ret === null ? [] : curve(next, ret * 0.02),
    }
    return base(`synthetic-strategy-${String(i + 1).padStart(3, '0')}`, `strategy-${String(i + 1).padStart(3, '0')}`, `Synthetic strategy ${i + 1}`, { factor: null, strategy })
  })
}

export const syntheticWorkspace = (projects: ProjectSummary[]): WorkspaceSummary => ({
  kind: 'autoquant-studio-workspace-summary', generatedAt: '2026-11-04T00:00:00Z', harness: {} as WorkspaceSummary['harness'],
  source: { scope: 'fixture', rootDir: '.', workspace: null }, valid: true, diagnostics: [], projects,
})
