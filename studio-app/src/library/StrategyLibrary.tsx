import { translate, uiTemplate, uiText, useLanguage } from '../i18n'
import { useMemo, useState } from 'react'
import type { ProjectSummary, WorkspaceSummary } from '../api'
import { BuildStrategyAction } from '../actions/BuildStrategyAction'
import { routeHref } from '../route'
import { Contour } from '../design/marks'
import { filterCounts, GroupMean, labels, LibraryFilter, LibraryRow, LibraryTable, LibraryTitle, LibraryViewControls, strategyMetricLine, type LibraryColumn, type LibrarySection, groupRows, meanOf, nextSort, sortRows, useLibraryView, type Sort } from './LibraryCards'
const FILTERS = ['All', 'Tuned', 'Backtested', 'Defined']
const COLUMNS: LibraryColumn[] = [
  { label: 'Name', sortKey: 'name' }, { label: 'Status' },
  { label: 'Net return', className: 'r', metric: 'netTotalReturn', sortKey: 'return' },
  { label: 'Net Sharpe', className: 'r', metric: 'netSharpe', sortKey: 'sharpe' }, { label: 'Max drawdown', className: 'r', metric: 'maxDrawdown', sortKey: 'drawdown' },
  { label: 'Growth curve', className: 'end' }, { label: 'Last updated', className: 'end', sortKey: 'updated' },
]
const DEFAULT_SORT: Sort = { key: 'updated', dir: -1 }
const strategyOf = (p: ProjectSummary) => p.library!.strategy!
const SORTERS: Record<string, (p: ProjectSummary) => string | number | null | undefined> = {
  name: p => p.name, return: p => strategyOf(p).net?.totalReturn, sharpe: p => strategyOf(p).net?.sharpe, drawdown: p => strategyOf(p).net?.maximumDrawdown, updated: p => strategyOf(p).updatedAt,
}
const GROUPS = FILTERS.filter(f => f !== 'All')
const pct = (v: number | null | undefined) => v == null ? '—' : `${(v * 100).toFixed(2)}%`
const meanReturnPct = (rows: ProjectSummary[]) => { const m = meanOf(rows.map(p => strategyOf(p).net?.totalReturn)); return m == null ? null : m * 100 }

export function StrategyLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const view = useLibraryView()
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [sort, setSort] = useState<Sort>(DEFAULT_SORT)
  const rows = useMemo(() => (workspace?.projects ?? []).filter(p => p.library?.strategy), [workspace])
  const factors = (workspace?.projects ?? []).filter(p => p.library?.factor)
  const [source, setSource] = useState('')
  const selected = factors.find(p => p.id === source)
  const shown = useMemo(() => sortRows(rows.filter(p => (filter === 'All' || strategyOf(p).state === filter) && [p.name, p.description].join(' ').toLowerCase().includes(query.toLowerCase())), sort, SORTERS[sort.key] ?? SORTERS.updated), [rows, filter, query, sort])
  const filtered = filter !== 'All' || query !== '' || sort !== DEFAULT_SORT
  const row = (p: ProjectSummary) => { const s = strategyOf(p); return <LibraryRow strategy key={p.id} name={p.name} description={p.description} badge={s.state} metric={strategyMetricLine(s)} headline={s.net ? { value: s.net.totalReturn == null ? null : s.net.totalReturn * 100, digits: 2, unit: "%", label: "Net return" } : undefined} secondary={s.net ? undefined : uiText("No Portfolio Run metrics yet")} numbers={[s.net?.sharpe == null ? '—' : s.net.sharpe.toFixed(2), pct(s.net?.maximumDrawdown)]} points={s.points} updated={s.updatedAt} href={routeHref({ view: 'strategy', id: p.id })} go={go} /> }
  const sections: LibrarySection[] = view.grouped
    ? groupRows(shown, GROUPS, p => strategyOf(p).state).filter(g => g.rows.length || filter === 'All').map(g => ({ id: g.id, heading: { label: language === 'zh' ? labels[g.id] ?? g.id : g.id, count: g.rows.length, summary: <GroupMean label={uiText("Mean net return")} value={meanReturnPct(g.rows)} digits={2} unit="%" /> }, rows: g.rows.map(row) }))
    : [{ id: 'all', rows: shown.map(row) }]
  return <div className="pg object-library strategies-library"><LibraryTitle strategy count={rows.length} /><div className="library-toolbar" data-measure="toolbar">
    <LibraryFilter options={FILTERS} counts={filterCounts(rows, FILTERS, p => strategyOf(p).state)} selected={filter} onSelect={setFilter} label={uiText("Status")} onReset={filtered ? () => { setFilter("All"); setQuery(""); setSort(DEFAULT_SORT) } : undefined} />
    <LibraryViewControls density={view.density} onDensity={view.setDensity} grouped={view.grouped} onGrouped={view.setGrouped} />
    <input data-measure="search" aria-label={t('Search strategies', '搜索策略')} type="search" placeholder={t('Search name or question', '搜索名称或问题')} value={query} onChange={e => setQuery(e.target.value)} />
  </div>
    <LibraryTable kind="strategy" columns={COLUMNS} sections={sections} sort={sort} onSort={key => setSort(nextSort(sort, key))} density={view.density} fadeKey={`${filter}|${view.grouped}`} footer={shown.length ? uiTemplate("Strategies shown: {0}", [shown.length]) : uiText('No evidence in this Project')} />
    <aside className="library-unavailable strategy-build"><label>{uiText('Source factor')} <select aria-label={uiText('Source factor')} value={source} onChange={e => setSource(e.target.value)}><option value="">{uiText('Select a source factor')}</option>{factors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {selected ? <BuildStrategyAction key={selected.id} projectId={selected.id} route={selected.library?.factor?.buildStrategy} /> : <><button type="button" className="abtn" disabled>{uiText('Build strategy')}</button><p className="small muted">{uiText('Select a source factor to inspect its Core-supported Strategy route.')}</p></>}
    </aside>
    <Contour className="library-topo" width={1200} height={640} seed={23} opacity={0.05} />
  </div>
}
