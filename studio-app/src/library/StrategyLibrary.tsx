import { useMemo, useState } from 'react'
import type { ProjectSnapshot, ProjectSummary, RunRow, WorkspaceSummary } from '../api'
import { num, plural, when } from '../format'
import type { Verdict } from '../pages/FactorEvidence'
import { routeHref } from '../route'
import { byNewest, laneOfRun, splitOf, useAllProjects, type Loaded } from './data'
import { DataTable, type Col } from './DataTable'
import { Empty, Field, LoadNote, PageHead, uniq, VerdictBadge } from './parts'

type Row = {
  key: string
  project: ProjectSummary
  lane: string
  verdict: Verdict | null
  stage: string | null
  metric: string | null
  value: number | null
  split: string | null
  runs: number
  last: string | null
  runId: string | null
  href: string
  hasPage: boolean
}

/**
 * Same mapping the Portfolio page uses for the server's own `strategyViability.diagnosis.stage`: three non-positive
 * stages are a fail; the one positive stage is still inconclusive. Repeated here only because that page keeps it private.
 */
const PORTFOLIO_FAIL = new Set(['factor-edge-absent', 'factor-not-monetized', 'cost-fragile'])

type Explorer = { run?: { id?: string; primaryMetric?: string; primaryValue?: number | null; startedAt?: string } } | null

const STRATEGY_LANES: { lane: string; key: 'portfolioExplorer' | 'rlExplorer' | 'allocationExplorer' }[] = [
  { lane: 'Portfolio', key: 'portfolioExplorer' },
  { lane: 'RL policy', key: 'rlExplorer' },
  { lane: 'Allocation', key: 'allocationExplorer' },
]

function rowsOf(all: Loaded[]): Row[] {
  const out: Row[] = []
  for (const l of all) {
    const project = l.project as ProjectSnapshot | null
    if (!project) continue
    for (const { lane, key } of STRATEGY_LANES) {
      const explorer = project[key] as Explorer
      const runs: RunRow[] = project.runs.filter((r) => laneOfRun(project, r) === lane).sort(byNewest)
      if (!explorer && runs.length === 0) continue
      const latest = runs[0]
      // Fall back to the explorer's own Run when the lane has no row in runs[].
      const ex = explorer?.run
      const metric = latest?.primaryMetric ?? ex?.primaryMetric ?? null
      const stage = lane === 'Portfolio' ? ((project.portfolioExplorer?.strategyViability?.diagnosis?.stage as string | undefined) ?? null) : null
      const runId = latest?.id ?? ex?.id ?? null
      const portfolio = lane === 'Portfolio' && !!project.portfolioExplorer
      out.push({
        key: `${l.summary.id}/${lane}`,
        project: l.summary,
        lane,
        verdict: stage ? (PORTFOLIO_FAIL.has(stage) ? 'fail' : 'inconclusive') : null,
        stage,
        metric,
        value: latest ? latest.primaryValue : (ex?.primaryValue ?? null),
        split: metric ? splitOf(metric) : null,
        runs: runs.length,
        last: latest?.startedAt ?? ex?.startedAt ?? null,
        runId,
        // Portfolio has its own lane page; the other lanes open their latest Run until their pages land.
        hasPage: portfolio,
        href: portfolio ? routeHref({ view: 'portfolio', id: l.summary.id }) : runId ? routeHref({ view: 'run', id: l.summary.id, run: runId }) : routeHref({ view: 'project', id: l.summary.id }),
      })
    }
  }
  return out
}

export function StrategyLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const all = useAllProjects(workspace)
  const rows = useMemo(() => rowsOf(all), [all])
  const [q, setQ] = useState('')
  const [lane, setLane] = useState('')
  const [project, setProject] = useState('')
  const shown = rows.filter(
    (r) => (!lane || r.lane === lane) && (!project || r.project.id === project) && (!q || `${r.project.name} ${r.project.id} ${r.lane} ${r.metric ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )
  const cols: Col<Row>[] = [
    {
      id: 'name',
      label: 'Strategy',
      rowHeader: true,
      sort: (r) => r.project.name,
      render: (r) => (
        <>
          <a href={r.href} translate="no">{r.project.name}</a>
          <span className="faint small mono" translate="no">{r.project.id}</span>
        </>
      ),
    },
    { id: 'lane', label: 'Lane', sort: (r) => r.lane, render: (r) => r.lane },
    {
      id: 'verdict',
      label: 'Verdict',
      title: 'Server viability stage. Only the Portfolio lane publishes one today.',
      sort: (r) => (r.verdict === 'fail' ? 0 : r.verdict === 'inconclusive' ? 1 : null),
      render: (r) => (
        <>
          <VerdictBadge verdict={r.verdict} none="Not published" />
          {r.stage && <span className="faint small mono" translate="no">{r.stage}</span>}
        </>
      ),
    },
    {
      id: 'metric',
      label: 'Headline metric',
      sort: (r) => r.metric,
      render: (r) =>
        r.metric ? (
          <>
            <span className="mono small" translate="no">{r.metric}</span>
            {r.split && <span className="faint small"> · {r.split} split</span>}
          </>
        ) : (
          <span className="faint small">No Run</span>
        ),
    },
    { id: 'value', label: 'Value', align: 'r', sort: (r) => r.value, render: (r) => num(r.value, 3) },
    { id: 'runs', label: 'Runs', align: 'r', sort: (r) => r.runs, render: (r) => r.runs },
    { id: 'last', label: 'Last Run (UTC)', sort: (r) => r.last, render: (r) => <span className="mono">{when(r.last)}</span> },
    { id: 'opens', label: 'Opens', render: (r) => <span className="faint small">{r.hasPage ? 'Portfolio page' : r.runId ? 'Latest Run' : 'Project'}</span> },
  ]
  const projects = uniq(rows.map((r) => r.project.id))
  return (
    <div className="pg">
      <PageHead
        title="Strategy library"
        lede={`${plural(rows.length, 'strategy-like lane', 'strategy-like lanes')} across ${plural(projects.length, 'Project')}: Portfolio, RL and Allocation evidence. Click a row to open it.`}
      />
      <LoadNote all={all} />
      <div className="lib-filters">
        <Field label="Search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Project, lane, metric" />
        </Field>
        <Field label="Lane">
          <select value={lane} onChange={(e) => setLane(e.target.value)}>
            <option value="">All lanes</option>
            {uniq(rows.map((r) => r.lane)).map((v) => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Project">
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((id) => <option key={id} value={id}>{rows.find((r) => r.project.id === id)?.project.name ?? id}</option>)}
          </select>
        </Field>
        <span className="faint small lib-count">{shown.length} of {rows.length}</span>
      </div>
      {shown.length === 0 ? (
        <Empty>{rows.length === 0 ? 'No Portfolio, RL or Allocation evidence was found in this Workspace.' : 'No row matches these filters.'}</Empty>
      ) : (
        <DataTable rows={shown} cols={cols} rowKey={(r) => r.key} href={(r) => r.href} go={go} initial={{ id: 'last', dir: -1 }} caption="Strategy-like lanes across all Projects" />
      )}
      <p className="muted small">
        Evidence only, never a trading recommendation: every number is in-sample unless its page says otherwise. Lanes without their own page yet open their latest Run.
      </p>
    </div>
  )
}
