import { useEffect, useId, useState } from 'react'
import type { ProjectSnapshot } from '../api'
import { Notice } from '../Notice'
import { ActionHttpError, errorCopy, type ErrorCopy } from './client'
import { launchPreviewed, previewAction, START_ID } from './candidateApi'
import { CopyButton } from './CopyButton'
import type { ActionsBootstrap, Preview } from './types'

type State =
  | { state: 'loading' }
  | { state: 'ready'; preview: Preview }
  | { state: 'error'; copy: ErrorCopy }

/** Confirmation for session.start: the exact command, the current family trial count, and a second acknowledgment. */
export function StartSessionDialog({
  project,
  bootstrap,
  studyId,
  onClose,
  onLaunched,
}: {
  project: ProjectSnapshot
  bootstrap: ActionsBootstrap
  studyId: string
  onClose: () => void
  onLaunched: (jobId: string) => void
}) {
  const [load, setLoad] = useState<State>({ state: 'loading' })
  const [second, setSecond] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<ErrorCopy | null>(null)
  const ids = { title: useId(), second: useId() }

  useEffect(() => {
    const controller = new AbortController()
    previewAction(bootstrap, START_ID, project.id, { study: studyId }, controller.signal)
      .then((preview) => setLoad({ state: 'ready', preview }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setLoad({ state: 'error', copy: errorCopy(reason, 'preview this command') })
      })
    return () => controller.abort()
  }, [bootstrap, project.id, studyId])

  const ready = load.state === 'ready' ? load.preview : null
  const trial = ready?.trial as unknown as { currentFamilyTrials?: number; notice?: string } | null | undefined
  const confirm = async () => {
    if (!ready) return
    setBusy(true)
    setFailure(null)
    try {
      const created = await launchPreviewed(bootstrap, ready, second)
      onLaunched(created.jobId)
    } catch (reason) {
      setBusy(false)
      setFailure(errorCopy(reason instanceof ActionHttpError ? reason : reason, 'start the Session'))
    }
  }

  return (
    <form
      className="adialog-body"
      aria-labelledby={ids.title}
      onSubmit={(event) => {
        event.preventDefault()
        if (ready && second && !busy) void confirm()
      }}
    >
      <header className="adialog-head">
        <h2 id={ids.title}>Start session</h2>
        <p className="small muted">
          Project: <span translate="no">{project.name}</span> · Study <span className="mono" translate="no">{studyId}</span> · Nothing runs until you confirm below.
        </p>
      </header>
      <div className="adialog-scroll">
        <section className="apreview" aria-live="polite" aria-busy={load.state === 'loading'}>
          <h3>The exact command</h3>
          {load.state === 'loading' && <p className="small muted">Checking preconditions and building the command…</p>}
          {load.state === 'error' && <Notice kind="error" label="Error" title={load.copy.title} subtitle={load.copy.detail} />}
          {ready && (
            <>
              <div className="cmdrow">
                <pre className="cmd mono" translate="no" tabIndex={0} aria-label="Command to run">{ready.display}</pre>
                <CopyButton text={ready.display} label="Copy command" />
              </div>
              <dl className="kv akv">
                <dt>Command hash</dt>
                <dd className="mono" translate="no">{ready.commandHash}</dd>
              </dl>
              {trial && (
                <div className="trial atrial" role="note">
                  <p className="trial-head">
                    The research family has {trial.currentFamilyTrials ?? 0} counted source {trial.currentFamilyTrials === 1 ? 'trial' : 'trials'} now.
                  </p>
                  <p className="small">{trial.notice ? `${trial.notice[0].toUpperCase()}${trial.notice.slice(1)}.` : 'Starting a Session opens a trial family.'}</p>
                </div>
              )}
              <p className="small muted">{ready.writes} Time limit {Math.round(ready.timeoutSeconds / 60)} minutes, then the process is stopped.</p>
            </>
          )}
        </section>
      </div>
      <div className="adialog-pinned">
        {failure && <Notice kind="error" label="Error" title={failure.title} subtitle={failure.detail} />}
        {ready && (
          <div className="asecond">
            <input id={ids.second} type="checkbox" checked={second} onChange={(event) => setSecond(event.target.checked)} />
            <label htmlFor={ids.second}>I understand this opens a Session and its trial family on Study {studyId}.</label>
          </div>
        )}
      </div>
      <footer className="adialog-foot">
        <button type="submit" className="abtn abtn--primary" disabled={!ready || !second || busy}>
          {busy ? 'Starting…' : 'Confirm and start'}
        </button>
        <button type="button" className="abtn" onClick={onClose}>Cancel</button>
        <span className="small muted afoot-hint">{!ready ? 'Confirm unlocks after the command is shown.' : !second ? 'Tick the acknowledgment to enable Confirm.' : ''}</span>
      </footer>
    </form>
  )
}
