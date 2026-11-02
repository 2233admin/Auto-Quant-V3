import { translate, uiTemplate, uiText, useLanguage } from '../i18n'
﻿import { useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { ActionRow } from '../components/workbench'
import { NewIdeaDialog } from '../pages/NewIdeaDialog'
import { routeHref } from '../route'
import { FACTOR_FILTERS, factorMetricLine, factorPoints, filterCounts, LibraryCard, LibraryFilter, LibraryTitle } from './LibraryCards'
export function FactorLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [create, setCreate] = useState(false), [evidence, setEvidence] = useState('All')
  const rows = (workspace?.projects ?? []).filter(p => p.library?.factor).sort((a, b) => (b.library!.factor!.updatedAt ?? '').localeCompare(a.library!.factor!.updatedAt ?? ''))
  const counts = filterCounts(rows, FACTOR_FILTERS, p => p.library!.factor!.verdict)
  const shown = rows.filter(p => (evidence === 'All' || (evidence === 'Development' ? !!p.library!.factor!.validation : !p.library!.factor!.validation)) && (filter === 'All' || p.library!.factor!.verdict === filter) && [p.name, p.library!.factor!.question, p.library!.factor!.expression].join(' ').toLowerCase().includes(query.toLowerCase()))
  return <div className="pg object-library factors-library"><LibraryTitle /><div className="library-toolbar" data-measure="toolbar">
    <ActionRow primary={{ label: translate(language, '+ New factor', '+ 新建因子'), onClick: () => setCreate(true) }} />
    <LibraryFilter options={FACTOR_FILTERS} counts={counts} selected={filter} onSelect={setFilter} onReset={() => { setFilter("All"); setQuery(""); setEvidence("All") }} />
    <input data-measure="search" aria-label={translate(language, 'Search factors', '搜索因子')} type="search" placeholder={translate(language, 'Search name, question or expression', '搜索名称、问题或表达式')} value={query} onChange={e => setQuery(e.target.value)} />
  </div><div className="library-meta">{uiTemplate("Factors / Library · {0} objects · published Run timestamps", [rows.length])}</div><LibraryFilter label={uiText("Split")} options={["All", "Development", "Not tested"]} counts={filterCounts(rows, ["All", "Development", "Not tested"], p => p.library!.factor!.validation ? "Development" : "Not tested")} selected={evidence} onSelect={setEvidence} /><div className="library-grid" data-measure="grid">{shown.map(p => { const s = p.library!.factor!; return <LibraryCard key={p.id} name={p.name} badge={s.verdict} metrics={['meanRankIc', 'hacT', 'trialsCounted']} metric={s.verdict === "Could not be tested" ? uiTemplate("{0} · Trials {1}", [uiText("Could not be tested"), s.trials]) : factorMetricLine(s)} secondary={uiTemplate("HAC t {0} · Trials {1}", [s.validation?.hacTStatistic?.toFixed(1) ?? "—", s.trials])} headline={s.validation && s.verdict !== "Could not be tested" ? { value: s.validation.meanRankIc, digits: 3, label: "Rank IC" } : undefined} points={factorPoints(s)} updated={s.updatedAt} href={routeHref({ view: 'factor', id: p.id, study: s.studyId }) + '&idea=1'} go={go} /> })}</div>
    <p className="library-end" role="status">{shown.length ? uiText('End of list') : uiText('No evidence in this Project')}</p><NewIdeaDialog open={create} onClose={() => setCreate(false)} /></div>
}
