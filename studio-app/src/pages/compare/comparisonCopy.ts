import { uiText, uiTemplate } from '../../i18n'
import type { Comparison } from '../../library/runHistoryApi'

const FIELDS: Record<string, string> = {
  objectKind: 'Object kind', lane: 'Lane', study: 'Study protocol', datasetId: 'Dataset id',
  datasetHash: 'Dataset hash', splitWindows: 'Split windows', horizon: 'Research horizon',
  costModel: 'Cost model', objective: 'Objective', runId: 'Run identity', sourceHash: 'Candidate source hash',
}
export const fieldLabel = (field: string) => uiText(FIELDS[field] ?? field)
export function compareReason(count: number, decision?: Comparison, error?: string): string {
  if (count !== 2) return uiText('Select exactly two Runs to compare.')
  if (error) return uiTemplate('Could not verify comparison: {0}', [error])
  if (!decision) return uiText('Checking comparability…')
  if (decision.status === 'comparable') return uiText('Same evaluation baseline. Delta is subject minus baseline; validation only.')
  return uiTemplate('Not comparable: {0}', [decision.differences.map(d => `${fieldLabel(d.field)} (${uiText(d.reason === 'missing' ? 'Missing' : d.reason === 'same-run' ? 'Same Run' : 'Different')})`).join('; ')])
}

/** Preserve a sign glyph on every finite delta, including exact zero. */
export const deltaText = (value: number | null, digits = 4) => value === null ? '—' : `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(digits)}`
