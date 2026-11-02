import { useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { ActionRow } from '../components/workbench'
import { NewIdeaDialog } from '../pages/NewIdeaDialog'
import { routeHref } from '../route'
import { FACTOR_FILTERS, factorMetricLine, factorPoints, filterCounts, LibraryCard, LibraryFilter, LibraryTitle } from './LibraryCards'

export function FactorLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('All'), [create, setCreate] = useState(false), [evidence, setEvidence] = useState('All')
  const rows = (workspace?.projects ?? []).filter(p => p.library?.factor).sort((a, b) => (b.library!.factor!.updatedAt ?? '').localeCompare(a.library!.factor!.updatedAt ?? ''))
  const counts = filterCounts(rows, FACTOR_FILTERS, p => p.library!.factor!.verdict)
  const shown = rows.filter(p => (evidence === 'All' || (evidence === 'Development' ? !!p.library!.factor!.validation : !p.library!.factor!.validation)) && (filter === 'All' || p.library!.factor!.verdict === filter) && [p.name, p.library!.factor!.question, p.library!.factor!.expression].join(' ').toLowerCase().includes(query.toLowerCase()))
  return <div className="pg object-library factors-library"><LibraryTitle /><div className="library-toolbar" data-measure="toolbar">
    <ActionRow primary={{ label: '+ New factor', onClick: () => setCreate(true) }} />
    <LibraryFilter options={FACTOR_FILTERS} counts={counts} selected={filter} onSelect={setFilter} onReset={() => { setFilter("All"); setQuery(""); setEvidence("All") }} />
    <input data-measure="search" aria-label="Search factors" type="search" placeholder="Search name, question or expression" value={query} onChange={e => setQuery(e.target.value)} />
  </div><div className="library-meta">Factors / Library · {rows.length} objects · published Run timestamps</div><LibraryFilter label="Split" options={["All", "Development", "Not tested"]} counts={filterCounts(rows, ["All", "Development", "Not tested"], p => p.library!.factor!.validation ? "Development" : "Not tested")} selected={evidence} onSelect={setEvidence} /><div className="library-grid" data-measure="grid">{shown.map(p => { const s = p.library!.factor!; return <LibraryCard key={p.id} name={p.name} badge={s.verdict} metric={s.verdict === "Could not be tested" ? `Could not be tested · Trials ${s.trials}` : factorMetricLine(s)} secondary={`HAC t ${s.validation?.hacTStatistic?.toFixed(1) ?? "—"} · Trials ${s.trials}`} headline={s.validation && s.verdict !== "Could not be tested" ? { value: s.validation.meanRankIc, digits: 3, label: "Rank IC" } : undefined} points={factorPoints(s)} updated={s.updatedAt} href={routeHref({ view: 'factor', id: p.id, study: s.studyId }) + '&idea=1'} go={go} /> })}</div>
    <p className="library-end" role="status">{shown.length ? 'End of list' : rows.length ? 'No evidence in this Project' : 'No evidence in this Project'}</p><NewIdeaDialog open={create} onClose={() => setCreate(false)} /></div>
}
