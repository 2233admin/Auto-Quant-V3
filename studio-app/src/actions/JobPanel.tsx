import { useCallback, useEffect, useRef, useState } from 'react'
import { getJson, type ProjectResponse } from '../api'
import { plural } from '../format'
import { Glyph, type GlyphKind } from '../design/icons'
import { Notice } from '../Notice'
import { routeHref } from '../route'
import { useActions } from './ActionsContext'
import { actionCall, ActionHttpError, errorCopy } from './client'
import { CopyButton } from './CopyButton'
import { StagePipeline } from './StagePipeline'
import { isTerminal, type ActionsBootstrap, type Job, type JobStatus } from './types'

export const POLL_FAST_MS = 1_000
export const POLL_SLOW_MS = 5_000
export const SLOW_AFTER_MS = 60_000
const RETRY_MS = 3_000

type Poll = { job: Job | null; error: ActionHttpError | null; failures: number }

/** Polls GET jobs/<id>: every second, every 5 seconds after a minute, and retries through a lost connection. */
function useJob(jobId: string, bootstrap: ActionsBootstrap, onTerminal: () => void): Poll {
  const [poll, setPoll] = useState<Poll>({ job: null, error: null, failures: 0 })
  const finished = useRef(onTerminal)
  finished.current = onTerminal
  useEffect(() => {
    const controller = new AbortController()
    const began = Date.now()
    let timer = 0
    let failures = 0
    let notified = false
    const tick = async () => {
      let delay = Date.now() - began > SLOW_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS
      try {
        const job = await actionCall<Job>(bootstrap, 'GET', `/api/v1/jobs/${encodeURIComponent(jobId)}`, undefined, controller.signal)
        failures = 0
        setPoll({ job, error: null, failures: 0 })
        if (isTerminal(job.status)) {
          if (!notified) {
            notified = true
            finished.current()
          }
          return
        }
      } catch (reason) {
        if (controller.signal.aborted) return
        const error = reason instanceof ActionHttpError ? reason : new ActionHttpError('other', 0, 'client.unknown', String(reason))
        failures += 1
        setPoll((prev) => ({ job: prev.job, error, failures }))
        // A rejected token or an unknown job will not heal by retrying.
        if (error.kind === 'token' || error.kind === 'unknown-job') return
        delay = RETRY_MS
      }
      timer = window.setTimeout(tick, delay)
    }
    void tick()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [jobId, bootstrap])
  return poll
}

const STATUS_LOOK: Record<JobStatus, { glyph: GlyphKind; word: string; signal: boolean }> = {
  queued: { glyph: 'proposed', word: 'Queued', signal: false },
  running: { glyph: 'running', word: 'Running', signal: false },
  succeeded: { glyph: 'confirmed', word: 'Succeeded', signal: false },
  failed: { glyph: 'error', word: 'Failed', signal: true },
  cancelled: { glyph: 'dropped', word: 'Cancelled', signal: false },
  'timed-out': { glyph: 'error', word: 'Timed out', signal: true },
}

function elapsed(job: Job, now: number): string {
  if (!job.startedAt) return '—'
  const start = Date.parse(job.startedAt)
  const end = job.endedAt ? Date.parse(job.endedAt) : now
  if (Number.isNaN(start) || Number.isNaN(end)) return '—'
  const seconds = Math.max(0, Math.round((end - start) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

/** The Run before `runId` on the same Study, from the refreshed Project snapshot. Null when there is none. */
async function previousRun(project: string, runId: string): Promise<string | null> {
  const body = await getJson<ProjectResponse>(`/api/v1/project?id=${encodeURIComponent(project)}`)
  const runs = body.projects[0]?.runs ?? []
  const created = runs.find((r) => r.id === runId)
  if (!created) return null
  const earlier = runs.filter((r) => r.studyId === created.studyId && r.id !== runId && r.startedAt <= created.startedAt)
  earlier.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  return earlier[0]?.id ?? null
}

function Result({ job }: { job: Job }) {
  const runId = job.createdRefs.runId
  const [previous, setPrevious] = useState<{ state: 'loading' } | { state: 'none' } | { state: 'ready'; id: string }>({ state: 'loading' })
  useEffect(() => {
    if (!runId) return
    let live = true
    previousRun(job.project, runId)
      .then((id) => live && setPrevious(id ? { state: 'ready', id } : { state: 'none' }))
      .catch(() => live && setPrevious({ state: 'none' }))
    return () => {
      live = false
    }
  }, [job.project, runId])
  if (!runId) {
    return (
      <p className="small">
        The command exited with code 0 but its output named no new Run. Check the Project's Runs list before assuming anything changed.
      </p>
    )
  }
  const runHref = routeHref({ view: 'run', id: job.project, run: runId })
  return (
    <div className="jr">
      <p className="small">
        <strong>A new Run was written:</strong> <span className="mono" translate="no">{runId}</span>
        {job.createdRefs.experimentId && (
          <>
            {' '}
            from Experiment <span className="mono" translate="no">{job.createdRefs.experimentId}</span>
          </>
        )}
        . It counts as one trial and cannot be removed.
      </p>
      <p className="jr-links">
        <a className="abtn abtn--primary" href={runHref}>Open the new Run</a>
        {previous.state === 'ready' ? (
          <a className="abtn" href={routeHref({ view: 'compare', id: job.project, a: previous.id, b: runId })}>Compare with previous Run</a>
        ) : (
          <span className="small muted">{previous.state === 'loading' ? 'Looking for the previous Run…' : 'No earlier Run on this Study to compare with.'}</span>
        )}
      </p>
      <p className="small muted">The verdict, trial counter and selection adjustment are on the Run page, read from the refreshed Project snapshot. This panel shows only the job's own status.</p>
    </div>
  )
}

function Tail({ label, text, open }: { label: string; text: string; open?: boolean }) {
  return (
    <details className="tail" open={open}>
      <summary>
        {label} <span className="faint small">{text ? plural(text.split('\n').filter(Boolean).length, 'line') : 'empty'}</span>
      </summary>
      <pre className="tail-body mono" tabIndex={0} aria-label={`${label} tail`}>{text || '(no output)'}</pre>
    </details>
  )
}

/** The progress panel for the job whose id is in the URL hash. Docked bottom right; survives navigation and reload. */
export function JobPanel({ jobId, bootstrap }: { jobId: string; bootstrap: ActionsBootstrap }) {
  const { setActiveJobId, jobFinished } = useActions()
  const { job, error, failures } = useJob(jobId, bootstrap, jobFinished)
  const [now, setNow] = useState(() => Date.now())
  const [collapsed, setCollapsed] = useState(false)
  const [cancel, setCancel] = useState<{ state: 'idle' } | { state: 'busy' } | { state: 'error'; message: string }>({ state: 'idle' })
  const done = job ? isTerminal(job.status) : false

  useEffect(() => {
    if (done) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [done])

  const requestCancel = useCallback(async () => {
    setCancel({ state: 'busy' })
    try {
      await actionCall<Job>(bootstrap, 'POST', `/api/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {})
      setCancel({ state: 'idle' })
    } catch (reason) {
      const copy = errorCopy(reason, 'cancel the job')
      setCancel({ state: 'error', message: `${copy.title} ${copy.detail}` })
    }
  }, [bootstrap, jobId])

  const look = job ? STATUS_LOOK[job.status] : null
  const stuck = error && (error.kind === 'token' || error.kind === 'unknown-job')
  const copy = error ? errorCopy(error, 'read the job') : null

  return (
    <aside className={`jobdock${collapsed ? ' is-collapsed' : ''}`} aria-label="Job progress" data-status={job?.status ?? 'loading'}>
      <header className="jobdock-head">
        <div className="jobdock-title">
          <strong>Run analysis</strong>
          <span className="faint small mono" translate="no">{job?.project ?? ''}</span>
        </div>
        <div className="jobdock-status" role="status" aria-live="polite">
          {look ? (
            <span className="state">
              <Glyph kind={look.glyph} signal={look.signal} />
              <span className={look.signal ? 'sig' : undefined}>{look.word}</span>
              {job && <span className="faint small mono">{elapsed(job, now)}</span>}
            </span>
          ) : (
            <span className="muted small">{error ? 'Not loaded' : 'Loading job…'}</span>
          )}
        </div>
        <button type="button" className="abtn abtn--quiet" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
        {(done || stuck) && (
          <button type="button" className="abtn abtn--quiet" onClick={() => setActiveJobId(null)} aria-label="Close the job panel">
            Close
          </button>
        )}
      </header>
      {!collapsed && (
        <div className="jobdock-body">
          <p className="small muted jobdock-origin">
            <span className="alabel">launched from Studio</span> job <span className="mono" translate="no">{jobId}</span>
          </p>

          {error && copy && (
            <div role="alert" className="jobdock-alert">
              <Notice kind="error" label="Error" title={stuck ? copy.title : failures > 1 ? `${copy.title} Retrying (attempt ${failures}).` : `${copy.title} Retrying.`} subtitle={copy.detail} />
            </div>
          )}

          {job && (
            <>
              <StagePipeline job={job} />
              <div className="cmdrow">
                <pre className="cmd mono" translate="no">{job.display}</pre>
                <CopyButton text={job.display} label="Copy command" />
              </div>

              {job.status === 'succeeded' && <Result job={job} />}
              {job.status === 'failed' && (
                <div className="jr" role="alert">
                  <p>
                    <strong>The command failed</strong> with exit code <span className="mono">{job.exitCode ?? 'unknown'}</span>. Studio shows no verdict for a failed command.
                  </p>
                  {job.createdRefs.runId && <p className="small">A Run was written before the failure: <span className="mono">{job.createdRefs.runId}</span>. It still counts as a trial.</p>}
                </div>
              )}
              {job.status === 'timed-out' && (
                <p className="small" role="alert">
                  <strong>The command ran past its time limit</strong> and was stopped. Anything it had already written stays in the Project and counts; check the Runs list.
                </p>
              )}
              {job.status === 'cancelled' && (
                <p className="small">
                  <strong>Cancelled.</strong> Cancelling does not remove an Experiment that was already written; check the Runs list.
                </p>
              )}

              <Tail label="stderr" text={job.stderrTail} open={job.status === 'failed'} />
              <Tail label="stdout" text={job.stdoutTail} />
              {job.truncated && <p className="small muted">Output was longer than Studio keeps; only the last 256 KiB per stream is shown.</p>}
            </>
          )}

          {!done && !stuck && (
            <div className="jobdock-actions">
              <button type="button" className="abtn" onClick={requestCancel} disabled={cancel.state === 'busy' || !job}>
                {cancel.state === 'busy' ? 'Cancelling…' : 'Cancel job'}
              </button>
              <span className="small muted">Stops the process. A Run the command already wrote is kept.</span>
            </div>
          )}
          {cancel.state === 'error' && <p className="small sig" role="alert">{cancel.message}</p>}
        </div>
      )}
    </aside>
  )
}
