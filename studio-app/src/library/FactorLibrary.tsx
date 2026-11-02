import { translate, useLanguage } from '../i18n'
﻿import { useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { ActionRow } from '../components/workbench'
import { NewIdeaDialog } from '../pages/NewIdeaDialog'
import { routeHref } from '../route'
import { FACTOR_FILTERS, factorMetricLine, factorPoints, filterCounts, LibraryCard, LibraryFilter, LibraryTitle } from './LibraryCards'
export function FactorLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [create, setCreate] = useState(false)
  const rows = (workspace?.projects ?? []).filter(p => p.library?.factor).sort((a, b) => (b.library!.factor!.updatedAt ?? '').localeCompare(a.library!.factor!.updatedAt ?? ''))
  const counts = filterCounts(rows, FACTOR_FILTERS, p => p.library!.factor!.verdict)
  const shown = rows.filter(p => (filter === 'All' || p.library!.factor!.verdict === filter) && [p.name, p.library!.factor!.question, p.library!.factor!.expression].join(' ').toLowerCase().includes(query.toLowerCase()))
  return <div className="pg object-library factors-library"><LibraryTitle /><div className="library-toolbar" data-measure="toolbar">
    <ActionRow primary={{ label: translate(language, '+ New factor', '+ 新建因子'), onClick: () => setCreate(true) }} />
    <LibraryFilter options={FACTOR_FILTERS} counts={counts} selected={filter} onSelect={setFilter} />
    <input data-measure="search" aria-label={translate(language, 'Search factors', '搜索因子')} type="search" placeholder={translate(language, 'Search name, question or expression', '搜索名称、问题或表达式')} value={query} onChange={e => setQuery(e.target.value)} />
  </div><div className="library-grid" data-measure="grid">{shown.map(p => { const s = p.library!.factor!; return <LibraryCard key={p.id} name={p.name} badge={s.verdict} metric={factorMetricLine(s)} points={factorPoints(s)} updated={s.updatedAt} href={routeHref({ view: 'factor', id: p.id, study: s.studyId }) + '&idea=1'} go={go} /> })}</div>
    <p className="library-end" role="status">{shown.length ? (language === 'zh' ? `已加载全部 ${shown.length} 个因子` : 'All ' + shown.length + ' factors loaded') : rows.length ? translate(language, 'No factors match these filters.', '没有符合筛选条件的因子。') : translate(language, 'No factors yet. Create a factor to test a question.', '暂无因子。创建因子以检验研究问题。')}</p><NewIdeaDialog open={create} onClose={() => setCreate(false)} /></div>
}
