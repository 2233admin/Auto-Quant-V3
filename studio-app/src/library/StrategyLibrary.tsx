import { translate, uiTemplate, uiText, useLanguage } from '../i18n'
﻿import { useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { BuildStrategyAction } from '../actions/BuildStrategyAction'
import { routeHref } from '../route'
import { filterCounts, LibraryCard, LibraryFilter, LibraryTitle, strategyMetricLine } from './LibraryCards'
const FILTERS = ['All', 'Tuned', 'Backtested', 'Defined']
export function StrategyLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [sort, setSort] = useState('updated'), [ascending, setAscending] = useState(false)
  const rows = (workspace?.projects ?? []).filter(p => p.library?.strategy)
  const factors = (workspace?.projects ?? []).filter(p => p.library?.factor)
  const [source, setSource] = useState('')
  const selected = factors.find(p => p.id === source)
  const shown = rows.filter(p => (filter === 'All' || p.library!.strategy!.state === filter) && [p.name, p.description].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b) => (ascending ? 1 : -1) * (sort === 'name' ? a.name.localeCompare(b.name) : (a.library!.strategy!.updatedAt ?? '').localeCompare(b.library!.strategy!.updatedAt ?? '')))
  return <div className="pg object-library strategies-library"><LibraryTitle strategy /><div className="library-toolbar" data-measure="toolbar">
    <LibraryFilter options={FILTERS} counts={filterCounts(rows, FILTERS, p => p.library!.strategy!.state)} selected={filter} onSelect={setFilter} label={uiText("Status")} onReset={() => { setFilter("All"); setQuery(""); setSort("updated"); setAscending(false) }} />
    <input data-measure="search" aria-label={t('Search strategies', '搜索策略')} type="search" placeholder={t('Search name or question', '搜索名称或问题')} value={query} onChange={e => setQuery(e.target.value)} />
    <select aria-label={uiText("Sort strategies")} value={sort} onChange={e => setSort(e.target.value)}><option value="updated">{uiText("Last updated")}</option><option value="name">{uiText("Name")}</option></select><button className="abtn library-order" aria-label={ascending ? uiText("Sort descending") : uiText("Sort ascending")} onClick={() => setAscending(v => !v)}>{ascending ? '↑' : '↓'}</button>
  </div><div className="library-meta">{uiTemplate("Strategies / Library · {0} objects · validation development evidence", [rows.length])}</div><div className="library-grid" data-measure="grid">{shown.map(p => { const s = p.library!.strategy!; return <LibraryCard strategy key={p.id} name={p.name} description={p.description} badge={s.state} metrics={['netTotalReturn', 'netSharpe', 'maxDrawdown']} metric={strategyMetricLine(s)} secondary={uiTemplate("Net Sharpe {0}", [s.net?.sharpe?.toFixed(2) ?? "—"])} headline={s.net ? { value: s.net.totalReturn == null ? null : s.net.totalReturn * 100, digits: 2, unit: "%", label: "Net return" } : undefined} points={s.points} updated={s.updatedAt} href={routeHref({ view: 'strategy', id: p.id })} go={go} /> })}</div>
    <p className="library-end" role="status">{shown.length ? uiText('End of list') : uiText('No evidence in this Project')}</p>
    <aside className="library-unavailable strategy-build"><label>{uiText('Source factor')} <select aria-label={uiText('Source factor')} value={source} onChange={e => setSource(e.target.value)}><option value="">{uiText('Select a source factor')}</option>{factors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {selected ? <BuildStrategyAction key={selected.id} projectId={selected.id} route={selected.library?.factor?.buildStrategy} /> : <><button type="button" className="abtn" disabled>{uiText('Build strategy')}</button><p className="small muted">{uiText('Select a source factor to inspect its Core-supported Strategy route.')}</p></>}
    </aside>
  </div>
}
