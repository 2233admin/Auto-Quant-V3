import { useMemo, useState } from 'react'
import type { WorkspaceSummary } from '../api'
import { num, plural, when } from '../format'
import { routeHref } from '../route'
import { byNewest, dayOf, flatRuns, useAllProjects, type FlatRun } from './data'
import { DataTable, type Col } from './DataTable'
import { Empty, Field, LoadNote, PageHead, uniq } from './parts'

const duration = (ms: number | null | undefined) => (typeof ms === 'number' ? (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`) : '—')
const key = (r: FlatRun) => `${r.project.id}/${r.run.id}`

export function RunHistory({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const all = useAllProjects(workspace)
  const rows = useMemo(() => flatRuns(all).sort((a, b) => byNewest(a.run, b.run)), [all])
  const [q, setQ] = useState('')
  const [lane, setLane] = useState('')
  const [status, setStatus] = useState('')
  const [project, setProject] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [picked, setPicked] = useState<string[]>([])

  const shown = rows.filter(
    (r) =>
      (!lane || r.lane === lane) &&
      (!status || r.run.status === status) &&
      (!project || r.project.id === project) &&
      (!from || dayOf(r.run.startedAt) >= from) &&
      (!to || dayOf(r.run.startedAt) <= to) &&
      (!q || `${r.run.id} ${r.run.studyId} ${r.run.primaryMetric} ${r.run.subject.name} ${r.project.name}`.toLowerCase().includes(q.toLowerCase())),
  )

  const toggle = (k: string) => setPicked((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.length >= 2 ? [prev[1], k] : [...prev, k]))
  const two = picked.length === 2 ? picked.map((k) => rows.find((r) => key(r) === k)).filter((r): r is FlatRun => !!r) : []
  const sameProject = two.length === 2 && two[0].project.id === two[1].project.id
  // Older Run is A (before), newer is B (after), as on the Project page.
  const [a, b] = sameProject ? [...two].sort((x, y) => x.run.startedAt.localeCompare(y.run.startedAt)) : []

  const href = (r: FlatRun) => routeHref({ view: 'run', id: r.project.id, run: r.run.id })
  const cols: Col<FlatRun>[] = [
    {
      id: 'pick',
      label: 'Select',
      render: (r) => (
        <input type="checkbox" aria-label={`Select ${r.run.id} for comparison`} checked={picked.includes(key(r))} onChange={() => toggle(key(r))} />
      ),
    },
    {
      id: 'run',
      label: 'Run',
      rowHeader: true,
      sort: (r) => r.run.id,
      render: (r) => (
        <>
          <a href={href(r)} className="mono" translate="no" title={r.run.id}>{r.run.id.replace(/^.*-/, '')}</a>
          <span className="faint small mono" translate="no">{r.run.subject.name} · {r.run.studyId}</span>
        </>
      ),
    },
    { id: 'project', label: 'Project', sort: (r) => r.project.name, render: (r) => <span translate="no">{r.project.name}</span> },
    { id: 'lane', label: 'Lane', sort: (r) => r.lane, render: (r) => r.lane },
    { id: 'status', label: 'Status', sort: (r) => r.run.status, render: (r) => r.run.status },
    { id: 'started', label: 'Started (UTC)', sort: (r) => r.run.startedAt, render: (r) => <span className="mono">{when(r.run.startedAt)}</span> },
    { id: 'dur', label: 'Duration', align: 'r', sort: (r) => r.run.durationMs ?? null, render: (r) => duration(r.run.durationMs) },
    { id: 'metric', label: 'Metric', sort: (r) => r.run.primaryMetric, render: (r) => <span className="mono small" translate="no">{r.run.primaryMetric}</span> },
    { id: 'value', label: 'Value', align: 'r', sort: (r) => r.run.primaryValue, render: (r) => num(r.run.primaryValue, 4) },
    { id: 'errors', label: 'Errors', align: 'r', sort: (r) => (r.run.errors ?? []).length, render: (r) => (r.run.errors ?? []).length },
  ]
  const reset = () => {
    setQ('')
    setLane('')
    setStatus('')
    setProject('')
    setFrom('')
    setTo('')
  }
  const filtered = !!(q || lane || status || project || from || to)
  return (
    <div className="pg">
      <PageHead
        title="Run history"
        lede={`${plural(rows.length, 'immutable Run')} across ${plural(new Set(rows.map((r) => r.project.id)).size, 'Project')}, newest first. Tick two Runs of one Project to compare them.`}
      />
      <LoadNote all={all} />
      <div className="lib-filters">
        <Field label="Search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Run, Study, metric" />
        </Field>
        <Field label="Lane">
          <select value={lane} onChange={(e) => setLane(e.target.value)}>
            <option value="">All lanes</option>
            {uniq(rows.map((r) => r.lane)).map((v) => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {uniq(rows.map((r) => r.run.status)).map((v) => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Project">
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All Projects</option>
            {uniq(rows.map((r) => r.project.id)).map((id) => <option key={id} value={id}>{rows.find((r) => r.project.id === id)?.project.name ?? id}</option>)}
          </select>
        </Field>
        <Field label="From (UTC)">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To (UTC)">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        {filtered && <button type="button" className="btn" onClick={reset}>Clear filters</button>}
        <span className="faint small lib-count">{shown.length} of {rows.length}</span>
      </div>
      <div className="lib-bar" role="status">
        {a && b ? (
          <a className="btn" href={routeHref({ view: 'compare', id: a.project.id, a: a.run.id, b: b.run.id })}>Compare 2 Runs</a>
        ) : picked.length === 2 ? (
          <span className="sig small">Compare needs two Runs of the same Project.</span>
        ) : (
          <span className="faint small">{picked.length}/2 selected</span>
        )}
        {picked.length > 0 && <button type="button" className="btn" onClick={() => setPicked([])}>Clear selection</button>}
      </div>
      {shown.length === 0 ? (
        <Empty>{rows.length === 0 ? 'No Run was found in this Workspace.' : 'No Run matches these filters.'}</Empty>
      ) : (
        <DataTable rows={shown} cols={cols} rowKey={key} href={href} go={go} initial={{ id: 'started', dir: -1 }} caption="Runs across all Projects" selected={(r) => picked.includes(key(r))} />
      )}
    </div>
  )
}
