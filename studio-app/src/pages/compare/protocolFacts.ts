import { getLanguage, translate, uiTemplate, uiText } from '../../i18n'
import type { Comparison, HistoryRun } from '../../library/runHistoryApi'
import { testVisible, TEST_HIDDEN_NOTE } from '../testGate'

/** One side of one fact: `text` is the single readable line, `full` the complete value for hover, copy and expansion. */
export type FactValue = { text: string; full: string; hash: boolean }
export type FactState = 'Same' | 'Different' | 'Missing' | 'Intended change'
export type FactRow = { key: string; label: string; a: FactValue; b: FactValue; state: FactState }

type Obj = Record<string, unknown>
const obj = (value: unknown): Obj | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : undefined
const json = (value: unknown) => value == null ? '—' : typeof value === 'string' ? value : JSON.stringify(value, null, 2)
const NONE = '—'

/** First 8 hex characters of a hash; an algorithm prefix such as `sha256:` is dropped from the short form only. */
export const shortHash = (hash: unknown): string => typeof hash === 'string' && hash ? hash.replace(/^[a-z0-9]+:/i, '').slice(0, 8) : NONE
const hashValue = (hash: unknown): FactValue => ({ text: shortHash(hash), full: typeof hash === 'string' && hash ? hash : NONE, hash: typeof hash === 'string' && !!hash })
const plain = (value: unknown, text?: string): FactValue => ({ text: text ?? (value == null ? NONE : typeof value === 'string' ? value : JSON.stringify(value)), full: json(value), hash: false })

const SPLITS = [['train', 'Train', '训练'], ['validation', 'Validation', '验证'], ['test', 'Test', '测试']] as const

/**
 * "Train 2024-01-02 → 2024-05-30 · Validation … · Test …". The test window is replaced by the hidden-state word unless
 * this Run's test split passes the shared testGate rule, so a hidden test split never discloses its dates.
 */
export function splitWindowsText(windows: unknown, showTest: boolean, separator = ' · '): string {
  const all = obj(windows)
  if (!all) return NONE
  const language = getLanguage()
  return SPLITS.map(([key, en, zh]) => {
    const name = translate(language, en, zh)
    if (key === 'test' && !showTest) return `${name} ${uiText('Hidden')}`
    const w = obj(all[key])
    return `${name} ${typeof w?.start === 'string' ? w.start : '?'} → ${typeof w?.end === 'string' ? w.end : '?'}`
  }).join(separator)
}

export function horizonText(horizon: unknown): string {
  const h = obj(horizon)
  if (!h || typeof h.primaryForwardBars !== 'number') return NONE
  const diagnostics = Array.isArray(h.diagnosticForwardBars) ? h.diagnosticForwardBars.filter(n => n !== h.primaryForwardBars) : []
  const primary = uiTemplate('{0} bars primary', [h.primaryForwardBars])
  return diagnostics.length ? `${primary} · ${uiTemplate('diagnostic {0}', [diagnostics.join(', ')])}` : primary
}

export function costText(cost: unknown, objectKind: string): string {
  if (cost == null) return objectKind === 'factor' ? uiText('None (Factor measurement)') : NONE
  if (typeof cost === 'number') return `${cost} ${uiText('bps')}`
  const c = obj(cost)
  if (!c) return String(cost)
  if (c.unknown === true) return uiText('Unknown')
  const parts = [typeof c.costModel === 'string' ? c.costModel : undefined, typeof c.baseCostBps === 'number' ? `${c.baseCostBps} ${uiText('bps')}` : undefined,
    typeof c.noTradeOneWay === 'number' ? uiTemplate('no-trade band {0}', [c.noTradeOneWay]) : undefined].filter(Boolean)
  return parts.length ? parts.join(' · ') : JSON.stringify(c)
}

export function objectiveText(objective: unknown): string {
  const o = obj(objective)
  if (!o) return NONE
  const direction = o.direction === 'maximize' ? uiText('Maximize') : o.direction === 'minimize' ? uiText('Minimize') : String(o.direction ?? '')
  const parts = [`${direction} ${String(o.metric ?? NONE)}`.trim()]
  if (typeof o.minimumImprovement === 'number') parts.push(uiTemplate('minimum improvement {0}', [o.minimumImprovement]))
  return parts.join(' · ')
}

const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)

/** Test visibility for one side: the comparison's factor payload when present, otherwise the server's same two-part flag. */
export function sideTestVisible(c: Comparison, side: 0 | 1): boolean {
  const factor = c.factors?.[side]
  if (factor) return testVisible(factor.protocol, factor.summary)
  const run = side === 0 ? c.a : c.b
  return testVisible({ testRole: run.testAuditVisible ? 'visible-diagnostic' : undefined }, { testAudit: run.testAuditVisible || null })
}

/** One readable row per protocol fact, in reading order; the Core comparison payload is not altered. */
export function protocolFactRows(c: Comparison): FactRow[] {
  const missing = new Set(c.differences.filter(d => d.reason === 'missing').map(d => d.field))
  const show = [sideTestVisible(c, 0), sideTestVisible(c, 1)]
  const p = (run: HistoryRun) => run.protocol
  const study = (run: HistoryRun) => obj(p(run).study) ?? {}
  const rows: FactRow[] = []
  const add = (key: string, label: string, field: string, pick: (run: HistoryRun, side: 0 | 1) => { raw: unknown; value: FactValue }) => {
    const [x, y] = [pick(c.a, 0), pick(c.b, 1)]
    const state: FactState = field === 'sourceHash' ? (same(x.raw, y.raw) ? 'Same' : 'Intended change')
      : !same(x.raw, y.raw) ? 'Different' : missing.has(field) ? 'Missing' : 'Same'
    rows.push({ key, label: uiText(label), a: x.value, b: y.value, state })
  }
  const field = (name: string, format: (value: unknown, run: HistoryRun) => string) => (run: HistoryRun) => ({ raw: p(run)[name], value: plain(p(run)[name], format(p(run)[name], run)) })
  const hashOf = (name: string) => (run: HistoryRun) => ({ raw: study(run)[name], value: hashValue(study(run)[name]) })
  add('objectKind', 'Object kind', 'objectKind', field('objectKind', v => v == null ? NONE : String(v)))
  add('lane', 'Lane', 'lane', field('lane', v => v == null ? NONE : String(v)))
  add('study.id', 'Study id', 'study', run => ({ raw: study(run).id, value: plain(study(run).id) }))
  add('study.hash', 'Study hash', 'study', hashOf('hash'))
  add('study.judgeHash', 'Judge hash', 'study', hashOf('judgeHash'))
  add('study.programHash', 'Program hash', 'study', hashOf('programHash'))
  add('study.dependenciesHash', 'Dependencies hash', 'study', hashOf('dependenciesHash'))
  add('datasetId', 'Dataset id', 'datasetId', field('datasetId', v => v == null ? NONE : String(v)))
  add('datasetHash', 'Dataset hash', 'datasetHash', run => ({ raw: p(run).datasetHash, value: hashValue(p(run).datasetHash) }))
  // Comparison stays on the full windows (Core checked them); only the displayed text is gated per side.
  add('splitWindows', 'Split windows', 'splitWindows', (run, side) => ({ raw: p(run).splitWindows,
    value: { text: splitWindowsText(p(run).splitWindows, show[side]), full: splitWindowsText(p(run).splitWindows, show[side], '\n'), hash: false } }))
  add('horizon', 'Research horizon', 'horizon', field('horizon', horizonText))
  add('costModel', 'Cost model', 'costModel', field('costModel', (v, run) => costText(v, String(p(run).objectKind ?? run.objectKind))))
  add('objective', 'Objective', 'objective', field('objective', objectiveText))
  add('sourceHash', 'Candidate source hash', 'sourceHash', run => ({ raw: run.sourceHash, value: hashValue(run.sourceHash) }))
  return rows
}

/** Hover note for a split-window value whose test window is hidden on that side. */
export const hiddenTestNote = (c: Comparison, side: 0 | 1) => sideTestVisible(c, side) ? undefined : uiText(TEST_HIDDEN_NOTE)
export const highlighted = (row: FactRow) => row.state === 'Different' || row.state === 'Missing'
