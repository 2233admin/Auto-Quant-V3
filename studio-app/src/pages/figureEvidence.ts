import type { FactorDiagnostics, FactorSplit } from '../api'
import { signedNumber } from '../design/signConvention'
import { studyTestVisible, TEST_HIDDEN_NOTE } from './testGate'

/** Captions read the published split summary, never chart endpoints spanning several splits. */
export function groupReturnCaption(study: FactorDiagnostics, split: FactorSplit = 'validation'): string {
  if (split === 'test' && !studyTestVisible(study)) return TEST_HIDDEN_NOTE
  const value = study.spreadSummary?.status === 'available' ? study.spreadSummary.splits.find(s => s.split === split)?.totalReturn : undefined
  return typeof value === 'number' && Number.isFinite(value)
    ? `Long-short compounds ${signedNumber(value * 100, 1, '%')} over the ${split} window, before costs.`
    : `No ${split} long-short total return is published for this Run.`
}

export function rankIcCaption(study: FactorDiagnostics, split: 'validation' | 'test' = 'validation'): string {
  if (split === 'test' && !studyTestVisible(study)) return TEST_HIDDEN_NOTE
  const value = (split === 'test' ? study.summary.testAudit : study.summary.validation)?.meanRankIc
  return typeof value === 'number' && Number.isFinite(value)
    ? `Mean rank IC is ${signedNumber(value, 4)} over the ${split} window at the primary ${study.protocol.primaryHorizon}-bar horizon.`
    : `No ${split} mean rank IC is published for this Run.`
}

export function portfolioCaption(value: number | null | undefined, split: 'validation' | 'test', testVisible: boolean): string {
  if (split === 'test' && !testVisible) return TEST_HIDDEN_NOTE
  return typeof value === 'number' && Number.isFinite(value)
    ? `The portfolio returns ${signedNumber(value * 100, 2, '%')} over the ${split} window, after costs.`
    : `No ${split} net total return is published for this Run.`
}
