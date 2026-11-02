import { useState } from 'react'
import { uiTemplate, uiText } from '../i18n'
import type { WorkspaceSummary } from '../api'
import { routeHref } from '../route'
import { DataTable } from './DataTable'
import { Empty, PageHead } from './parts'
import { emptyFilters, matchesRun, RunFilters } from './RunFilters'
import { compareUrl, runKey, useHistory, useRead, type Comparison } from './runHistoryApi'
import { runColumns } from './runColumns'
import { compareReason } from '../pages/compare/comparisonCopy'

export function CompareSelection({ count, decision, error, onCompare }: { count: number; decision?: Comparison; error?: string; onCompare: () => void }) {
  const reason = compareReason(count, decision, error)
  return <div className="lib-bar">
    <button className="abtn abtn--primary" disabled={count !== 2 || decision?.status !== 'comparable'} aria-describedby="compare-reason" onClick={onCompare}>{uiText('Compare 2 Runs')}</button>
    <span id="compare-reason" role="status" className="small muted">{reason}</span>
  </div>
}

export function RunHistory({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const history = useHistory(workspace?.generatedAt ?? '')
  const [filters, setFilters] = useState(emptyFilters)
  const [picked, setPicked] = useState<string[]>([])
  const rows = history.rows
  const shown = rows.filter(r => matchesRun(r, filters))
  const two = picked.map(k => rows.find(r => runKey(r) === k)).filter(r => !!r)
  const check = useRead<Comparison>(two.length === 2 ? compareUrl(two[0], two[1]) : undefined)
  const toggle = (k: string) => setPicked(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const openCompare = () => {
    if (two.length === 2) go(routeHref({ view: 'compare', id: two[0].project.id, a: two[0].id, b: two[1].id, projectB: two[1].project.id }))
  }
  const href = (r: typeof rows[number]) => routeHref({ view: 'run', id: r.project.id, run: r.id })
  return <div className="pg">
    <PageHead title={uiText('Run history')} lede={uiText('Every immutable Run across objects and lanes. Select two Runs with the same evaluation baseline.')} />
    {history.loading && <p role="status">{uiText('Loading…')}</p>}
    {history.error && <p role="alert">{uiText('Could not load Run history.')} {history.error}</p>}
    {history.warnings && <details className="small muted"><summary>{uiText('Workspace diagnostics; verified Runs remain listed.')}</summary><p>{history.warnings}</p></details>}
    <RunFilters rows={rows} value={filters} onChange={setFilters} />
    <p className="small muted">{uiTemplate('{0} of {1} Runs', [shown.length, rows.length])}</p>
    <CompareSelection count={picked.length} decision={check?.data} error={check?.error} onCompare={openCompare} />
    {picked.length > 0 && <button className="btn" onClick={() => setPicked([])}>{uiText('Clear selection')}</button>}
    {!history.loading && !shown.length && <Empty>{uiText('No Run matches these filters.')}</Empty>}
    {shown.length > 0 && <DataTable rows={shown} cols={runColumns(picked, toggle)} rowKey={runKey} href={href} go={go} initial={{ id: 'started', dir: -1 }} caption={uiText('Runs across all Projects')} selected={r => picked.includes(runKey(r))} />}
  </div>
}
