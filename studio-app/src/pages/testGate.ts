import type { FactorDiagnostics, FactorSplit } from '../api'

/**
 * The single visibility rule for the test split: no test or holdout number is drawn before its audit exists.
 * Visible only when the Run published a test audit AND the protocol marks the test split a visible diagnostic.
 */
export const TEST_HIDDEN_NOTE = 'Test split hidden until its audit exists'

export function testVisible(
  protocol: { testRole?: string } | undefined | null,
  summary: { testAudit?: unknown } | undefined | null,
): boolean {
  return !!summary?.testAudit && protocol?.testRole === 'visible-diagnostic'
}

export const studyTestVisible = (study: Pick<FactorDiagnostics, 'protocol' | 'summary'>): boolean => testVisible(study.protocol, study.summary)

/** Splits that may be drawn for this study; test is dropped when it is not visible. */
export const gatedSplits = <T extends FactorSplit>(study: Pick<FactorDiagnostics, 'protocol' | 'summary'>, all: readonly T[]): T[] =>
  studyTestVisible(study) ? [...all] : all.filter((s) => s !== 'test')
