import { useState } from 'react'
import { uiTemplate, uiText } from '../i18n'
import type { WorkspaceSummary } from '../api'
import { routeHref } from '../route'
import { DataTable } from './DataTable'
import { Empty, PageHead } from './parts'
import { dayOf } from './data'
import { emptyFilters, matchesRun, RunFilters } from './RunFilters'
import { compareUrl, runKey, useHistory, useRead, type Comparison } from './runHistoryApi'
import { runColumns, runEdge } from './runColumns'
import { compareReason } from '../pages/compare/comparisonCopy'

export function CompareSelection({ count, decision, error, onCompare }: { count: number; decision?: Comparison; error?: string; onCompare: () => void }) {
  const reason = compareReason(count, decision, error)
  return <div className="lib-bar">
    <button className="abtn abtn--primary" disabled={count !== 2 || decision?.status !== 'comparable'} aria-describedby="compare-reason" onClick={onCompare}>{uiText('Compare 2 Runs')}</button>
    <span id="compare-reason" role="status" className="small muted">{reason}</span>
  </div>
}

export const scopedRuns = (rows: import('./runHistoryApi').HistoryRun[], projectId?: string, lane?: string) => rows.filter(r => (!projectId || r.project.id === projectId) && (!lane || r.lane === lane))

export function RunHistory({ workspace, go, projectId, lane, revision }: { workspace: WorkspaceSummary | null; go: (href: string) => void; projectId?: string; lane?: string; revision?: string }) {
  const history = useHistory(revision ?? workspace?.generatedAt ?? '')
  const [filters, setFilters] = useState(emptyFilters)
  const [picked, setPicked] = useState<string[]>([])
  const rows = scopedRuns(history.rows, projectId, lane)
  const shown = rows.filter(r => matchesRun(r, filters))
  const two = picked.map(k => rows.find(r => runKey(r) === k)).filter(r => !!r)
  const check = useRead<Comparison>(two.length === 2 ? compareUrl(two[0], two[1]) : undefined)
  const toggle = (k: string) => setPicked(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const openCompare = () => {
    if (two.length === 2) go(routeHref({ view: 'compare', id: two[0].project.id, a: two[0].id, b: two[1].id, projectB: two[1].project.id }))
  }
  const href = (r: typeof rows[number]) => routeHref({ view: 'run', id: r.project.id, run: r.id })
  return <div className="pg run-history">
    <PageHead icon={projectId ? 'versions' : 'runs'} micro={projectId ? 'VERSIONS' : 'RUN HISTORY'} title={uiText(projectId ? 'Strategy versions' : 'Run history')} lede={uiText(projectId ? 'Portfolio Runs in this Project over time. Select two to check their evaluation baseline before comparing.' : 'Every immutable Run across objects and lanes. Select two Runs with the same evaluation baseline.')} />
    {history.loading && <p role="status">{uiText('Loading…')}</p>}
    {history.error && <p role="alert">{uiText('Could not load Run history.')} {history.error}</p>}
    {history.warnings && <details className="small muted"><summary>{uiText('Workspace diagnostics; verified Runs remain listed.')}</summary><p>{history.warnings}</p></details>}
    <RunFilters rows={rows} value={filters} onChange={setFilters} />
    <div className="run-bar">
      <p className="small muted run-count">{uiTemplate('{0} of {1} Runs', [shown.length, rows.length])}</p>
      <CompareSelection count={picked.length} decision={check?.data} error={check?.error} onCompare={openCompare} />
      {picked.length > 0 && <button className="btn" onClick={() => setPicked([])}>{uiText('Clear selection')}</button>}
    </div>
    {!history.loading && !shown.length && <Empty>{uiText('No Run matches these filters.')}</Empty>}
    {shown.length > 0 && <DataTable rows={shown} cols={runColumns(picked, toggle)} rowKey={runKey} href={href} go={go} className="lib-tbl--runs" edge={runEdge} dayOf={r => dayOf(r.startedAt)} initial={{ id: 'started', dir: -1 }} caption={uiText(projectId ? 'Portfolio Runs in this Project' : 'Runs across all Projects')} selected={r => picked.includes(runKey(r))} />}
  </div>
}
