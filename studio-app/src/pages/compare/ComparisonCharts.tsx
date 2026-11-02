import { useState } from 'react'
import { FigureCard, ComparisonFigure } from '../../components/workbench/FigureCard'
import { MetricInfo } from '../../components/MetricInfo'
import { bi, metricEntry } from '../../metrics/catalogue'
import { uiText } from '../../i18n'
import { testVisible } from '../testGate'
import type { Comparison } from '../../library/runHistoryApi'
import { deltaText } from './comparisonCopy'
import { primaryMetricId } from './comparisonMetrics'
import { PairedCurve } from './PairedCurve'

export function ComparisonCharts({ comparison: c }: { comparison: Comparison }) {
  const [group, setGroup] = useState('spread')
  const id = primaryMetricId(c.a.primaryMetric)
  const factors = c.factors
  const gated = factors?.map(f => f.points.filter(p => p.split !== 'test' || testVisible(f.protocol, f.summary)))
  return <div className="cmp-figures">
    <div className="cmp-primary-figure"><ComparisonFigure title={bi(metricEntry(id).label)} subtitle={uiText('Validation only; common scale.')} label={uiText('FIG A')}
      caption={uiText('The grey baseline and accent subject show measurements under the same protocol, not a new verdict.')}
      baselineLabel={uiText('Baseline (A)')} subjectLabel={uiText('Subject (B)')}
      rows={[{ label: bi(metricEntry(id).label), baseline: c.a.primaryValue, subject: c.b.primaryValue }]}
      format={v => deltaText(v ?? null)} /><span className="cmp-figure-help"><MetricInfo id={id} /></span></div>
    {gated && <FigureCard title={uiText('Paired group cumulative curve')} subtitle={uiText('Published cumulative group growth; gross of costs.')} label={uiText('FIG B')} development
      caption={uiText('Grey is baseline; accent is subject. Overlapping forward returns can overstate compounded growth; this is not an executed portfolio.')}
      info={<MetricInfo id="spreadTotalReturn" />} minHeight={220}
      toggle={<label>{uiText('Group')} <select aria-label={uiText('Group')} value={group} onChange={e => setGroup(e.target.value)}>{['spread', 'low', 'middle', 'high'].map(g => <option key={g} value={g}>{uiText(g)}</option>)}</select></label>}
      legend={<span>{uiText('Baseline (A)')} · {uiText('Subject (B)')}</span>}>
      {({ width, height }) => <PairedCurve a={gated[0]} b={gated[1]} group={group} width={width} height={height} />}
    </FigureCard>}
  </div>
}
