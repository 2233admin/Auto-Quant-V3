import { useMemo, useState, type ReactNode } from 'react'
import type { ProjectSnapshot, ProjectSummary, WorkspaceSummary } from '../api'
import { CompactTile, CompactTileGrid } from '../components/CompactTile'
import { Empty } from '../components/States'
import { pickIntegrity } from '../components/TrialCounter'
import { Glyph } from '../design/icons'
import { num, plural, when } from '../format'
import { attentionItems, sortIdeas } from '../ideas'
import { DataTable, type Col } from '../library/DataTable'
import { useAllProjects, byNewest, type Loaded } from '../library/data'
import { VerdictBadge } from '../library/parts'
import { Notice } from '../Notice'
import { routeHref } from '../route'
import { buildVerdict } from './FactorEvidence'
import { NewIdeaDialog } from './NewIdeaDialog'
import './ideas.css'

type Row = { p: ProjectSummary; snap: ProjectSnapshot | null; loading: boolean }

function rowOf(p: ProjectSummary, loaded: Loaded | undefined): Row {
  return { p, snap: loaded?.project ?? null, loading: loaded ? loaded.state === 'loading' : true }
}

function latestOf(r: Row) {
  return r.snap && r.snap.runs.length > 0 ? [...r.snap.runs].sort(byNewest)[0] : null
}

function verdictOf(r: Row) {
  if (!r.snap?.factorExplorer) return null
  return buildVerdict(r.snap.factorExplorer, pickIntegrity(r.snap)?.selectionAdjustment).verdict
}

/** Home, called "Ideas": one Project is one idea. Status strip on top, then one row per Project. */
export function Projects({ workspace, freshness, error, go }: { workspace: WorkspaceSummary; freshness: ReactNode; error: string | null; go: (href: string) => void }) {
  const [creating, setCreating] = useState(false)
  const projects = workspace.projects
  const all = useAllProjects(workspace)
  const rows = useMemo(() => {
    const byId = new Map(all.map((l) => [l.summary.id, l]))
    return sortIdeas(projects).map((p) => rowOf(p, byId.get(p.id)))
  }, [projects, all])
  const attention = attentionItems(workspace).length
  const runs = projects.reduce((sum, p) => sum + p.runCount, 0)
  const last = projects.reduce<string | null>((m, p) => (p.latestRunAt && (!m || p.latestRunAt > m) ? p.latestRunAt : m), null)

  const cols: Col<Row>[] = [
    {
      id: 'name',
      label: 'Idea',
      rowHeader: true,
      render: (r) => (
        <>
          <a href={routeHref({ view: 'project', id: r.p.id })} translate="no">{r.p.name}</a>
          <span className="faint small">
            <span className="mono" translate="no">{r.p.id}</span>
            {!r.p.valid && (
              <span className="idea-flag">
                <Glyph kind="error" signal />
                <span className="sig">Needs attention</span>
              </span>
            )}
          </span>
        </>
      ),
    },
    {
      id: 'verdict',
      label: 'Verdict',
      title: 'Factor verdict from the server qualification stage.',
      render: (r) => <VerdictBadge verdict={verdictOf(r)} none={r.loading ? 'Loading…' : 'No verdict'} />,
    },
    {
      id: 'metric',
      label: 'Headline metric',
      render: (r) => {
        const run = latestOf(r)
        if (r.p.runCount === 0) return <span className="faint small">No Runs yet</span>
        if (!run) return <span className="faint small">{r.loading ? 'Loading…' : 'Not available'}</span>
        return (
          <>
            <span className="mono small" translate="no">{run.primaryMetric}</span>
            <span className="mono"> {num(run.primaryValue, 4)}</span>
          </>
        )
      },
    },
    { id: 'last', label: 'Latest Run (UTC)', render: (r) => <span className="mono">{when(r.p.latestRunAt)}</span> },
    {
      id: 'trials',
      label: 'Trials',
      align: 'r',
      title: 'Every execution in the research family; trials are never removed.',
      render: (r) => {
        const fam = r.snap ? pickIntegrity(r.snap)?.researchFamily : undefined
        return fam ? fam.totalExecutions : <span className="faint small">{r.loading ? '…' : 'no ledger'}</span>
      },
    },
    {
      id: 'next',
      label: 'Next step',
      render: (r) => (r.p.brief.headline ? <span className="idea-next">{r.p.brief.headline}</span> : <span className="faint small">None recorded</span>),
    },
  ]

  return (
    <div className="pg">
      <header className="pg-head idea-head">
        <h1>Ideas</h1>
        <p className="muted small">
          {workspace.source.workspace ? <span translate="no">{workspace.source.workspace.name}</span> : <span>Single Project</span>}
          {' · '}
          {freshness}
        </p>
        <button type="button" className="abtn abtn--primary idea-new" aria-haspopup="dialog" onClick={() => setCreating(true)}>
          New idea
        </button>
      </header>
      <div className="idea-strip">
        <CompactTileGrid label="Workspace status">
          <CompactTile label="Ideas" value={String(projects.length)} />
          <CompactTile
            label="Need attention"
            value={String(attention)}
            tone={attention > 0 ? 'weak' : 'neutral'}
            note={attention > 0 ? <a href={routeHref({ view: 'attention' })}>Review</a> : 'none'}
          />
          <CompactTile label="Immutable Runs" value={String(runs)} />
          <CompactTile label="Last Run (UTC)" value={when(last)} />
        </CompactTileGrid>
      </div>
      {error && <Notice kind="error" label="Error" title="Could not refresh." subtitle={error} />}
      {projects.length === 0 ? (
        <Empty title="No ideas yet">Use New idea to see how to create the first one.</Empty>
      ) : (
        <div className="idea-table">
        <DataTable
          rows={rows}
          cols={cols}
          rowKey={(r) => r.p.id}
          href={(r) => routeHref({ view: 'project', id: r.p.id })}
          go={go}
          caption={`${plural(projects.length, 'idea')}, needs attention first, then latest Run`}
        />
        </div>
      )}
      <NewIdeaDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
