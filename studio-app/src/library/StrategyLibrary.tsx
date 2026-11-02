import { translate, uiTemplate, uiText, uiValue, useLanguage } from '../i18n'
﻿import { useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { ActionRow } from '../components/workbench'
import { CopyButton } from '../actions/CopyButton'
import { routeHref } from '../route'
import { filterCounts, LibraryCard, LibraryFilter, LibraryTitle, strategyMetricLine } from './LibraryCards'
const FILTERS = ['All', 'Backtested', 'Defined']
export function StrategyLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const t = (en: string, zh: string) => translate(language, en, zh)
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [sort, setSort] = useState('updated'), [ascending, setAscending] = useState(false)
  const rows = (workspace?.projects ?? []).filter(p => p.library?.strategy)
  const shown = rows.filter(p => (filter === 'All' || p.library!.strategy!.state === filter) && [p.name, p.description].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b) => (ascending ? 1 : -1) * (sort === 'name' ? a.name.localeCompare(b.name) : (a.library!.strategy!.updatedAt ?? '').localeCompare(b.library!.strategy!.updatedAt ?? '')))
  const reason = t('Building a strategy from a factor needs the Portfolio project action, which is not built yet.', '从因子创建策略需要组合项目创建功能，该功能尚未完成。')
  const command = "aq project create '" + (workspace?.source.rootDir ?? '.').replaceAll("'", "''") + "' my-strategy --template ohlcv-portfolio-lab"
  return <div className="pg object-library strategies-library"><LibraryTitle strategy /><div className="library-toolbar" data-measure="toolbar">
    <ActionRow primary={{ label: t('+ New strategy', '+ 新建策略'), disabled: true, disabledReason: reason, showReason: false }} />
    <LibraryFilter options={FILTERS} counts={filterCounts(rows, FILTERS, p => p.library!.strategy!.state)} selected={filter} onSelect={setFilter} label={uiText("Status")} onReset={() => { setFilter("All"); setQuery(""); setSort("updated"); setAscending(false) }} />
    <input data-measure="search" aria-label={t('Search strategies', '搜索策略')} type="search" placeholder={t('Search name or question', '搜索名称或问题')} value={query} onChange={e => setQuery(e.target.value)} />
    <select aria-label={uiText("Sort strategies")} value={sort} onChange={e => setSort(e.target.value)}><option value="updated">{uiText("Last updated")}</option><option value="name">{uiText("Name")}</option></select><button className="abtn library-order" aria-label={ascending ? uiText("Sort descending") : uiText("Sort ascending")} onClick={() => setAscending(v => !v)}>{ascending ? '↑' : '↓'}</button>
  </div><div className="library-meta">{uiTemplate("Strategies / Library · {0} objects · validation development evidence", [rows.length])}</div><div className="library-grid" data-measure="grid">{shown.map(p => { const s = p.library!.strategy!; return <LibraryCard strategy key={p.id} name={p.name} description={p.description} badge={s.state} metrics={['netTotalReturn', 'netSharpe', 'maxDrawdown']} metric={strategyMetricLine(s)} secondary={uiTemplate("Net Sharpe {0}", [s.net?.sharpe?.toFixed(2) ?? "—"])} headline={s.net ? { value: s.net.totalReturn == null ? null : s.net.totalReturn * 100, digits: 2, unit: "%", label: "Net return" } : undefined} points={s.points} updated={s.updatedAt} href={routeHref({ view: 'portfolio', id: p.id })} go={go} /> })}</div>
    <p className="library-end" role="status">{shown.length ? uiText('End of list') : uiText('No evidence in this Project')}</p>
    <aside className="library-unavailable"><p>{uiValue(reason)}</p><p>{t('This CLI command creates a Portfolio scaffold; binding the source factor and caller-owned construction policy still requires the Project workflow.', '此命令创建组合项目骨架；绑定来源因子和由用户确定的组合构建规则仍需通过项目流程完成。')}</p><div><code>{command}</code><CopyButton text={command} label={t('Copy command', '复制命令')} /></div></aside>
  </div>
}
