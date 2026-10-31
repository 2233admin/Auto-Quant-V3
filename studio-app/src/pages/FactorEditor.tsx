import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { type FactorDiagnostics, type ProjectSnapshot } from '../api'
import { ACTIONS_OFF_COPY, useActions } from '../actions/ActionsContext'
import { errorCopy } from '../actions/client'
import { getCandidate, isConflict, runCheck, saveCandidate, type CandidateDoc } from '../actions/candidateApi'
import { ConfirmActionDialog, validateHypothesis } from '../actions/ConfirmActionDialog'
import { CopyButton } from '../actions/CopyButton'
import { StartSessionDialog } from '../actions/StartSessionDialog'
import { useCatalog } from '../actions/useCatalog'
import { CodeField } from '../components/CodeField'
import { Info } from '../components/Info'
import { pickIntegrity } from '../components/TrialCounter'
import { when } from '../format'
import { Modal } from '../shell/Modal'
import { Fact } from './FactorWorkbench'
import { SPLIT_LABEL, SPLITS } from './factorMath'
import { gatedSplits } from './testGate'
import './factorEdit.css'

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')
const OFF_COMMAND = 'aq studio serve --allow-actions'
/** Block texts that describe the saved file only; they cannot apply while the editor holds unsaved changes. */
const STALE_DISK_BLOCK = /does not differ from the leader/i
const HYP_MIN = 8
const HYP_MAX = 500

function LockIcon() {
  return (
    <svg className="fe-lock" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

type Tested = Pick<FactorDiagnostics, 'run' | 'dataset' | 'predictionUniverse' | 'protocol' | 'summary'>

/** The Study-locked inputs. Shown as facts with a lock: the Study fixes them so results stay comparable. */
function LockedFacts({ study }: { study: Tested }) {
  const { protocol } = study
  const windows = protocol.splits.splits
  const context = protocol.horizons.filter((h) => h !== protocol.primaryHorizon).sort((a, b) => a - b)
  return (
    <section className="fe-sec" aria-labelledby="fe-locked">
      <h2 className="wb-h fe-h" id="fe-locked">
        <LockIcon /> Fixed by the Study
        <Info label="Why these inputs are locked" align="start">
          <p>Fixed by the Study so results stay comparable. The analysis window, horizon, splits and universe cannot be changed here; only the candidate source and the hypothesis can.</p>
        </Info>
      </h2>
      <dl className="facts fe-facts">
        <Fact label="Study">
          <span className="mono" translate="no">{study.run.studyId}</span>
        </Fact>
        <Fact label="Horizon">
          {protocol.primaryHorizon}-bar primary
          {context.length > 0 && <span className="faint"> · context {context.join(', ')}-bar</span>}
        </Fact>
        <Fact label="Window">
          <span className="splitlist">
            {gatedSplits(study, SPLITS).map((s) => (
              <span key={s}>
                <span className="faint">{SPLIT_LABEL[s]}</span> {day(windows[s].start)} to {day(windows[s].end)}
              </span>
            ))}
          </span>
        </Fact>
        <Fact label="Universe">
          <span className="mono" translate="no">{(study.predictionUniverse.predictionAssets ?? []).join(', ') || '—'}</span>
          <span className="faint"> · {study.predictionUniverse.evaluationMode ?? '—'}</span>
        </Fact>
        <Fact label="Dataset">
          <span className="mono" translate="no">{study.dataset.id}</span>
          <span className="faint"> · {day(study.dataset.timeRange?.start)} to {day(study.dataset.timeRange?.end)}</span>
        </Fact>
        <Fact label="Run started">{when(study.run.startedAt)} UTC</Fact>
      </dl>
    </section>
  )
}

type Load =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; doc: CandidateDoc }
  | { state: 'error'; message: string }

type Note = { kind: 'ok' | 'error' | 'info'; text: string } | null

export function FactorEditor({ project, study }: { project: ProjectSnapshot; study: Tested }) {
  const { state, setActiveJobId, activeJobId, version } = useActions()
  const catalog = useCatalog(project.id)
  const studyId = study.run.studyId
  const bootstrap = state.mode === 'on' ? state.bootstrap : null

  // Which Session takes the candidate: an active Session of this Study, as the server's catalog lists it.
  const studyOf = useMemo(() => new Map(project.sessions.map((s) => [s.session?.id ?? s.id, s.session?.studyId ?? s.studyId])), [project.sessions])
  const sessions = catalog.state === 'ready' ? catalog.target.sessions : []
  const own = sessions.filter((s) => studyOf.get(s.session) === studyId)
  const picked = own.find((s) => s.available) ?? own[0] ?? null
  const sessionId = picked?.session ?? null
  // With actions off the catalog is unavailable; a read-only look still needs a Session id from the snapshot.
  const readOnlySession = state.mode === 'off' ? project.sessions.find((s) => (s.session?.studyId ?? s.studyId) === studyId) : undefined
  const loadSession = sessionId ?? (readOnlySession ? readOnlySession.session?.id ?? readOnlySession.id ?? null : null)

  const [load, setLoad] = useState<Load>({ state: 'idle' })
  const [draft, setDraft] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [hypothesis, setHypothesis] = useState('')
  const [touched, setTouched] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'saving' | 'checking'>('idle')
  const [note, setNote] = useState<Note>(null)
  const [conflict, setConflict] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [startOpen, setStartOpen] = useState(false)
  const hypRef = useRef<HTMLInputElement>(null)
  const ids = { hyp: useId(), hypNote: useId(), why: useId() }

  const wantsLoad = state.mode === 'off' ? !!loadSession : state.mode === 'on' && !!sessionId
  useEffect(() => {
    if (!wantsLoad || !loadSession) {
      setLoad({ state: 'idle' })
      return
    }
    const controller = new AbortController()
    setLoad((prev) => (prev.state === 'ready' ? prev : { state: 'loading' }))
    getCandidate(project.id, loadSession, controller.signal)
      .then((doc) => {
        setLoad({ state: 'ready', doc })
        setDraft(doc.source)
        setConflict(false)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setLoad({ state: 'error', message: reason instanceof Error ? reason.message : String(reason) })
      })
    return () => controller.abort()
  }, [wantsLoad, loadSession, project.id, reloadNonce, version])

  const doc = load.state === 'ready' ? load.doc : null
  const dirty = !!doc && draft !== doc.source
  const editable = !!doc && doc.editable && state.mode === 'on' && !!sessionId
  const hypProblem = validateHypothesis(hypothesis, HYP_MIN, HYP_MAX)
  const showHypProblem = touched && hypProblem
  const fam = pickIntegrity(project)?.researchFamily
  const activeJob = catalog.state === 'ready' ? catalog.target.activeJob : null
  const busy = phase !== 'idle' || !!activeJob || !!activeJobId

  const save = useCallback(async (): Promise<boolean> => {
    if (!bootstrap || !doc || !sessionId) return false
    setPhase('saving')
    setNote(null)
    try {
      const result = await saveCandidate(bootstrap, project.id, { session: sessionId, source: draft, baseSha256: doc.sha256 })
      setLoad({ state: 'ready', doc: { ...doc, source: draft, sha256: result.sha256 ?? doc.sha256, bytes: result.bytes ?? new Blob([draft]).size } })
      setNote({ kind: 'ok', text: 'Saved to the Session candidate file.' })
      return true
    } catch (reason) {
      if (isConflict(reason)) {
        setConflict(true)
        setNote(null)
      } else {
        const copy = errorCopy(reason, 'save the candidate')
        setNote({ kind: 'error', text: `${copy.title} ${copy.detail}` })
      }
      return false
    } finally {
      setPhase('idle')
    }
  }, [bootstrap, doc, sessionId, project.id, draft])

  const check = useCallback(async (): Promise<boolean> => {
    if (!bootstrap || !sessionId) return false
    setPhase('checking')
    setNote({ kind: 'info', text: 'Checking the candidate…' })
    try {
      const outcome = await runCheck(bootstrap, project.id, sessionId)
      setNote({ kind: outcome.ok ? 'ok' : 'error', text: outcome.text })
      return outcome.ok
    } catch (reason) {
      const copy = errorCopy(reason, 'check the candidate')
      setNote({ kind: 'error', text: `${copy.title} ${copy.detail}` })
      return false
    } finally {
      setPhase('idle')
    }
  }, [bootstrap, sessionId, project.id])

  const checkAfterSave = async () => {
    if (dirty && !(await save())) return
    await check()
    catalog.reload()
  }

  const runAnalysis = async () => {
    if (hypProblem) {
      setTouched(true)
      hypRef.current?.focus()
      return
    }
    if (dirty && !(await save())) return
    // The catalog's candidate-vs-leader block describes the file on disk; the server re-evaluates it in the check preview below.
    if (!(await check())) {
      catalog.reload()
      return
    }
    catalog.reload()
    setConfirmOpen(true)
  }

  // ---- why the primary action is unavailable, written beside it ----
  let reason: string | null = null
  let retry = false
  if (state.mode === 'off') reason = null
  else if (state.mode === 'loading' || catalog.state === 'loading') reason = 'Checking what can run…'
  else if (catalog.state === 'error') {
    reason = `${catalog.title} ${catalog.detail}`
    retry = true
  } else if (activeJob) reason = `Blocked: job ${activeJob} is already running in this Project.`
  else if (picked && !picked.available && !(dirty && STALE_DISK_BLOCK.test(picked.blockedBy ?? ''))) reason = picked.blockedBy ?? 'Blocked: this Session cannot take a candidate right now.'
  else if (load.state === 'loading') reason = 'Loading the candidate…'
  else if (load.state === 'error') reason = `Could not read the candidate: ${load.message}`
  else if (doc && !doc.editable) reason = doc.blockedReason ?? 'Blocked: the candidate is not editable.'
  else if (conflict) reason = 'Resolve the save conflict above first.'
  else if (hypProblem) reason = hypProblem
  else if (phase === 'saving') reason = 'Saving the candidate…'
  else if (phase === 'checking') reason = 'Checking the candidate…'

  const noSession = state.mode === 'on' && catalog.state === 'ready' && !picked
  const startEntry = catalog.state === 'ready' ? catalog.start?.studies?.find((x) => x.study === studyId) : undefined
  const startBlock = activeJob ? `Blocked: job ${activeJob} is already running in this Project.` : startEntry && !startEntry.available ? startEntry.blockedBy ?? 'Blocked: this Study cannot start a Session.' : !startEntry ? 'Blocked: the server does not offer Start session for this Study.' : null
  const canStart = noSession && startBlock === null

  return (
    <div className="fe">
      <LockedFacts study={study} />

      <section className="fe-sec" aria-labelledby="fe-cand">
        <div className="fe-cand-head">
          <h2 className="wb-h fe-h" id="fe-cand">Candidate</h2>
          {doc && editable && (
            <span className={`fe-chip${dirty ? ' is-dirty' : ''}`} role="status">{dirty ? 'Unsaved changes' : 'Saved'}</span>
          )}
          {doc && editable && dirty && (
            <button type="button" className="abtn abtn--quiet fe-reset" onClick={() => { setDraft(doc.source); setConflict(false) }}>
              Reset to saved
            </button>
          )}
        </div>

        {state.mode === 'off' && (
          <div className="fe-note" role="note">
            <p className="small">Read-only. {ACTIONS_OFF_COPY} to edit and run from this page.</p>
            <div className="cmdrow">
              <pre className="cmd mono" translate="no" aria-label="Command that enables editing">{OFF_COMMAND}</pre>
              <CopyButton text={OFF_COMMAND} label="Copy command" />
            </div>
          </div>
        )}

        {noSession && (
          <p className="small muted fe-note">
            No active Session on Study <span className="mono" translate="no">{studyId}</span>. A Session holds the one candidate you edit; starting one opens a trial family.
          </p>
        )}

        {doc ? (
          <>
            <CodeField rows={9} label="Candidate source" value={draft} onChange={setDraft} readOnly={!editable} describedBy={doc.blockedReason ? ids.why : undefined} />
            <p className="fe-meta small faint">
              <span className="mono" translate="no">{doc.path}</span> · {doc.bytes.toLocaleString('en-US')} bytes · <span className="mono" translate="no">{doc.sha256.slice(0, 12)}</span>
            </p>
            {doc.blockedReason && state.mode === 'on' && <p id={ids.why} className="small sig">{doc.blockedReason}</p>}
          </>
        ) : load.state === 'loading' ? (
          <p className="small muted">Loading the candidate…</p>
        ) : load.state === 'error' ? (
          <p className="small sig" role="alert">Could not read the candidate: {load.message}</p>
        ) : (
          <p className="small muted fe-note">
            The candidate source of this Run is not published to the browser. {state.mode === 'off' ? 'It appears here once a Session exists and the server can read it.' : 'Start a Session to see and edit it here.'}
          </p>
        )}

        {conflict && (
          <div className="fe-conflict" role="alert">
            <p className="small">
              <strong>The candidate file changed on disk</strong> after you opened it, so Studio did not overwrite it. Your edits are still in the field.
            </p>
            <div className="fe-row">
              <button type="button" className="abtn" onClick={() => setReloadNonce((n) => n + 1)}>Reload from disk</button>
              <CopyButton text={draft} label="Copy my edits" />
              <span className="small muted">Reload discards your edits; copy them first if you want to keep them.</span>
            </div>
          </div>
        )}
      </section>

      {state.mode === 'on' && !noSession && (
        <section className="fe-sec" aria-labelledby="fe-hyp-h">
          <h2 className="wb-h fe-h" id="fe-hyp-h">Hypothesis</h2>
          <label className="sr-only" htmlFor={ids.hyp}>Hypothesis: what this candidate is meant to test</label>
          <input
            id={ids.hyp}
            ref={hypRef}
            className="fe-input"
            type="text"
            value={hypothesis}
            maxLength={HYP_MAX + 50}
            placeholder="What this candidate is meant to test"
            aria-invalid={showHypProblem ? true : undefined}
            aria-describedby={ids.hypNote}
            onChange={(event) => setHypothesis(event.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (!reason && !busy) void runAnalysis()
              }
            }}
          />
          <p id={ids.hypNote} className={`small ${showHypProblem ? 'sig' : 'faint'}`} aria-live="polite">
            {showHypProblem ? hypProblem : `${hypothesis.length} / ${HYP_MAX} · ${HYP_MIN} to ${HYP_MAX} characters`}
          </p>
        </section>
      )}

      {state.mode === 'on' && (
        <div className="fe-actions">
          {noSession ? (
            <>
              <button type="button" className="abtn abtn--primary fe-primary" disabled={!canStart} aria-describedby={!canStart ? ids.why : undefined} onClick={() => setStartOpen(true)}>
                Start session
              </button>
              {startBlock && <p id={ids.why} className="small muted">{startBlock}</p>}
            </>
          ) : (
            <>
              <button
                type="button"
                className="abtn abtn--primary fe-primary"
                disabled={reason !== null || busy}
                aria-describedby={reason ? ids.why : undefined}
                onClick={() => void runAnalysis()}
              >
                {phase === 'saving' ? 'Saving…' : phase === 'checking' ? 'Checking…' : 'Run analysis'}
              </button>
              {reason && (
                <p id={ids.why} className="small muted fe-reason">
                  {reason}
                  {retry && (
                    <>
                      {' '}
                      <button type="button" className="linklike" onClick={catalog.reload}>Retry</button>
                    </>
                  )}
                  {activeJob && activeJobId !== activeJob && (
                    <>
                      {' '}
                      <button type="button" className="linklike" onClick={() => setActiveJobId(activeJob)}>Show its progress</button>
                    </>
                  )}
                </p>
              )}
              <div className="fe-row">
                <button type="button" className="abtn abtn--quiet" disabled={!editable || !dirty || busy || conflict} onClick={() => void save()}>
                  Save
                </button>
                <button type="button" className="abtn abtn--quiet" disabled={!editable || busy} onClick={() => void checkAfterSave()}>
                  Check
                </button>
                <span className="small faint">
                  {!editable ? 'Nothing to save: the candidate is read-only.' : dirty ? 'Check saves your edits first, then checks the saved file.' : 'No unsaved changes to save.'}
                </span>
              </div>
            </>
          )}
          <p className="small muted fe-trial">
            Each run counts as a trial and cannot be removed.{' '}
            {fam ? `This research family has ${fam.totalExecutions} counted so far (${fam.uniqueSourceTrials} unique). ` : 'No trial ledger yet. '}
            The confirm step shows the exact trial N of M and the selection adjustment.
          </p>
        </div>
      )}

      {note && (
        <p className={`small fe-msg${note.kind === 'error' ? ' sig' : ''}`} role={note.kind === 'error' ? 'alert' : 'status'}>
          {note.text}
        </p>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} label="Confirm Run analysis" className="adialog">
        {catalog.state === 'ready' && bootstrap && picked && (
          <ConfirmActionDialog
            project={project}
            bootstrap={bootstrap}
            action={catalog.action}
            sessions={[picked]}
            preferred={picked.session}
            fixedHypothesis={hypothesis}
            onClose={() => setConfirmOpen(false)}
            onLaunched={(jobId) => {
              setConfirmOpen(false)
              setActiveJobId(jobId)
            }}
          />
        )}
      </Modal>
      <Modal open={startOpen} onClose={() => setStartOpen(false)} label="Confirm Start session" className="adialog">
        {bootstrap && (
          <StartSessionDialog
            project={project}
            bootstrap={bootstrap}
            studyId={studyId}
            onClose={() => setStartOpen(false)}
            onLaunched={(jobId) => {
              setStartOpen(false)
              setActiveJobId(jobId)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

