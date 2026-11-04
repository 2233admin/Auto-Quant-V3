import { useState } from 'react'
import { translate, useLanguage } from '../i18n'
import { SectionBar } from '../design/marks'
import type { FactorDiagnostics, FactorSplit } from '../api'
import { MetricExplanation, MetricInfo, type MetricId } from '../components/MetricInfo'
import { FigureCard } from '../components/workbench/FigureCard'
import { gatedSplits, studyTestVisible, TEST_HIDDEN_NOTE } from './testGate'
import { TearSheetPlot } from './TearSheetPlot'

const pct = (v: number | null | undefined) => v == null ? '—' : `${(v * 100).toFixed(3)}%`
const value = (v: number | null | undefined) => v == null ? '—' : v.toFixed(4)

/** Resolve the gate before reading values, including captions and data tables. */
export function FactorTearSheet({ study }: { study: FactorDiagnostics }) {
  const language = useLanguage()
  const tr = (en: string, zh: string) => translate(language, en, zh)
  const [chosen, setChosen] = useState<FactorSplit>('validation')
  const sheet = study.tearSheet
  const title = tr('Full factor tear sheet', '完整因子报告')
  if (!sheet || sheet.status === 'not-published') return <section className="tear-sheet" aria-label={title}>
    <SectionBar as="h2" icon="analysis" micro="TEAR SHEET">{title}</SectionBar><p className="muted">{tr("Not published by this Run's Judge.", '本次运行的 Judge 未发布此证据。')}</p>
  </section>
  if (sheet.status !== 'available') return <section className="tear-sheet" aria-label={title}>
    <SectionBar as="h2" icon="analysis" micro="TEAR SHEET">{title}</SectionBar><p>{tr('Cross-sectional groups and rank persistence are unavailable for temporal evaluation.', '时间序列评估不提供横截面分组与秩持续性证据。')}</p>
  </section>
  const allowed = gatedSplits(study, ['train', 'validation', 'test'] as const)
  const split = allowed.includes(chosen) ? chosen : 'validation'
  const data = sheet.splits?.[split]
  if (!data) return null
  const names = Array.from({ length: sheet.quantiles ?? 3 }, (_, i) => `Q${i + 1}`)
  const splitName = (s: FactorSplit) => s === 'validation' ? tr('Validation', '验证集') : s === 'train' ? tr('Train', '训练集') : tr('Test audit', '测试审计')
  const scope = `${splitName(split)} · ${tr('primary horizon', '主预测周期')} ${sheet.primaryHorizon} · ${tr('bars', '根 K 线')}`
  const table = (labels: string[], series: { name: string; values: (number | null)[] }[]) => <table className="data-table"><thead><tr><th>{tr('Axis', '坐标')}</th>{series.map(s => <th key={s.name}>{s.name}</th>)}</tr></thead><tbody>{labels.map((label, i) => <tr key={i}><th>{label}</th>{series.map(s => <td key={s.name}>{value(s.values[i])}</td>)}</tr>)}</tbody></table>
  const figure = (id: MetricId, heading: string, caption: string, labels: string[], series: { name: string; values: (number | null)[] }[], bars = false, percent = false) => <FigureCard key={id} title={heading} subtitle={scope} label={tr('Published diagnostics', '已发布的诊断')} caption={caption} development
    info={<MetricExplanation id={id} />} table={table(labels, series)} minHeight={185}
    legend={series.length > 1 ? series.map((s, i) => <span key={s.name} className="small muted">{`${s.name} ${i ? '┄' : '━'} `}</span>) : undefined}>
    {size => <TearSheetPlot {...size} labels={labels} series={series} bars={bars} percent={percent} />}
  </FigureCard>
  const dates = data.path.map(p => p.timestamp.slice(0, 10))
  const gross = tr('Gross', '毛收益'), net = tr('Cost-adjusted', '扣成本')
  const noCost = tr('No cost model; cost-adjusted returns are unavailable.', '无成本模型，扣成本收益不可用。')
  const risk = sheet.outcome !== 'forward-return'
  const warning = data.shortSample || data.icDecay.some(p => p.shortSample) || data.autocorrelation.some(p => p.shortSample) || data.meanTurnover.some(p => p.shortSample)
  return <section className="tear-sheet" aria-label={title}>
    <SectionBar as="h2" icon="analysis" micro="TEAR SHEET">{title} <MetricInfo id="tearQuantiles" /></SectionBar>
    <label>{tr('Evidence split', '证据划分')} <select aria-label={tr('Tear sheet split', '完整报告的数据划分')} value={split} onChange={e => setChosen(e.target.value as FactorSplit)}>
      {allowed.map(s => <option key={s} value={s}>{splitName(s)}</option>)}
    </select></label>
    {!studyTestVisible(study) && <p className="muted small">{TEST_HIDDEN_NOTE}</p>}
    <p className="small muted">{tr('Diagnostic only; no selection or trading authority. Minimum one name per group; singleton groups can be noisy.', '仅供诊断，无选择或交易权限。每组最低一个标的；单成员分组可能噪声较大。')}</p>
    {warning && <p role="status">{tr('Short sample: one or more statistics have fewer than', '短样本：至少一项统计的有效观测少于')} {sheet.minimumSampleBars} {tr('bars.', '根 K 线。')} <MetricInfo id="tearSample" /></p>}
    {!!data.refusedBars && <p>{tr('Bars refused for insufficient breadth or distinct scores:', '因标的或不同因子值不足而拒绝分组的 K 线数：')} {data.refusedBars}</p>}
    {risk ? <p>{tr('Risk outcome: group levels are forward realized volatility; return curves and long-short returns do not apply.', '风险结果：分组水平是前瞻已实现波动率；收益曲线与多空收益不适用。')}</p> : <p className="small muted">{sheet.costModel ? `${tr('Linear target-change cost, bps:', '线性目标变动成本，基点：')} ${sheet.costModel.baseCostBps}` : noCost}</p>}
    <p className="small muted">{tr('Multi-bar outcomes overlap. Compounded curves are descriptive indices, not investable wealth; each split starts at one. Curves are sampled only after full-history calculation.', '多期结果存在重叠。复利曲线为描述性指数，不代表可投资净值；各划分从一开始。完整历史计算后才对曲线采样。')}</p>
    {figure('tearQuantileMean', tr('Mean outcome by quantile', '各分组平均前瞻结果'), `${tr('Top / bottom mean:', '最高 / 最低分组均值：')} ${pct(data.quantileMeans.at(-1)?.value)} / ${pct(data.quantileMeans[0]?.value)}.`, names, [{ name: tr('Mean outcome', '平均结果'), values: data.quantileMeans.map(q => q.value) }], true, true)}
    {!risk && figure('tearGroupGrowth', tr('Cumulative group returns', '各分组累计收益'), `${tr('Top / bottom ending index:', '最高 / 最低分组期末指数：')} ${value(data.path.at(-1)?.groupCumulative.at(-1))} / ${value(data.path.at(-1)?.groupCumulative[0])}.`, dates, names.map((name, q) => ({ name, values: data.path.map(p => p.groupCumulative[q]) })))}
    {!risk && figure('tearLongShort', tr('Long-short gross and cost-adjusted', '多空毛收益与扣成本收益'), `${tr('Mean gross / net:', '平均毛收益 / 净收益：')} ${pct(data.longShortGross.value)} / ${pct(data.longShortNet.value)}. ${sheet.costModel ? tr('Two units gross; no drift or execution model.', '总敞口为两单位；无漂移或执行模型。') : noCost}`, dates, [{ name: gross, values: data.path.map(p => p.grossCumulative) }, ...(sheet.costModel ? [{ name: net, values: data.path.map(p => p.netCumulative) }] : [])])}
    {figure('tearTurnover', tr('Turnover by quantile', '各分组换手率'), `${tr('Top / bottom mean turnover:', '最高 / 最低分组平均换手率：')} ${pct(data.meanTurnover.at(-1)?.value)} / ${pct(data.meanTurnover[0]?.value)}.`, names, [{ name: tr('Mean turnover', '平均换手率'), values: data.meanTurnover.map(q => q.value) }], true, true)}
    {figure('tearIcDecay', tr('IC decay', 'IC 衰减'), `${tr('IC at 1 / H:', '周期 1 / H 的 IC：')} ${value(data.icDecay[0]?.value)} / ${value(data.icDecay.at(-1)?.value)}.`, data.icDecay.map(p => String(p.horizon)), [{ name: tr('Rank IC', '秩 IC'), values: data.icDecay.map(p => p.value) }])}
    {figure('tearAutocorrelation', tr('Rank autocorrelation', '因子秩自相关'), `${tr('Persistence at lag 1 / H:', '滞后 1 / H 的持续性：')} ${value(data.autocorrelation[0]?.value)} / ${value(data.autocorrelation.at(-1)?.value)}.`, data.autocorrelation.map(p => String(p.lag)), [{ name: tr('Rank autocorrelation', '秩自相关'), values: data.autocorrelation.map(p => p.value) }])}
  </section>
}
