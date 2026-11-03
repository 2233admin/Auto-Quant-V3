import { OverlapLine } from '../pages/FactorRedundancy'
import { translate, uiTemplate, uiText, useLanguage } from '../i18n'
import { useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { ActionRow } from '../components/workbench'
import { NewIdeaDialog } from '../pages/NewIdeaDialog'
import { routeHref } from '../route'
import { FACTOR_FILTERS, factorMetricLine, factorPoints, filterCounts, isFactorProject, LibraryFilter, LibraryRow, LibraryTable, LibraryTitle, type LibraryColumn } from './LibraryCards'

const SPLITS = ['All', 'Development', 'Not tested']
const COLUMNS: LibraryColumn[] = [
  { label: 'Name' }, { label: 'Verdict' },
  { label: 'Validation rank IC', className: 'r', metric: 'meanRankIc' },
  { label: 'HAC t', className: 'r', metric: 'hacT' }, { label: 'Trials', className: 'r', metric: 'trialsCounted' }, { label: 'Overlap' },
  { label: 'Validation curve', className: 'end' }, { label: 'Last updated', className: 'end' },
]

export function FactorLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const language = useLanguage()
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [create, setCreate] = useState(false), [evidence, setEvidence] = useState('All')
  // Only Factor objects: a strategy or a multi-lane desk that also carries a Factor Study belongs to the Strategy library.
  const rows = (workspace?.projects ?? []).filter(isFactorProject).sort((a, b) => (b.library!.factor!.updatedAt ?? '').localeCompare(a.library!.factor!.updatedAt ?? ''))
  const counts = filterCounts(rows, FACTOR_FILTERS, p => p.library!.factor!.verdict)
  const shown = rows.filter(p => (evidence === 'All' || (evidence === 'Development' ? !!p.library!.factor!.validation : !p.library!.factor!.validation)) && (filter === 'All' || p.library!.factor!.verdict === filter) && [p.name, p.library!.factor!.question, p.library!.factor!.expression].join(' ').toLowerCase().includes(query.toLowerCase()))
  const filtered = filter !== 'All' || evidence !== 'All' || query !== ''
  return <div className="pg object-library factors-library"><LibraryTitle /><div className="library-toolbar" data-measure="toolbar">
    <ActionRow primary={{ label: translate(language, '+ New factor', '+ 新建因子'), onClick: () => setCreate(true) }} secondary={[{ label: uiText('Import data'), onClick: () => go(routeHref({ view: 'data-intake' })) }]} />
    <LibraryFilter options={FACTOR_FILTERS} counts={counts} selected={filter} onSelect={setFilter} onReset={filtered ? () => { setFilter("All"); setQuery(""); setEvidence("All") } : undefined} />
    <select className="library-split" aria-label={uiText("Split")} value={evidence} onChange={e => setEvidence(e.target.value)}>{SPLITS.map(s => <option key={s} value={s}>{s === 'All' ? uiText("All splits") : uiText(s)} ({filterCounts(rows, SPLITS, p => p.library!.factor!.validation ? "Development" : "Not tested")[s]})</option>)}</select>
    <input data-measure="search" aria-label={translate(language, 'Search factors', '搜索因子')} type="search" placeholder={translate(language, 'Search name, question or expression', '搜索名称、问题或表达式')} value={query} onChange={e => setQuery(e.target.value)} />
  </div>
    <LibraryTable kind="factor" columns={COLUMNS} footer={shown.length ? uiTemplate("Factors shown: {0}", [shown.length]) : uiText('No evidence in this Project')}>
      {shown.map(p => { const s = p.library!.factor!; const v = s.validation && s.verdict !== "Could not be tested" ? s.validation : null; return <LibraryRow key={p.id} name={p.name} badge={s.verdict} metric={s.verdict === "Could not be tested" ? uiTemplate("{0} · Trials {1}", [uiText("Could not be tested"), s.trials]) : factorMetricLine(s)} headline={v ? { value: v.meanRankIc, digits: 3, label: "Rank IC" } : undefined} numbers={[v?.hacTStatistic == null ? '—' : v.hacTStatistic.toFixed(1), s.trials]} overlap={<OverlapLine redundancy={s.redundancy} validationIc={s.validation?.meanRankIc} />} points={factorPoints(s)} updated={s.updatedAt} href={routeHref({ view: 'factor', id: p.id, study: s.studyId }) + '&idea=1'} go={go} /> })}
    </LibraryTable>
    <NewIdeaDialog open={create} onClose={() => setCreate(false)} /></div>
}
