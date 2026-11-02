import type { FactorDiagnostics, FactorSplit } from '../api'
import { signedNumber } from '../design/signConvention'
import { uiTemplate, uiText } from '../i18n'
import { studyTestVisible, TEST_HIDDEN_NOTE } from './testGate'

/** Captions read the published split summary, never chart endpoints spanning several splits. */
export function groupReturnCaption(study: FactorDiagnostics, split: FactorSplit = 'validation'): string {
  if (split === 'test' && !studyTestVisible(study)) return uiText(TEST_HIDDEN_NOTE)
  const value = study.spreadSummary?.status === 'available' ? study.spreadSummary.splits.find(s => s.split === split)?.totalReturn : undefined
  return typeof value === 'number' && Number.isFinite(value)
    ? uiTemplate('Long-short compounds {0} over the {1} window, before costs.', [signedNumber(value * 100, 1, '%'), uiText(split)])
    : uiTemplate('No {0} long-short total return is published for this Run.', [uiText(split)])
}

export function rankIcCaption(study: FactorDiagnostics, split: 'validation' | 'test' = 'validation'): string {
  if (split === 'test' && !studyTestVisible(study)) return uiText(TEST_HIDDEN_NOTE)
  const value = (split === 'test' ? study.summary.testAudit : study.summary.validation)?.meanRankIc
  return typeof value === 'number' && Number.isFinite(value)
    ? uiTemplate('Mean rank IC is {0} over the {1} window at the primary {2}-bar horizon.', [signedNumber(value, 4), uiText(split), study.protocol.primaryHorizon])
    : uiTemplate('No {0} mean rank IC is published for this Run.', [uiText(split)])
}

export function portfolioCaption(value: number | null | undefined, split: 'validation' | 'test', testVisible: boolean): string {
  if (split === 'test' && !testVisible) return uiText(TEST_HIDDEN_NOTE)
  return typeof value === 'number' && Number.isFinite(value)
    ? uiTemplate('The portfolio returns {0} over the {1} window, after costs.', [signedNumber(value * 100, 2, '%'), uiText(split)])
    : uiTemplate('No {0} net total return is published for this Run.', [uiText(split)])
}
