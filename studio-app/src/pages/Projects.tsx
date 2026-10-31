import type { ReactNode } from 'react'
import type { WorkspaceSummary } from '../api'
import { ProjectCard } from '../components/ProjectCard'
import { plural } from '../format'
import { Notice } from '../Notice'
import { Empty, EndOfList } from '../components/States'
import { HeroLine, HeroTiles } from './hero'

export function Projects({ workspace, freshness, error }: { workspace: WorkspaceSummary; freshness: ReactNode; error: string | null }) {
  const projects = workspace.projects
  const runs = projects.reduce((sum, p) => sum + p.runCount, 0)
  const studies = projects.reduce((sum, p) => sum + p.studies.length, 0)
  const broken = projects.filter((p) => !p.valid).length
  return (
    <div className="pg">
      <header className="pg-head">
        <h1>Projects</h1>
        <p className="muted small">
          {workspace.source.workspace ? <span translate="no">{workspace.source.workspace.name}</span> : <span>Single Project</span>}
          {' · '}
          {freshness}
        </p>
      </header>
      <div className="hero-stack">
        {projects.length === 0 ? (
          <HeroLine tone="warn" word="Empty">no Projects were discovered in this Workspace</HeroLine>
        ) : broken === 0 ? (
          <HeroLine tone="ok" word="Verified">every Project verifies; {plural(runs, 'immutable Run')} are on record</HeroLine>
        ) : (
          <HeroLine tone="bad" word="Needs attention">
            {broken} of {plural(projects.length, 'Project')} {broken === 1 ? 'does' : 'do'} not verify
          </HeroLine>
        )}
        <HeroTiles
          label="Workspace totals"
          items={[
            { label: 'Projects', value: String(projects.length) },
            { label: 'Need attention', value: String(broken), note: broken === 0 ? 'none' : 'open the flagged Project' },
            { label: 'Studies', value: String(studies) },
            { label: 'Immutable Runs', value: String(runs) },
          ]}
        />
      </div>
      {error && <Notice kind="error" label="Error" title="Could not refresh." subtitle={error} />}
      {workspace.diagnostics.length > 0 && (
        <Notice kind="error" label="Error" title="Workspace diagnostics." subtitle={workspace.diagnostics.map((d) => d.message ?? d.code ?? '').join('; ')} />
      )}
      {projects.length === 0 ? (
        <Empty title="No Projects were discovered in this Workspace" />
      ) : (
        <>
          <div className="pc-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
          <EndOfList label={`End of list · ${plural(projects.length, 'Project')}`} />
        </>
      )}
      <p className="muted small">
        Native pages: Factor, Portfolio, Book Risk, path stress, Allocation, Governed RL and Event Study.
        Anything not listed falls back to the <a href="/legacy">legacy Studio</a>.
      </p>
    </div>
  )
}
