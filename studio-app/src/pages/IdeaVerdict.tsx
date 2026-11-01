import type { FactorDiagnostics, ProjectSnapshot, RunRow } from '../api'
import type { Idea, IdeaBinding } from '../actions/ideaApi'
import type { Job } from '../actions/types'
import { isTerminal } from '../actions/types'
import { PaneCard, VerdictBar } from '../components/workbench'
import { routeHref } from '../route'
import { testVisible } from './testGate'

export type IdeaVerdictState = 'Supported' | 'Refuted' | 'Inconclusive' | 'Could not be tested'

/** Translate an existing Core diagnosis, never statistical thresholds or portfolio admission. */
export function ideaVerdict(study: FactorDiagnostics | null, adjustmentPass: boolean | null | undefined): IdeaVerdictState {
  const q = study?.factorQualification
  if (!q?.available || !q.diagnosis || q.claim?.claim !== 'decision-signal' || q.claim.outcome !== 'forward-return') return 'Could not be tested'
  // The current Judge has no falsification protocol for a caller's prose. Refuted is reserved, never synthesized.
  return q.diagnosis.stage === 'decision-signal-positive' && adjustmentPass === true ? 'Supported' : 'Inconclusive'
}

export function IdeaVerdict({ project, idea, study, run, job, busy }: { project: ProjectSnapshot; idea: Idea; study: FactorDiagnostics | null; run: RunRow | null; job: Job | null; busy: string }) {
  const sessions = project.sessions.filter(s => (s.session?.studyId ?? s.studyId) === run?.studyId)
  const integrity = sessions[0]?.selectionIntegrity
  // Session adjustment describes its leader, which may differ from this candidate Run.
  const boundEvidence = idea.evidence?.runId === run?.id ? idea.evidence : null
  const adjustment = boundEvidence?.selectionAdjustment
  const family = boundEvidence?.researchFamily
  const count = family?.totalExecutions ?? integrity?.researchFamily?.totalExecutions ?? project.runs.filter(r => r.studyId === 'ohlcv-factor-quality').length
  const failedJob = job && isTerminal(job.status) && job.status !== 'succeeded' && ['session.start', 'session.check', 'experiment.evaluate'].includes(job.actionId)
  const failedRun = run && run.status !== 'succeeded'
  const binding: IdeaBinding = idea.bindings.find(b => b.runId === run?.id && !!run) ?? idea.bindings.find(b => b.jobId === job?.jobId) ?? idea.bindings[0] ?? idea
  const pending = !!busy || (job && !isTerminal(job.status))
  const hasAttempt = !!run || !!failedJob
  const status = failedJob || failedRun ? 'Could not be tested' : ideaVerdict(study, adjustment?.passes)
  const sentence = status === 'Supported'
    ? 'The declared ranking claim is supported on development data; independent confirmation is still required.'
    : status === 'Inconclusive'
      ? 'The evidence does not establish this ranking claim; it has not been disproved.'
      : 'This attempt could not answer the original question because execution or the required protocol was unavailable.'
  const validation = study?.protocol.splits.splits.validation
  const range = validation ? `${validation.start} – ${validation.end}` : 'No validated evidence range'
  return <PaneCard label="Idea verdict" tabs={<h2 className="set-title">Your answer</h2>}>
    <div className="idea-answer">
      {pending ? <><h2>Analysis in progress</h2><p>{busy || 'The fixed Judge is running.'}</p><p className="small muted">Preflight → baseline or candidate Run → validation evidence. Trial records are retained even if execution fails.</p><p className="small">The original question and verdict wording are fixed for this attempt.</p></>
      : !hasAttempt ? <><h2>Ready to test your idea</h2><p>Define the factor on the left, then run one bounded analysis.</p><p className="small muted">You will confirm the exact command and trial count before execution. Inconclusive is a valid stopping point.</p></>
      : <><VerdictBar tone={status === 'Supported' ? 'ok' : status === 'Could not be tested' ? 'bad' : 'warn'} word={status}>{status === 'Supported' ? 'Development evidence only' : status === 'Inconclusive' ? 'Not established, not disproved' : 'No scientific conclusion'} </VerdictBar>
        <h2 className="idea-conclusion">{sentence}</h2>
        <blockquote className="idea-original">“{binding.hypothesis}”</blockquote>
        {study && !failedJob && !failedRun && <p className="small">{study.factorQualification.diagnosis?.explanation ?? 'Core publishes no applicable qualification protocol.'}</p>}
        {(failedJob || failedRun) && <p className="small">{failedRun ? run.summary : 'The candidate did not complete the analysis. Inspect the execution details below and repair the candidate before another attempt.'}</p>}
        <dl className="set-kv">
          <dt>Evidence range</dt><dd>{failedJob || failedRun ? 'No completed evidence for this attempt' : `Validation · ${range}`}</dd>
          <dt>Trials retained</dt><dd>{count} {count === 1 ? 'execution' : 'executions'} · {family?.uniqueSourceTrials ?? count} distinct sources</dd>
          <dt>Test audit</dt><dd>{study && !failedJob && !failedRun && testVisible(study.protocol, study.summary) ? 'Published diagnostic only; never independent confirmation' : 'Hidden until its audit exists'}</dd>
          <dt>Sealed holdout</dt><dd>Not opened by this flow. Sealed-tail intake is not implemented.</dd>
        </dl>
        <details><summary>Question identity and evidence</summary><dl className="set-kv"><dt>Hypothesis SHA-256</dt><dd className="mono">{binding.hypothesisSha256}</dd><dt>Wording policy</dt><dd>{binding.verdictPolicy}</dd><dt>Authority</dt><dd>Studio audit binding; not a Core Hypothesis or immutable Verdict Record.</dd></dl></details>
        <p className="mono small idea-hash" title={binding.hypothesisSha256}>Question hash · {binding.hypothesisSha256}</p>
        {run && <a className="small" href={routeHref({ view: 'run', id: project.id, run: run.id })}>Inspect this immutable Run</a>}
        {study && <a className="small" href={routeHref({ view: 'factor', id: project.id, run: study.run.id })}>Open Factor diagnostics</a>}
      </>}
      <p className="small muted">Support needs Core’s positive decision-signal diagnosis and the trial-family adjustment. Failure to qualify for Portfolio research is not a refutation.</p>
    </div>
  </PaneCard>
}
