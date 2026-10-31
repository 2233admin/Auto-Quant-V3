import { useMemo, useState } from 'react'
import type { ProjectSnapshot, ProjectSummary, StudyRow, WorkspaceSummary } from '../api'
import { Info } from '../components/Info'
import { Sparkline } from '../components/ProjectCard'
import { pickIntegrity } from '../components/TrialCounter'
import { num, plural, when } from '../format'
import { buildVerdict, type Verdict } from '../pages/FactorEvidence'
import { routeHref } from '../route'
import { byNewest, laneOfRun, splitOf, studySeries, useAllProjects, type Loaded } from './data'
import { DataTable, type Col } from './DataTable'
import { EndOfList } from '../components/States'
import { Empty, Field, LoadNote, PageHead, uniq, VerdictBadge } from './parts'

type Row = {
  key: string
  project: ProjectSummary
  study: StudyRow
  verdict: Verdict | null
  stage: string | null
  metric: string | null
  value: number | null
  split: string | null
  trials: string | null
  trialsN: number | null
  runs: number
  values: number[]
  last: string | null
}

function rowsOf(all: Loaded[]): Row[] {
  const out: Row[] = []
  for (const l of all) {
    const project = l.project as ProjectSnapshot | null
    if (!project) continue
    const integrity = pickIntegrity(project)
    const fam = integrity?.researchFamily
    for (const study of project.studies) {
      const runs = project.runs.filter((r) => r.studyId === study.id).sort(byNewest)
      const latest = runs[0]
      // A Study is a Factor candidate when its latest Run is in the Factor lane; with no Run yet, when its subject is a factor.
      const isFactor = latest ? laneOfRun(project, latest) === 'Factor' : study.subjectKind === 'factor'
      if (!isFactor) continue
      // The server publishes one Factor explorer per Project, for its latest Factor Run; only that Study has a verdict.
      const ex = project.factorExplorer
      const has = !!ex && ex.run.studyId === study.id
      const built = has && ex ? buildVerdict(ex, integrity?.selectionAdjustment) : null
      out.push({
        key: `${l.summary.id}/${study.id}`,
        project: l.summary,
        study,
        verdict: built?.verdict ?? null,
        stage: has && ex ? (ex.factorQualification.diagnosis?.stage ?? null) : null,
        metric: latest?.primaryMetric ?? null,
        value: latest?.primaryValue ?? null,
        split: latest ? splitOf(latest.primaryMetric) : null,
        trials: fam ? `${fam.totalExecutions} (${fam.uniqueSourceTrials} unique)` : null,
        trialsN: fam ? fam.totalExecutions : null,
        runs: runs.length,
        values: latest ? studySeries(project, study, latest.primaryMetric) : [],
        last: latest?.startedAt ?? null,
      })
    }
  }
  return out
}

/** One Factor Study as a card: verdict, primary value with its sparkline across Runs, and three key figures. */
function FactorCard({ r, href, go }: { r: Row; href: string; go: (href: string) => void }) {
  return (
    <article
      className="pc lib-fcard"
      aria-label={r.study.name}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || (e.target as Element).closest('a, button')) return
        go(href)
      }}
    >
      <div className="pc-top">
        <a className="pc-name" href={href} translate="no">{r.study.name}</a>
        <span className="faint small mono" translate="no">{r.project.name} · {r.study.id}</span>
      </div>
      <div className="pc-badges">
        <VerdictBadge verdict={r.verdict} none="Verdict not published" detail={r.stage ? `stage: ${r.stage}` : undefined} />
      </div>
      {r.metric ? (
        <div className="pc-metric">
          <div className="mt">
            <span className="mt-label"><span className="mono" translate="no">{r.metric}</span></span>
            <span className="mt-value mono">{num(r.value, 4)}</span>
            <span className="faint small">{r.split ? `${r.split} split · ` : ''}{plural(r.values.length, 'valued Run')}</span>
          </div>
          {r.values.length > 0 ? (
            <Sparkline values={r.values} label={`${r.metric} across ${plural(r.values.length, 'valued Run')}, oldest to newest; the last point is the latest Run.`} />
          ) : (
            <span className="faint small">No valued Run</span>
          )}
        </div>
      ) : (
        <p className="muted small">No Runs yet. There is no primary metric to show.</p>
      )}
      <dl className="pc-facts">
        <dt>Trials counted</dt>
        <dd className="mono">{r.trials ?? 'no ledger'}</dd>
        <dt>Runs</dt>
        <dd className="mono">{r.runs}</dd>
        <dt>Last Run (UTC)</dt>
        <dd className="mono">{when(r.last)}</dd>
      </dl>
    </article>
  )
}

const ORDER: Record<Verdict, number> = { pass: 0, inconclusive: 1, fail: 2 }

export function FactorLibrary({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const all = useAllProjects(workspace)
  const rows = useMemo(() => rowsOf(all), [all])
  const [q, setQ] = useState('')
  const [verdict, setVerdict] = useState('')
  const [project, setProject] = useState('')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const shown = rows.filter(
    (r) =>
      (!project || r.project.id === project) &&
      (!verdict || (verdict === 'none' ? r.verdict === null : r.verdict === verdict)) &&
      (!q || `${r.study.name} ${r.study.id} ${r.project.name} ${r.project.id}`.toLowerCase().includes(q.toLowerCase())),
  )
  const href = (r: Row) => routeHref({ view: 'factor', id: r.project.id, study: r.study.id })
  const cols: Col<Row>[] = [
    {
      id: 'name',
      label: 'Factor Study',
      rowHeader: true,
      sort: (r) => r.study.name,
      render: (r) => (
        <>
          <a href={href(r)} translate="no">{r.study.name}</a>
          <span className="faint small mono" translate="no">{r.study.id}</span>
        </>
      ),
    },
    { id: 'project', label: 'Project', sort: (r) => r.project.name, render: (r) => <span className="lib-wrap" translate="no">{r.project.name}</span> },
    {
      id: 'verdict',
      label: 'Verdict',
      title: 'Server qualification stage, demoted when the selection adjustment fails. Only the latest Factor Run of a Project has one today.',
      sort: (r) => (r.verdict ? ORDER[r.verdict] : null),
      render: (r) => <VerdictBadge verdict={r.verdict} none="Not published" detail={r.stage ? `stage: ${r.stage}` : undefined} />,
    },
    {
      id: 'metric',
      label: 'Primary metric',
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
    { id: 'value', label: 'Value', align: 'r', sort: (r) => r.value, render: (r) => num(r.value, 4) },
    { id: 'trials', label: 'Trials counted', align: 'r', title: 'researchFamily.totalExecutions of the Project ledger', sort: (r) => r.trialsN, render: (r) => r.trials ?? <span className="faint small">no ledger</span> },
    { id: 'runs', label: 'Runs', align: 'r', sort: (r) => r.runs, render: (r) => r.runs },
    {
      id: 'spark',
      label: 'Across Runs',
      render: (r) =>
        r.values.length > 0 && r.metric ? (
          <Sparkline values={r.values} label={`${r.metric} across ${plural(r.values.length, 'valued Run')}, oldest to newest; the last point is the latest Run.`} />
        ) : (
          <span className="faint small">No valued Run</span>
        ),
    },
    { id: 'last', label: 'Last Run (UTC)', sort: (r) => r.last, render: (r) => <span className="mono">{when(r.last)}</span> },
  ]
  const projects = uniq(rows.map((r) => r.project.id))
  return (
    <div className="pg">
      <PageHead
        title="Factor library"
        lede={`${plural(rows.length, 'Factor Study', 'Factor Studies')} across ${plural(projects.length, 'Project')}. Click a row to open its evidence.`}
      />
      <LoadNote all={all} />
      <div className="lib-filters">
        <Field label="Search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Study or Project" />
        </Field>
        <Field label="Verdict">
          <select value={verdict} onChange={(e) => setVerdict(e.target.value)}>
            <option value="">All verdicts</option>
            <option value="pass">Pass</option>
            <option value="inconclusive">Inconclusive</option>
            <option value="fail">Fail</option>
            <option value="none">Not published</option>
          </select>
        </Field>
        <Field label="Project">
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((id) => (
              <option key={id} value={id}>{rows.find((r) => r.project.id === id)?.project.name ?? id}</option>
            ))}
          </select>
        </Field>
        <span className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Cards</button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
        </span>
        <span className="faint small lib-count" role="status">{shown.length} of {rows.length} Factor Studies</span>
      </div>
      {shown.length === 0 ? (
        <Empty>{rows.length === 0 ? 'No Factor Study was found in this Workspace.' : 'No Factor Study matches these filters.'}</Empty>
      ) : view === 'cards' ? (
        <>
          <div className="lib-fcards">
            {[...shown].sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '')).map((r) => (
              <FactorCard key={r.key} r={r} href={href(r)} go={go} />
            ))}
          </div>
          <EndOfList label={`End of list · ${shown.length} ${shown.length === 1 ? 'card' : 'cards'}, newest Run first`} />
        </>
      ) : (
        <DataTable rows={shown} cols={cols} rowKey={(r) => r.key} href={href} go={go} initial={{ id: 'last', dir: -1 }} caption="Factor Studies across all Projects" />
      )}
      <p className="muted small">
        Verdicts are the server&apos;s Factor qualification.
        <Info label="About verdicts and trials">
          <p>
            Verdicts come from the server&apos;s Factor qualification. The server publishes it for one Run per Project, so other Studies show &quot;Not published&quot; rather than a guess.
            Trials are counted per Project research family, not per Study.
          </p>
        </Info>
      </p>
    </div>
  )
}
