import { useEffect, useState } from 'react'
import { useActions } from '../actions/ActionsContext'
import { launchPreviewed, previewAction } from '../actions/candidateApi'
import { getDatasets, jobError, waitJob, type DatasetChoices } from '../actions/ideaApi'
import type { Preview } from '../actions/types'
import { ActionRow } from '../components/workbench'
import { routeHref } from '../route'
import { Modal } from '../shell/Modal'
import '../actions/actions.css'

export function NewIdeaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, go, jobFinished } = useActions()
  const b = state.mode === 'on' ? state.bootstrap : null
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [datasets, setDatasets] = useState<DatasetChoices | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open && b) getDatasets(b).then(setDatasets).catch(e => setError(String(e))) }, [open, b])
  const change = () => { setPreview(null); setError('') }
  const reason = !b ? 'Start Studio with --allow-actions to create an idea.' : busy ? 'Creating the Project…' : !name.trim() ? 'Give this idea a short name.' : !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) ? 'Use lowercase letters, digits and dashes for the Project id.' : hypothesis.trim().length < 8 ? 'Write the question you want this Factor to test (8–500 characters).' : null
  const submit = async () => {
    if (!b || reason) return
    setBusy(true); setError('')
    try {
      if (!preview) {
        setPreview(await previewAction(b, 'project.create', id, { id, name: name.trim(), description: hypothesis.trim(), template: 'ohlcv-factor-lab' }))
      } else {
        const launched = await launchPreviewed(b, preview, false)
        const job = await waitJob(b, launched.jobId)
        if (job.status !== 'succeeded') throw new Error(jobError(job))
        jobFinished(); onClose()
        go(`${routeHref({ view: 'factor', id })}&idea=1`)
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setPreview(null) }
    finally { setBusy(false) }
  }
  return <Modal open={open} onClose={onClose} label="New idea" className="adialog">
    <div className="adialog-body">
      <header className="adialog-head"><h2>New idea</h2><p className="muted small">One question. One dedicated Project. Start with a Factor that ranks future returns.</p></header>
      <div className="adialog-scroll idea-form">
        <label className="afield">Idea name<input className="fe-input" value={name} maxLength={120} onChange={e => { setName(e.target.value); setId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,64)); change() }} placeholder="Five-day momentum" /></label>
        <label className="afield">Original question<textarea className="fe-input" rows={3} value={hypothesis} maxLength={500} onChange={e => { setHypothesis(e.target.value); change() }} placeholder="Does five-day relative strength rank higher returns over the next daily bar?" /></label>
        <label className="afield">Project id<input className="fe-input mono" value={id} onChange={e => { setId(e.target.value); change() }} /></label>
        <p className="small muted">Next: choose staged data, author the factor, then confirm the first trial. The original question stays attached to every result.</p>
        {datasets && datasets.datasets.length === 0 && <div className="apreview"><h3>Stage data before analysis</h3><p className="small">{datasets.stagingNote}</p><pre className="cmd mono">{datasets.stagingCommand}</pre><p className="small muted">You can create the idea now. Analysis stays unavailable until a complete package is staged.</p></div>}
        {datasets && datasets.datasets.length > 0 && <p className="small">{datasets.datasets.length} staged daily {datasets.datasets.length === 1 ? 'package is' : 'packages are'} available. You will explicitly select the prediction assets and horizon next.</p>}
        {preview && <div className="apreview"><h3>Create this Project</h3><pre className="cmd mono">{preview.display}</pre><p className="small muted">{preview.writes}</p></div>}
        {error && <p className="sig small" role="alert">{error}</p>}
      </div>
      <footer className="adialog-foot"><ActionRow primary={reason ? { label: 'Create idea', disabled: true, disabledReason: reason } : { label: preview ? 'Confirm and create' : 'Create idea', onClick: () => void submit() }} secondary={[{ label: 'Cancel', onClick: onClose }]} /></footer>
    </div>
  </Modal>
}
