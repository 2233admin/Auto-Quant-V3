import { uiTemplate, uiText, uiValue } from '../i18n'
import { useState } from 'react'
import type { FactorDiagnostics, ProjectSnapshot, RunRow } from '../api'
import type { Idea, IdeaBinding } from '../actions/ideaApi'
import { jobError } from '../actions/ideaApi'
import type { Job } from '../actions/types'
import { isTerminal } from '../actions/types'
import { ActionRow, MetricGrid, PaneCard, VerdictBar, StatusLine, StatChips, FactsDialog, type LockedParam } from '../components/workbench'
import { routeHref } from '../route'
import { testVisible } from './testGate'
import { coreGroups } from './FactorWorkbench'
import { FactorHero, spreadGroups } from './GroupReturn'
import { signedNumber } from '../design/signConvention'
import { FactorComparisons } from './FactorComparisons'
import { TEST_HIDDEN_NOTE } from './testGate'

export type IdeaVerdictState = 'Supported' | 'Inconclusive' | 'Could not be tested'

/** Translate an existing Core diagnosis, never statistical thresholds or portfolio admission. */
export function ideaVerdict(study: FactorDiagnostics | null, adjustmentPass: boolean | null | undefined): IdeaVerdictState {
  const q = study?.factorQualification
  if (!q?.available || !q.diagnosis || q.claim?.claim !== 'decision-signal' || q.claim.outcome !== 'forward-return') return 'Could not be tested'
  // The current Judge has no falsification protocol for a caller's prose.
  return q.diagnosis.stage === 'decision-signal-positive' && adjustmentPass === true ? 'Supported' : 'Inconclusive'
}

/** A compact selection of the existing validation tiles; no new numerical calculations. */
export function ideaMetricGroups(study: FactorDiagnostics, project: ProjectSnapshot) {
  const labels = ['Mean rank IC', 'HAC t', 'HAC p', 'Hit rate', 'Rank IC IR', 'Observations']
  return [
    ...coreGroups({ study, project, validation: study.summary.validation, testAudit: undefined, testVisible: false, defs: study.protocol.semantics })
      .map(g => ({ ...g, tiles: g.tiles.filter(t => labels.map(uiText).includes(t.label)) })),
    ...(study.quantileEvidence.status === 'available' ? spreadGroups(study, false) : []),
  ]
}

export function IdeaVerdict({ project, idea, study, run, job, busy, onDeclareTrial, runs = run ? [run] : [], onSelectRun, params = [] }: { project: ProjectSnapshot; idea: Idea; study: FactorDiagnostics | null; run: RunRow | null; job: Job | null; busy: string; onDeclareTrial?: () => void; runs?: RunRow[]; onSelectRun?: (id: string) => void; params?: LockedParam[] }) {
  const [parameters, setParameters] = useState(false)
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
  const showEvidence = !!study && status !== 'Could not be tested'
  const diagnostics = study ? { label: uiText("Open diagnostics"), href: routeHref({ view: 'factor', id: project.id, run: study.run.id }) } : undefined
  const failure = job && (job.result || job.stderrTail || job.stdoutTail)
    ? jobError(job)
    : `The analysis command failed${!run ? ' before producing a Run' : ''}. This retained job receipt has no error details; inspect the candidate before retrying.`
  const word = pending ? 'In progress' : !hasAttempt ? 'Not tested' : status
  const stages = job?.stages ?? []
  const done = stages.filter(s => s.state === 'done').length
  const stageText = job?.stageMode === 'whole-action' ? 'Command-level progress' : stages.length ? `${done}/${stages.length} stages complete` : 'Stage count not recorded'
  const duration = run?.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : job?.startedAt && job.endedAt ? `${((Date.parse(job.endedAt) - Date.parse(job.startedAt)) / 1000).toFixed(1)}s` : 'Duration not recorded'
  const exportJson = () => {
    // Export exactly the evidence already allowed on this page, never hidden test payloads.
    const payload = { run, question: binding, verdict: word, developmentEvidenceOnly: true, validation: study?.summary.validation ?? null }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `${run?.id ?? 'idea'}-development.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <PaneCard label={uiText("Idea verdict")}>
    <div className="idea-answer">
      <div className="idea-run-selector" data-measure="selector">
        <select aria-label={uiText("Analysis Run")} value={run?.id ?? ''} onChange={e => onSelectRun?.(e.target.value)}>
          {!runs.length && <option value="">{uiValue(word)}</option>}
          {runs.map((r, i) => <option key={r.id} value={r.id}>{r.startedAt?.replace('T', ' ').slice(0, 19) ?? r.id} · {r.id === run?.id ? word : r.status === 'succeeded' ? uiText("Completed") : uiText("Could not be tested")}{uiText(" · Trial ")}{runs.length - i}</option>)}
        </select>
        <StatChips label={uiText("Run facts")} scope="development" stats={[
          ...(showEvidence && !pending && study.summary.validation ? [{ label: uiText("Rank IC"), value: signedNumber(study.summary.validation.meanRankIc, 4), signed: true, focal: true }] : []),
          { label: uiText("Trials"), value: String(count) },
        ]} />
      </div>
      <div className="idea-action-chips" data-measure="chips"><ActionRow align="start" secondary={[
        { label: uiText("Parameters"), onClick: () => setParameters(true) },
        ...(diagnostics ? [diagnostics] : []),
        ...(run && !pending ? [{ label: uiText("Export JSON"), onClick: exportJson }] : []),
        ...(onDeclareTrial ? [{ label: uiText("Declare another trial"), onClick: onDeclareTrial }] : []),
      ]} /></div>
      <div className="idea-status" data-measure="status"><StatusLine state={pending ? 'running' : !hasAttempt ? 'idle' : failedJob || failedRun ? 'failed' : 'done'} text={pending ? busy || 'Analysis in progress' : !hasAttempt ? 'Not tested · author a candidate to begin' : `${failedJob || failedRun ? 'Analysis failed' : 'Analysis complete'} · ${stageText}`} percent={pending ? null : hasAttempt && !failedJob && !failedRun ? 100 : undefined} elapsed={hasAttempt ? duration : undefined} /></div>
      {pending ? <div className="idea-empty"><h2>{uiText("Analysis in progress")}</h2><p>{busy || uiText("The fixed Judge is running.")}</p><p className="small muted">{uiText("Preflight → baseline or candidate Run → validation evidence. Trial records are retained even if execution fails.")}</p><p className="small">{uiText("The original question and verdict wording are fixed for this attempt.")}</p></div>
      : !hasAttempt ? <div className="idea-empty"><h2>{uiText("Not tested")}</h2><p>{uiText("Define the factor on the left, then run one bounded analysis.")}</p><p className="small muted">{uiText("You will confirm the exact command and trial count before execution. Inconclusive is a valid stopping point.")}</p></div>
      : <><VerdictBar tone={status === 'Supported' ? 'ok' : status === 'Could not be tested' ? 'bad' : 'warn'} word={status} detail={sentence}>{status === 'Supported' ? uiText("Development evidence only") : status === 'Inconclusive' ? uiText("Not established, not disproved") : uiText("No scientific conclusion")}</VerdictBar>
        {showEvidence && <><FactorHero key={study.run.id} study={study} minHeight={200} /><section className="idea-core-metrics" data-measure="metrics" aria-label={uiText("Core metrics")}><h2 className="set-title">{uiText("Core metrics")}</h2><MetricGrid groups={ideaMetricGroups(study, project)} /><p className="small muted idea-conclusion">{sentence}</p></section><FactorComparisons study={study} runs={runs} projectId={project.id} /></>}
        {study && status === 'Could not be tested' && !failedJob && !failedRun && <p className="small">{study.factorQualification.diagnosis?.explanation ?? uiText("Core publishes no applicable qualification protocol.")}</p>}
        {(failedJob || failedRun) && <p className="small idea-failure">{failedRun ? run.summary : failure}</p>}
        <dl className="set-kv">
          <dt>{uiText("Evidence range")}</dt><dd>{failedJob || failedRun ? uiText("No completed evidence for this attempt") : uiTemplate("Validation · {0}", [range])}</dd>
          <dt>{uiText("Trials retained")}</dt><dd>{count} {count === 1 ? uiText("execution") : uiText("executions")} · {family?.uniqueSourceTrials ?? count}{uiText(" distinct sources")}</dd>
          <dt>{uiText("Test audit")}</dt><dd>{study && !failedJob && !failedRun && testVisible(study.protocol, study.summary) ? uiText("Published diagnostic only; never independent confirmation") : uiText(TEST_HIDDEN_NOTE)}</dd>
          <dt>{uiText("Sealed holdout")}</dt><dd>{uiText("Not opened by this flow. Sealed-tail intake is not implemented.")}</dd>
        </dl>
        <details className="idea-evidence"><summary>{uiText("Question identity and evidence")}</summary>
          <blockquote className="idea-original">“{binding.hypothesis}”</blockquote>
          {showEvidence && <p className="small">{uiValue(study.factorQualification.diagnosis?.explanation)}</p>}
          <dl className="set-kv"><dt>{uiText("Hypothesis SHA-256")}</dt><dd className="mono">{binding.hypothesisSha256}</dd><dt>{uiText("Wording policy")}</dt><dd>{binding.verdictPolicy}</dd><dt>{uiText("Authority")}</dt><dd>{uiText("Studio audit binding; not a Core Hypothesis or immutable Verdict Record.")}</dd></dl>
          {run && <a className="small" href={routeHref({ view: 'run', id: project.id, run: run.id })}>{uiText("Inspect this immutable Run")}</a>}
          <p className="small muted">{uiText("Support needs Core’s positive decision-signal diagnosis and the trial-family adjustment. Failure to qualify for Portfolio research is not a refutation.")}</p>
        </details>
      </>}
    </div>
    <FactsDialog open={parameters} onClose={() => setParameters(false)} title={uiText("Study parameters")} facts={params} note={uiText("Locked by the Study. Candidate edits cannot change evaluation authority.")} />
  </PaneCard>
}
