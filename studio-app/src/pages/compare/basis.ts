import { uiTemplate, uiText } from '../../i18n'
import type { ProjectSnapshot } from '../../api'
import { testAuditVisible, type RunDiagnostics } from '../run/runTypes'

export type Check = { key: string; label: string; a: string | null; b: string | null; state: 'same' | 'different' | 'missing' }

export type Basis = {
  mode: { name: string; meaning: string }
  locked: boolean
  checks: Check[]
  /** Fields neither Run carries, listed so the banner can say what is missing. */
  missing: string[]
}

function check(key: string, label: string, a: string | null | undefined, b: string | null | undefined): Check {
  const x = a ?? null
  const y = b ?? null
  return { key, label, a: x, b: y, state: x === null || y === null ? 'missing' : x === y ? 'same' : 'different' }
}

const windowOf = (fe: RunDiagnostics, withTest: boolean) => {
  const s = fe.protocol.splits.splits
  const base = `train ${s.train.start.slice(0, 10)}..${s.train.end.slice(0, 10)} / validation ${s.validation.start.slice(0, 10)}..${s.validation.end.slice(0, 10)}`
  return withTest ? `${base} / test ${s.test.start.slice(0, 10)}..${s.test.end.slice(0, 10)}` : base
}

/** Compares only fields the payload carries. Nothing is inferred when a hash is absent. */
export function compareBasis(a: RunDiagnostics, b: RunDiagnostics): Basis {
  const bothTest = testAuditVisible(a) && testAuditVisible(b)
  const dataset = check('dataset', 'Dataset hash', a.dataset.hash, b.dataset.hash)
  const horizon = check('horizon', 'Research horizon id', a.researchHorizon?.id, b.researchHorizon?.id)
  const candidate = check('candidate', 'Candidate source hash', a.run.sourceHash, b.run.sourceHash)
  const checks: Check[] = [
    dataset,
    horizon,
    candidate,
    check('primary', 'Primary horizon (bars)', String(a.protocol.primaryHorizon), String(b.protocol.primaryHorizon)),
    check('window', bothTest ? 'Train / validation / test windows' : 'Train / validation windows', windowOf(a, bothTest), windowOf(b, bothTest)),
    check('universe', 'Universe', a.dataset.universe.join(','), b.dataset.universe.join(',')),
    check('study', 'Study hash', a.run.studyHash, b.run.studyHash),
  ]
  const missing = checks
    .filter((c) => (c.key === 'dataset' || c.key === 'horizon') && c.state === 'missing')
    .map((c) => `${c.label} (${[c.a === null ? 'Run A' : null, c.b === null ? 'Run B' : null].filter(Boolean).join(' and ')})`)
  const locked = dataset.state === 'same' && horizon.state === 'same'
  let mode: Basis['mode']
  if (missing.length > 0) {
    mode = { name: 'Basis not comparable', meaning: 'A hash the comparison needs is not in the payload, so nothing here proves the two Runs measure the same thing.' }
  } else if (dataset.state === 'different') {
    mode = { name: 'Different data', meaning: 'The Runs were evaluated on different datasets. A delta mixes the effect of the candidate with the effect of the data; it is not a before/after result.' }
  } else if (horizon.state === 'different') {
    mode = { name: 'Same data, different horizon', meaning: 'The Runs predict over different horizons. A delta compares different questions.' }
  } else if (candidate.state === 'different') {
    mode = { name: 'Same data, different candidate', meaning: 'Same dataset and horizon, different candidate source. A delta is the effect of the candidate change, subject to the trial count below.' }
  } else {
    mode = { name: 'Same data, same candidate', meaning: 'Same dataset, horizon and candidate source. Any delta is re-run variation, not an improvement.' }
  }
  return { mode, locked, checks, missing }
}

export type Row = { label: string; a: number | null; b: number | null; digits: number; better: 'higher' | 'lower' | null; group: 'validation' | 'test' }

const rows = (fe: RunDiagnostics, group: 'validation' | 'test') => {
  const s = group === 'validation' ? fe.summary.validation : fe.summary.testAudit
  return {
    ic: s?.meanRankIc ?? null,
    ir: s?.rankIcir ?? null,
    t: s?.hacTStatistic ?? null,
    p: s?.hacNormalPValue ?? null,
    hit: s?.rankHitRate ?? null,
    n: s?.observations ?? null,
  }
}

export function metricRows(a: RunDiagnostics, b: RunDiagnostics): Row[] {
  const out: Row[] = []
  const add = (group: 'validation' | 'test', prefix: string) => {
    const x = rows(a, group)
    const y = rows(b, group)
    out.push(
      { label: uiTemplate("{0} mean rank IC", [prefix]), a: x.ic, b: y.ic, digits: 4, better: 'higher', group },
      { label: uiTemplate("{0} IC information ratio", [prefix]), a: x.ir, b: y.ir, digits: 3, better: 'higher', group },
      { label: uiTemplate("{0} HAC t-statistic", [prefix]), a: x.t, b: y.t, digits: 2, better: 'higher', group },
      { label: uiTemplate("{0} HAC p-value", [prefix]), a: x.p, b: y.p, digits: 3, better: 'lower', group },
      { label: uiTemplate("{0} rank hit rate", [prefix]), a: x.hit, b: y.hit, digits: 3, better: 'higher', group },
      { label: uiTemplate("{0} observations", [prefix]), a: x.n, b: y.n, digits: 0, better: null, group },
    )
  }
  add('validation', 'Validation')
  // The test number appears only when both Runs' protocols mark the test split as a visible diagnostic.
  if (testAuditVisible(a) && testAuditVisible(b)) add('test', 'Test audit')
  return out
}

export function deltaWord(row: Row): string {
  if (row.a === null || row.b === null) return uiText("not computed")
  if (row.group === 'test') return uiText("visible audit only, not for selection")
  const d = row.b - row.a
  if (d === 0) return 'unchanged'
  if (row.better === null) return d > 0 ? 'more' : 'fewer'
  return (d > 0) === (row.better === 'higher') ? uiText("better number") : uiText("worse number")
}

/** Sentences about how the better number was obtained, built only from counts and dates the server sent. */
export function provenanceSentences(a: RunDiagnostics, b: RunDiagnostics, project: ProjectSnapshot): string[] {
  const out: string[] = []
  const wa = a.protocol.splits.splits
  const wb = b.protocol.splits.splits
  const sameWindows =
    (testAuditVisible(a) && testAuditVisible(b) ? (['train', 'validation', 'test'] as const) : (['train', 'validation'] as const)).every((k) => wa[k].start === wb[k].start && wa[k].end === wb[k].end)
  if (!sameWindows) {
    out.push('A different window: the train, validation or test dates differ between the two Runs, so a better number may come from the window and not from the candidate.')
  }
  if (a.dataset.hash && b.dataset.hash && a.dataset.hash !== b.dataset.hash) {
    out.push('A different dataset: the dataset hashes differ.')
  }
  const family = project.sessions.map((s) => s.selectionIntegrity?.researchFamily).find((f) => f)
  if (family) {
    out.push(
      `More trials: the Project's research family counts ${family.uniqueSourceTrials} unique candidate trial${family.uniqueSourceTrials === 1 ? '' : 's'} and ${family.totalExecutions} execution${family.totalExecutions === 1 ? '' : 's'} (${family.trialCountAssumption}). The server sends no per-Run trial count, so the later Run can only be read as the best of up to ${family.uniqueSourceTrials} tries, not as a single pre-registered test.`,
    )
    if (a.run.startedAt && b.run.startedAt && a.run.startedAt !== b.run.startedAt) {
      out.push(`Run ${a.run.startedAt < b.run.startedAt ? 'B' : 'A'} started later, so it was evaluated after the earlier Run was already seen.`)
    }
  } else {
    out.push('Trial counts: the server sent no research-family trial count for this Project, so how many tries produced either number is unknown.')
  }
  return out
}
