import { OverlapLine } from '../pages/FactorRedundancy'
import { translate, uiTemplate, uiText, useLanguage } from '../i18n'
import { useMemo, useState } from 'react'
import type { ProjectSummary, WorkspaceSummary } from '../api'
import { ActionRow } from '../components/workbench'
import { NewIdeaDialog } from '../pages/NewIdeaDialog'
import { routeHref } from '../route'
import { Contour } from '../design/marks'
import { FACTOR_FILTERS, factorMetricLine, factorPoints, filterCounts, GroupMean, isFactorProject, labels, LibraryFilter, LibraryRow, LibraryTable, LibraryTitle, LibraryViewControls, type LibraryColumn, type LibrarySection, groupRows, meanOf, nextSort, sortRows, useLibraryView, type Sort } from './LibraryCards'

const SPLITS = ['All', 'Development', 'Not tested']
const COLUMNS: LibraryColumn[] = [
  { label: 'Name', sortKey: 'name' }, { label: 'Verdict' },
  { label: 'Validation rank IC', className: 'r', metric: 'meanRankIc', sortKey: 'ic' },
  { label: 'HAC t', className: 'r', metric: 'hacT', sortKey: 'hac' }, { label: 'Trials', className: 'r', metric: 'trialsCounted', sortKey: 'trials' }, { label: 'Overlap' },
  { label: 'Validation curve', className: 'end' }, { label: 'Last updated', className: 'end', sortKey: 'updated' },
]
const DEFAULT_SORT: Sort = { key: 'updated', dir: -1 }
const factorOf = (p: ProjectSummary) => p.library!.factor!
const validationOf = (p: ProjectSummary) => { const s = factorOf(p); return s.validation && s.verdict !== 'Could not be tested' ? s.validation : null }
const SORTERS: Record<string, (p: ProjectSummary) => string | number | null | undefined> = {
  name: p => p.name, ic: p => validationOf(p)?.meanRankIc, hac: p => validationOf(p)?.hacTStatistic, trials: p => factorOf(p).trials, updated: p => factorOf(p).updatedAt,
}
const GROUPS = FACTOR_FILTERS.filter(f => f !== 'All')

export function FactorLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const view = useLibraryView()
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [create, setCreate] = useState(false), [evidence, setEvidence] = useState('All'), [sort, setSort] = useState<Sort>(DEFAULT_SORT)
  // Only Factor objects: a strategy or a multi-lane desk that also carries a Factor Study belongs to the Strategy library.
  const rows = useMemo(() => (workspace?.projects ?? []).filter(isFactorProject), [workspace])
  const counts = filterCounts(rows, FACTOR_FILTERS, p => factorOf(p).verdict)
  const shown = useMemo(() => sortRows(rows.filter(p => (evidence === 'All' || (evidence === 'Development' ? !!factorOf(p).validation : !factorOf(p).validation)) && (filter === 'All' || factorOf(p).verdict === filter) && [p.name, factorOf(p).question, factorOf(p).expression].join(' ').toLowerCase().includes(query.toLowerCase())), sort, SORTERS[sort.key] ?? SORTERS.updated), [rows, evidence, filter, query, sort])
  const filtered = filter !== 'All' || evidence !== 'All' || query !== '' || sort !== DEFAULT_SORT
  const row = (p: ProjectSummary) => { const s = factorOf(p); const v = validationOf(p); return <LibraryRow key={p.id} name={p.name} badge={s.verdict} metric={s.verdict === "Could not be tested" ? uiTemplate("{0} · Trials {1}", [uiText("Could not be tested"), s.trials]) : factorMetricLine(s)} headline={v ? { value: v.meanRankIc, digits: 3, label: "Rank IC" } : undefined} numbers={[v?.hacTStatistic == null ? '—' : v.hacTStatistic.toFixed(1), s.trials]} overlap={<OverlapLine redundancy={s.redundancy} validationIc={s.validation?.meanRankIc} />} points={factorPoints(s)} updated={s.updatedAt} href={routeHref({ view: 'factor', id: p.id, study: s.studyId }) + '&idea=1'} go={go} /> }
  const sections: LibrarySection[] = view.grouped
    ? groupRows(shown, GROUPS, p => factorOf(p).verdict).filter(g => g.rows.length || filter === 'All').map(g => ({ id: g.id, heading: { label: language === 'zh' ? labels[g.id] ?? g.id : g.id, count: g.rows.length, summary: <GroupMean label={uiText("Mean IC")} value={meanOf(g.rows.map(p => validationOf(p)?.meanRankIc))} digits={3} /> }, rows: g.rows.map(row) }))
    : [{ id: 'all', rows: shown.map(row) }]
  return <div className="pg object-library factors-library"><LibraryTitle count={rows.length} /><div className="library-toolbar" data-measure="toolbar">
    <ActionRow primary={{ label: translate(language, '+ New factor', '+ 新建因子'), onClick: () => setCreate(true) }} secondary={[{ label: uiText('Import data'), onClick: () => go(routeHref({ view: 'data-intake' })) }]} />
    <LibraryFilter options={FACTOR_FILTERS} counts={counts} selected={filter} onSelect={setFilter} onReset={filtered ? () => { setFilter("All"); setQuery(""); setEvidence("All"); setSort(DEFAULT_SORT) } : undefined} />
    <select className="library-split" aria-label={uiText("Split")} value={evidence} onChange={e => setEvidence(e.target.value)}>{SPLITS.map(s => <option key={s} value={s}>{s === 'All' ? uiText("All splits") : uiText(s)} ({filterCounts(rows, SPLITS, p => factorOf(p).validation ? "Development" : "Not tested")[s]})</option>)}</select>
    <LibraryViewControls density={view.density} onDensity={view.setDensity} grouped={view.grouped} onGrouped={view.setGrouped} />
    <input data-measure="search" aria-label={translate(language, 'Search factors', '搜索因子')} type="search" placeholder={translate(language, 'Search name, question or expression', '搜索名称、问题或表达式')} value={query} onChange={e => setQuery(e.target.value)} />
  </div>
    <LibraryTable kind="factor" columns={COLUMNS} sections={sections} sort={sort} onSort={key => setSort(nextSort(sort, key))} density={view.density} fadeKey={`${filter}|${evidence}|${view.grouped}`} footer={shown.length ? uiTemplate("Factors shown: {0}", [shown.length]) : uiText('No evidence in this Project')} />
    <Contour className="library-topo" width={1200} height={640} seed={11} opacity={0.05} />
    <NewIdeaDialog open={create} onClose={() => setCreate(false)} /></div>
}
