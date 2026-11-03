import { useState } from 'react'
import type { StrategyRoute } from '../api'
import { uiText, uiValue } from '../i18n'
import { useOptionalActions } from './ActionsContext'
import { previewAction, launchPreviewed } from './candidateApi'
import type { Preview } from './types'
import { CopyButton } from './CopyButton'
import { Modal } from '../shell/Modal'
import { ConvertStrategyDialog } from './ConvertStrategyDialog'
import { routeHref } from '../route'
import '../pages/strategy/strategy.css'

const REASONS: Record<string, string> = {
  'risk-outcome': 'This Factor predicts future realized volatility. Core cannot translate a risk forecast into a forward-return Portfolio claim; a different caller-owned assignment is required.',
  'no-coordinated-program': 'This Project has no coordinated Factor-to-Portfolio program and is not a request-bound standalone Factor Lab that Core can convert.',
  'source-not-tested': 'The source Factor has no successful Factor Run; test it before building a strategy.',
  'source-changed': 'The source candidate changed after its latest Factor Run; re-test the exact source before building a strategy.',
  'data-not-reusable': 'The source dataset package could not be found unchanged under Workspace staging, so the same market data cannot be proven.',
  'data-mismatch': 'The supplied dataset package is not the exact market data the source Factor was tested on.',
  'active-session': 'Finish the active research Session before starting Portfolio: Factor, Portfolio and RL share source authority.',
  'failed-evidence': 'Inspect the retained failed Portfolio Run and its failure disposition before declaring new work.',
  'no-start-command': 'Core does not offer a Portfolio Session start for this state.',
  'invalid-program': 'The coordinated program could not be verified; inspect Project diagnostics before building a strategy.',
}

/** The server publishes eligibility; the browser only confirms an existing aq command. */
export function BuildStrategyAction({ projectId, route, shownRunId }: { projectId: string; route?: StrategyRoute; shownRunId?: string }) {
  const actions = useOptionalActions()
  const bootstrap = actions?.state.mode === 'on' ? actions.state.bootstrap : null
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [second, setSecond] = useState(false)
  const [error, setError] = useState('')
  const [converting, setConverting] = useState(false)
  const differentRun = !!shownRunId && !!route?.factorRunId && shownRunId !== route.factorRunId
  const open = route?.mode === 'open' && !differentRun
  const reason = !route ? uiText('No verified Factor-to-Portfolio route is published for this Project.')
    : route.mode === 'blocked' ? uiText(REASONS[route.reasonCode] ?? 'Core has not admitted this Factor to Portfolio; inspect the exact gate reason below.')
    : differentRun ? uiText('The selected Factor Run differs from the current canonical source. Select the current admitted Factor Run before building its Strategy.')
    : actions?.state.mode === 'loading' ? uiText('Loading…')
    : !open && !bootstrap ? uiText('Read-only session: actions are off.') : null
  const prepare = async () => {
    if (!bootstrap || reason) return
    if (route?.mode === 'convert') { setConverting(true); return }
    setBusy(true); setError(''); setSecond(false)
    try { setPreview(await previewAction(bootstrap, 'strategy.build', projectId, {})) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  const launch = async () => {
    if (!bootstrap || !preview || !second) return
    setBusy(true); setError('')
    try {
      const job = await launchPreviewed(bootstrap, preview, second)
      setPreview(null); actions?.setActiveJobId(job.jobId)
      actions?.go(routeHref({ view: 'strategy', id: projectId }))
    } catch (e) {
      setPreview(null); setSecond(false)
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }
  return <div className="strategy-build">
    <div>{open ? <a className="abtn" href={routeHref({ view: 'strategy', id: projectId })}>{uiText('Open strategy')}</a>
      : <button type="button" className="abtn" disabled={!!reason || busy} onClick={() => void prepare()}>{uiText('Build strategy')}</button>}</div>
    {reason && <p className="small muted strategy-reason" role="status">{reason}</p>}
    {route?.mode === 'blocked' && route.reason !== REASONS[route.reasonCode] && <details className="small muted"><summary>{uiText('Exact Core gate reason')}</summary><p translate="no">{route.reason}</p></details>}
    {route && !open && <details className="small muted"><summary>{uiText('Agent CLI path')}</summary>
      {route.reasonCode === 'no-coordinated-program' && <p>{uiText('First agree the caller-owned Portfolio policy and complete research brief, then intake a sibling research desk with a complete compatible dataset. Author the factor before evaluation, publish its counted evidence and Report, and follow Core admission. A scaffold alone does not transfer evidence.')}</p>}
      <pre className="cmd mono" translate="no">{route.display}</pre><CopyButton text={route.display} label={uiText('Copy command')} />
    </details>}
    {error && <p role="alert">{uiText('Could not build strategy. Preview again after inspecting the refusal.')} {error}</p>}
    {route?.mode === 'convert' && route.conversion && <p className="small muted strategy-reason">{uiText('Creates a new research desk from this exact Factor by reference; you confirm every Portfolio fact first.')}</p>}
    <Modal open={converting} onClose={() => setConverting(false)} label={uiText('Build strategy from this Factor')} className="adialog">
      {converting && bootstrap && route?.conversion && <ConvertStrategyDialog bootstrap={bootstrap} projectId={projectId} conversion={route.conversion}
        onClose={() => setConverting(false)} onDone={(href) => { setConverting(false); actions?.go(href) }} />}
    </Modal>
    <Modal open={!!preview} onClose={() => { if (!busy) setPreview(null) }} label={uiText('Build strategy')} className="adialog">
      {preview && <div className="adialog-body"><header className="adialog-head"><h2>{uiText('Build strategy')}</h2><p>{uiText('Review the exact command before confirming. Nothing has run yet.')}</p></header>
        <div className="adialog-scroll">
          <pre className="cmd mono" translate="no">{preview.display}</pre><CopyButton text={preview.display} label={uiText('Copy command')} />
          <p>{uiText('Starts the existing research-desk Portfolio Study in a governed Session; a new baseline counts unless reused. No Project conversion or new Study.')}</p>
          <p className="small mono" translate="no">{route?.factorRunId ?? '—'}</p>
          <p>{uiValue(preview.trial?.notice ?? '')}</p>
          <p className="small mono" translate="no">{preview.commandHash}</p>
          <label><input type="checkbox" checked={second} onChange={e => setSecond(e.target.checked)} /> {uiText('I confirm the Session/worktree creation and understand that any new baseline is a counted source trial. Only the Core Judge decides the result.')}</label>
        </div>
        <footer className="adialog-foot"><button type="button" className="abtn" disabled={busy} onClick={() => setPreview(null)}>{uiText('Cancel')}</button><button type="button" className="abtn abtn--primary" disabled={!second || busy} onClick={() => void launch()}>{uiText('Confirm build strategy')}</button></footer>
      </div>}
    </Modal>
  </div>
}
