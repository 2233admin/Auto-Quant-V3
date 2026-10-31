import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { num, when } from '../format'
import { Modal } from '../shell/Modal'
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

/** One locked fact as a small read-only chip: label above, value below, truncated with the full text in the tooltip. */
function Chip({ label, value, mono = true, wide = false }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={`fe-fact${wide ? ' is-wide' : ''}`} title={`${label}: ${value}`}>
      <span className="fe-fact-l">{label}</span>
      <span className={`fe-fact-v${mono ? ' mono' : ''}`} translate="no">{value}</span>
    </div>
  )
}

/** The Study-locked inputs as a compact two-column grid of read-only chips under one lock and one "?". */
function LockedFacts({ study }: { study: Tested }) {
  const { protocol } = study
  const windows = protocol.splits.splits
  const context = protocol.horizons.filter((h) => h !== protocol.primaryHorizon).sort((a, b) => a - b)
  const range = (a: string | null | undefined, b: string | null | undefined) => `${day(a)} → ${day(b)}`
  return (
    <section className="fe-facts-sec" aria-labelledby="fe-locked">
      <h2 className="wb-h fe-h" id="fe-locked">
        <LockIcon /> Fixed by the Study
        <Info label="Why these inputs are locked" align="start">
          <p>Fixed by the Study so results stay comparable. The analysis window, horizon, splits and universe cannot be changed here; only the candidate source and the hypothesis can.</p>
        </Info>
      </h2>
      <div className="fe-facts2" role="group" aria-label="Fixed by the Study">
        <Chip label="Study" value={study.run.studyId} />
        <Chip label="Horizon" value={`${protocol.primaryHorizon}-bar${context.length > 0 ? ` (+${context.join(', ')})` : ''}`} />
        <Chip label="Universe" value={`${(study.predictionUniverse.predictionAssets ?? []).join(', ') || '—'}${study.predictionUniverse.evaluationMode ? ` · ${study.predictionUniverse.evaluationMode}` : ''}`} />
        <Chip label="Dataset" value={study.dataset.id} />
        {gatedSplits(study, SPLITS).map((sp) => (
          <Chip key={sp} label={SPLIT_LABEL[sp]} value={range(windows[sp].start, windows[sp].end)} />
        ))}
      </div>
    </section>
  )
}

/** A line of text that never wraps: the full text sits in the tooltip, and "more" opens it in place. */
function OneLine({ id, kind, children, text, action }: { id?: string; kind?: 'error' | 'ok' | 'info'; children?: ReactNode; text: string; action?: ReactNode }) {
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [text])
  return (
    <div className={`fe-line${open ? ' is-open' : ''}${kind === 'error' ? ' is-error' : ''}`}>
      <p id={id} className="fe-line-t small" title={text} role={kind === 'error' ? 'alert' : undefined}>{children ?? text}</p>
      {action}
      {text.length > 52 && (
        <button type="button" className="linklike fe-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'less' : 'more'}</button>
      )}
    </div>
  )
}

/** This Session's past trials, read-only, from the Project snapshot. */
function History({ project, sessionId }: { project: ProjectSnapshot; sessionId: string | null }) {
  const row = project.sessions.find((s) => (s.session?.id ?? s.id) === sessionId)
  const experiments = [...(row?.experiments ?? [])].sort((a, b) => b.sequence - a.sequence)
  const trials = [...(row?.decisionMatrix?.trials ?? [])].sort((a, b) => b.sequence - a.sequence)
  if (!row) return <p className="small muted fe-pad">No Session on this Study yet, so there is no trial history.</p>
  if (experiments.length === 0 && trials.length === 0) return <p className="small muted fe-pad">This Session has no completed trials yet.</p>
  return (
    <div className="fe-hist" role="region" aria-label="Session trial history" tabIndex={0}>
      <table className="tbl fe-hist-t">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Verdict</th>
            <th scope="col" className="r">Validation IC</th>
            <th scope="col">{experiments.length > 0 ? 'Time (UTC)' : 'Role'}</th>
          </tr>
        </thead>
        <tbody>
          {experiments.length > 0
            ? experiments.map((e) => (
                <tr key={e.id} title={e.hypothesis}>
                  <td className="mono">{e.sequence}</td>
                  <td>{e.verdict}</td>
                  <td className="r mono">{num(e.candidateValue, 4)}</td>
                  <td className="mono">{when(e.completedAt)}</td>
                </tr>
              ))
            : trials.map((t) => (
                <tr key={`${t.role}-${t.sequence}-${t.runId}`} title={t.hypothesis}>
                  <td className="mono">{t.sequence}</td>
                  <td>{t.verdict}</td>
                  <td className="r mono">{num(t.primaryValue, 4)}</td>
                  <td>{t.role}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
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

  const [tab, setTab] = useState<'candidate' | 'history'>('candidate')
  const integrity = project.sessions.find((x) => (x.session?.id ?? x.id) === (sessionId ?? loadSession))?.selectionIntegrity
  const trialN = (integrity?.candidateTrials ?? fam?.totalExecutions ?? 0) + 1
  const trialM = (fam?.uniqueSourceTrials ?? 0) + 1
  const trialTitle = 'Each run counts as a trial and cannot be removed. The confirm step shows the exact trial N of M and the selection adjustment.'
  const mainReason = noSession ? startBlock : reason
  const on = state.mode === 'on'

  return (
    <div className="fe">
      <div className="fe-top">
        <div className="fe-tabs" role="tablist" aria-label="Candidate pane">
          <button type="button" role="tab" id="fe-tab-c" aria-selected={tab === 'candidate'} aria-controls="fe-panel" onClick={() => setTab('candidate')}>Candidate</button>
          <button type="button" role="tab" id="fe-tab-h" aria-selected={tab === 'history'} aria-controls="fe-panel" onClick={() => setTab('history')}>History</button>
        </div>
        <span className="fe-grow" />
        {on && !noSession && (
          <>
            <button type="button" className="abtn abtn--quiet fe-q" aria-label="Save" title="Save the candidate" disabled={!editable || !dirty || busy || conflict} onClick={() => void save()}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h8l2 2v10H3z" /><path d="M5 2v4h5V2M5 14v-4h6v4" /></svg>
              <span className="fe-q-t">Save</span>
            </button>
            <button type="button" className="abtn abtn--quiet fe-q" aria-label="Check" title={!editable ? 'Nothing to check: the candidate is read-only.' : dirty ? 'Check saves your edits first, then checks the saved file.' : 'Check the saved candidate'} disabled={!editable || busy} onClick={() => void checkAfterSave()}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8.5l3.2 3.2L13 4.5" /></svg>
              <span className="fe-q-t">Check</span>
            </button>
          </>
        )}
        {on && (
          <button
            type="button"
            className="abtn abtn--primary fe-primary"
            disabled={noSession ? !canStart : reason !== null || busy}
            aria-describedby={mainReason ? ids.why : undefined}
            onClick={() => (noSession ? setStartOpen(true) : void runAnalysis())}
          >
            {noSession ? 'Start session' : phase === 'saving' ? 'Saving…' : phase === 'checking' ? 'Checking…' : 'Run analysis'}
          </button>
        )}
        {on && !noSession && (
          <span className="fe-trial-chip" title={trialTitle} aria-label={`Trial ${trialN} of ${trialM}. ${trialTitle}`}>
            <span aria-hidden="true"><span className="fe-trial-lbl">Trial </span>{trialN}<span className="fe-trial-w"> of </span><span className="fe-trial-s">/</span>{trialM}</span>
          </span>
        )}
      </div>

      <div className="fe-status">
        {mainReason && (
          <OneLine
            id={ids.why}
            text={mainReason}
            action={
              <>
                {retry && !noSession && <button type="button" className="linklike" onClick={catalog.reload}>Retry</button>}
                {!noSession && activeJob && activeJobId !== activeJob && (
                  <button type="button" className="linklike" onClick={() => setActiveJobId(activeJob)}>Show its progress</button>
                )}
              </>
            }
          />
        )}
        {state.mode === 'off' && (
          <OneLine
            text={`Read-only. ${ACTIONS_OFF_COPY} to edit and run from this page.`}
            action={<CopyButton text={OFF_COMMAND} label="Copy command" />}
          />
        )}
        {noSession && (
          <OneLine text={`No active Session on Study ${studyId}. A Session holds the one candidate you edit; starting one opens a trial family.`} />
        )}
        {note && <OneLine kind={note.kind} text={note.text} />}
      </div>

      <div className="fe-scroll" role="tabpanel" id="fe-panel" aria-labelledby={tab === 'candidate' ? 'fe-tab-c' : 'fe-tab-h'}>
        {tab === 'history' ? (
          <History project={project} sessionId={sessionId ?? loadSession} />
        ) : (
          <>
            <LockedFacts study={study} />

            <section className="fe-cand" aria-labelledby="fe-cand">
              <div className="fe-cand-head">
                <h2 className="wb-h fe-h" id="fe-cand">Candidate</h2>
                {doc && editable && <span className={`fe-chip${dirty ? ' is-dirty' : ''}`} role="status">{dirty ? 'Unsaved changes' : 'Saved'}</span>}
                {doc && editable && dirty && (
                  <button type="button" className="abtn abtn--quiet fe-reset" onClick={() => { setDraft(doc.source); setConflict(false) }}>
                    Reset to saved
                  </button>
                )}
                {doc && (
                  <span className="fe-meta small faint" title={`${doc.path} · ${doc.bytes.toLocaleString('en-US')} bytes · ${doc.sha256.slice(0, 12)}`}>
                    <span className="mono" translate="no">{doc.path}</span> · {doc.bytes.toLocaleString('en-US')} bytes
                  </span>
                )}
              </div>

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

              {doc ? (
                <div className="fe-code">
                  <CodeField rows={9} label="Candidate source" value={draft} onChange={setDraft} readOnly={!editable} describedBy={doc.blockedReason ? ids.why : undefined} />
                </div>
              ) : load.state === 'loading' ? (
                <p className="small muted">Loading the candidate…</p>
              ) : load.state === 'error' ? (
                <p className="small sig" role="alert">Could not read the candidate: {load.message}</p>
              ) : (
                <p className="small muted">
                  The candidate source of this Run is not published to the browser. {state.mode === 'off' ? 'It appears here once a Session exists and the server can read it.' : 'Start a Session to see and edit it here.'}
                </p>
              )}
            </section>
          </>
        )}
      </div>

      {state.mode === 'on' && !noSession && tab === 'candidate' && (
        <div className="fe-hyp">
          <label className="fe-hyp-l" htmlFor={ids.hyp}>Hypothesis</label>
          <input
            id={ids.hyp}
            ref={hypRef}
            className="fe-input"
            type="text"
            value={hypothesis}
            maxLength={HYP_MAX + 50}
            placeholder="Hypothesis: what this candidate is meant to test"
            title={showHypProblem ? hypProblem ?? undefined : `${HYP_MIN} to ${HYP_MAX} characters`}
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
          <span id={ids.hypNote} className={`fe-count small ${showHypProblem ? 'sig' : 'faint'}`} aria-live="polite">
            {hypothesis.length} / {HYP_MAX}
          </span>
        </div>
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

