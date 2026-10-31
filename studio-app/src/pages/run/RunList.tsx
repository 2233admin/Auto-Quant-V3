import { useState } from 'react'
import type { ProjectSnapshot } from '../../api'
import { num, plural, when } from '../../format'
import { routeHref } from '../../route'
import './run.css'

const duration = (ms: number | undefined) => (typeof ms === 'number' ? (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`) : '—')

/**
 * Every immutable Run of the Project, newest first, from snapshot runs[]. Tick two Runs to compare them.
 * Mount it on the Project page with <RunList project={project} />.
 */
export function RunList({ project }: { project: ProjectSnapshot }) {
  const [picked, setPicked] = useState<string[]>([])
  const runs = [...project.runs].sort((x, y) => y.startedAt.localeCompare(x.startedAt))
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]))
  if (runs.length === 0) return <p className="muted">This Project has no Runs yet.</p>
  // Older Run is A (before), newer is B (after).
  const [a, b] = picked.length === 2 ? [...picked].sort((x, y) => (runs.find((r) => r.id === x)!.startedAt < runs.find((r) => r.id === y)!.startedAt ? -1 : 1)) : [undefined, undefined]
  return (
    <div className="runlist">
      <div className="runlist-bar">
        <span className="muted small">{plural(runs.length, 'Run')}. Tick two to compare.</span>
        {a && b ? (
          <a className="btn" href={routeHref({ view: 'compare', id: project.id, a, b })}>Compare 2 Runs</a>
        ) : (
          <span className="faint small">{picked.length}/2 selected</span>
        )}
      </div>
      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col"><span className="sr">Select</span></th>
              <th scope="col">Run</th>
              <th scope="col">Study</th>
              <th scope="col">Status</th>
              <th scope="col">Started (UTC)</th>
              <th scope="col" className="r">Duration</th>
              <th scope="col">Metric</th>
              <th scope="col" className="r">Value</th>
              <th scope="col" className="r">Errors</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td><input type="checkbox" aria-label={`Select ${run.id} for comparison`} checked={picked.includes(run.id)} onChange={() => toggle(run.id)} /></td>
                <th scope="row">
                  <a href={routeHref({ view: 'run', id: project.id, run: run.id })} className="mono" translate="no">{run.id.replace(/^run-/, '')}</a>
                  <span className="faint small">{run.subject.name}</span>
                </th>
                <td className="mono small">{run.studyId}</td>
                <td>{run.status}</td>
                <td className="mono">{when(run.startedAt)}</td>
                <td className="r num">{duration((run as { durationMs?: number }).durationMs)}</td>
                <td className="mono small">{run.primaryMetric}</td>
                <td className="r num">{num(run.primaryValue, 4)}</td>
                <td className="r num">{((run as { errors?: unknown[] }).errors ?? []).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
