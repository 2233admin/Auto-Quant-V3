import { useState } from 'react'
import type { StrategyConversion, StrategyMandate } from '../api'
import { uiTemplate, uiText } from '../i18n'
import { routeHref } from '../route'
import { actionCall } from './client'
import { CopyButton } from './CopyButton'
import { previewAction, launchPreviewed } from './candidateApi'
import type { ActionsBootstrap, Job, Preview } from './types'
import { isTerminal } from './types'

type Role = StrategyMandate['positionRoles'][string]
const ROLES: Role[] = ['long-only', 'short-only', 'two-sided', 'context-only']
type Benchmark = 'equal-weight' | 'cash' | 'asset'
type Policy = Record<'grossLimit' | 'maxAbsWeight' | 'annualizedVolatilityCeiling' | 'baseCostBps' | 'noTradeOneWay' | 'referenceNav' | 'bars', string>
export type ConversionPreview = Preview & { mandate: StrategyMandate; mandateSha256: string; trial: Preview['trial'] & { inheritedSourceTrials: number }; conversion: { newProject: string; sourceRunId: string; sourceHash: string; datasetPackage: string; observations: number; rlLaneSufficient: boolean; callerProvidedFields: string[] } }

/** Direction follows the confirmed roles exactly as Core checks it; it is shown, never chosen silently. */
export function directionFor(roles: Record<string, Role>): StrategyMandate['direction'] | null {
  const values = Object.values(roles)
  const long = values.some(r => r === 'long-only' || r === 'two-sided')
  const short = values.some(r => r === 'short-only' || r === 'two-sided')
  return long && short ? 'long-short' : long ? 'long' : short ? 'short' : null
}

/** Builds the caller mandate only from the visible form; `callerConfirmed` mirrors the explicit checkbox. */
export function mandateFrom(question: string, roles: Record<string, Role>, benchmark: Benchmark, benchmarkAsset: string, policy: Policy, confirmed: boolean): StrategyMandate {
  const tradable = Object.keys(roles).filter(s => roles[s] !== 'context-only')
  const weights = Object.fromEntries(tradable.map(s => [s, 1 / tradable.length]))
  const num = (v: string) => Number(v)
  return {
    schemaVersion: 1, kind: 'autoquant-strategy-mandate', question: question.trim(),
    direction: directionFor(roles) ?? 'long', positionRoles: roles,
    benchmarkPolicy: benchmark === 'cash' ? { kind: 'cash', symbol: null } : benchmark === 'asset' ? { kind: 'asset', symbol: benchmarkAsset } : { kind: 'fixed-weights', weights },
    portfolioPolicy: { grossLimit: num(policy.grossLimit), maxAbsWeight: num(policy.maxAbsWeight), assetMaxAbsWeights: {}, annualizedVolatilityCeiling: num(policy.annualizedVolatilityCeiling), baseCostBps: num(policy.baseCostBps), noTradeOneWay: num(policy.noTradeOneWay), referenceNav: num(policy.referenceNav), decisionSchedule: { kind: 'every-bars', bars: Math.trunc(num(policy.bars)), anchor: 'dataset-start' } },
    callerConfirmed: confirmed,
  }
}

const initialPolicy = (d: StrategyMandate): Policy => {
  const p = d.portfolioPolicy
  const bars = p.decisionSchedule.kind === 'every-bars' ? p.decisionSchedule.bars : 1
  return { grossLimit: String(p.grossLimit), maxAbsWeight: String(p.maxAbsWeight), annualizedVolatilityCeiling: String(p.annualizedVolatilityCeiling), baseCostBps: String(p.baseCostBps), noTradeOneWay: String(p.noTradeOneWay), referenceNav: String(p.referenceNav), bars: String(bars) }
}

const FIELDS: [keyof Policy, string, string][] = [
  ['bars', 'Decision cadence (every N daily bars)', 'cadence'],
  ['baseCostBps', 'Cost model: linear cost per traded notional (bps)', 'cost'],
  ['noTradeOneWay', 'No-trade band (one-way weight)', 'cost'],
  ['grossLimit', 'Risk policy: gross exposure limit', 'risk'],
  ['maxAbsWeight', 'Risk policy: maximum weight per asset', 'risk'],
  ['annualizedVolatilityCeiling', 'Risk policy: annualized volatility ceiling', 'risk'],
  ['referenceNav', 'Reference NAV for capacity evidence', 'risk'],
]

/** Collects every caller-owned Portfolio fact, previews the exact Core command, then needs a second confirmation. */
export function ConvertStrategyDialog({ bootstrap, projectId, conversion, onClose, onDone }: {
  bootstrap: ActionsBootstrap; projectId: string; conversion: StrategyConversion; onClose: () => void; onDone: (href: string, jobId: string) => void
}) {
  const d = conversion.defaults
  const [newId, setNewId] = useState(conversion.suggestedProjectId)
  const [question, setQuestion] = useState(d.question)
  const [roles, setRoles] = useState<Record<string, Role>>(d.positionRoles)
  const [benchmark, setBenchmark] = useState<Benchmark>('equal-weight')
  const [benchmarkAsset, setBenchmarkAsset] = useState(conversion.assets[conversion.assets.length - 1] ?? '')
  const [policy, setPolicy] = useState<Policy>(initialPolicy(d))
  const [confirmed, setConfirmed] = useState(false)
  const [preview, setPreview] = useState<ConversionPreview | null>(null)
  const [second, setSecond] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const direction = directionFor(roles)
  const ready = confirmed && !!direction && /^[a-z0-9][a-z0-9-]{0,63}$/.test(newId)
  const review = async () => {
    setBusy(true); setError(''); setSecond(false)
    try { setPreview(await previewAction(bootstrap, 'strategy.build', projectId, { newProject: newId, mandate: mandateFrom(question, roles, benchmark, benchmarkAsset, policy, true) }) as ConversionPreview) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  const create = async () => {
    if (!preview || !second) return
    setBusy(true); setError(''); setStatus(uiText('Creating the research desk…'))
    try {
      const { jobId } = await launchPreviewed(bootstrap, preview, true)
      for (;;) {
        const job = await actionCall<Job>(bootstrap, 'GET', `/api/v1/jobs/${encodeURIComponent(jobId)}`)
        if (isTerminal(job.status)) {
          if (job.status !== 'succeeded') throw new Error((job.stderrTail || job.stdoutTail || job.status).trim().split('\n').slice(-6).join('\n'))
          onDone(routeHref({ view: 'strategy', id: preview.conversion.newProject }), jobId)
          return
        }
        await new Promise(resolve => setTimeout(resolve, 700))
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStatus('') }
    finally { setBusy(false) }
  }
  const field = (key: keyof Policy, label: string) => <label key={key} className="convert-field"><span>{uiText(label)}</span>
    <input className="mono" inputMode="decimal" value={policy[key]} disabled={!!preview} onChange={e => { setPolicy({ ...policy, [key]: e.target.value }); setConfirmed(false) }} /></label>
  return <div className="adialog-body"><header className="adialog-head"><h2>{uiText('Build strategy from this Factor')}</h2>
    <p>{uiText('Creates a new research desk that reuses this Factor\'s exact source and market data by reference. The source Project is not changed.')}</p></header>
    <div className="adialog-scroll">
      <dl className="convert-facts">
        <dt>{uiText('Source Factor Run')}</dt><dd className="mono" translate="no">{conversion.sourceRunId}</dd>
        <dt>{uiText('Candidate source hash')}</dt><dd className="mono" translate="no">{conversion.sourceHash.slice(0, 16)}</dd>
        <dt>{uiText('Inherited counted trials')}</dt><dd>{uiTemplate('{0} distinct Factor sources tried in the source Project continue in the new desk.', [conversion.inheritedSourceTrials])}</dd>
        <dt>{uiText('Market data')}</dt><dd><span className="mono" translate="no">{conversion.datasetPackage}</span> · {uiTemplate('{0} daily bars, proven identical by hash', [conversion.observations])}</dd>
      </dl>
      {!conversion.rlLaneSufficient && <p className="small muted">{uiText('The optional governed RL lane needs 240 daily bars; this data is shorter, so only Factor and Portfolio can run. RL would fail its fixed Judge and is not offered.')}</p>}
      {!preview && <fieldset className="convert-form">
        <legend>{uiText('Caller-owned Portfolio facts')}</legend>
        <p className="small muted">{uiText('Displayed starting values only. Nothing is recorded until you confirm every Portfolio fact.')}</p>
        <label className="convert-field"><span>{uiText('New research desk id')}</span><input className="mono" value={newId} onChange={e => setNewId(e.target.value)} /></label>
        <label className="convert-field convert-wide"><span>{uiText('Strategy question')}</span><textarea rows={2} value={question} onChange={e => { setQuestion(e.target.value); setConfirmed(false) }} /></label>
        <table className="convert-roles"><caption>{uiText('Tradable assets and position roles')}</caption><tbody>
          {conversion.assets.map(symbol => <tr key={symbol}><th scope="row" className="mono" translate="no">{symbol}</th><td>
            <select aria-label={symbol} value={roles[symbol]} onChange={e => { setRoles({ ...roles, [symbol]: e.target.value as Role }); setConfirmed(false) }}>
              {ROLES.map(role => <option key={role} value={role}>{uiText(role)}</option>)}</select></td></tr>)}
        </tbody></table>
        <p className="small">{uiText('Direction (derived from the roles):')} <b translate="no">{direction ?? '—'}</b></p>
        <label className="convert-field"><span>{uiText('Benchmark')}</span><select value={benchmark} onChange={e => { setBenchmark(e.target.value as Benchmark); setConfirmed(false) }}>
          <option value="equal-weight">{uiText('Equal-weight basket of tradable assets')}</option><option value="cash">{uiText('Cash')}</option><option value="asset">{uiText('One named asset')}</option></select></label>
        {benchmark === 'asset' && <label className="convert-field"><span>{uiText('Benchmark asset')}</span><select value={benchmarkAsset} onChange={e => { setBenchmarkAsset(e.target.value); setConfirmed(false) }}>
          {conversion.assets.map(symbol => <option key={symbol} value={symbol}>{symbol}</option>)}</select></label>}
        {FIELDS.map(([key, label]) => field(key, label))}
        <p className="small muted">{uiText('Signal construction (ranking, thresholds, sizing) is fixed Harness authority and is not a caller choice. Daily decisions are anchored to the dataset start.')}</p>
        <label className="convert-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> {uiText('I confirm these Portfolio facts as my own; they will be recorded as caller-provided.')}</label>
      </fieldset>}
      {preview && <div className="convert-preview">
        <p>{uiText('Review the exact command before confirming. Nothing has run yet.')}</p>
        <pre className="cmd mono" translate="no">{preview.display}</pre><CopyButton text={preview.display} label={uiText('Copy command')} />
        <details open><summary>{uiText('Caller-provided mandate')}</summary><pre className="cmd mono" translate="no">{JSON.stringify(preview.mandate, null, 2)}</pre></details>
        <p>{uiText(preview.writes)}</p>
        <p>{uiTemplate('The new desk continues {0} counted source trials; its first Portfolio evaluation will be trial {1}.', [preview.trial.inheritedSourceTrials, preview.trial.n])}</p>
        <p className="small mono" translate="no">{preview.commandHash}</p>
        <label><input type="checkbox" checked={second} onChange={e => setSecond(e.target.checked)} /> {uiText('I confirm creating the research desk and continuing its counted research family. Only the Core Judge decides results.')}</label>
      </div>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{uiText('Core refused or failed. Nothing was created unless the job reported success.')} <span translate="no">{error}</span></p>}
    </div>
    <footer className="adialog-foot">
      <button type="button" className="abtn" disabled={busy} onClick={() => preview ? setPreview(null) : onClose()}>{preview ? uiText('Back') : uiText('Cancel')}</button>
      {!preview ? <button type="button" className="abtn abtn--primary" disabled={!ready || busy} onClick={() => void review()}>{uiText('Preview command')}</button>
        : <button type="button" className="abtn abtn--primary" disabled={!second || busy} onClick={() => void create()}>{uiText('Create research desk')}</button>}
    </footer>
  </div>
}
