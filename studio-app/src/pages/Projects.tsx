import { useMemo, useState, type ReactNode } from 'react'
import type { ProjectSnapshot, ProjectSummary, WorkspaceSummary } from '../api'
import { Empty } from '../components/States'
import { pickIntegrity } from '../components/TrialCounter'
import { Glyph } from '../design/icons'
import { plural, when } from '../format'
import { sortIdeas } from '../ideas'
import { DataTable, type Col } from '../library/DataTable'
import { useAllProjects, byNewest, type Loaded } from '../library/data'
import { Notice } from '../Notice'
import { routeHref } from '../route'
import { ideaVerdict } from './IdeaVerdict'
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
  const latest = latestOf(r)
  if (!latest) return 'Not tested'
  if (latest.status !== 'succeeded') return 'Could not be tested'
  if (r.snap?.factorExplorer?.run.id !== latest.id) return 'No current Factor conclusion'
  const exactLeader = r.snap.sessions.find(s => s.session?.leader?.runId === latest.id)
  return ideaVerdict(r.snap.factorExplorer, exactLeader?.selectionIntegrity?.selectionAdjustment?.passes)
}

const hrefOf = (r: Row) => r.p.studies.length === 1 && r.p.studies[0].id === 'ohlcv-factor-quality' ? `${routeHref({ view: 'factor', id: r.p.id })}&idea=1` : routeHref({ view: 'project', id: r.p.id })

/** Home, called "Ideas": one Project is one idea. Status strip on top, then one row per Project. */
export function Projects({ workspace, freshness, error, go }: { workspace: WorkspaceSummary; freshness: ReactNode; error: string | null; go: (href: string) => void }) {
  const [creating, setCreating] = useState(false)
  const projects = workspace.projects
  const all = useAllProjects(workspace)
  const rows = useMemo(() => {
    const byId = new Map(all.map((l) => [l.summary.id, l]))
    return sortIdeas(projects).map((p) => rowOf(p, byId.get(p.id)))
  }, [projects, all])

  const cols: Col<Row>[] = [
    {
      id: 'name',
      label: 'Idea',
      rowHeader: true,
      render: (r) => (
        <>
          <a href={hrefOf(r)} translate="no">{r.p.name}</a>
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
      render: (r) => <span>{r.loading ? 'Loading…' : verdictOf(r)}</span>,
    },
    {
      id: 'metric',
      label: 'Original question',
      render: (r) => {
        const question = r.snap?.agentWorkBrief?.question?.text ?? r.snap?.description ?? r.p.description ?? 'Loading…'
        return <span className="idea-table-question" title={question}>{question}</span>
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
      render: (r) => <span className="idea-next">{r.p.runCount ? 'Read the conclusion' : 'Continue this idea'}</span>,
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
      <p className="muted">Bring a factor idea. Test it on staged data. Keep an honest answer, including an inconclusive one.</p>
      {error && <Notice kind="error" label="Error" title="Could not refresh." subtitle={error} />}
      {projects.length === 0 ? (
        <Empty title="What would you like to test?">Choose New idea to write your first question. No analysis runs until you confirm a trial.</Empty>
      ) : (
        <div className="idea-table">
        <DataTable
          rows={rows}
          cols={cols}
          rowKey={(r) => r.p.id}
          href={hrefOf}
          go={go}
          caption={`${plural(projects.length, 'idea')}, needs attention first, then latest Run`}
          slideHover
        />
        </div>
      )}
      <NewIdeaDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
