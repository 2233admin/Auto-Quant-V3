import type { ProjectSnapshot } from '../../api'
import { uiTemplate, uiText, uiValue } from '../../i18n'
import { MetricGrid } from '../../components/workbench'
import { Empty } from '../../components/States'
import { fn, up } from '../portfolio/pfmt'

/** A neighborhood is a context stress, not a search result or a parameter recommendation. */
export function StrategyTuning({ project }: { project: ProjectSnapshot }) {
  const neighborhood = project.portfolioExplorer?.parameterNeighborhood
  const evidence = project.library?.strategy?.evidence
  const adjustment = evidence?.selectionAdjustment
  const statistics = adjustment?.statistics
  return <div className="vstack">
    <h2 className="type-section">{uiText('Parameter neighborhood')}</h2>
    {neighborhood?.available ? <p>{uiTemplate('{0} predeclared configurations; base {1}.', [neighborhood.policy?.configurationCount ?? '—', neighborhood.policy?.baseConfigurationId ?? '—'])}</p>
      : <Empty title={uiText('No evidence in this Project')}><p>{uiText('No parameter neighborhood is published for this Portfolio Run.')}</p></Empty>}
    <p className="small muted">{uiText('The neighborhood is context only. Core publishes no selection-adjusted result for individual cells, so their raw rankings and best values are withheld here.')}</p>
    <h3 className="type-section">{uiText('Selection-adjusted evidence')}</h3>
    {adjustment ? <>
      <p>{uiValue(adjustment.status)} · <span className="mono">{adjustment.method ?? '—'}</span></p>
      <p>{uiValue(adjustment.interpretation)}</p>
      <p className="small muted">{uiText('This adjustment belongs to the exact base Run and its source-trial family; it does not adjust the neighborhood cells.')}</p>
      {statistics && <MetricGrid groups={[{ heading: uiText('Validation · development'), label: uiText('Selection-adjusted evidence'), tiles: [
        { label: uiText('Deflated Sharpe probability'), value: up(statistics.deflatedSharpeProbability), metric: 'deflatedSharpe', info: uiText('Core family adjustment; no parameter-selection authority.') },
        { label: uiText('Minimum track record'), value: fn(statistics.minimumTrackRecordObservations, 0), metric: 'minimumTrackRecord', info: uiText('Required observations under the Core adjustment.') },
        { label: uiText('Unique source trials'), value: String(evidence.researchFamily?.uniqueSourceTrials ?? '—'), metric: 'trialsCounted' },
      ]}]} />}
      {adjustment.reason && <p className="small muted">{uiValue(adjustment.reason)}</p>}
    </> : <p>{uiText('No verified selection adjustment is available. No adjusted tuning result can be claimed.')}</p>}
    <p className="small mono" translate="no">{evidence?.runId ?? '—'}</p>
    <p className="small muted">{uiText('No parameters are applied. A new hypothesis requires a separately declared, counted trial and a fresh external holdout where required.')}</p>
  </div>
}
