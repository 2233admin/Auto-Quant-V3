import { uiTemplate, uiText, uiValue } from '../i18n'
import { useCallback, useEffect, useState } from 'react'
import { getJson, type FactorDiagnostics, type ProjectSnapshot } from '../api'
import { useActions } from '../actions/ActionsContext'
import { getCandidate, launchPreviewed, previewAction, runCheck, saveCandidate, type CandidateDoc } from '../actions/candidateApi'
import { getDatasets, getIdea, jobError, waitJob, type DatasetChoices, type Idea } from '../actions/ideaApi'
import type { Job, Preview } from '../actions/types'
import { isTerminal } from '../actions/types'
import { CodeField } from '../components/CodeField'
import { ActionRow, PaneCard, WorkbenchShell, TitleCard, TabList, type ActionButton } from '../components/workbench'
import { Modal } from '../shell/Modal'
import { IdeaVerdict } from './IdeaVerdict'
import { NewIdeaDialog } from './NewIdeaDialog'
import { Info } from '../components/Info'
import { Icon } from '../design/icons'
import { routeHref } from '../route'
import { candidateExpression, expressionSource } from './ideaEditor'
import { SessionRecovery } from './FactorEditorState'
import { STATE_COPY } from '../components/stateCopy'
import './factorEdit.css'
import './ideas.css'

const errorText = (e: unknown) => e instanceof Error ? e.message : String(e)

export function IdeaWorkbench({ project }: { project: ProjectSnapshot }) {
  const STUDY = project.library?.factor?.studyId ?? 'ohlcv-factor-quality'
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
  const [advanced, setAdvanced] = useState(true)
  const [expandedParams, setExpandedParams] = useState(false)
  const [expandedQuestion, setExpandedQuestion] = useState(false)
  const [editorTab, setEditorTab] = useState('hypothesis')
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [checkedSource, setCheckedSource] = useState<string | null>(null)
  const [savedForTrial, setSavedForTrial] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [second, setSecond] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [newIdea, setNewIdea] = useState(false)
  const [evidence, setEvidence] = useState<FactorDiagnostics | null>(null)
  const [evidenceRun, setEvidenceRun] = useState<string | null>(null)
  const matchingSessions = project.sessions.filter(s => (s.session?.studyId ?? s.studyId) === STUDY)
  const session = matchingSessions.find(s => (s.session?.status ?? s.status) === 'active' && s.authority?.valid) ?? matchingSessions.find(s => (s.session?.status ?? s.status) === 'active') ?? matchingSessions[0]
  const sessionId = session?.session?.id ?? session?.id ?? null
  const runs = project.runs.filter(r => r.studyId === STUDY).sort((a, z) => z.startedAt.localeCompare(a.startedAt) || z.id.localeCompare(a.id))
  const latest = runs[0] ?? null
  const shownRun = runs.find(r => r.id === selectedRun) ?? latest
  const selectedPackage = packages?.datasets.find(d => d.path === dataset)

  const reload = useCallback(async () => {
    if (!b) {
      const f = project.library?.factor
      setIdea({ hypothesis: f?.question ?? project.description, hypothesisSha256: '', verdictPolicy: 'factor-idea-development-v1', bound: f?.bound || project.runs.length > 0, frozen: project.runs.length > 0, initialAuthored: true, request: f?.request ?? null, bindings: [], jobs: [], evidence: f?.evidence ?? null })
      return
    }
    const data = await getIdea(b, project.id)
    setIdea(data)
    const researchJobs = data.jobs.filter(j => ['session.start', 'session.check', 'experiment.evaluate'].includes(j.actionId))
    if (researchJobs.length) setJob(researchJobs[0])
    if (!data.bound) setPackages(await getDatasets(b))
  }, [b, project.id, project.library])
  useEffect(() => { reload().catch(e => setError(errorText(e))) }, [reload, version, project.runs.length])
  useEffect(() => { hideDock(true); return () => hideDock(false) }, [hideDock])
  useEffect(() => {
    if (!idea?.bound) return
    getCandidate(project.id, sessionId ?? (latest || !b ? 'canonical' : 'initial')).then(d => {
      setDoc(d)
      // A new idea never evaluates the template demonstrator by default.
      const authored = sessionId || latest || !b || idea?.initialAuthored ? d.source : ''
      setDraft(authored)
      setExpression(candidateExpression(authored))
      setAdvanced(!candidateExpression(authored))
      setCheckedSource(null)
      setSavedForTrial(false)
    }).catch(e => setError(errorText(e)))
  }, [project.id, sessionId, idea?.bound, latest?.id])
  useEffect(() => {
    setEvidence(null); setEvidenceRun(null)
    if (!shownRun || shownRun.status !== 'succeeded') return
    const c = new AbortController()
    getJson<{ factorExplorer: FactorDiagnostics | null }>(`/api/v1/run?${new URLSearchParams({ project: project.id, id: shownRun.id })}`, c.signal)
      .then(d => { setEvidence(d.factorExplorer); setEvidenceRun(shownRun.id) }).catch(e => { if (!c.signal.aborted) { setError(errorText(e)); setEvidenceRun(shownRun.id) } })
    return () => c.abort()
  }, [project.id, shownRun?.id, shownRun?.status])
  useEffect(() => {
    if (!b || !job || isTerminal(job.status)) return
    let live = true
    waitJob(b, job.jobId, j => { if (live) setJob(j) }).then(() => { if (live) { jobFinished(); void reload() } })
    return () => { live = false }
    // Resume an in-flight job after a page reload.
  }, [b, job?.jobId])

  const source = advanced ? draft : expressionSource(expression, draft)
  const busyReason = busy || (job && !isTerminal(job.status) ? 'An analysis is running. Wait for it to finish.' : '')
  const reason = !b ? 'Read-only session: actions are off.' : !idea ? 'Loading…' : busyReason || (!idea.bound ? (!dataset ? 'Select a staged dataset package.' : !assets.length ? 'Select the assets this factor will predict.' : !accepted ? 'Confirm the prediction claim and evidence limits below.' : null) : !doc ? (latest && !sessionId ? 'The first Run failed without a Session. Inspect its failure before repairing the canonical candidate through the CLI.' : 'Loading…') : !doc.editable ? doc.blockedReason ?? 'This candidate is read-only.' : !source.trim() ? 'Enter a factor expression or author Python before running.' : latest && (note.trim().length < 8 || note.trim().length > 500) ? 'Describe this next trial in at least 8 characters.' : sessionId && source === doc.source && !savedForTrial ? 'Edit the candidate before spending another trial.' : null)

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
        setSavedForTrial(true)
        if (sessionId) {
          setBusy('Checking the candidate…')
          const checked = await runCheck(b, project.id, sessionId)
          setCheckedSource(checked.ok ? source : null)
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
      if (action === 'experiment.evaluate') { setSavedForTrial(false); setSelectedRun(null) }
      jobFinished(); await reload()
      if (finished.status !== 'succeeded') setError(jobError(finished))
    } catch (e) { setError(errorText(e)) }
    finally { setBusy('') }
  }
  const saveReason = !b ? 'Read-only session: actions are off.' : busyReason || (!doc?.editable ? doc?.blockedReason ?? 'The candidate is not editable.' : !source.trim() ? 'Author a candidate first.' : source === doc.source ? 'No unsaved changes.' : null)
  const save = async () => {
    if (!b || !doc || saveReason) return
    setBusy('Saving candidate…'); setError('')
    try {
      const saved = await saveCandidate(b, project.id, { session: sessionId ?? 'initial', source, baseSha256: doc.sha256 })
      setDoc({ ...doc, source, ...saved }); setSavedForTrial(true)
    } catch (e) { setError(errorText(e)) } finally { setBusy('') }
  }
  const primary: ActionButton = reason ? { label: idea && !idea.bound ? 'Use this dataset' : !latest ? 'Run study' : 'Run analysis', disabled: true, disabledReason: reason, showReason: false } : { label: idea && !idea.bound ? 'Use this dataset' : !latest ? 'Run study' : 'Run analysis', onClick: () => void prepare() }
  const saveButton: ActionButton = saveReason ? { label: uiText("Save"), disabled: true, disabledReason: saveReason } : { label: uiText("Save"), onClick: () => void save() }
  const question = idea?.bindings[0]?.hypothesis ?? idea?.hypothesis ?? project.description
  const params = [
    { label: uiText("Dataset"), value: evidence?.dataset.id ?? 'Study snapshot' },
    { label: uiText("Horizon"), value: `${idea?.request?.horizonPolicy.primaryForwardBars ?? evidence?.protocol.primaryHorizon ?? '—'}-bar` },
    { label: uiText("Assets"), value: (idea?.request?.factorPolicy.predictionAssets ?? evidence?.predictionUniverse.predictionAssets)?.join(', ') ?? 'Study population' },
    { label: uiText("Validation window"), value: evidence ? `${evidence.protocol.splits.splits.validation.start} – ${evidence.protocol.splits.splits.validation.end}` : 'Fixed by Study' },
    { label: uiText("Test role"), value: evidence?.protocol.testRole ?? 'Study locked' },
    { label: uiText("Selection"), value: 'Validation only' },
  ]
  const frozen = !!latest || !!idea?.frozen
  const recoveryReason = !b ? 'Studio is read-only. Enable actions to edit this candidate.' : doc && !doc.editable ? doc.blockedReason ?? 'The Session is inactive.' : latest && !sessionId ? 'There is no active Session for this retained Run.' : null
  const restart = async () => {
    if (!b || busyReason) return
    setBusy('Preparing a fresh Session…'); setError(''); setSecond(false)
    try { setPreview(await previewAction(b, 'session.start', project.id, { study: STUDY })) }
    catch (e) { setError(errorText(e)) } finally { setBusy('') }
  }
  const assetCount = (idea?.request?.factorPolicy.predictionAssets ?? evidence?.predictionUniverse.predictionAssets ?? []).length
  const currentIntegrity = session?.selectionIntegrity
  const familyTrials = idea?.evidence?.researchFamily?.uniqueSourceTrials ?? currentIntegrity?.researchFamily?.uniqueSourceTrials ?? runs.length
  const trialChip = uiTemplate("Trial {0} of {1}", [latest ? Math.max(1, currentIntegrity?.candidateTrials ?? familyTrials) : 0, familyTrials])
  const enableCommand = `aq studio serve '${(project.rootDir ?? '.').replaceAll("'", "''")}' --allow-actions --port ${window.location.port || '8881'}`
  return <div className="pg idea-workbench">
    <TitleCard title={project.name} subtitle={question} backHref={routeHref({ view: 'projects' })} type="Factor" />
    <WorkbenchShell ratio={35} left={<PaneCard label={uiText("Factor idea editor")} tabs={<TabList label={uiText("Idea editor")} tabs={[{ id: 'hypothesis', label: uiText("Factor") }, { id: 'history', label: uiText("History") }]} active={editorTab} onSelect={setEditorTab} />} actions={<ActionRow primary={primary} secondary={[saveButton]} chip={trialChip} />}>
      <div className="idea-form" onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !reason) { e.preventDefault(); void prepare() } }} hidden={editorTab !== 'hypothesis'} role="tabpanel" aria-label={uiText("Factor")}>
        <div className="idea-question-line"><Icon name="lock" /><p className={expandedQuestion ? 'idea-question is-expanded' : 'idea-question'}>{question}</p><Info label={uiText("About the frozen question")}>{uiText("The original question is frozen at the first attempt. A new question needs a new Project; every trial stays in this history.")}<p>{uiText("Supported requires Core's decision-signal-positive diagnosis and a passed trial-family adjustment. Otherwise valid evidence is Inconclusive. Core has no arbitrary-question refutation protocol; this flow never invents a falsification. Execution or protocol failure means Could not be tested.")}</p><button className="linklike" onClick={() => setNewIdea(true)}>{uiText("Start a new question")}</button></Info><button className="linklike idea-question-expand" onClick={() => setExpandedQuestion(v => !v)} aria-expanded={expandedQuestion}>{expandedQuestion ? uiText("Less") : uiText("Expand question")}</button></div>
        <p className="small muted">{uiText("This question is frozen")}</p>
        {!idea?.bound ? <>
          <label className="afield">{uiText("Staged dataset")}<select aria-label={uiText("Staged dataset")} className="fe-input" value={dataset} onChange={e => { setDataset(e.target.value); setAssets([]); setAccepted(false) }}><option value="">{uiText("Select a complete package")}</option>{packages?.datasets.map(d => <option key={d.path} value={d.path}>{d.id} · {d.provider}</option>)}</select></label>
          {selectedPackage && <><p className="small muted">{selectedPackage.path} · {selectedPackage.adjustment} · {selectedPackage.frequency}</p><fieldset className="idea-assets"><legend>{uiText("Prediction assets")}</legend>{selectedPackage.assets.map(a => <label key={a}><input type="checkbox" checked={assets.includes(a)} onChange={e => { setAssets(e.target.checked ? [...assets, a] : assets.filter(x => x !== a)); setAccepted(false) }} />{a}</label>)}</fieldset><p className="small muted">{uiText("Unselected assets supply context only.")}</p></>}
          <label className="afield">{uiText("Forward horizon (completed daily bars)")}<input className="fe-input" type="number" min={1} max={60} value={horizon} onChange={e => { setHorizon(Number(e.target.value)); setAccepted(false) }} /></label>
          <p className="small muted">{uiText("The fixed protocol also reports a ")}{horizon === 5 ? 20 : 5}{uiText("-bar context horizon; it does not select the candidate.")}</p>
          <label className="asecond"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>{uiText("I am testing whether higher factor values rank higher forward returns for these assets. This is development evidence, not a sealed-holdout confirmation.")}</span></label>
          {packages?.datasets.length === 0 && <div className="apreview"><h3>{uiText("No supported staged data")}</h3><p className="small">{packages.stagingNote}</p><pre className="cmd mono">{packages.stagingCommand}</pre><button className="abtn" onClick={() => void reload()}>{uiText("Refresh staged data")}</button></div>}
          {packages?.unavailable.map(d => <p className="small" key={d.path}>{d.path}: {uiValue(d.reason)}</p>)}
        </> : <>
          <section className="idea-parameters" aria-label={uiText("Frozen parameters")}><div className="idea-parameter-summary"><span>{assetCount}{uiText(" assets · ")}{idea?.request?.horizonPolicy.primaryForwardBars ?? evidence?.protocol.primaryHorizon ?? '—'}{uiText("-bar · validation selects, test diagnostic")}</span><button className="linklike" onClick={() => setExpandedParams(v => !v)} aria-expanded={expandedParams}>{expandedParams ? uiText("Collapse") : uiText("Expand")}</button></div>{expandedParams && <dl className="idea-parameter-rows">{params.map(p => <div key={p.label}><dt>{uiValue(p.label)}:</dt><dd className={['Dataset', 'Assets'].includes(p.label) ? 'mono' : ''} data-param={p.label}>{p.value}</dd></div>)}</dl>}</section>
          {recoveryReason && <SessionRecovery reason={recoveryReason} actions={!!b} command={enableCommand} onRestart={() => void restart()} busy={!!busyReason} />}
          <section className="idea-source" aria-label={uiText("Candidate editor")}><div className="idea-source-toolbar"><TabList label={uiText("Candidate language")} tabs={[{ id: 'expression', label: uiText("Expression") }, { id: 'python', label: uiText("Python") }]} active={advanced ? 'python' : 'expression'} onSelect={tab => { if (tab === 'python') { setDraft(source); setAdvanced(true) } else { setExpression(candidateExpression(draft)); setAdvanced(false) } }} /><span className="idea-check-chip">{checkedSource === source ? uiText("Check passed") : source !== doc?.source ? uiText("Unsaved changes") : savedForTrial ? uiText("Needs check") : uiText("Saved")}</span>{(!doc?.editable || !b) && <span className="idea-readonly-label">{STATE_COPY.readOnly}</span>}</div>
            {advanced ? <CodeField label={uiText("Candidate source")} rows={12} value={draft} onChange={setDraft} readOnly={!b || !doc?.editable || !!busyReason} /> : <CodeField label={uiText("Factor expression")} rows={12} value={expression} onChange={setExpression} readOnly={!b || !doc?.editable || !!busyReason} />}
            {!advanced && !expression && draft && <p className="small muted">{uiText("This Python candidate has no expression adapter. Open Python to edit its full source, or enter an expression to replace it.")}</p>}
          </section>
          {frozen && <label className="idea-trial-note"><input aria-label={uiText("What changes in this trial?")} placeholder={uiText("What changes in this trial?")} value={note} minLength={8} maxLength={500} readOnly={!b || !doc?.editable || !!busyReason} onChange={e => setNote(e.target.value)} /><span className="small muted">{note.length}/500</span></label>}
        </>}
        {error && <details open><summary className="sig">{uiText("Action needs attention")}</summary><pre className="cmd small" role="alert">{error}</pre></details>}
      </div>
      {editorTab === 'history' && <div className="idea-history" role="tabpanel" aria-label={uiText("History")}><h2 className="set-title">{runs.length}{uiText(" immutable Runs")}</h2>{runs.length ? <ol>{runs.map((r, i) => <li key={r.id}><button className="linklike" onClick={() => setSelectedRun(r.id)}>{uiText("Trial ")}{runs.length - i} · {uiValue(r.status)}</button><p className="small muted">{r.startedAt}</p><a className="small" href={routeHref({ view: 'run', id: project.id, run: r.id })}>{r.id}</a></li>)}</ol> : <p className="small muted">{uiText("No trials yet. Preflight alone creates no Run.")}</p>}</div>}
    </PaneCard>} right={idea ? <IdeaVerdict onDeclareTrial={latest && sessionId && doc?.editable && !busyReason ? () => { setEditorTab('hypothesis'); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.idea-trial-note input')?.focus()) } : undefined} project={project} idea={idea} study={evidenceRun === shownRun?.id ? evidence : null} run={shownRun} runs={runs} onSelectRun={setSelectedRun} params={params} job={shownRun?.id === latest?.id ? job : idea.jobs.find(j => j.createdRefs?.runId === shownRun?.id) ?? null} busy={busy || (shownRun?.status === 'succeeded' && evidenceRun !== shownRun.id ? uiText('Loading…') : '')} /> : <PaneCard label={uiText("Idea verdict")}><p>{uiText("Loading…")}</p></PaneCard>} />
    <Modal open={!!preview} onClose={() => setPreview(null)} label={uiText("Confirm analysis")} className="adialog">
      {preview && <div className="adialog-body"><header className="adialog-head"><h2>{preview.requiresSecondConfirm ? uiText("Confirm trial") : uiText("Confirm dataset")}</h2><p className="small">{idea?.hypothesis}</p></header>
        <div className="adialog-scroll">
          {preview.trial && <div className="trial atrial idea-trial"><p className="trial-head">{uiText("Trial ")}{preview.trial.n}{uiText(" of ")}{preview.trial.m}</p><p className="small">{preview.actionId === 'experiment.evaluate' ? uiText("N is this Session’s candidate-trial index; M is the family source count including the baseline. These are counts, not a trial budget.") : uiText("Counted source trials in this family after this attempt, not a trial budget. A reused baseline does not add a source; failed preflight creates no Run.")}</p>{preview.actionId === 'experiment.evaluate' && <p className="small">{preview.trial.notice}{uiText(". Prior visible test evidence cannot serve as a sealed holdout; independent confirmation is required.")}</p>}</div>}
          <pre className="cmd mono">{preview.display}</pre><p className="small muted">{preview.writes}</p>
          {!preview.requiresSecondConfirm && <p className="small">{uiText("Prediction population: ")}{assets.join(', ')} · {horizon}{uiText(" daily bars · decision-signal / forward-return.")}</p>}
          <p className="small">{uiText("No sealed holdout is opened. Every completed or failed Run remains in history.")}</p>
          <details><summary>{uiText("Command hash")}</summary><p className="mono small">{preview.commandHash}</p></details>
        </div>
        {preview.requiresSecondConfirm && <div className="adialog-pinned"><label className="asecond"><input type="checkbox" checked={second} onChange={e => setSecond(e.target.checked)} />{uiText("I understand this creates immutable evidence and counts the trial.")}</label></div>}
        <footer className="adialog-foot"><ActionRow primary={preview.requiresSecondConfirm && !second ? { label: uiText("Confirm and run"), disabled: true, disabledReason: uiText("Acknowledge the trial before running.") } : { label: preview.requiresSecondConfirm ? 'Confirm and run' : 'Confirm and bind data', onClick: () => void launch() }} secondary={[{ label: uiText("Cancel"), onClick: () => setPreview(null) }]} /></footer>
      </div>}
    </Modal>
    <NewIdeaDialog open={newIdea} onClose={() => setNewIdea(false)} />
  </div>
}
