import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ProjectSnapshot } from '../api'
import { Notice } from '../Notice'
import { actionCall, ActionHttpError, errorCopy, type ErrorCopy } from './client'
import { CopyButton } from './CopyButton'
import { EVALUATE_ID } from './useCatalog'
import type { CatalogAction, CatalogSession, Preview } from './types'

/** Mirrors the catalog schema and the server's own checks; the server stays the authority. */
export function validateHypothesis(text: string, min: number, max: number): string | null {
  if (text.length === 0) return `Required: ${min} to ${max} characters.`
  if (/[\u0000-\u001f\u007f]/.test(text)) return 'No line breaks or control characters.'
  if (text !== text.trim()) return 'No spaces at the start or end.'
  if (text.startsWith('-')) return 'Must not start with a dash.'
  if (text.length < min) return `${min - text.length} more character${min - text.length === 1 ? '' : 's'} needed (minimum ${min}).`
  if (text.length > max) return `${text.length - max} over the ${max} character limit.`
  return null
}

type PreviewState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; preview: Preview }
  | { state: 'error'; copy: ErrorCopy; kind: ActionHttpError['kind'] | 'other'; issues: { path?: string; message?: string }[] }

const PREVIEW_DELAY_MS = 450

function adjustmentLine(preview: Preview): string {
  const adj = preview.trial.adjustment
  if (!adj) return 'No selection adjustment is recorded for this family yet, so every figure stays in-sample.'
  const method = adj.method ? ` (${adj.method})` : ''
  if (adj.passes === true) return `The family currently passes the selection adjustment${method}. One more counted trial raises the number of tests the adjustment must correct for, so the adjusted p-value can only rise.`
  if (adj.passes === false) return `The family currently fails the selection adjustment${method}. One more counted trial raises the number of tests the adjustment corrects for; it does not improve this.`
  return `Selection adjustment is ${adj.status ?? 'not available'}${adj.reason ? ` (${adj.reason})` : ''}. One more counted trial enlarges the family the adjustment will have to correct for.`
}

/**
 * Everything the owner must see before a Run is launched: the exact command, its hash, whether the
 * precondition held, which trial this is, and a second explicit confirmation. A native modal dialog gives
 * Esc to close, an inert page behind it and focus return.
 */
export function ConfirmActionDialog({
  project,
  bootstrap,
  action,
  sessions,
  preferred,
  onClose,
  onLaunched,
}: {
  project: ProjectSnapshot
  bootstrap: Parameters<typeof actionCall>[0]
  action: CatalogAction
  sessions: CatalogSession[]
  preferred: string | undefined
  onClose: () => void
  onLaunched: (jobId: string) => void
}) {
  const { minLength, maxLength } = action.params.hypothesis
  const [session, setSession] = useState(preferred ?? sessions[0]?.session ?? '')
  const [hypothesis, setHypothesis] = useState('')
  const [touched, setTouched] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({ state: 'idle' })
  const [second, setSecond] = useState(false)
  const [launch, setLaunch] = useState<{ state: 'idle' } | { state: 'busy' } | { state: 'error'; copy: ErrorCopy }>({ state: 'idle' })
  const [stale, setStale] = useState(false)
  const ids = { hyp: useId(), hypErr: useId(), session: useId(), second: useId(), title: useId() }
  const hypothesisRef = useRef<HTMLTextAreaElement>(null)
  const problem = validateHypothesis(hypothesis, minLength, maxLength)
  const selected = sessions.find((s) => s.session === session)

  // The native dialog moves focus to its first control when it opens; take it back for the field the owner must fill.
  useEffect(() => {
    const timer = window.setTimeout(() => hypothesisRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const runPreview = useCallback(
    (signal: AbortSignal, keepStale = false) => {
      setPreview({ state: 'loading' })
      setSecond(false)
      if (!keepStale) setStale(false)
      return actionCall<Preview>(
        bootstrap,
        'POST',
        '/api/v1/actions/preview',
        { actionId: EVALUATE_ID, project: project.id, params: { session, hypothesis } },
        signal,
      )
        .then((data) => setPreview({ state: 'ready', preview: data }))
        .catch((reason: unknown) => {
          if (signal.aborted) return
          const kind = reason instanceof ActionHttpError ? reason.kind : 'other'
          setPreview({ state: 'error', copy: errorCopy(reason, 'preview this command'), kind, issues: reason instanceof ActionHttpError ? reason.issues : [] })
        })
    },
    [bootstrap, project.id, session, hypothesis],
  )

  // Preview whenever the inputs are valid; any edit discards the old preview and its confirmation.
  useEffect(() => {
    setLaunch({ state: 'idle' })
    if (problem || !session || selected?.available === false) {
      setPreview({ state: 'idle' })
      setSecond(false)
      return
    }
    const controller = new AbortController()
    setPreview({ state: 'loading' })
    setSecond(false)
    const timer = window.setTimeout(() => void runPreview(controller.signal), PREVIEW_DELAY_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
    // runPreview already depends on session and hypothesis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hypothesis, problem, selected?.available])

  const ready = preview.state === 'ready' ? preview.preview : null
  const canConfirm = ready !== null && second && launch.state !== 'busy'

  const confirm = async () => {
    if (!ready) return
    setLaunch({ state: 'busy' })
    try {
      const created = await actionCall<{ jobId: string }>(bootstrap, 'POST', '/api/v1/actions', {
        actionId: EVALUATE_ID,
        project: project.id,
        params: ready.params,
        confirm: true,
        commandHash: ready.commandHash,
        secondConfirm: second,
      })
      onLaunched(created.jobId)
    } catch (reason) {
      if (reason instanceof ActionHttpError && reason.kind === 'stale') {
        // State moved under the preview: show the new command and make the owner confirm it again.
        setStale(true)
        setLaunch({ state: 'idle' })
        const controller = new AbortController()
        await runPreview(controller.signal, true)
        return
      }
      setLaunch({ state: 'error', copy: errorCopy(reason, 'start the analysis') })
    }
  }

  const hypothesisIssue = preview.state === 'error' ? preview.issues.find((i) => i.path?.endsWith('hypothesis')) : undefined
  const showProblem = (touched || hypothesis.length > 0) && problem
  const trial = ready?.trial

  return (
    <form
      className="adialog-body"
      aria-labelledby={ids.title}
      onSubmit={(event) => {
        event.preventDefault()
        if (canConfirm) void confirm()
      }}
    >
      <header className="adialog-head">
        <h2 id={ids.title}>Run analysis</h2>
        <p className="small muted">
          Project: <span translate="no">{project.name}</span> · Nothing runs until you confirm below.
        </p>
      </header>

      <div className="adialog-scroll">
        <div className="afield">
          <label htmlFor={ids.session}>Session</label>
          {sessions.length > 1 ? (
            <select id={ids.session} value={session} onChange={(e) => setSession(e.target.value)}>
              {sessions.map((s) => (
                <option key={s.session} value={s.session} disabled={!s.available}>
                  {s.session}
                  {s.available ? '' : ' (blocked)'}
                </option>
              ))}
            </select>
          ) : (
            <p id={ids.session} className="mono small" translate="no">{session}</p>
          )}
          {selected?.available === false && <p className="small sig">{selected.blockedBy}</p>}
        </div>

        <div className="afield">
          <label htmlFor={ids.hyp}>
            Hypothesis <span className="faint small">what this candidate is meant to test, {minLength} to {maxLength} characters</span>
          </label>
          <textarea
            id={ids.hyp}
            ref={hypothesisRef}
            rows={2}
            value={hypothesis}
            maxLength={maxLength + 50}
            aria-invalid={showProblem || hypothesisIssue ? true : undefined}
            aria-describedby={ids.hypErr}
            onChange={(e) => setHypothesis(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              // Enter inside the field must not submit the form; the confirm button is the only way to run.
              if (e.key === 'Enter' && !e.shiftKey) e.preventDefault()
            }}
          />
          <p id={ids.hypErr} className={`small ${showProblem || hypothesisIssue ? 'sig' : 'faint'}`} aria-live="polite">
            {hypothesisIssue?.message ?? (showProblem ? problem : `${hypothesis.length} / ${maxLength}`)}
          </p>
        </div>


        <section className="apreview" aria-live="polite" aria-busy={preview.state === 'loading'}>
          <h3>The exact command</h3>
          {preview.state === 'idle' && <p className="small muted">Enter a valid hypothesis to see the exact command Studio would run.</p>}
          {preview.state === 'loading' && <p className="small muted">Checking preconditions and building the command…</p>}
          {preview.state === 'error' && hypothesisIssue && <p className="small muted">No command was built: Studio refused the hypothesis above.</p>}
          {preview.state === 'error' && preview.kind !== 'validation' && <Notice kind="error" label="Error" title={preview.copy.title} subtitle={preview.copy.detail} />}
          {preview.state === 'error' && preview.kind === 'validation' && !hypothesisIssue && <Notice kind="error" label="Error" title={preview.copy.title} subtitle={preview.copy.detail} />}
          {ready && (
            <>
              <div className="cmdrow">
                <pre className="cmd mono" translate="no" tabIndex={0} aria-label="Command to run">{ready.display}</pre>
                <CopyButton text={ready.display} label="Copy command" />
              </div>
              <dl className="kv akv">
                <dt>Command hash</dt>
                <dd className="mono" translate="no">{ready.commandHash}</dd>
                <dt>Precondition</dt>
                <dd>Passed: Session active, authority valid, candidate differs from the leader.</dd>
              </dl>
              {trial && (
                <div className="trial atrial" role="note">
                  <p className="trial-head">This will be trial {trial.n} of {trial.m} in this research family</p>
                  <p className="small">{adjustmentLine(ready)}</p>
                  <p className="small">
                    {trial.notice ? `${trial.notice[0].toUpperCase()}${trial.notice.slice(1)}.` : ''}
                    {trial.externalHoldoutRequired ? ' An external holdout is already required.' : ''}
                  </p>
                </div>
              )}
              <p className="small muted">
                {ready.writes} A Run cannot be hidden, deleted or reverted out of the count, and cancelling the job later does not remove an Experiment it already wrote. Time limit {Math.round(ready.timeoutSeconds / 60)} minutes, then the process is stopped.
              </p>
            </>
          )}
        </section>


      </div>

      <div className="adialog-pinned">
          {stale && (
            <Notice kind="info" label="Info" title="The Project changed since the preview." subtitle="Nothing was run. Review the refreshed command and trial number, then confirm again." />
          )}
          {launch.state === 'error' && <Notice kind="error" label="Error" title={launch.copy.title} subtitle={launch.copy.detail} />}
      {ready && action.requiresSecondConfirm && (
        <div className="asecond">
          <input id={ids.second} type="checkbox" checked={second} onChange={(e) => setSecond(e.target.checked)} />
          <label htmlFor={ids.second}>
            I understand this adds trial {trial?.n} of {trial?.m} to the family permanently and shows test audit values.
          </label>
        </div>
      )}
      </div>
      <footer className="adialog-foot">
        <button type="submit" className="abtn abtn--primary" disabled={!canConfirm}>
          {launch.state === 'busy' ? 'Starting…' : 'Confirm and run'}
        </button>
        <button type="button" className="abtn" onClick={onClose}>
          Cancel
        </button>
        <span className="small muted afoot-hint">
          {!ready ? 'Confirm unlocks after the command is shown.' : !second ? 'Tick the acknowledgment to enable Confirm.' : ''}
        </span>
      </footer>
    </form>
  )
}
