import { useMemo, useState } from 'react'
import type { ProjectSummary, WorkspaceSummary } from '../api'
import { ActionRow, SignedValue } from '../components/workbench'
import { num, when } from '../format'
import { translate, uiTemplate, uiText, useLanguage } from '../i18n'
import { OverlapLine } from '../pages/FactorRedundancy'
import { NewIdeaDialog } from '../pages/NewIdeaDialog'
import { routeHref } from '../route'
import { FACTOR_FILTERS, factorMetricLine, factorPoints, filterCounts, GroupMean, isFactorProject, labels, LibraryFilter, LibraryRow, LibraryTable, LibraryTitle, LibraryViewControls, type LibraryColumn, groupRows, meanOf, nextSort, sortRows, useLibraryView, type Sort } from './LibraryCards'
import { useFactorLibraryLayout } from './libraryView'
import { researchReferences, ResearchReferences } from './FactorResearch'

const SPLITS = ['All', 'Development', 'No validation data']
const COLUMNS: LibraryColumn[] = [
  { label: 'Name', sortKey: 'name' }, { label: 'Verdict' },
  { label: 'Validation rank IC', className: 'r', metric: 'meanRankIc', sortKey: 'ic' },
  { label: 'HAC t', className: 'r', metric: 'hacT', sortKey: 'hac' }, { label: 'Trials', className: 'r', metric: 'trialsCounted', sortKey: 'trials' }, { label: 'Overlap' },
  { label: 'Validation curve', className: 'end' }, { label: 'Last updated', className: 'end', sortKey: 'updated' },
  { label: 'Actions', className: 'end' },
]
const DEFAULT_SORT: Sort = { key: 'updated', dir: -1 }
const factorOf = (p: ProjectSummary) => p.library!.factor!
const validationOf = (p: ProjectSummary) => { const s = factorOf(p); return s.validation && s.verdict !== 'Could not be tested' ? s.validation : null }
const SORTERS: Record<string, (p: ProjectSummary) => string | number | null | undefined> = {
  name: p => p.name, ic: p => validationOf(p)?.meanRankIc, hac: p => validationOf(p)?.hacTStatistic, trials: p => factorOf(p).trials, updated: p => factorOf(p).updatedAt,
}
const SORT_COLUMNS = COLUMNS.flatMap(c => c.sortKey ? [{ label: c.label, key: c.sortKey }] : [])
const GROUPS = FACTOR_FILTERS.filter(f => f !== 'All')
const factorHref = (p: ProjectSummary) => routeHref({ view: 'factor', id: p.id, study: factorOf(p).studyId }) + '&idea=1'
const splitOf = (p: ProjectSummary) => validationOf(p) ? 'Development' : 'No validation data'
const hacText = (p: ProjectSummary) => num(validationOf(p)?.hacTStatistic, 1)

function FactorCard({ project }: { project: ProjectSummary }) {
  const language = useLanguage()
  const factor = factorOf(project)
  const description = factor.expression || project.description || factor.question
  return <li className="factor-card">
    <header>
      <h3 title={project.name} translate="no">{project.name}</h3>
      <span className="factor-card-state">{language === 'zh' ? labels[factor.verdict] : factor.verdict}</span>
    </header>
    <p className="factor-card-description" title={description}>{description}</p>
    <dl className="factor-card-metrics">
      <div><dt>{uiText('Validation rank IC')}</dt><dd data-sign-area="library-headline"><SignedValue value={validationOf(project)?.meanRankIc} digits={3} focal /></dd></div>
      <div><dt>{uiText('HAC t')}</dt><dd>{hacText(project)}</dd></div>
      <div><dt>{uiText('Trials')}</dt><dd>{factor.trials}</dd></div>
    </dl>
    <footer>
      <span title={factor.updatedAt ?? undefined}>{factor.updatedAt ? `${uiText('Last updated')} · ${when(factor.updatedAt)}` : uiText('Not run')}</span>
      <a className="abtn abtn--quiet" href={factorHref(project)} aria-label={`${translate(language, 'Factor analysis', '因子分析')} · ${project.name}`}>{translate(language, 'Factor analysis', '因子分析')}</a>
    </footer>
  </li>
}

export function FactorLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const view = useLibraryView()
  const [layout, setLayout] = useFactorLibraryLayout()
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [create, setCreate] = useState(false), [evidence, setEvidence] = useState('All'), [sort, setSort] = useState<Sort>(DEFAULT_SORT)
  const rows = useMemo(() => (workspace?.projects ?? []).filter(isFactorProject), [workspace])
  const references = useMemo(() => researchReferences(workspace), [workspace])
  const invalidReferences = workspace?.projects.some(p => p.library?.factorReferences?.invalid) ?? false
  const showFormal = rows.length > 0 || references.length === 0
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter(p => (evidence === 'All' || splitOf(p) === evidence) && (
      !needle || [p.name, factorOf(p).question, factorOf(p).expression].join(' ').toLowerCase().includes(needle)
    ))
  }, [rows, evidence, query])
  const counts = filterCounts(matching, FACTOR_FILTERS, p => factorOf(p).verdict)
  const splitCounts = filterCounts(rows, SPLITS, splitOf)
  const shown = useMemo(() => sortRows(matching.filter(p => filter === 'All' || factorOf(p).verdict === filter), sort, SORTERS[sort.key] ?? SORTERS.updated), [matching, filter, sort])
  const filtered = filter !== 'All' || evidence !== 'All' || query !== '' || sort !== DEFAULT_SORT
  const groups = view.grouped
    ? groupRows(shown, GROUPS, p => factorOf(p).verdict).filter(g => g.rows.length).map(g => ({ ...g, heading: { label: language === 'zh' ? labels[g.id] ?? g.id : g.id, count: g.rows.length, summary: <GroupMean label={uiText('Mean IC')} value={meanOf(g.rows.map(p => validationOf(p)?.meanRankIc))} digits={3} /> } }))
    : [{ id: 'all', rows: shown, heading: undefined }]
  const footer = shown.length ? uiTemplate('Factors shown: {0}', [shown.length])
    : rows.length ? t('No factors match these filters.', '没有符合筛选条件的因子。')
      : t('No factors in this workspace.', '当前工作区暂无因子。')
  const row = (p: ProjectSummary) => {
    const s = factorOf(p)
    const v = validationOf(p)
    return <LibraryRow key={p.id} name={p.name} badge={s.verdict} metric={v ? factorMetricLine(s) : uiTemplate('{0} · Trials {1}', [uiText(s.verdict), s.trials])}
      headline={v ? { value: v.meanRankIc, digits: 3, label: 'Rank IC' } : undefined} numbers={[hacText(p), s.trials]}
      overlap={<OverlapLine redundancy={s.redundancy} validationIc={v?.meanRankIc} />} points={v ? factorPoints(s) : []}
      updated={s.updatedAt} href={factorHref(p)} go={go} actionLabel={t('Factor analysis', '因子分析')} />
  }
  return <div className="pg object-library factors-library" data-layout={layout}>
    <LibraryTitle count={rows.length + references.length} />
    <div className="library-toolbar" data-measure="toolbar">
      <div className="factor-controls">
        <input data-measure="search" aria-label={t('Search factors', '搜索因子')} type="search" placeholder={t('Search name, question or expression', '搜索名称、问题或表达式')} value={query} onChange={e => setQuery(e.target.value)} />
        {showFormal && <>
          <select className="library-split" aria-label={uiText('Split')} value={evidence} onChange={e => setEvidence(e.target.value)}>{SPLITS.map(s => <option key={s} value={s}>{s === 'All' ? uiText('All splits') : uiText(s)} ({splitCounts[s]})</option>)}</select>
          <div className="factor-order">
            <select aria-label={t('Sort factors by', '因子排序字段')} value={sort.key} onChange={e => setSort(nextSort(sort, e.target.value))}>{SORT_COLUMNS.map(c => <option key={c.key} value={c.key}>{uiText(c.label)}</option>)}</select>
            <button type="button" className="abtn abtn--quiet" onClick={() => setSort(nextSort(sort, sort.key))}>{sort.dir === 1 ? t('Ascending ↑', '升序 ↑') : t('Descending ↓', '降序 ↓')}</button>
          </div>
        </>}
        <ActionRow primary={{ label: t('+ New factor', '+ 新建因子'), onClick: () => setCreate(true) }} secondary={[{ label: uiText('Import data'), onClick: () => go(routeHref({ view: 'data-intake' })) }]} />
      </div>
      <div className="factor-facets">
        {showFormal && <>
          <LibraryFilter options={FACTOR_FILTERS} counts={counts} selected={filter} onSelect={setFilter} onReset={filtered ? () => { setFilter('All'); setQuery(''); setEvidence('All'); setSort(DEFAULT_SORT) } : undefined} />
          <LibraryViewControls density={view.density} onDensity={view.setDensity} grouped={view.grouped} onGrouped={view.setGrouped} />
        </>}
        <div className="library-density factor-layout" role="group" aria-label={t('Factor layout', '因子显示方式')}>
          <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><span className="factor-layout-icon factor-layout-icon--list" aria-hidden="true" />{t('List', '列表')}</button>
          <button type="button" aria-pressed={layout === 'cards'} onClick={() => setLayout('cards')}><span className="factor-layout-icon" aria-hidden="true" />{t('Cards', '卡片')}</button>
        </div>
      </div>
    </div>
    {showFormal && <div className="factor-results">
      <p className="factor-results-note">{t('Rank IC and HAC t use the published validation split. A dash means no value.', 'Rank IC 和 HAC t 使用已发布的验证集；横线表示没有数值。')}</p>
      {layout === 'list'
        ? <LibraryTable kind="factor" columns={COLUMNS} sections={groups.map(g => ({ id: g.id, heading: g.heading, rows: g.rows.map(row) }))} sort={sort} onSort={key => setSort(nextSort(sort, key))} density={view.density} fadeKey={`${filter}|${evidence}|${view.grouped}`} footer={footer} />
        : <div className="factor-card-results">
          {groups.filter(g => g.rows.length).map(g => <section key={g.id} aria-label={g.heading?.label ?? t('Factor results', '因子结果')}>
            {g.heading && <h2 className="factor-card-group">{g.heading.label} <span>{g.heading.count}</span> {g.heading.summary}</h2>}
            <ul className="factor-card-grid">{g.rows.map(p => <FactorCard key={p.id} project={p} />)}</ul>
          </section>)}
          <p className="library-end" role="status">{footer}</p>
        </div>}
    </div>}
    {(references.length > 0 || invalidReferences) && <ResearchReferences entries={references} invalid={invalidReferences} query={query} layout={layout} />}
    <NewIdeaDialog open={create} onClose={() => setCreate(false)} />
  </div>
}
