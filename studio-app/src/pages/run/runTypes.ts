import type { FactorDiagnostics, RankSummary } from '../../api'

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
  return fe.protocol.testRole === 'visible-diagnostic' && !!fe.summary.testAudit
}
