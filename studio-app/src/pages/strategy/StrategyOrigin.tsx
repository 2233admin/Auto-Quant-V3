import { useState } from 'react'
import type { ProjectSnapshot } from '../../api'
import { uiTemplate, uiText, uiValue } from '../../i18n'
import { useOptionalActions } from '../../actions/ActionsContext'
import { StartSessionDialog } from '../../actions/StartSessionDialog'
import { Modal } from '../../shell/Modal'
import { routeHref } from '../../route'
import { SectionBar } from '../../design/marks'

const pct = (v: number | undefined | null) => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—'

/** Lineage of a desk built from a standalone Factor, and the governed first Portfolio evaluation. Never runs anything itself. */
export function StrategyOrigin({ project }: { project: ProjectSnapshot }) {
  const strategy = project.library?.strategy
  const lineage = strategy?.lineage
  const actions = useOptionalActions()
  const bootstrap = actions?.state.mode === 'on' ? actions.state.bootstrap : null
  const [open, setOpen] = useState(false)
  if (!lineage) return null
  if (!lineage.valid) return <p role="alert">{uiText('The Factor lineage of this desk could not be verified.')} <span translate="no">{lineage.error}</span></p>
  const m = lineage.mandate
  const p = m?.portfolioPolicy
  const b = m?.benchmarkPolicy
  const cadence = p?.decisionSchedule.kind === 'every-bars' ? uiTemplate('every {0} daily bars', [p.decisionSchedule.bars]) : uiText('calendar month end')
  const benchmark = !b ? '—' : b.kind === 'cash' ? uiText('Cash') : b.kind === 'asset' ? b.symbol : uiTemplate('Fixed weights: {0}', [Object.entries(b.weights).map(([s, w]) => `${s} ${pct(w)}`).join(', ')])
  const firstRun = strategy?.state === 'Defined' && !!strategy.studyId
  return <section className="strategy-origin" aria-label={uiText('Strategy origin')}>
    <SectionBar as="h2" icon="factors" micro="PROVENANCE">{uiText('Built from a standalone Factor')}</SectionBar>
    <dl className="convert-facts">
      <dt>{uiText('Source Factor Project')}</dt><dd><a href={routeHref({ view: 'factor', id: lineage.sourceProjectId ?? '' })} translate="no">{lineage.sourceProjectId}</a></dd>
      <dt>{uiText('Source Factor Run')}</dt><dd className="mono" translate="no">{lineage.sourceRunId}</dd>
      <dt>{uiText('Candidate source hash')}</dt><dd className="mono" translate="no">{lineage.sourceHash?.slice(0, 16)}</dd>
      <dt>{uiText('Source evidence')}</dt><dd>{uiValue(lineage.sourceQualificationStage ?? 'not reconstructed')} · {uiText('selection adjustment')} {lineage.sourceSelectionAdjustment?.passes === true ? uiText('passes') : lineage.sourceSelectionAdjustment?.passes === false ? uiText('fails') : uiText('not available')}</dd>
      <dt>{uiText('Inherited counted trials')}</dt><dd>{uiTemplate('{0} distinct Factor sources from {1} source Runs; selection adjustment here counts them.', [lineage.inheritedSourceTrials ?? 0, lineage.sourceRunCount ?? 0])}</dd>
      <dt>{uiText('Market data')}</dt><dd>{lineage.sameMarketData ? uiTemplate('Same market data as the source, proven by hash · {0} daily bars', [lineage.observations ?? 0]) : uiText('Not proven identical')}</dd>
      <dt>{uiText('Caller-provided mandate')}</dt><dd>{uiTemplate('Direction {0} · benchmark {1} · {2} · cost {3} bps · volatility ceiling {4} · gross {5} · max weight {6}', [m?.direction ?? '—', benchmark, cadence, p?.baseCostBps ?? '—', pct(p?.annualizedVolatilityCeiling), p?.grossLimit ?? '—', pct(p?.maxAbsWeight)])}</dd>
      <dt>{uiText('Position roles')}</dt><dd translate="no">{Object.entries(m?.positionRoles ?? {}).map(([s, r]) => `${s}=${r}`).join(', ')}</dd>
    </dl>
    {lineage.factorGate && <p className="small muted">{uiText('This desk\'s own Factor-to-Portfolio gate (Core):')} <b>{uiValue(lineage.factorGate.status)}</b> · {uiValue(lineage.factorGate.explanation)}</p>}
    {!lineage.rlLaneSufficient && <p className="small muted">{uiTemplate('Governed RL needs {0} daily bars; this data has {1}, so the RL lane cannot run here.', [lineage.rlRequiredObservations ?? 240, lineage.observations ?? 0])}</p>}
    {firstRun && <div className="strategy-build">
      <button type="button" className="abtn abtn--primary" disabled={!bootstrap} onClick={() => setOpen(true)}>{uiText('Run first Portfolio evaluation')}</button>
      <p className="small muted">{bootstrap ? uiText('Starts the governed Portfolio Session through the existing action: preview, second confirmation, counted baseline Run. The Core Judge decides the result.') : uiText('Read-only session: actions are off.')}</p>
    </div>}
    <Modal open={open} onClose={() => setOpen(false)} label={uiText('Confirm Start session')} className="adialog">
      {open && bootstrap && strategy?.studyId && <StartSessionDialog project={project} bootstrap={bootstrap} studyId={strategy.studyId}
        onClose={() => setOpen(false)} onLaunched={(jobId) => { setOpen(false); actions?.setActiveJobId(jobId) }} />}
    </Modal>
  </section>
}
