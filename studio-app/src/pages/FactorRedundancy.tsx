import { translate, useLanguage } from '../i18n'
import type { FactorRedundancy } from '../api'
import { MetricExplanation, MetricInfo } from '../components/MetricInfo'

const number = (v: number | null) => v === null ? '—' : v.toFixed(2).replace('-', '−')

/** Presentation heuristic only; never feeds Core qualification or a verdict. */
export const possibleDuplicate = (correlation: number | null, residual: number | null, validationIc?: number | null) =>
  correlation !== null && residual !== null && validationIc != null &&
  Math.abs(correlation) >= 0.7 && Math.abs(residual) < Math.abs(validationIc) / 2

export function OverlapLine({ redundancy, validationIc }: { redundancy?: FactorRedundancy | null; validationIc?: number | null }) {
  const language = useLanguage()
  const tr = (en: string, zh: string) => translate(language, en, zh)
  const peer = redundancy?.status === 'available' ? redundancy.peers[0] : undefined
  const line = peer
    ? language === 'zh' ? `与 ${peer.label} 相关 ${number(peer.correlation)}，剩余 IC ${number(peer.residualRankIc)}`
      : `Overlap with ${peer.label}: ${number(peer.correlation)}, residual IC ${number(peer.residualRankIc)}`
    : redundancy?.status === 'no-comparable-peers' ? tr('No comparable factors', '暂无可比因子')
      : tr('Overlap unavailable: published validation pairs are required', '查重不可用：需要已发布的验证集配对证据')
  return <div className="factor-overlap small muted" data-measure="overlap">
    <span>{line}{peer && possibleDuplicate(peer.correlation, peer.residualRankIc, validationIc) && ` · ${tr('Possible duplicate', '可能重复')}`}</span>
    <MetricInfo id="overlapCorrelation" label={tr('Factor overlap', '因子重叠')} extra={<MetricExplanation id="residualRankIc" />} />
  </div>
}

export function RedundancyTable({ redundancy }: { redundancy?: FactorRedundancy | null }) {
  const language = useLanguage()
  const tr = (en: string, zh: string) => translate(language, en, zh)
  return <section className="redundancy-evidence" aria-label={tr('Comparable factors', '可比因子')}>
    <h2 className="set-title">{tr('Comparable factors · validation only', '可比因子 · 仅验证集')}</h2>
    {redundancy?.status === 'available' ? <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{tr('Factor', '因子')}</th><th>{tr('Overlap correlation', '重叠相关性')} <MetricInfo id="overlapCorrelation" /></th><th>{tr('Residual rank IC', '剩余秩 IC')} <MetricInfo id="residualRankIc" /></th><th>{tr('Observations / residual', '观测数 / 残差')}</th></tr></thead>
      <tbody>{redundancy.peers.map(p => <tr key={`${p.projectId}/${p.studyId}/${p.sourceHash}`}>
        <td><span translate="no">{p.label}</span><details><summary>{tr('Run identity', '运行标识')}</summary><span className="mono small" translate="no">{p.projectId} / {p.studyId} / {p.runId}</span></details></td>
        <td className="mono">{number(p.correlation)}</td><td className="mono">{number(p.residualRankIc)}{p.residualReason && <p className="small muted">{tr('Cross-sectional residualization does not apply to temporal Runs.', '时间序列运行不适用横截面残差化。')}</p>}</td>
        <td className="mono">{p.observations} / {p.residualObservations}</td>
      </tr>)}</tbody></table></div> : <p className="small muted">{redundancy?.status === 'no-comparable-peers' ? tr('No factors share this exact evaluation basis.', '没有因子共享此精确评估基础。') : tr('No published validation pairs are available for this comparison.', '此比较缺少已发布的验证集配对证据。')}</p>}
    <p className="small muted">{tr('Diagnostic only. Bars are counted cross-sectionally; temporal mode counts paired timestamps. No verdict changes.', '仅作诊断。横截面模式统计有效 K 线数，时间序列模式统计配对时间点数。不改变判决。')}</p>
    {redundancy?.reason && <details><summary>{tr('Evidence limitation', '证据限制')}</summary><code translate="no">{redundancy.reason}</code></details>}
    {!!redundancy?.excluded.length && <details><summary>{tr('Excluded evidence', '排除的证据')}</summary><pre translate="no">{JSON.stringify(redundancy.excluded, null, 2)}</pre></details>}
  </section>
}
