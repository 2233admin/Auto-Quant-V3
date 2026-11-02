import { uiText } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import type { ProjectSnapshot } from '../api'
import { Glyph } from '../design/icons'
import { StatusLine } from '../components/workbench'
import { AnimatedDetails } from '../components/motion/AnimatedDetails'
import { useActions } from './ActionsContext'
import { actionCall, errorCopy } from './client'
import { elapsed, useJob } from './JobPanel'
import { StagePipeline } from './StagePipeline'
import { isTerminal, type Job, type JobStatus } from './types'
import './loop.css'

/** What the loop remembers of a finished job so the page can say it plainly after the job panel is gone. */
export type LoopOutcome = {
  jobId: string
  actionId: string
  status: JobStatus
  runId?: string
  experimentId?: string
  exitCode: number | null
  tail: string
  display: string
}

export const outcomeOf = (job: Job): LoopOutcome => ({
  jobId: job.jobId,
  actionId: job.actionId,
  status: job.status,
  runId: job.createdRefs.runId,
  experimentId: job.createdRefs.experimentId,
  exitCode: job.exitCode,
  tail: (job.stderrTail || job.stdoutTail || '').trim().split('\n').slice(-8).join('\n'),
  display: job.display,
})

const NOTE_WHOLE = 'Studio reports this command as a whole, so the bar cannot show a percentage. It is not a guess.'

function percent(job: Job): number | null {
  if (job.status === 'succeeded') return 100
  if (job.stageMode === 'whole-action' || job.stages.length === 0) return null
  const done = job.stages.filter((s) => s.state === 'done' || s.state === 'skipped').length
  return Math.round((done / job.stages.length) * 100)
}

/**
 * The slim one-line progress bar of the Factor workbench: status, bar, percent, elapsed. The stages sit behind a
 * disclosure. Mounts only while a job id is active; calls `onFinished` once when the job ends.
 */
export function LoopProgress({ onFinished }: { onFinished: (outcome: LoopOutcome) => void }) {
  const { state, activeJobId } = useActions()
  if (state.mode !== 'on' || !activeJobId) return null
  return <Running key={activeJobId} jobId={activeJobId} onFinished={onFinished} />
}

function Running({ jobId, onFinished }: { jobId: string; onFinished: (outcome: LoopOutcome) => void }) {
  const { state, setActiveJobId, jobFinished } = useActions()
  const bootstrap = state.mode === 'on' ? state.bootstrap : null
  if (!bootstrap) return null
  return <RunningInner jobId={jobId} bootstrap={bootstrap} onFinished={onFinished} finish={jobFinished} close={() => setActiveJobId(null)} />
}

function RunningInner({
  jobId,
  bootstrap,
  onFinished,
  finish,
  close,
}: {
  jobId: string
  bootstrap: Parameters<typeof actionCall>[0]
  onFinished: (outcome: LoopOutcome) => void
  finish: () => void
  close: () => void
}) {
  const { job, error } = useJob(jobId, bootstrap, finish)
  const [now, setNow] = useState(() => Date.now())
  const [cancelNote, setCancelNote] = useState<string | null>(null)
  const reported = useRef(false)
  const done = job ? isTerminal(job.status) : false

  useEffect(() => {
    if (done) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [done])

  useEffect(() => {
    if (!job || !isTerminal(job.status) || reported.current) return
    reported.current = true
    onFinished(outcomeOf(job))
    close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job])

  const pct = job ? percent(job) : null
  const copy = error ? errorCopy(error, 'read the job') : null
  const cancel = () => {
    actionCall<Job>(bootstrap, 'POST', `/api/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {}).catch((reason: unknown) => {
      const c = errorCopy(reason, 'cancel the job')
      setCancelNote(`${c.title} ${c.detail}`)
    })
  }
  return (
    <div aria-label={uiText("Analysis progress")}>
      <StatusLine
        state="running"
        text={job?.status === 'queued' ? 'Queued' : 'Running'}
        percent={pct}
        elapsed={job ? elapsed(job, now) : '—'}
        onCancel={job ? cancel : undefined}
        details={
          job && (
            <>
              {pct === null && <p className="small faint lp-note">{NOTE_WHOLE}</p>}
              <StagePipeline job={job} />
              <pre className="cmd mono" translate="no">{job.display}</pre>
            </>
          )
        }
      />
      {error && copy && <p className="small sig" role="alert">{copy.title} {copy.detail}</p>}
      {cancelNote && <p className="small sig" role="alert">{cancelNote}</p>}
    </div>
  )
}

const verdictOf = (project: ProjectSnapshot, runId: string | undefined) =>
  runId ? project.sessions.flatMap((s) => s.experiments ?? []).find((e) => e.runId === runId)?.verdict : undefined

/** The plain statement of how the last job ended, kept until dismissed. Shows the Judge verdict from the Session ledger. */
export function LoopResult({ outcome, project, onDismiss }: { outcome: LoopOutcome; project: ProjectSnapshot; onDismiss: () => void }) {
  const verdict = verdictOf(project, outcome.runId)
  const evaluate = outcome.actionId === 'experiment.evaluate'
  let line: string
  let bad = false
  if (outcome.status === 'succeeded') {
    if (!evaluate) line = outcome.actionId === 'session.start' ? 'Session started.' : 'Done.'
    else if (!outcome.runId) line = 'The command exited normally but named no new Run. Check the Runs list before assuming anything changed.'
    else if (!verdict) line = `New Run ${outcome.runId} written. Reading the Judge verdict from the Session ledger…`
    else {
      line = `Judge verdict: ${verdict}. New Run ${outcome.runId} written and counted as one trial.`
      bad = verdict === 'CRASH' || verdict === 'REVERT'
    }
  } else {
    bad = true
    line =
      outcome.status === 'failed'
        ? `The command failed (exit code ${outcome.exitCode ?? 'unknown'}). Studio shows no verdict for a failed command.${outcome.runId ? ` A Run was written before the failure (${outcome.runId}); it still counts as a trial.` : ''}`
        : outcome.status === 'timed-out'
          ? 'The command ran past its time limit and was stopped. Anything it already wrote stays and counts; check the Runs list.'
          : 'Cancelled. Cancelling does not remove an Experiment that was already written.'
  }
  return (
    <section className={`lr${bad ? ' is-bad' : ''}`} aria-label={uiText("Last analysis result")} role="status">
      <Glyph kind={bad ? 'error' : 'confirmed'} signal={bad} />
      <div className="lr-body">
        <p className="lr-line" title={line}>{line}</p>
        {outcome.status !== 'succeeded' && outcome.tail && (
          <AnimatedDetails className="lp-more">
            <summary>{uiText("Command output")}</summary>
            <pre className="cmd mono" translate="no">{outcome.tail}</pre>
          </AnimatedDetails>
        )}
      </div>
      <button type="button" className="abtn abtn--quiet" onClick={onDismiss}>{uiText("Dismiss")}</button>
    </section>
  )
}
