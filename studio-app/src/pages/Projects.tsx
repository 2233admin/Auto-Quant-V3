import type { ReactNode } from 'react'
import type { WorkspaceSummary } from '../api'
import { Glyph } from '../design/icons'
import { plural, when } from '../format'
import { routeHref } from '../route'
import { Notice } from '../Notice'
import { verification } from '../shell/Rail'

function sessions(counts: Record<string, number | Record<string, number>>): { total: number; active: number } {
  const n = (key: string) => (typeof counts[key] === 'number' ? (counts[key] as number) : 0)
  return { total: n('sessions'), active: n('activeSessions') }
}

export function Projects({ workspace, freshness, error }: { workspace: WorkspaceSummary; freshness: ReactNode; error: string | null }) {
  const projects = workspace.projects
  const runs = projects.reduce((sum, p) => sum + p.runCount, 0)
  const studies = projects.reduce((sum, p) => sum + p.studies.length, 0)
  const broken = projects.filter((p) => !p.valid).length
  return (
    <div className="pg">
      <header className="pg-head">
        <h1>
          {plural(projects.length, 'Project')}, {plural(studies, 'Study', 'Studies')}, {plural(runs, 'immutable Run')}
        </h1>
        <p className="muted small">
          {workspace.source.workspace ? <span translate="no">{workspace.source.workspace.name}</span> : <span>Single Project</span>}
          {' · '}
          {broken === 0 ? 'every Project verifies' : `${plural(broken, 'Project')} need attention`}
          {' · '}
          {freshness}
        </p>
      </header>
      {error && <Notice kind="error" label="Error" title="Could not refresh." subtitle={error} />}
      {workspace.diagnostics.length > 0 && (
        <Notice kind="error" label="Error" title="Workspace diagnostics." subtitle={workspace.diagnostics.map((d) => d.message ?? d.code ?? '').join('; ')} />
      )}
      {projects.length === 0 ? (
        <p className="muted">No Projects were discovered in this Workspace.</p>
      ) : (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Verification</th>
                <th scope="col" className="r">Studies</th>
                <th scope="col" className="r">Runs</th>
                <th scope="col" className="r">Sessions</th>
                <th scope="col">External holdout</th>
                <th scope="col">Latest Run (UTC)</th>
                <th scope="col">Next move</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const look = verification(p.valid)
                const s = sessions(p.counts)
                return (
                  <tr key={p.id}>
                    <th scope="row">
                      <a href={routeHref({ view: 'project', id: p.id })} translate="no">{p.name}</a>
                      <span className="faint small mono" translate="no">{p.id}</span>
                    </th>
                    <td>
                      <span className="state">
                        <Glyph kind={look.glyph} signal={look.signal} />
                        <span className={look.signal ? 'sig' : undefined}>{look.word}</span>
                      </span>
                    </td>
                    <td className="r num">{p.studies.length}</td>
                    <td className="r num">{p.runCount}</td>
                    <td className="r num">{s.active > 0 ? `${s.total} (${s.active} active)` : s.total}</td>
                    <td>{p.externalHoldout.present ? (p.externalHoldout.status ?? 'Recorded') : 'Not run'}</td>
                    <td className="mono">{when(p.latestRunAt)}</td>
                    <td className="next">{p.brief.headline ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        This view covers Factor and Portfolio evidence. Every other lane is still drawn by the{' '}
        <a href="/legacy">legacy Studio</a>.
      </p>
    </div>
  )
}
