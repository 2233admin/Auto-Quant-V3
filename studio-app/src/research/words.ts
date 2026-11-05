import { uiText } from '../i18n'

/** The parts of a ledger row the formatters read (see researchApi.Row). */
type Row = { id: string; value: number | string | boolean | null; threshold: string | null }
type Shape = 'supported' | 'confirmed' | 'inconclusive' | 'running' | 'challenged' | 'proposed' | 'selected' | 'unconfirmed' | 'dropped' | 'error' | 'empty'

/** Shinka's hypothesis states as words and shapes. The state comes from the notebook; nothing here decides one. */
const STATUS: Record<string, { word: string; glyph: Shape; signal?: boolean }> = {
  proposed: { word: 'Proposed', glyph: 'proposed' },
  selected: { word: 'Selected', glyph: 'selected' },
  running: { word: 'Running', glyph: 'running' },
  challenged: { word: 'Challenged', glyph: 'challenged' },
  supported: { word: 'Supported', glyph: 'supported' },
  rejected: { word: 'Rejected', glyph: 'error', signal: true },
  inconclusive: { word: 'Inconclusive', glyph: 'inconclusive' },
  confirmed: { word: 'Confirmed', glyph: 'confirmed' },
  unconfirmed: { word: 'Unconfirmed', glyph: 'unconfirmed', signal: true },
  dropped: { word: 'Dropped', glyph: 'dropped' },
}

export function statusOf(status: string | null | undefined) {
  const known = status ? STATUS[status] : undefined
  return { word: uiText(known?.word ?? 'Unknown state'), glyph: known?.glyph ?? 'empty', signal: known?.signal ?? false }
}

/** VerdictBand tone of a recorded label; a lockbox confirmation outranks the development verdict. */
export function bandOf(label: string): 'pass' | 'fail' | 'inconclusive' {
  if (label === 'supported' || label === 'confirmed') return 'pass'
  if (label === 'rejected' || label === 'unconfirmed') return 'fail'
  return 'inconclusive'
}

const ROW_LABEL: Record<string, string> = {
  'validation-sharpe': 'Validation Sharpe above zero',
  'beats-buy-hold': 'Validation Sharpe beats buy and hold',
  dsr: 'Deflated Sharpe ratio',
  subperiods: 'Positive validation sub-periods',
  pbo: 'Probability of backtest overfitting',
  'in-sample-best': 'Best in-sample score',
  'in-sample-sharpe': 'In-sample Sharpe of the judged program',
  'noise-frontier': 'Expected best of N noise trials',
  'family-trials': 'Trials counted in the direction',
  'seed-baseline': 'Seed program validation Sharpe',
  decay: 'Validation over in-sample ratio',
  lockbox: 'Lockbox',
}

export const rowLabel = (row: Row) => (ROW_LABEL[row.id] ? uiText(ROW_LABEL[row.id]) : row.id)

const ROW_STATE: Record<string, { word: string; glyph: Shape; signal?: boolean }> = {
  pass: { word: 'Pass', glyph: 'supported' },
  fail: { word: 'Fail', glyph: 'error', signal: true },
  'n.a.': { word: 'Not applicable', glyph: 'empty' },
  withheld: { word: 'Withheld until a verdict', glyph: 'proposed' },
  'not-computed': { word: 'Not computed', glyph: 'dropped' },
  info: { word: 'Reference', glyph: 'empty' },
  none: { word: 'No lockbox', glyph: 'empty' },
  sealed: { word: 'Sealed', glyph: 'selected' },
  opened: { word: 'Opened', glyph: 'challenged' },
  confirmed: { word: 'Confirmed', glyph: 'confirmed' },
  unconfirmed: { word: 'Unconfirmed', glyph: 'unconfirmed', signal: true },
}

export function rowStateOf(state: string) {
  const known = ROW_STATE[state] ?? ROW_STATE['n.a.']
  return { word: uiText(known.word), glyph: known.glyph, signal: known.signal ?? false }
}

/** A threshold as published; the one worded threshold is translated, numeric ones stay as sent. */
export const rowThreshold = (row: Row) => (row.threshold === null ? '—' : row.threshold === '> buy and hold' ? uiText('> buy and hold') : row.threshold)

export function lockboxWord(state: string | undefined): string {
  return rowStateOf(state ?? 'none').word
}

/** A ledger value as published: numbers with fixed digits, fractions as percent; trial counts as integers. */
export function rowValue(row: Row): string {
  const v = row.value
  if (v === null || v === undefined) return '—'
  if (typeof v !== 'number') return String(v)
  if (row.id === 'family-trials') return String(Math.round(v))
  if (row.id === 'subperiods') return `${(v * 100).toFixed(0)}%`
  return v.toFixed(row.id === 'dsr' || row.id === 'pbo' ? 3 : 2)
}

/**
 * Shinka vocabulary that reaches the page as data but is fixed by the research layer: hypothesis body headings,
 * agent-round states, results-ledger event kinds, pipeline stages and patch kinds. Unknown values pass through.
 */
const VOCABULARY: Record<string, string> = {
  Claim: 'Claim', Mechanism: 'Mechanism', Falsification: 'Falsification',
  idle: 'Idle', running: 'Running', waiting: 'Waiting on the owner', open: 'Round open', blocked: 'Blocked', unknown: 'Unknown state',
  scaffold: 'Scaffold', run: 'Run', 'run-failed': 'Run failed', skeptic: 'Skeptic', verdict: 'Verdict', confirm: 'Lockbox opened', probe: 'Probe', event: 'Event',
  sampling: 'Sampling', evaluation: 'Evaluation', postprocess: 'Post-processing', pipeline: 'Whole pipeline',
  diff: 'Diff patch', full: 'Full rewrite', cross: 'Crossover', init: 'Seed',
}
export const vocab = (value: string | null | undefined) => (value ? (VOCABULARY[value] ? uiText(VOCABULARY[value]) : value) : '—')

export const money = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `$${v.toFixed(2)}` : '—')
export const fixed = (v: number | null | undefined, d = 3) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—')
