import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, getJson, type ProjectResponse, type ProjectSnapshot, type RunRow, type StudyRow } from '../api'
import { Glyph } from '../design/icons'
import { num, plural, when } from '../format'
import { Notice } from '../Notice'
import { routeHref } from '../route'
import { verification } from '../shell/Rail'

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; project: ProjectSnapshot }

/**
 * One Project's verified snapshot. The page keeps the last data while a refresh is in flight.
 * The shell's first workspace response is only a baseline: it must not re-request a Project the
 * page is already loading, so only later ticks refresh. Repeat requests revalidate with the
 * server's ETag, so an unchanged Project costs a 304.
 */
export function useProject(id: string, tick: Date | null): Load {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const controller = useRef<AbortController | null>(null)
  const lastTick = useRef<Date | null>(tick)

  const fetchProject = useCallback((projectId: string) => {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    getJson<ProjectResponse>(`/api/v1/project?id=${encodeURIComponent(projectId)}`, next.signal)
      .then((body) => {
        const project = body.projects[0]
        setLoad(project ? { state: 'ready', project } : { state: 'error', message: `Unknown Project: ${projectId}` })
      })
      .catch((reason: unknown) => {
        if (next.signal.aborted) return
        const message = reason instanceof ApiError || reason instanceof Error ? reason.message : String(reason)
        setLoad((prev) => (prev.state === 'ready' ? prev : { state: 'error', message }))
      })
  }, [])

  useEffect(() => {
    setLoad({ state: 'loading' })
    if (!id) return
    lastTick.current = tick
    fetchProject(id)
    return () => controller.current?.abort()
    // tick is read only to seed the baseline for this Project id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fetchProject])

  useEffect(() => {
    if (!id || tick === lastTick.current) return
    const first = lastTick.current === null
    lastTick.current = tick
    if (!first) fetchProject(id)
  }, [id, tick, fetchProject])

  return load
}

const STATUS_GLYPH: Record<string, 'supported' | 'error' | 'running' | 'empty'> = {
  succeeded: 'supported',
  failed: 'error',
  running: 'running',
}

function latestRunByStudy(runs: RunRow[]): Map<string, RunRow> {
  const latest = new Map<string, RunRow>()
  for (const run of runs) {
    const seen = latest.get(run.studyId)
    if (!seen || run.startedAt > seen.startedAt) latest.set(run.studyId, run)
  }
  return latest
}

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section className="sec" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}

const OTHER_LANES: { key: keyof ProjectSnapshot; name: string }[] = [
  { key: 'portfolioExplorer', name: 'Portfolio decision explorer' },
  { key: 'rlExplorer', name: 'Governed RL policy' },
  { key: 'bookRiskExplorer', name: 'Book risk' },
  { key: 'eventStudyExplorer', name: 'Price event study' },
  { key: 'bookPathStressExplorer', name: 'Reported-book path stress' },
  { key: 'allocationExplorer', name: 'Strategic allocation' },
]

export function ProjectPage({ project }: { project: ProjectSnapshot }) {
  const look = verification(project.valid)
  const brief = project.agentWorkBrief
  const counts = project.counts
  const n = (key: string) => (typeof counts[key] === 'number' ? (counts[key] as number) : 0)
  const latest = latestRunByStudy(project.runs)
  const validation = project.factorExplorer?.summary?.validation
  const holdout = project.externalHoldout
  return (
    <div className="pg">
      <header className="pg-head">
        <h1 translate="no">{project.name}</h1>
        <p className="muted small">
          <span className="state">
            <Glyph kind={look.glyph} signal={look.signal} />
            <span className={look.signal ? 'sig' : undefined}>{look.word}</span>
          </span>
          {' · '}
          {plural(project.studies.length, 'Study', 'Studies')} · {plural(project.runs.length, 'Run')} · {plural(n('sessions'), 'Session')} ·{' '}
          {plural(n('reports'), 'Report')}
        </p>
        {project.description && <p className="lede">{project.description}</p>}
      </header>

      {project.diagnostics.length > 0 && (
        <Notice kind="error" label="Error" title="Project diagnostics." subtitle={project.diagnostics.map((d) => d.message ?? '').join('; ')} />
      )}

      <Section title="Next move" id="sec-next">
        {brief?.primaryAction?.description ? (
          <>
            <p>{brief.primaryAction.description}</p>
            {brief.primaryAction.display && <pre className="cmd mono" translate="no">{brief.primaryAction.display}</pre>}
            <p className="muted small">
              {brief.focus?.laneName && <>Lane {brief.focus.laneName}. </>}
              {brief.focus?.scientificStage && <>Stage {brief.focus.scientificStage}. </>}
              {brief.authority && (
                <>
                  Selection uses the {brief.authority.selectionSplit} split; the test split is{' '}
                  {brief.authority.testEntersSelection ? 'part of' : 'never part of'} selection. Trading authority: {brief.authority.tradingAuthority}.
                </>
              )}
            </p>
          </>
        ) : (
          <p className="muted">The Agent Work Brief has no recommended action for this Project.</p>
        )}
      </Section>

      <Section title="Studies" id="sec-studies">
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Study</th>
                <th scope="col">Subject</th>
                <th scope="col">Primary metric</th>
                <th scope="col">Latest Run</th>
                <th scope="col" className="r">Primary value</th>
              </tr>
            </thead>
            <tbody>
              {project.studies.map((study: StudyRow) => {
                const run = latest.get(study.id)
                return (
                  <tr key={study.id}>
                    <th scope="row">
                      {study.name}
                      <span className="faint small mono" translate="no">{study.id}</span>
                    </th>
                    <td>{study.subjectKind}</td>
                    <td className="mono">{study.primaryMetric} ({study.direction})</td>
                    <td>
                      {run ? (
                        <span className="state">
                          <Glyph kind={STATUS_GLYPH[run.status] ?? 'empty'} signal={run.status === 'failed'} />
                          <span>{run.status}</span>
                          <span className="faint mono small">{when(run.startedAt)}</span>
                        </span>
                      ) : (
                        <span className="faint">No Run yet</span>
                      )}
                    </td>
                    <td className="r num mono">{run ? num(run.primaryValue, 4) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">Primary values are the Study's selection-split metric. Test and holdout numbers are not drawn here.</p>
      </Section>

      <Section title="Factor evidence (validation split)" id="sec-factor">
        {validation ? (
          <dl className="stats">
            <div>
              <dt>Mean rank IC</dt>
              <dd className="mono">{num(validation.meanRankIc, 4)}</dd>
            </div>
            <div>
              <dt>Rank ICIR</dt>
              <dd className="mono">{num(validation.rankIcir, 3)}</dd>
            </div>
            <div>
              <dt>HAC normal p</dt>
              <dd className="mono">{num(validation.hacNormalPValue, 3)}</dd>
            </div>
            <div>
              <dt>Observations</dt>
              <dd className="mono">
                {validation.observations}
                {!validation.sufficient && <span className="sig"> · below minimum</span>}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="muted">No verified Factor Run yet.</p>
        )}
        {project.factorExplorer && (
          <p className="small">
            <a href={routeHref({ view: 'factor', id: project.id, study: project.factorExplorer.run.studyId })}>Open Factor evidence</a>
            <span className="muted"> · IC by horizon and split, IC over time, quantiles, noise frontier and the check ledger.</span>
          </p>
        )}
      </Section>

      <Section title="Sessions" id="sec-sessions">
        {project.sessions.length === 0 ? (
          <p className="muted">No Research Sessions yet.</p>
        ) : (
          <ul className="plain">
            {project.sessions.map((s, index) => (
              <li key={s.id ?? index} className="mono small" translate="no">
                {s.id ?? 'session'} · {s.studyId ?? '—'} · {s.status ?? '—'}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent activity" id="sec-timeline">
        {project.timeline.length === 0 ? (
          <p className="muted">No Runs, Sessions or Reports yet.</p>
        ) : (
          <ol className="timeline">
            {project.timeline.slice(0, 12).map((row) => (
              <li key={`${row.kind}/${row.id}`}>
                <span className="mono faint small">{when(row.at)}</span>
                <span className="kind">{row.kind}</span>
                <span className="trunc" translate="no">{row.title}</span>
                <span className="mono small">{row.value === null ? row.status : `${row.status} · ${num(row.value, 3)}`}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="External holdout" id="sec-holdout">
        <p>{holdout ? `Recorded: ${holdout.status ?? holdout.state ?? 'present'}. Details stay in the legacy Studio.` : 'No external holdout has been run for this Project.'}</p>
      </Section>

      <Section title="Other lanes" id="sec-lanes">
        <p className="muted small">Lanes still marked legacy are drawn by the fallback Studio from the same verified snapshot.</p>
        <ul className="plain">
          {OTHER_LANES.map((lane) => (
            <li key={lane.key} className="lane">
              <span>{lane.name}</span>
              {lane.key === 'eventStudyExplorer' && project.eventStudyExplorer ? (
                <a href={routeHref({ view: 'event-study', id: project.id })}>Open event study</a>
              ) : project[lane.key] ? (
                <a href="/legacy">Open in legacy Studio</a>
              ) : (
                <span className="faint">No evidence in this Project</span>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
