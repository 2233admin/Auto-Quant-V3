import type { FactorDiagnostics, ProjectSnapshot, RankSummary, RunRow } from '../../api'
import { testVisible } from '../testGate'

/** Fields the Run route sends that the shared FactorDiagnostics type does not name yet. Optional on purpose: older servers omit them. */
export type RunDiagnostics = FactorDiagnostics & {
  run: { status?: string; summary?: string; inputHash?: string; studyHash?: string; sourceHash?: string; objective?: { metric?: string; direction?: string } }
  dataset: { hash?: string }
  harness?: { id?: string; version?: string; commit?: string | null; dirty?: boolean }
  researchHorizon?: { id?: string; primaryForwardBars?: number }
  summary: { validation?: RankSummary & { meanPearsonIc?: number | null }; testAudit?: RankSummary & { meanPearsonIc?: number | null } }
}

export type RunPayload = {
  schemaVersion: number
  kind: 'autoquant-studio-run'
  projectId: string
  runId: string
  factorExplorer: RunDiagnostics
}

export const short = (hash: string | null | undefined, n = 10): string => (hash ? hash.slice(0, n) : '—')

/** The test number is drawn only when the protocol says it is a visible diagnostic; otherwise it stays hidden. */
export function testAuditVisible(fe: RunDiagnostics): boolean {
  return testVisible(fe.protocol, fe.summary)
}

// ---------------------------------------------------------------------------------------------
// Lane routing: /api/v1/run serves Factor Runs only, so the lane is read from the Project snapshot before any fetch.

const EXPLORER_VIEWS = [
  ['portfolioExplorer', 'portfolio', 'Portfolio'],
  ['rlExplorer', 'rl', 'RL policy'],
  ['bookRiskExplorer', 'bookrisk', 'Book Risk'],
  ['bookPathStressExplorer', 'bookstress', 'Path Stress'],
  ['allocationExplorer', 'allocation', 'Allocation'],
  ['eventStudyExplorer', 'event-study', 'Event Study'],
] as const
const LAYER_VIEWS: Record<string, (typeof EXPLORER_VIEWS)[number][1] | undefined> = { portfolio: 'portfolio', 'rl-policy': 'rl' }

export type OtherLane = { view: 'portfolio' | 'rl' | 'bookrisk' | 'bookstress' | 'allocation' | 'event-study'; lane: string }

/** The non-Factor lane a Run belongs to, or null for a Factor Run (or when the snapshot does not say). Read from the snapshot only. */
export function otherLaneOf(project: ProjectSnapshot, runId: string): OtherLane | null {
  for (const [key, view, lane] of EXPLORER_VIEWS) {
    const ex = project[key] as { run?: { id?: string } } | null
    if (ex?.run?.id === runId) return { view, lane }
  }
  const row = project.runs.find((r) => r.id === runId)
  const layer = (row as (RunRow & { metricLayers?: { kind?: string } }) | undefined)?.metricLayers?.kind
  const view = layer ? LAYER_VIEWS[layer] : undefined
  if (view) return { view, lane: EXPLORER_VIEWS.find((e) => e[1] === view)![2] }
  return null
}
