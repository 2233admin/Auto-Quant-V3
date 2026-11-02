import { useEffect, useState } from 'react'
import { uiTemplate, uiText, useLanguage } from '../../i18n'
import type { WorkspaceSummary } from '../../api'
import { useActions } from '../../actions/ActionsContext'
import { jobError, waitJob } from '../../actions/ideaApi'
import { ActionRow, PaneCard, TitleCard } from '../../components/workbench'
import { Empty, Loading } from '../../components/States'
import { STATE_COPY } from '../../components/stateCopy'
import { routeHref } from '../../route'
import { checkData, confirmIntake, inspectSource, listSources, previewIntake, type IntakePreview, type QualityReport, type SourcePreview } from './intakeApi'
import { QualityTable } from './QualityTable'
import './intake.css'

const STEPS = ['Choose staged data', 'Map columns', 'Review quality', 'Bind to Project']
const COLUMNS = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'asset']
const COLUMN_COPY: Record<string, string> = { timestamp: 'Timestamp', open: 'Open price', high: 'High price', low: 'Low price', close: 'Close price', volume: 'Volume', asset: 'Asset' }
export function DataIntake({ workspace }: { workspace: WorkspaceSummary | null }) {
  useLanguage()
  const { state, go, jobFinished } = useActions()
  const bootstrap = state.mode === 'on' ? state.bootstrap : null
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [candidates, setCandidates] = useState<{ path: string; kind: string }[] | null>(null)
  const [source, setSource] = useState(''), [inspection, setInspection] = useState<SourcePreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [frequency, setFrequency] = useState('1d'), [calendar, setCalendar] = useState(''), [zone, setZone] = useState('')
  const [threshold, setThreshold] = useState(30), [gap, setGap] = useState(5), [coverage, setCoverage] = useState('unknown')
  const [report, setReport] = useState<QualityReport | null>(null), [preview, setPreview] = useState<IntakePreview | null>(null)
  const [existing, setExisting] = useState(''), [id, setId] = useState(''), [name, setName] = useState(''), [question, setQuestion] = useState('')
  const [horizon, setHorizon] = useState(1), [population, setPopulation] = useState<string[]>([])
  const [adjustment, setAdjustment] = useState(''), [venue, setVenue] = useState(''), [currency, setCurrency] = useState(''), [assetClass, setAssetClass] = useState('equity')
  const [provider, setProvider] = useState(''), [terms, setTerms] = useState(''), [acknowledged, setAcknowledged] = useState(false)
  const [success, setSuccess] = useState('')
  const packaged = !!inspection?.package
  useEffect(() => {
    if (!bootstrap) return
    let current = true
    listSources(bootstrap).then(value => { if (current) setCandidates(value.sources) }).catch(e => { if (current) setError(String(e)) })
    return () => { current = false }
  }, [bootstrap])
  const options = () => ({ mapping, frequency, calendar, timezone: zone, clock: 'session', jumpThreshold: threshold / 100, longGapBars: gap, universeStatus: coverage,
    priceAdjustment: adjustment, venue, currency, assetClass, provider: { name: provider, terms, retrievedAt: null, sourceUri: null } })
  const changed = () => { setPreview(null); setAcknowledged(false); setError('') }
  const projects = (workspace?.projects ?? []).filter(p => p.valid && p.library?.factor && !p.library.factor.bound && p.runCount === 0)
  const reason = state.mode === 'loading' ? STATE_COPY.loading : !bootstrap ? STATE_COPY.readOnlyReason : busy ? uiText('Working…')
    : step === 0 && !source ? uiText('Select a staged source to continue.')
    : step === 1 && !packaged && COLUMNS.slice(0, 6).some(c => !mapping[c]) ? uiText('Map all six required OHLCV columns.')
    : step === 1 && (!frequency || !calendar || !zone) ? uiText('Declare a frequency, calendar and IANA timezone.')
    : step === 1 && (threshold <= 0 || !Number.isFinite(threshold) || gap < 1 || !Number.isInteger(gap)) ? uiText('Use a positive jump threshold and a whole-number gap length.')
    : step === 2 && report?.verdict === 'fail' ? uiText('Resolve failing checks in the staged source, then check again.')
    : step === 3 && !existing && (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || !name.trim() || question.trim().length < 8) ? uiText('Enter a Project id, name and research question of at least eight characters.')
    : step === 3 && !population.length ? uiText('Select the caller-owned prediction assets explicitly.')
    : step === 3 && (!Number.isInteger(horizon) || horizon < 1 || horizon > 60) ? uiText('Choose a forward horizon from 1 to 60 bars.')
    : step === 3 && !packaged && (!adjustment || !venue.trim() || !currency.trim() || !provider.trim() || !terms.trim()) ? uiText('Declare adjustment, venue, currency, provider and source terms.')
    : step === 3 && preview && !acknowledged ? uiText('Acknowledge the exact command and snapshot write before confirming.') : null
  const perform = async () => {
    if (!bootstrap || reason) return
    setBusy(true); setError('')
    try {
      if (step === 0) {
        const value = await inspectSource(bootstrap, source)
        setInspection(value); setMapping(value.mapping); setFrequency(value.frequency)
        setCalendar(value.market.calendar ?? ''); setZone(value.market.timezone ?? '')
        setPopulation([]); setReport(null); setStep(1)
      } else if (step === 1) {
        setReport(await checkData(bootstrap, source, options())); setPopulation([]); setStep(2)
      } else if (step === 2) { setStep(3) }
      else if (!preview) {
        const value = await previewIntake(bootstrap, existing || id, { source, options: options(), name: name.trim(), question: question.trim(), horizon, predictionAssets: population })
        setPreview(value); setAcknowledged(false)
      } else {
        const launched = await confirmIntake(bootstrap, preview)
        const job = await waitJob(bootstrap, launched.jobId)
        if (job.status !== 'succeeded') throw new Error(jobError(job))
        setSuccess(preview.project); jobFinished()
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setPreview(null); setAcknowledged(false) }
    finally { setBusy(false) }
  }
  const field = (label: string, value: string, set: (v: string) => void, maxLength = 120) => <label className="intake-field">{uiText(label)}<input className="fe-input" value={value} maxLength={maxLength} onChange={e => { set(e.target.value); changed() }} /></label>
  const label = step === 0 ? uiText('Preview columns') : step === 1 ? uiText('Run quality check') : step === 2 ? uiText('Continue to intake') : preview ? uiText('Confirm and bind dataset') : uiText('Preview intake command')
  return <div className="pg intake-page">
    <TitleCard title={uiText('Import data')} subtitle={uiText('Inspect staged OHLCV, review quality, then bind through strict intake.')} backHref={routeHref({ view: 'factors' })} type={uiText('Data intake')} />
    <ol className="intake-steps">{STEPS.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined}><span className="mono">{index + 1}</span>{uiText(title)}</li>)}</ol>
    <PaneCard label={uiText('Data intake')}>
      {state.mode === 'loading' ? <Loading /> : !bootstrap && <Empty title={STATE_COPY.readOnly}><p>{STATE_COPY.readOnlyReason}</p><code>uv run aq studio serve &lt;workspace&gt; --allow-actions</code></Empty>}
      {busy && <Loading label={uiText('Working…')} />}
      {error && <details open role="alert"><summary>{uiText('Data intake needs attention')}</summary><p>{uiText('Check the source and declared metadata, then retry. Original diagnostic:')}</p><pre className="cmd small">{error}</pre></details>}
      {bootstrap && step === 0 && <div>
        <h2>{uiText('Choose staged data')}</h2><p className="muted">{uiText('Only folders and dataset packages under this Workspace’s staging directory are listed. Source files stay unchanged.')}</p>
        {!candidates && !error && <Loading />}
        {candidates?.length === 0 && <Empty title={uiText('No staged CSV files or dataset packages.')}><p>{uiText('Copy complete CSV sets or a complete dataset package into Workspace staging, then refresh.')}</p></Empty>}
        {!!candidates?.length && <label className="intake-field">{uiText('Staged source')}<select className="fe-input mono" value={source} onChange={e => { setSource(e.target.value); changed() }}><option value="">{uiText('Choose a staged source')}</option>{candidates.map(c => <option key={c.path} value={c.path}>{c.path}</option>)}</select></label>}
        <p className="small muted">{uiText('CSV filenames name assets unless an asset column is mapped. Existing package paths resolve from their manifest directory.')}</p>
      </div>}
      {bootstrap && step === 1 && inspection && <div>
        <h2>{uiText('Column mapping and market clock')}</h2><p className="mono" translate="no">{source}</p>
        {packaged ? <p>{uiText('Existing package columns and market authority are retained. Supply an audited V5 package for close-time-aware or asynchronous data.')}</p> : <table className="intake-table"><thead><tr><th>{uiText('Canonical column')}</th><th>{uiText('Detected source column')}</th></tr></thead><tbody>{COLUMNS.map(column => <tr key={column}><td>{uiText(COLUMN_COPY[column])}</td><td><select className="fe-input" aria-label={uiTemplate('Map {0}', [uiText(COLUMN_COPY[column])])} value={mapping[column] ?? ''} onChange={e => setMapping({ ...mapping, [column]: e.target.value })}><option value="">{uiText(column === 'asset' ? 'Filename / optional' : 'Choose column')}</option>{inspection.columns.map(c => <option key={c}>{c}</option>)}</select></td></tr>)}</tbody></table>}
        <details><summary>{uiText('Original CSV preview')}</summary><pre className="cmd small">{JSON.stringify(inspection.sample, null, 2)}</pre></details>
        {packaged ? <p className="mono" translate="no">{frequency} · {calendar} · {zone}</p> : <div className="intake-fields">{field('Frequency', frequency, setFrequency)}{field('Calendar', calendar, setCalendar)}{field('IANA timezone', zone, setZone)}</div>}
        <p className="small muted">{uiText('Use an exchange calendar such as XNYS, explicitly declared weekdays, or 24/7. Raw CSV packaging supports daily session date labels; other frequencies can be checked and require an existing package for intake.')}</p>
        <div className="intake-fields"><label className="intake-field">{uiText('Jump threshold (%)')}<input className="fe-input" type="number" min="0.01" value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></label><label className="intake-field">{uiText('Long gap (missing bars)')}<input className="fe-input" type="number" min="1" step="1" value={gap} onChange={e => setGap(Number(e.target.value))} /></label><label className="intake-field">{uiText('Universe coverage')}<select className="fe-input" value={coverage} onChange={e => setCoverage(e.target.value)}>{['unknown', 'currently-listed-only', 'contains-delisted'].map(value => <option key={value} value={value}>{uiText(value)}</option>)}</select></label></div>
      </div>}
      {bootstrap && step === 2 && report && <QualityTable report={report} />}
      {bootstrap && step === 3 && report && !success && <div>
        <h2>{uiText('Bind to a new or existing Project')}</h2><p className="muted small">{uiText('No research Run starts here. Strict Factor intake still requires at least four assets and 180 aligned daily observations for a V1 package; other package versions retain their own Core requirements.')}</p>
        <label className="intake-field">{uiText('Target Project')}<select className="fe-input" value={existing} onChange={e => { setExisting(e.target.value); changed() }}><option value="">{uiText('Create a new Factor Project')}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}</select></label>
        {!existing && <div className="intake-fields">{field('Project id', id, setId, 64)}{field('Factor name', name, setName)}{field('Original question', question, setQuestion, 500)}</div>}
        {!!existing && <p translate="no">{projects.find(p => p.id === existing)?.description}</p>}
        <div className="intake-population"><p>{uiText('Prediction assets (explicit caller selection)')}</p>{report.assets.map(a => <label key={a.asset}><input type="checkbox" checked={population.includes(a.asset)} onChange={e => { setPopulation(e.target.checked ? [...population, a.asset] : population.filter(v => v !== a.asset)); changed() }} /><span translate="no">{a.asset}</span></label>)}</div>
        <label className="intake-field">{uiText('Primary forward horizon (bars)')}<input className="fe-input" type="number" min="1" max="60" value={horizon} onChange={e => { setHorizon(Number(e.target.value)); changed() }} /></label>
        {!packaged && <div className="intake-fields"><label className="intake-field">{uiText('Price adjustment')}<select className="fe-input" value={adjustment} onChange={e => { setAdjustment(e.target.value); changed() }}><option value="">{uiText('Choose adjustment claim')}</option>{['raw', 'split-adjusted', 'split-and-dividend-adjusted', 'provider-adjusted'].map(v => <option key={v} value={v}>{uiText(v)}</option>)}</select></label>{field('Venue', venue, setVenue)}{field('Currency', currency, setCurrency)}{field('Asset class', assetClass, setAssetClass)}{field('Provider name', provider, setProvider)}{field('Source terms', terms, setTerms, 500)}</div>}
        <p className="small muted">{uiText('Unknown original retrieval time is preserved as null. Prediction means higher factor values rank higher forward returns; this is research only.')}</p>
        {preview && <section className="intake-preview"><h2>{uiText('Confirm dataset')}</h2><pre className="cmd mono">{preview.display}</pre><p>{uiText('Creates a staging package and a normalized Project snapshot through Core intake. No trial or Run.')}</p><details><summary>{uiText('Request and dataset package')}</summary><pre className="cmd small">{JSON.stringify({ request: preview.request, package: preview.package }, null, 2)}</pre></details><p className="mono small">{preview.commandHash}</p><label className="asecond"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />{uiText('I confirm the displayed command, source declarations, prediction population and Project snapshot write.')}</label></section>}
      </div>}
      {success && <div role="status"><h2>{uiText('Dataset bound successfully.')}</h2><p>{uiText('The Project now owns its strict request and immutable normalized snapshot. Review the research brief before authoring a candidate.')}</p></div>}
      <footer className="intake-footer"><ActionRow primary={success ? { label: uiText('Open Factor Project'), onClick: () => go(routeHref({ view: 'factor', id: success }) + '&idea=1') } : reason ? { label, disabled: true, disabledReason: reason } : { label, onClick: () => void perform() }} secondary={[...(step > 0 && !busy && !success ? [{ label: uiText('Back'), onClick: () => { setStep(step - 1); changed() } }] : []), ...(step === 0 && bootstrap && !busy ? [{ label: uiText('Refresh'), onClick: () => { setCandidates(null); setError(''); listSources(bootstrap).then(v => setCandidates(v.sources)).catch(e => setError(String(e))) } }] : []), { label: uiText('Back to Factors'), onClick: () => go(routeHref({ view: 'factors' })) }]} /></footer>
    </PaneCard>
  </div>
}
