import { useMemo, useState } from 'react'
import type { ProjectSnapshot, ProjectSummary, SessionSnapshot, TrialRow, WorkspaceSummary } from '../api'
import { Info } from '../components/Info'
import { MetricTile } from '../components/MetricTile'
import { Section } from '../design/layout'
import { Glyph, type GlyphKind } from '../design/icons'
import { num, plural, pct, ret, when } from '../format'
import { Notice } from '../Notice'
import type { NeighborConfig } from '../pages/portfolio/portfolioTypes'
import { routeHref } from '../route'
import { sessionOf, useAllProjects, type Loaded } from './data'
import { DataTable, type Col } from './DataTable'
import { Empty, LoadNote, PageHead } from './parts'

/** Trial as the Session decision matrix publishes it; `metrics` is only read for display. */
type Trial = TrialRow & { metrics?: Record<string, number | null> }
type Matrix = {
  objective?: { direction?: string; metric?: string; minimumImprovement?: number }
  scope?: { trialLimit: number; totalCandidateTrials: number; displayedCandidateTrials: number; omittedCandidateTrials: number }
  trials?: Trial[]
}

type Phase = 'queued' | 'running' | 'done' | 'failed'
const PHASE: Record<Phase, { word: string; glyph: GlyphKind; signal: boolean }> = {
  queued: { word: 'Queued', glyph: 'proposed', signal: false },
  running: { word: 'Running', glyph: 'running', signal: false },
  done: { word: 'Done', glyph: 'supported', signal: false },
  failed: { word: 'Failed', glyph: 'refuted', signal: true },
}

/** Maps the server's trial status string to a counter. Unknown words count as failed so nothing is silently dropped. */
export function phaseOf(t: Pick<TrialRow, 'status' | 'verdict'>): Phase {
  const s = t.status.toLowerCase()
  if (s === 'succeeded' && t.verdict !== 'CRASH') return 'done'
  if (s === 'queued' || s === 'pending' || s === 'proposed') return 'queued'
  if (s === 'running' || s === 'started' || s === 'in-progress') return 'running'
  return 'failed'
}

const matrixOf = (s: SessionSnapshot): Matrix | null => (s.decisionMatrix as Matrix | null | undefined) ?? null
const trialsOf = (s: SessionSnapshot): Trial[] => matrixOf(s)?.trials ?? []

// ----------------------------------------------------------------------------------------------- index

type Task = { key: string; project: ProjectSummary; session: SessionSnapshot; id: string; status: string; studyId: string; metric: string | null; trials: Trial[]; updated: string | null }

function tasksOf(all: Loaded[]): Task[] {
  return all.flatMap((l) =>
    (l.project?.sessions ?? []).map((session) => {
      const s = sessionOf(session)
      return {
        key: `${l.summary.id}/${s.id}`,
        project: l.summary,
        session,
        id: s.id,
        status: s.status,
        studyId: s.studyId,
        metric: matrixOf(session)?.objective?.metric ?? null,
        trials: trialsOf(session),
        updated: session.session?.updatedAt ?? null,
      }
    }),
  )
}

function Index({ workspace, go }: { workspace: WorkspaceSummary | null; go: (href: string) => void }) {
  const all = useAllProjects(workspace)
  const rows = useMemo(() => tasksOf(all), [all])
  const href = (t: Task) => routeHref({ view: 'tuning', id: t.project.id })
  const count = (t: Task, p: Phase) => t.trials.filter((x) => phaseOf(x) === p).length
  const cols: Col<Task>[] = [
    {
      id: 'session',
      label: 'Tuning task (Session)',
      rowHeader: true,
      sort: (t) => t.id,
      render: (t) => (
        <>
          <a href={href(t)} className="mono" translate="no">{t.id.replace(/^session-/, '')}</a>
          <span className="faint small" translate="no">{t.project.name}</span>
        </>
      ),
    },
    { id: 'study', label: 'Study', sort: (t) => t.studyId, render: (t) => <span className="mono small" translate="no">{t.studyId}</span> },
    { id: 'status', label: 'Status', sort: (t) => t.status, render: (t) => t.status || '—' },
    { id: 'objective', label: 'Objective', sort: (t) => t.metric, render: (t) => (t.metric ? <span className="mono small" translate="no">{t.metric}</span> : <span className="faint small">not published</span>) },
    { id: 'trials', label: 'Trials', align: 'r', sort: (t) => t.trials.length, render: (t) => t.trials.length },
    { id: 'done', label: 'Done', align: 'r', sort: (t) => count(t, 'done'), render: (t) => count(t, 'done') },
    { id: 'failed', label: 'Failed', align: 'r', sort: (t) => count(t, 'failed'), render: (t) => count(t, 'failed') },
    { id: 'updated', label: 'Updated (UTC)', sort: (t) => t.updated, render: (t) => <span className="mono">{when(t.updated)}</span> },
  ]
  return (
    <div className="pg">
      <PageHead
        title="Tuning tasks"
        lede={`${plural(rows.length, 'Session')} across ${plural(new Set(rows.map((r) => r.project.id)).size, 'Project')}. Click a row to open it.`}
        info={<p>A Session is the closest thing here to a tuning task: a baseline and its recorded candidate trials.</p>}
      />
      <LoadNote all={all} />
      {rows.length === 0 ? (
        <Empty>No Session was found in this Workspace, so there are no trials to list.</Empty>
      ) : (
        <DataTable rows={rows} cols={cols} rowKey={(t) => t.key} href={href} go={go} initial={{ id: 'updated', dir: -1 }} caption="Sessions across all Projects" />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------------------------- detail

type Ranked = Trial & { rank: number | null }

function rankTrials(trials: Trial[], direction: string | undefined): Ranked[] {
  const sign = direction === 'minimize' ? 1 : -1
  const valued = trials.filter((t) => typeof t.primaryValue === 'number' && Number.isFinite(t.primaryValue)).sort((a, b) => ((a.primaryValue as number) - (b.primaryValue as number)) * sign)
  const rank = new Map(valued.map((t, i) => [t.runId, i + 1]))
  return trials.map((t) => ({ ...t, rank: rank.get(t.runId) ?? null }))
}

function Counters({ trials }: { trials: Trial[] }) {
  const n = (p: Phase) => trials.filter((t) => phaseOf(t) === p).length
  return (
    <dl className="lib-counters">
      <MetricTile label="Queued" value={String(n('queued'))} />
      <MetricTile label="Running" value={String(n('running'))} />
      <MetricTile label="Done" value={String(n('done'))} />
      <MetricTile label="Failed" value={String(n('failed'))} />
    </dl>
  )
}

function StatusMatrix({ trials, projectId }: { trials: Trial[]; projectId: string }) {
  return (
    <ul className="lib-matrix" aria-label="Status of each trial, in sequence order">
      {trials.map((t) => {
        const p = PHASE[phaseOf(t)]
        const label = `${t.role === 'baseline' ? 'Baseline' : `Trial ${t.sequence}`}: ${p.word}, verdict ${t.verdict}${t.isCurrentLeader ? ', current leader' : ''}`
        return (
          <li key={t.runId}>
            <a className={`lib-cell is-${phaseOf(t)}${t.isCurrentLeader ? ' is-leader' : ''}`} href={routeHref({ view: 'run', id: projectId, run: t.runId })} title={`${label}. ${t.hypothesis}`} aria-label={label}>
              <Glyph kind={p.glyph} signal={p.signal} />
              <span className="mono">{t.role === 'baseline' ? 'B' : t.sequence}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

function Ranking({ trials, direction, projectId, go }: { trials: Trial[]; direction?: string; projectId: string; go: (href: string) => void }) {
  const rows = useMemo(() => rankTrials(trials, direction), [trials, direction])
  const href = (t: Ranked) => routeHref({ view: 'run', id: projectId, run: t.runId })
  const cols: Col<Ranked>[] = [
    { id: 'rank', label: 'Rank', align: 'r', sort: (t) => t.rank, render: (t) => t.rank ?? '—' },
    {
      id: 'trial',
      label: 'Trial',
      rowHeader: true,
      sort: (t) => t.sequence,
      render: (t) => (
        <>
          <a href={href(t)}>{t.role === 'baseline' ? 'Baseline' : `Trial ${t.sequence}`}</a>
          {t.isCurrentLeader && <span className="faint small">current leader</span>}
        </>
      ),
    },
    { id: 'hyp', label: 'Hypothesis', render: (t) => <span className="lib-hyp">{t.hypothesis}</span> },
    { id: 'status', label: 'Status', sort: (t) => t.status, render: (t) => t.status },
    { id: 'verdict', label: 'Verdict', sort: (t) => t.verdict, render: (t) => <span className="mono small">{t.verdict}</span> },
    { id: 'value', label: 'Objective value', align: 'r', sort: (t) => t.primaryValue, render: (t) => num(t.primaryValue, 4) },
    { id: 'delta', label: 'vs baseline', align: 'r', sort: (t) => t.objectiveImprovementVsBaseline, render: (t) => num(t.objectiveImprovementVsBaseline, 4) },
  ]
  return <DataTable rows={rows} cols={cols} rowKey={(t) => t.runId} href={href} go={go} initial={{ id: 'rank', dir: 1 }} caption="Trials ranked by the Session objective" />
}

const profile = (c: NeighborConfig) => c.signalProfile ?? '—'

function Neighborhood({ project }: { project: ProjectSnapshot }) {
  const nb = project.portfolioExplorer?.parameterNeighborhood
  const data = nb?.validation
  const configs = data?.configurations ?? []
  if (!project.portfolioExplorer) {
    return <p className="muted">This Project has no Portfolio Run, so no parameter neighborhood is published. Factor and Event Study lanes publish none.</p>
  }
  if (!nb || nb.available === false || configs.length === 0) {
    return <p className="muted">The Portfolio Run does not publish a parameter neighborhood (<span className="mono">parameterNeighborhood.available</span> is false or its configuration list is empty).</p>
  }
  const agg = data?.aggregate
  const cols: Col<NeighborConfig>[] = [
    { id: 'id', label: 'Configuration', rowHeader: true, sort: (c) => c.id, render: (c) => <><span className="mono small" translate="no">{c.id}</span>{c.isBase && <span className="faint small">selected base</span>}</> },
    { id: 'profile', label: 'Signal profile', sort: (c) => c.signalProfile ?? null, render: (c) => profile(c) },
    { id: 'band', label: 'No-trade band', align: 'r', sort: (c) => c.noTradeOneWay ?? null, render: (c) => num(c.noTradeOneWay, 2) },
    { id: 'sharpe', label: 'Net Sharpe', align: 'r', sort: (c) => c.netSharpe ?? null, render: (c) => num(c.netSharpe, 2) },
    { id: 'delta', label: 'vs base', align: 'r', sort: (c) => c.netSharpeDeltaVsBase ?? null, render: (c) => num(c.netSharpeDeltaVsBase, 2) },
    { id: 'ret', label: 'Total return', align: 'r', sort: (c) => c.totalReturn ?? null, render: (c) => ret(c.totalReturn) },
    { id: 'turn', label: 'Turnover / yr', align: 'r', sort: (c) => c.annualizedOneWayTurnover ?? null, render: (c) => `${num(c.annualizedOneWayTurnover, 1)}x` },
    { id: 'cost', label: 'Cost drag', align: 'r', sort: (c) => c.totalCostDrag ?? null, render: (c) => pct(c.totalCostDrag, 2) },
  ]
  return (
    <>
      <p className="small">
        {plural(nb.policy?.configurationCount ?? configs.length, 'predeclared configuration')} around the selected base, validation split, role{' '}
        <span className="mono">{nb.policy?.role ?? '—'}</span>. The other configurations are context only and never enter selection.
        {agg && <> {pct(agg.positiveNetSharpeRate, 0)} have a positive net Sharpe; {pct(agg.signAgreementWithBaseRate, 0)} share the base sign.</>}
      </p>
      <DataTable rows={configs} cols={cols} rowKey={(c) => c.id} initial={{ id: 'sharpe', dir: -1 }} caption="Parameter neighborhood, validation split" />
      <p className="small lib-after">
        <a href={routeHref({ view: 'portfolio', id: project.id })}>Open the Portfolio page</a> for the matrix and the test audit.
      </p>
    </>
  )
}

function SessionView({ project, session, go }: { project: ProjectSnapshot; session: SessionSnapshot; go: (href: string) => void }) {
  const m = matrixOf(session)
  const trials = trialsOf(session)
  const s = sessionOf(session)
  const fam = session.selectionIntegrity?.researchFamily
  return (
    <>
      <p className="muted small">
        Session <span className="mono" translate="no">{s.id}</span> · {s.status || 'status not published'} · Study <span className="mono" translate="no">{s.studyId}</span>
        {m?.objective && <> · objective: {m.objective.direction ?? '—'} <span className="mono" translate="no">{m.objective.metric ?? '—'}</span>{typeof m.objective.minimumImprovement === 'number' && <>, minimum improvement {m.objective.minimumImprovement}</>}</>}
      </p>
      {trials.length === 0 ? (
        <Empty>This Session has no recorded trials yet.</Empty>
      ) : (
        <>
          <Section title="Counters" id="tn-counters" caption="Counted from each trial's recorded status.">
            <Counters trials={trials} />
            <p className="muted small">
              Counted from finished trials.
              <Info label="About the counters">
                <p>
                  Trials are written when they finish, so Queued and Running stay at 0 unless the server publishes a live queue.
                  {m?.scope && m.scope.omittedCandidateTrials > 0 && <> {m.scope.omittedCandidateTrials} candidate trials are omitted from this view (limit {m.scope.trialLimit}).</>}
                  {fam && <> {fam.totalExecutions} executions are counted in this research family.</>}
                </p>
              </Info>
            </p>
          </Section>
          <Section title="Trial status" id="tn-matrix" caption="One cell per trial; B is the baseline, a ringed cell the leader.">
            <StatusMatrix trials={trials} projectId={project.id} />
          </Section>
          <Section title="Ranked values" id="tn-ranking" caption="Ordered by the Session objective; in-sample on the selection split.">
            <Ranking trials={trials} direction={m?.objective?.direction} projectId={project.id} go={go} />
          </Section>
        </>
      )}
    </>
  )
}

function Detail({ workspace, id, go }: { workspace: WorkspaceSummary | null; id: string; go: (href: string) => void }) {
  const all = useAllProjects(workspace)
  const item = all.find((l) => l.summary.id === id)
  const [chosen, setChosen] = useState('')
  if (!workspace || (item && item.state === 'loading')) return <div className="pg"><p className="muted">Loading…</p></div>
  if (!item) return <div className="pg"><Notice kind="error" label="Error" title="Unknown Project." subtitle={id} /><p><a href={routeHref({ view: 'tuning' })}>Back to tuning tasks</a></p></div>
  const project = item.project
  if (!project) return <div className="pg"><Notice kind="error" label="Error" title="Could not load this Project." subtitle={id} /></div>
  const sessions = project.sessions
  const session = sessions.find((s) => sessionOf(s).id === chosen) ?? sessions[0]
  return (
    <div className="pg">
      <PageHead title={`Tuning · ${project.name}`} lede={<>{plural(sessions.length, 'Session')}. Read-only.</>} info={<p>The per-trial view reads the Session decision matrix; nothing is run or changed from here.</p>} />
      {sessions.length > 1 && (
        <label className="lib-field">
          <span>Session</span>
          <select value={sessionOf(session).id} onChange={(e) => setChosen(e.target.value)}>
            {sessions.map((s) => <option key={sessionOf(s).id} value={sessionOf(s).id}>{sessionOf(s).id} ({sessionOf(s).status})</option>)}
          </select>
        </label>
      )}
      {session ? <SessionView project={project} session={session} go={go} /> : <Empty>This Project has no Session, so there is no tuning task to show.</Empty>}
      <Section title="Parameter neighborhood" id="tn-neighborhood" caption="Published by the Portfolio lane only.">
        <Neighborhood project={project} />
      </Section>
      <Section title="Not available" id="tn-na" caption="The reference tuning view shows these; this Studio does not, and says so instead of drawing something.">
        <ul className="lib-na">
          <li><strong>Per-trial curves.</strong> <span className="muted">Session trials publish one objective value and a metric set each, not an equity or IC time series, so no overlaid curve can be drawn.</span></li>
          <li><strong>Live queue and parallel workers.</strong> <span className="muted">Trials are recorded after they finish; there is no queued or running state in the payload.</span></li>
          <li><strong>Apply best parameters.</strong> <span className="muted">Studio is read-only here. Selecting a trial is a recorded Session step, not a button.</span></li>
        </ul>
      </Section>
    </div>
  )
}

export function TuningPage({ workspace, id, go }: { workspace: WorkspaceSummary | null; id?: string; go: (href: string) => void }) {
  return id ? <Detail workspace={workspace} id={id} go={go} /> : <Index workspace={workspace} go={go} />
}
