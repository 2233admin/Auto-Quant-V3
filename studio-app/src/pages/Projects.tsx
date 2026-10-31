import type { ReactNode } from 'react'
import type { WorkspaceSummary } from '../api'
import { ProjectCard } from '../components/ProjectCard'
import { plural } from '../format'
import { Notice } from '../Notice'

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
        <div className="pc-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
      <p className="muted small">
        This view covers Factor and Portfolio evidence. Every other lane is still drawn by the{' '}
        <a href="/legacy">legacy Studio</a>.
      </p>
    </div>
  )
}
