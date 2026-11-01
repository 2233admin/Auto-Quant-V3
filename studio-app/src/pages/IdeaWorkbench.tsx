import { useCallback, useEffect, useState } from 'react'
import { getJson, type FactorDiagnostics, type ProjectSnapshot } from '../api'
import { useActions } from '../actions/ActionsContext'
import { getCandidate, launchPreviewed, previewAction, runCheck, saveCandidate, type CandidateDoc } from '../actions/candidateApi'
import { getDatasets, getIdea, jobError, waitJob, type DatasetChoices, type Idea } from '../actions/ideaApi'
import type { Job, Preview } from '../actions/types'
import { isTerminal } from '../actions/types'
import { CodeField } from '../components/CodeField'
import { ActionRow, PaneCard, WorkbenchShell, type ActionButton } from '../components/workbench'
import { Modal } from '../shell/Modal'
import { IdeaVerdict } from './IdeaVerdict'
import { NewIdeaDialog } from './NewIdeaDialog'
import './factorEdit.css'
import './ideas.css'

const STUDY = 'ohlcv-factor-quality'
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e)

export function IdeaWorkbench({ project }: { project: ProjectSnapshot }) {
  const { state, version, jobFinished, hideDock } = useActions()
  const b = state.mode === 'on' ? state.bootstrap : null
  const [idea, setIdea] = useState<Idea | null>(null)
  const [packages, setPackages] = useState<DatasetChoices | null>(null)
  const [dataset, setDataset] = useState('')
  const [assets, setAssets] = useState<string[]>([])
  const [horizon, setHorizon] = useState(1)
  const [accepted, setAccepted] = useState(false)
  const [doc, setDoc] = useState<CandidateDoc | null>(null)
  const [draft, setDraft] = useState('')
  const [expression, setExpression] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [iterating, setIterating] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [second, setSecond] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [newIdea, setNewIdea] = useState(false)
  const [evidence, setEvidence] = useState<FactorDiagnostics | null>(null)
  const [evidenceRun, setEvidenceRun] = useState<string | null>(null)
  const session = project.sessions.find(s => (s.session?.studyId ?? s.studyId) === STUDY && (s.session?.status ?? s.status) === 'active')
  const sessionId = session?.session?.id ?? session?.id ?? null
  const runs = project.runs.filter(r => r.studyId === STUDY).sort((a, z) => z.startedAt.localeCompare(a.startedAt) || z.id.localeCompare(a.id))
  const latest = runs[0] ?? null
  const selectedPackage = packages?.datasets.find(d => d.path === dataset)

  const reload = useCallback(async () => {
    if (!b) return
    const data = await getIdea(b, project.id)
    setIdea(data)
    const researchJobs = data.jobs.filter(j => ['session.start', 'session.check', 'experiment.evaluate'].includes(j.actionId))
    if (researchJobs.length) setJob(researchJobs[0])
    if (!data.bound) setPackages(await getDatasets(b))
  }, [b, project.id])
  useEffect(() => { reload().catch(e => setError(errorText(e))) }, [reload, version, project.runs.length])
  useEffect(() => { hideDock(true); return () => hideDock(false) }, [hideDock])
  useEffect(() => {
    if (!idea?.bound || (!sessionId && latest)) return
    getCandidate(project.id, sessionId ?? 'initial').then(d => {
      setDoc(d)
      // A new idea never evaluates the template demonstrator by default.
      setDraft(sessionId || idea?.initialAuthored ? d.source : '')
    }).catch(e => setError(errorText(e)))
  }, [project.id, sessionId, idea?.bound, latest?.id])
  useEffect(() => {
    setEvidence(null); setEvidenceRun(null)
    if (!latest || latest.status !== 'succeeded') return
    const c = new AbortController()
    getJson<{ factorExplorer: FactorDiagnostics | null }>(`/api/v1/run?${new URLSearchParams({ project: project.id, id: latest.id })}`, c.signal)
      .then(d => { setEvidence(d.factorExplorer); setEvidenceRun(latest.id) }).catch(e => { if (!c.signal.aborted) { setError(errorText(e)); setEvidenceRun(latest.id) } })
    return () => c.abort()
  }, [project.id, latest?.id, latest?.status])
  useEffect(() => {
    if (!b || !job || isTerminal(job.status)) return
    let live = true
    waitJob(b, job.jobId, j => { if (live) setJob(j) }).then(() => { if (live) { jobFinished(); void reload() } })
    return () => { live = false }
    // Resume an in-flight job after a page reload.
  }, [b, job?.jobId])

  const source = advanced ? draft : expression.trim() ? `import pandas as pd\n\ndef compute_factor(panel: pd.DataFrame) -> pd.Series:\n    return (${expression.trim()}).rename("idea_factor")\n` : draft
  const busyReason = busy || (job && !isTerminal(job.status) ? 'An analysis is running. Wait for it to finish.' : '')
  const reason = !b ? 'Start Studio with --allow-actions to run this idea.' : !idea ? 'Loading the idea…' : busyReason || (!idea.bound ? (!dataset ? 'Select a staged dataset package.' : !assets.length ? 'Select the assets this factor will predict.' : !accepted ? 'Confirm the prediction claim and evidence limits below.' : null) : !doc ? (latest && !sessionId ? 'The first Run failed without a Session. Inspect its failure before repairing the canonical candidate through the CLI.' : 'Loading the candidate…') : !doc.editable ? doc.blockedReason ?? 'This candidate is read-only.' : !source.trim() ? 'Enter a factor expression or author Python before running.' : sessionId && note.trim().length < 8 ? 'Describe this next trial in at least 8 characters.' : sessionId && source === doc.source ? 'Edit the candidate before spending another trial.' : null)

  const prepare = async () => {
    if (!b || !idea || reason) return
    setError(''); setSecond(false)
    try {
      if (!idea.bound) {
        setBusy('Checking the staged package…')
        setPreview(await previewAction(b, 'project.intake', project.id, { dataset, horizon, predictionAssets: assets }))
      } else {
        if (!doc) return
        setBusy('Saving the candidate…')
        const saved = await saveCandidate(b, project.id, { session: sessionId ?? 'initial', source, baseSha256: doc.sha256 })
        setDoc({ ...doc, source, ...saved })
        if (sessionId) {
          setBusy('Checking the candidate…')
          const checked = await runCheck(b, project.id, sessionId)
          if (!checked.ok) { await reload(); throw new Error(checked.text) }
        }
        setBusy('Preparing the trial confirmation…')
        setPreview(await previewAction(b, sessionId ? 'experiment.evaluate' : 'session.start', project.id,
          sessionId ? { session: sessionId, hypothesis: note.trim() } : { study: STUDY }))
      }
    } catch (e) { setError(errorText(e)) }
    finally { setBusy('') }
  }
  const launch = async () => {
    if (!b || !preview || (preview.requiresSecondConfirm && !second)) return
    setBusy(preview.actionId === 'project.intake' ? 'Binding the staged dataset…' : 'Running preflight and analysis…'); setError('')
    try {
      const launched = await launchPreviewed(b, preview, second)
      const action = preview.actionId
      setPreview(null)
      const finished = await waitJob(b, launched.jobId, action === 'project.intake' ? undefined : setJob)
      if (action === 'experiment.evaluate') setIterating(false)
      jobFinished(); await reload()
      if (finished.status !== 'succeeded') setError(jobError(finished))
    } catch (e) { setError(errorText(e)) }
    finally { setBusy('') }
  }
  const primary: ActionButton = reason ? { label: !idea?.bound ? 'Use this dataset' : 'Run analysis', disabled: true, disabledReason: reason } : { label: !idea?.bound ? 'Use this dataset' : 'Run analysis', onClick: () => void prepare() }
  return <div className="pg idea-workbench">
    <header className="pg-head"><h1>{project.name}</h1><span className="small muted">Factor idea · {idea?.bound ? 'Data bound' : 'Project created · choose data next'}</span></header>
    <WorkbenchShell ratio={30} left={<PaneCard label="Factor idea editor" tabs={<h2 className="set-title">Your hypothesis</h2>} actions={latest && !iterating ? undefined : <ActionRow primary={primary} />}>
      <div className="idea-form">
        <p className="idea-question">{idea?.bindings[0]?.hypothesis ?? idea?.hypothesis ?? project.description}</p>
        {idea?.frozen && <p className="small muted">Original question frozen at the first attempt. <button className="linklike" onClick={() => setNewIdea(true)}>Test a different question</button> in a new Project; this history remains.</p>}
        {!idea?.bound ? <>
          <label className="afield">Staged dataset<select aria-label="Staged dataset" className="fe-input" value={dataset} onChange={e => { setDataset(e.target.value); setAssets([]); setAccepted(false) }}><option value="">Select a complete package</option>{packages?.datasets.map(d => <option key={d.path} value={d.path}>{d.id} · {d.provider}</option>)}</select></label>
          {selectedPackage && <><p className="small muted">{selectedPackage.path} · {selectedPackage.adjustment} · {selectedPackage.frequency}</p><fieldset className="idea-assets"><legend>Prediction assets</legend>{selectedPackage.assets.map(a => <label key={a}><input type="checkbox" checked={assets.includes(a)} onChange={e => { setAssets(e.target.checked ? [...assets, a] : assets.filter(x => x !== a)); setAccepted(false) }} />{a}</label>)}</fieldset><p className="small muted">Unselected assets supply context only.</p></>}
          <label className="afield">Forward horizon (completed daily bars)<input className="fe-input" type="number" min={1} max={60} value={horizon} onChange={e => { setHorizon(Number(e.target.value)); setAccepted(false) }} /></label>
          <p className="small muted">The fixed protocol also reports a {horizon === 5 ? 20 : 5}-bar context horizon; it does not select the candidate.</p>
          <label className="asecond"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>I am testing whether higher factor values rank higher forward returns for these assets. This is development evidence, not a sealed-holdout confirmation.</span></label>
          {packages?.datasets.length === 0 && <div className="apreview"><h3>No supported staged data</h3><p className="small">{packages.stagingNote}</p><pre className="cmd mono">{packages.stagingCommand}</pre><button className="abtn" onClick={() => void reload()}>Refresh staged data</button></div>}
          {packages?.unavailable.map(d => <p className="small" key={d.path}>{d.path}: {d.reason}</p>)}
        </> : <>
          <p className="small muted">{idea.request?.factorPolicy.predictionAssets.join(', ')} · {idea.request?.horizonPolicy.primaryForwardBars}-bar forward return · Validation selects; test is diagnostic.</p>
          {latest && <><p className="small">This attempt is complete. Read the answer; another trial is optional.</p>{iterating && <button className="linklike" onClick={() => setIterating(false)}>Close optional follow-up</button>}</>}
          <div className="idea-form" hidden={!!latest && !iterating}>
          {sessionId && <label className="afield">Next trial hypothesis<textarea aria-label="Next trial hypothesis" className="fe-input" rows={2} value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="Declare one bounded change to this candidate" /><span className="small muted">A changed hypothesis is a new trial-family note, not a rewrite of the original question or a reset of Core’s trial ledger.</span></label>}
          {!advanced && <label className="afield">Factor expression<textarea aria-label="Factor expression" className="fe-input mono" rows={3} value={expression} onChange={e => setExpression(e.target.value)} placeholder={'panel.groupby("asset")["close"].pct_change(5, fill_method=None)'} /><span className="small muted">Enter a pandas Series using the observed panel. The example is a syntax hint; no candidate runs until you author it.</span></label>}
          {!advanced && !expression && draft && <p className="small muted">Using the authored Python candidate below. Entering an expression explicitly replaces it.</p>}
          <details open={advanced} onToggle={e => { const open = e.currentTarget.open; if (open && !advanced) setDraft(source); if (!open && advanced) setExpression(''); setAdvanced(open) }}><summary>Python source · advanced editor</summary>{advanced && <CodeField label="Candidate source" rows={10} value={draft} onChange={setDraft} />}</details>
          <details><summary>Fixed support and refutation wording</summary><p className="small">Supported requires Core’s decision-signal-positive diagnosis and a passed trial-family adjustment. Otherwise valid evidence is Inconclusive. Core has no arbitrary-question refutation protocol; this flow never invents Refuted. Execution or protocol failure means Could not be tested.</p><p className="small">The first Session command runs preflight before its baseline. Later trials save, check, then ask for confirmation. Checks spend no trial.</p></details>
          </div>
        </>}
        {error && <details open><summary className="sig">Action needs attention</summary><pre className="cmd small" role="alert">{error}</pre></details>}
        {runs.length > 0 && <details><summary>Trial history · {runs.length} immutable Runs</summary><ul className="small">{runs.map(r => <li key={r.id}>{r.id} · {r.status}</li>)}</ul></details>}
      </div>
    </PaneCard>} right={idea ? <IdeaVerdict editing={iterating} onDeclareTrial={latest && sessionId && doc?.editable && !iterating && !busyReason ? () => setIterating(true) : undefined} project={project} idea={idea} study={evidence} run={latest} job={job} busy={busy || (latest?.status === 'succeeded' && evidenceRun !== latest.id ? 'Loading verified Run evidence…' : '')} /> : <PaneCard label="Idea verdict"><p>Loading the question…</p></PaneCard>} />
    <Modal open={!!preview} onClose={() => setPreview(null)} label="Confirm analysis" className="adialog">
      {preview && <div className="adialog-body"><header className="adialog-head"><h2>{preview.requiresSecondConfirm ? 'Confirm trial' : 'Confirm dataset'}</h2><p className="small">{idea?.hypothesis}</p></header>
        <div className="adialog-scroll">
          {preview.trial && <div className="trial atrial idea-trial"><p className="trial-head">Trial {preview.trial.n} of {preview.trial.m}</p><p className="small">{preview.actionId === 'experiment.evaluate' ? 'N is this Session’s candidate-trial index; M is the family source count including the baseline. These are counts, not a trial budget.' : 'Counted source trials in this family after this attempt, not a trial budget. A reused baseline does not add a source; failed preflight creates no Run.'}</p>{preview.actionId === 'experiment.evaluate' && <p className="small">{preview.trial.notice}. Prior visible test evidence cannot serve as a sealed holdout; independent confirmation is required.</p>}</div>}
          <pre className="cmd mono">{preview.display}</pre><p className="small muted">{preview.writes}</p>
          {!preview.requiresSecondConfirm && <p className="small">Prediction population: {assets.join(', ')} · {horizon} daily bars · decision-signal / forward-return.</p>}
          <p className="small">No sealed holdout is opened. Every completed or failed Run remains in history.</p>
          <details><summary>Command hash</summary><p className="mono small">{preview.commandHash}</p></details>
        </div>
        {preview.requiresSecondConfirm && <div className="adialog-pinned"><label className="asecond"><input type="checkbox" checked={second} onChange={e => setSecond(e.target.checked)} />I understand this creates immutable evidence and counts the trial.</label></div>}
        <footer className="adialog-foot"><ActionRow primary={preview.requiresSecondConfirm && !second ? { label: 'Confirm and run', disabled: true, disabledReason: 'Acknowledge the trial before running.' } : { label: preview.requiresSecondConfirm ? 'Confirm and run' : 'Confirm and bind data', onClick: () => void launch() }} secondary={[{ label: 'Cancel', onClick: () => setPreview(null) }]} /></footer>
      </div>}
    </Modal>
    <NewIdeaDialog open={newIdea} onClose={() => setNewIdea(false)} />
  </div>
}
