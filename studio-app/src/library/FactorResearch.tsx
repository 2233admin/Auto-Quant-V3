import type { FactorReference, ProjectSummary, WorkspaceSummary } from '../api'
import { CopyButton } from '../actions/CopyButton'
import { FactChips, PaneCard, SectionBar, Tabs, TitleCard } from '../components/workbench'
import { useHashTab } from '../components/workbench/Tabs'
import { signedNumber } from '../design/signConvention'
import { translate, useLanguage } from '../i18n'
import { LaneChart } from '../pages/lanes/LaneChart'
import { routeHref, type Route } from '../route'
import { DataTable } from './DataTable'

type ReferenceEntry = { project: ProjectSummary; reference: FactorReference }
const REFERENCE_TABS = ['reference-history', 'reference-rule'] as const
export const factorListHref = routeHref({ view: 'factors' })
export const factorReferenceHref = (project: string, item: string) => routeHref({ view: 'factors', section: 'reference', project, item })
const percent = (value: number | null | undefined) => value == null ? '—' : `${value > 0 ? '+' : ''}${(100 * value).toFixed(2)}%`
const diagnostic = (reference: FactorReference) => reference.strategyUses?.some(use => use.id === 'long_short')

export function researchReferences(workspace: WorkspaceSummary | null): ReferenceEntry[] {
  return (workspace?.projects ?? []).flatMap(project => (project.library?.factorReferences?.factors ?? []).map(reference => ({ project, reference })))
}

export function matchingReferences(entries: ReferenceEntry[], query: string): ReferenceEntry[] {
  const needle = query.trim().toLowerCase()
  return entries.filter(({ project, reference: r }) => [project.name, r.id, r.name, r.formula, r.meaning, r.usage, r.evidence, r.market, ...(r.tags ?? []), ...(r.strategyUses ?? []).flatMap(use => [use.name, use.rule])].join(' ').toLowerCase().includes(needle))
}

export function ResearchReferences({ entries, invalid, query, layout }: { entries: ReferenceEntry[]; invalid: boolean; query: string; layout: 'list' | 'cards' }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const shown = matchingReferences(entries, query)
  const status = (r: FactorReference) => r.replay ? t('Development replay', '开发样本回放') : diagnostic(r) ? t('Ranking diagnostic only', '仅排序诊断') : t('No verified history', '无已验证历史')
  const history = ({ project, reference: r }: ReferenceEntry) => <a className="abtn abtn--quiet" href={factorReferenceHref(project.id, r.id)} aria-label={`${t('Historical performance', '历史表现')} · ${r.name}`}>{t('Historical performance', '历史表现')}</a>
  return <section aria-label={t('Research references', '研究参考')}>
    <SectionBar as="h2">{t('Research references', '研究参考')} · {shown.length}</SectionBar>
    <p>{t('Research references are not formal factor studies and are excluded from validation IC filters and counts.', '研究参考不是正式因子研究，不计入验证 IC 的筛选和数量。')}</p>
    {invalid && <p role="status">{t('Some research references could not be loaded.', '部分研究参考无法加载。')}</p>}
    {!shown.length ? <p role="status">{t('No research references match this search.', '没有符合搜索条件的研究参考。')}</p> : layout === 'list'
      ? <DataTable rows={shown} rowKey={({ project, reference }) => `${project.id}/${reference.id}`} caption={t('Research references', '研究参考')} cols={[
        { id: 'name', label: t('Name', '名称'), rowHeader: true, render: ({ reference }) => reference.name },
        { id: 'project', label: t('Project', '项目'), render: ({ project }) => project.name },
        { id: 'status', label: t('Evidence status', '证据状态'), render: ({ reference }) => status(reference) },
        { id: 'evidence', label: t('Evidence', '证据'), render: ({ reference }) => reference.evidence },
        { id: 'history', label: t('Actions', '操作'), render: history },
      ]} />
      : <ul className="factor-card-grid">{shown.map(entry => <li className="factor-card" key={`${entry.project.id}/${entry.reference.id}`}>
        <header><h3 translate="no">{entry.reference.name}</h3><span className="factor-card-state">{status(entry.reference)}</span></header>
        <p className="factor-card-description" title={entry.reference.evidence}>{entry.reference.evidence}</p>
        <footer><span>{entry.project.name}</span>{history(entry)}</footer>
      </li>)}</ul>}
  </section>
}

function ReferenceHistory({ project, reference: r }: ReferenceEntry) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const title = t('Historical performance', '历史表现')
  return <PaneCard label={title}>
    <SectionBar as="h2">{title}</SectionBar>
    {!r.replay && <p><strong>{t('No verifiable historical performance available', '暂无可验证的历史表现')}</strong></p>}
    {r.evidenceUniverse && <FactChips label={t('Historical evidence', '历史证据')} variant="row" facts={[{ label: t('Evidence sample', '证据样本'), value: r.evidenceUniverse }]} />}
    {r.replay && <DecisionHistory projectId={project.id} replay={r.replay} />}
    <p>{r.evidence}</p>
    {diagnostic(r) && <p><strong>{t('Ranking diagnostic only', '仅排序诊断')}</strong>{' · '}{t('Q5−Q1 is a ranking diagnostic, not verified strategy performance. Overlapping 20-session spread cohorts; no compounding, costs or execution simulation.', 'Q5−Q1 仅为排序诊断，不是已验证的策略表现。20 日价差的持有窗重叠，未复利、扣费或模拟成交。')}</p>}
  </PaneCard>
}

function DecisionHistory({ projectId, replay }: { projectId: string; replay: NonNullable<FactorReference['replay']> }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const rows = [...replay.daily].sort((a, b) => a.day.localeCompare(b.day))
  const first = rows[0]?.day
  const last = rows.at(-1)?.day
  const arms = [{ key: 'momentum', label: t('Momentum', '纯动量') }, { key: 'kit', label: t('KiT gate', 'KiT 确认') }, { key: 'control', label: t('Equal exposure', '等敞口') }] as const
  return <>
    <FactChips label={t('Development replay', '开发样本回放')} variant="row" facts={[
      ...(first && last ? [{ label: t('Decision interval', '决策区间'), value: t(`${first} to ${last}`, `${first} 至 ${last}`) }] : []),
      { label: t('Decision dates', '决策日数'), value: String(replay.dates) },
      { label: t('Decisions with a cash slot', '第二名留现金的次数'), value: String(replay.triggered) },
    ]} />
    <p>{t('Development-sample paired-decision replay, not independent factor validation. No independent holdout validation. Each point is a decision-period return, not a daily return or cumulative NAV.', '这是开发样本的配对决策回放，未做独立留出验证。每个点是该次决策的持有期收益，不是日收益或累计净值。')}</p>
    <p>{t(`Mean KiT difference: ${signedNumber(replay.versusMomentumBp)} bp vs momentum; ${signedNumber(replay.versusSameExposureBp)} bp vs equal exposure.`, `KiT 平均较纯动量差 ${signedNumber(replay.versusMomentumBp)} 基点，较等敞口差 ${signedNumber(replay.versusSameExposureBp)} 基点。`)}{' · '}<a href={routeHref({ view: 'run', id: projectId, run: replay.runId })}>{t('Open original Run record', '查看原始运行记录')}</a></p>
    {rows.length > 1 && first !== last && <LaneChart title={t('Returns by decision date', '逐决策日收益')} desc={t('Each position is one observed decision, not one trading day. Returns are not compounded.', '横轴每格是一笔已观察的决策，不是一个交易日。收益不做复利。')} yLabel={t('Decision-period return', '决策持有期收益')} xLabel={t('Decision date', '决策日期')} fy={percent} endLabels={false} series={arms.map(({ key, label }) => ({ key, label, points: rows.map((row, index) => ({ x: index, xl: row.day, y: row[key] })) }))} />}
    <SectionBar as="h3">{t('What each decision held', '逐次选股与结果')}</SectionBar>
    <p>{t('KiT keeps the first momentum pick. If the second pick’s predicted 5-day median return is zero or negative, KiT leaves that slot in cash. The equal-exposure control holds the second pick instead of the first on those dates. Otherwise all three arms hold both picks.', 'KiT 保留动量第一名。若第二名的 5 日预测收益中位数不大于 0，KiT 将第二个名额留作现金；这时等敞口对照只持第二名。其他日期，三组都保留前两名。')}</p>
    <p>{t('Each difference is KiT’s return minus the control’s return for that decision. 100 bp equals 1 percentage point.', '每行差额是该次决策的 KiT 收益减去对应对照收益。100 基点等于 1 个百分点。')}</p>
    <DataTable rows={rows} rowKey={day => day.day} caption={t('Decision evidence and cash slots', '决策证据与现金名额')} cols={[
      { id: 'day', label: t('Decision date', '决策日期'), rowHeader: true, render: day => day.day },
      { id: 'first', label: t('Momentum #1', '动量第一名'), render: day => day.first },
      { id: 'second', label: t('Momentum #2', '动量第二名'), render: day => day.second },
      { id: 'cash', label: t('KiT second slot', 'KiT 如何处理第二名'), render: day => day.cash ? t('Hold cash', '留现金') : t('Keep second stock', '保留第二名') },
      { id: 'delta-momentum', label: t('KiT vs momentum (bp)', '较纯动量（基点）'), align: 'r', render: day => signedNumber(10_000 * (day.kit - day.momentum)) },
      { id: 'delta-control', label: t('KiT vs equal exposure (bp)', '较等敞口（基点）'), align: 'r', render: day => signedNumber(10_000 * (day.kit - day.control)) },
    ]} />
  </>
}

function sourceHref(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

export function ReferenceDetail({ project, reference: r }: ReferenceEntry) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const [active, select] = useHashTab(REFERENCE_TABS, 'reference-history')
  const label = t('Research reference', '研究参考')
  const direction = { higher: t('Higher first', '从高到低'), lower: t('Lower first', '从低到高'), diagnostic: t('Diagnostic only', '仅诊断') }
  const source = sourceHref(r.source)
  const strategy = r.strategyUrl ? sourceHref(r.strategyUrl) : undefined
  return <article>
    <TitleCard title={r.name} type={label} backHref={factorListHref} backLabel={t('Back to factor list', '返回因子列表')} subtitle={[project.name, r.market, ...(r.tags ?? [])].filter(Boolean).join(' · ')} />
    <Tabs label={t('Factor detail', '因子详情')} active={active} onSelect={select} tabs={[
      { id: 'reference-history', label: t('Historical performance', '历史表现') },
      { id: 'reference-rule', label: t('Formula and usage', '公式与用法') },
    ]} panels={{
      'reference-history': <ReferenceHistory project={project} reference={r} />,
      'reference-rule': <PaneCard label={label}>
        {r.meaning && <p>{r.meaning}</p>}
        <SectionBar as="h2">{t('Signal formula', '信号公式')}</SectionBar>
        <CopyButton text={r.formula} label={t('Copy formula', '复制公式')} />
        <pre><code dir="ltr">{r.formula}</code></pre>
        <FactChips label={t('Research facts', '研究信息')} compact={false} facts={[
          { label: t('Direction', '排序方向'), value: direction[r.direction] },
          ...(r.usage ? [{ label: t('Usage', '使用方式'), value: r.usage }] : []),
          ...(r.plannedUniverses?.length ? [{ label: t('Pools to validate', '待验证股票池'), value: r.plannedUniverses.join(' · ') }] : []),
        ]} />
        {!!r.strategyUses?.length && <section><SectionBar as="h2">{t('Strategies using this factor', '使用这个因子的策略')}</SectionBar><ul>{r.strategyUses.map(use => <li key={use.id ?? use.name}><strong>{use.name}</strong><p>{use.rule}</p></li>)}</ul></section>}
        {source && <p><a href={source} target="_blank" rel="noreferrer">{t('Source', '原始来源')}</a></p>}
        {strategy && strategy !== source && <p><a href={strategy} target="_blank" rel="noreferrer">{t('KiT strategy website', 'KiT 官网策略页')}</a></p>}
      </PaneCard>,
    }} />
  </article>
}

export function ReferenceSelection({ workspace, route }: { workspace: WorkspaceSummary; route: Extract<Route, { view: 'factors' }> }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const project = workspace.projects.find(project => project.id === route.project)
  const reference = project?.library?.factorReferences?.factors.find(reference => reference.id === route.item)
  return <div className="pg object-library">{project && reference
    ? <ReferenceDetail key={`${project.id}/${reference.id}`} project={project} reference={reference} />
    : <>
      <TitleCard title={t('Research reference unavailable', '研究参考不可用')} subtitle={t('The selected reference is not present in this workspace.', '当前工作区不存在所选研究参考。')} type={t('Research reference', '研究参考')} backHref={factorListHref} backLabel={t('Back to factor list', '返回因子列表')} />
      <PaneCard label={t('Reference selection', '参考选择')}><p>{t('Research references are not formal factor studies. This link may belong to a different workspace or a removed reference; it is not evidence of verified historical performance.', '研究参考不是正式因子研究。此链接可能属于其他工作区或已移除的参考；它不能证明已有验证过的历史表现。')}</p><a href={factorListHref}>{t('Back to factor list', '返回因子列表')}</a></PaneCard>
    </>}</div>
}
