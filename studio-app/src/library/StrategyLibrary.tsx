import { useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { ActionRow } from '../components/workbench'
import { CopyButton } from '../actions/CopyButton'
import { routeHref } from '../route'
import { filterCounts, LibraryCard, LibraryFilter, LibraryTitle, strategyMetricLine } from './LibraryCards'

const FILTERS = ['All', 'Backtested', 'Defined']
export function StrategyLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [sort, setSort] = useState('updated'), [ascending, setAscending] = useState(false)
  const rows = (workspace?.projects ?? []).filter(p => p.library?.strategy)
  const shown = rows.filter(p => (filter === 'All' || p.library!.strategy!.state === filter) && [p.name, p.description].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b) => (ascending ? 1 : -1) * (sort === 'name' ? a.name.localeCompare(b.name) : (a.library!.strategy!.updatedAt ?? '').localeCompare(b.library!.strategy!.updatedAt ?? '')))
  const reason = 'Building a strategy from a factor needs the Portfolio project action, which is not built yet.'
  const command = "aq project create '" + (workspace?.source.rootDir ?? '.').replaceAll("'", "''") + "' my-strategy --template ohlcv-portfolio-lab"
  return <div className="pg object-library strategies-library"><LibraryTitle strategy /><div className="library-toolbar" data-measure="toolbar">
    <ActionRow primary={{ label: '+ New strategy', disabled: true, disabledReason: reason, showReason: false }} />
    <LibraryFilter options={FILTERS} counts={filterCounts(rows, FILTERS, p => p.library!.strategy!.state)} selected={filter} onSelect={setFilter} />
    <input data-measure="search" aria-label="Search strategies" type="search" placeholder="Search name or question" value={query} onChange={e => setQuery(e.target.value)} />
    <select aria-label="Sort strategies" value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Last updated</option><option value="name">Name</option></select><button className="abtn library-order" aria-label={ascending ? 'Sort descending' : 'Sort ascending'} onClick={() => setAscending(v => !v)}>{ascending ? '↑' : '↓'}</button>
  </div><div className="library-grid" data-measure="grid">{shown.map(p => { const s = p.library!.strategy!; return <LibraryCard strategy key={p.id} name={p.name} description={p.description} badge={s.state} metric={strategyMetricLine(s)} points={s.points} updated={s.updatedAt} href={routeHref({ view: 'portfolio', id: p.id })} go={go} /> })}</div>
    <p className="library-end" role="status">{shown.length ? 'All ' + shown.length + ' strategies loaded' : 'No strategies match. Create a Portfolio Project with the command below.'}</p>
    <aside className="library-unavailable"><p>{reason}</p><p>This CLI command creates a Portfolio scaffold; binding the source factor and caller-owned construction policy still requires the Project workflow.</p><div><code>{command}</code><CopyButton text={command} label="Copy command" /></div></aside>
  </div>
}
